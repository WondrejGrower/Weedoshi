import type { Event as NostrEvent, UnsignedEvent, Filter } from 'nostr-tools';
import { SimplePool, finalizeEvent } from 'nostr-tools';
import type { AuthState } from './authManager';
import type { Diary, DiaryItemRef } from './diaryStore';
import type { GrowmiesState } from './growmiesStore';

const DIARY_KIND = 30078;
const GROWMIES_KIND = 30000;

interface BrowserSigner {
  getPublicKey?: () => Promise<string>;
  signEvent?: (event: UnsignedEvent) => Promise<NostrEvent>;
}

export interface RemoteDiary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  items: DiaryItemRef[];
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Invalid private key for signing');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function signUnsignedEvent(unsignedEvent: UnsignedEvent, authState: AuthState): Promise<NostrEvent> {
  if (authState.method === 'nsec' && authState.privkey) {
    return finalizeEvent(unsignedEvent, hexToBytes(authState.privkey));
  }

  if (authState.method === 'signer' && typeof window !== 'undefined') {
    const signer = (window as unknown as { nostr?: BrowserSigner }).nostr;
    if (signer && typeof signer.signEvent === 'function') {
      return await signer.signEvent(unsignedEvent);
    }
  }

  throw new Error('No signing method available');
}

function buildDiaryUnsignedEvent(diary: Diary, pubkey: string): UnsignedEvent {
  const tags: string[][] = [
    ['d', `diary-${diary.id}`],
    ['title', diary.title],
    ['t', 'weedoshi-diary'],
  ];

  for (const item of diary.items) {
    tags.push(['e', item.eventId]);
  }

  const content = JSON.stringify({
    id: diary.id,
    title: diary.title,
    updatedAt: diary.updatedAt,
    createdAt: diary.createdAt,
    items: diary.items,
  });

  return {
    kind: DIARY_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    pubkey,
  };
}

function buildGrowmiesUnsignedEvent(state: GrowmiesState, pubkey: string): UnsignedEvent {
  const tags: string[][] = [
    ['d', 'growmies'],
    ['title', state.title],
    ['t', 'weedoshi-growmies'],
  ];

  for (const author of state.authors) {
    tags.push(['p', author]);
  }

  return {
    kind: GROWMIES_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify({
      title: state.title,
      updatedAt: state.updatedAt,
    }),
    pubkey,
  };
}

export async function publishPublicDiary(diary: Diary, authState: AuthState, relayUrls: string[]): Promise<void> {
  if (!authState.pubkey) {
    throw new Error('Login required to publish diary');
  }
  if (relayUrls.length === 0) {
    throw new Error('No relays configured');
  }

  const pool = new SimplePool();
  const signed = await signUnsignedEvent(buildDiaryUnsignedEvent(diary, authState.pubkey), authState);

  const results = await Promise.allSettled(pool.publish(relayUrls, signed));
  const ok = results.some((item) => item.status === 'fulfilled');
  pool.close(relayUrls);
  if (!ok) {
    throw new Error('Failed to publish diary to relays');
  }
}

export async function fetchPublicDiaries(pubkey: string, relayUrls: string[]): Promise<RemoteDiary[]> {
  if (!pubkey || relayUrls.length === 0) return [];

  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [DIARY_KIND],
    authors: [pubkey],
    '#t': ['weedoshi-diary'],
    limit: 50,
  };

  try {
    const events = await pool.querySync(relayUrls, filter, {
      maxWait: 6000,
      label: 'fetch-public-diaries',
    });

    const latestByDiary = new Map<string, NostrEvent>();
    for (const event of events) {
      const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] || '';
      const diaryId = dTag.replace(/^diary-/, '').trim();
      if (!diaryId) continue;
      const current = latestByDiary.get(diaryId);
      if (!current || current.created_at < event.created_at) {
        latestByDiary.set(diaryId, event);
      }
    }

    const remote: RemoteDiary[] = [];
    for (const [id, event] of latestByDiary) {
      try {
        const parsed = JSON.parse(event.content || '{}') as {
          title?: string;
          createdAt?: number;
          updatedAt?: number;
          items?: DiaryItemRef[];
        };

        const eTags = event.tags.filter((tag) => tag[0] === 'e' && typeof tag[1] === 'string').map((tag) => tag[1]);
        const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
        const itemMap = new Map(parsedItems.map((item) => [item.eventId, item]));
        for (const idTag of eTags) {
          if (!itemMap.has(idTag)) {
            itemMap.set(idTag, {
              eventId: idTag,
              authorPubkey: pubkey,
              createdAt: event.created_at,
              addedAt: event.created_at,
              contentPreview: '',
            });
          }
        }

        remote.push({
          id,
          title: parsed.title?.trim() || id,
          createdAt: parsed.createdAt || event.created_at,
          updatedAt: parsed.updatedAt || event.created_at,
          isPublic: true,
          items: Array.from(itemMap.values()),
        });
      } catch {
        continue;
      }
    }

    return remote;
  } finally {
    pool.close(relayUrls);
  }
}

export async function publishGrowmiesList(state: GrowmiesState, authState: AuthState, relayUrls: string[]): Promise<void> {
  if (!authState.pubkey) {
    throw new Error('Login required to publish Growmies');
  }
  if (relayUrls.length === 0) {
    throw new Error('No relays configured');
  }

  const pool = new SimplePool();
  const signed = await signUnsignedEvent(buildGrowmiesUnsignedEvent(state, authState.pubkey), authState);
  const results = await Promise.allSettled(pool.publish(relayUrls, signed));
  const ok = results.some((item) => item.status === 'fulfilled');
  pool.close(relayUrls);

  if (!ok) {
    throw new Error('Failed to publish Growmies list');
  }
}

export async function fetchGrowmiesList(pubkey: string, relayUrls: string[]): Promise<{ authors: string[] } | null> {
  if (!pubkey || relayUrls.length === 0) return null;

  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [GROWMIES_KIND],
    authors: [pubkey],
    '#d': ['growmies'],
    limit: 10,
  };

  try {
    const events = await pool.querySync(relayUrls, filter, {
      maxWait: 5000,
      label: 'fetch-growmies',
    });

    const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
    if (!latest) return null;

    const authors = latest.tags
      .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string')
      .map((tag) => tag[1]);

    return {
      authors: Array.from(new Set(authors)),
    };
  } finally {
    pool.close(relayUrls);
  }
}

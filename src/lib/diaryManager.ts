import type { Event, Filter, UnsignedEvent } from 'nostr-tools';
import { SimplePool, finalizeEvent } from 'nostr-tools';
import { diagnostics } from './diagnostics';
import { assertNoSensitiveMaterial } from './securityBaseline';
import { requireAtLeastOneSuccess } from './networkResult';

export const DIARY_INDEX_KIND = 30078;

export type DiaryEntry = {
  id: string;
  chapter: string;
  addedAt: number;
};

export type DiaryChapter = {
  key: string;
  label: string;
};

export type DiaryIndex = {
  version: number;
  diaryId: string;
  title?: string;
  defaultRelayHints?: string[];
  chapters: DiaryChapter[];
  entries: DiaryEntry[];
};

export type DiarySigner =
  | {
      type: 'nsec';
      secretKey: Uint8Array;
    }
  | {
      type: 'nip07';
      signEvent: (event: UnsignedEvent) => Promise<Event>;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid private key hex format');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getTagValue(tags: string[][], key: string): string | undefined {
  const tag = tags.find((t) => t[0] === key && typeof t[1] === 'string');
  return tag?.[1];
}

export function parseDiaryIndexEvent(event: Event): DiaryIndex | null {
  try {
    if (event.kind !== DIARY_INDEX_KIND) return null;
    const parsed = JSON.parse(event.content);
    if (!isObject(parsed)) return null;

    const version = parsed.version;
    const diaryId = parsed.diaryId;
    const chapters = parsed.chapters;
    const entries = parsed.entries;

    if (version !== 1) return null;
    if (typeof diaryId !== 'string' || diaryId.trim().length === 0) return null;
    if (!Array.isArray(chapters) || !Array.isArray(entries)) return null;

    const normalizedChapters: DiaryChapter[] = chapters
      .filter((chapter) => isObject(chapter) && typeof chapter.key === 'string' && typeof chapter.label === 'string')
      .map((chapter) => ({
        key: String(chapter.key),
        label: String(chapter.label),
      }));

    const normalizedEntries: DiaryEntry[] = entries
      .filter(
        (entry) =>
          isObject(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.chapter === 'string' &&
          typeof entry.addedAt === 'number'
      )
      .map((entry) => ({
        id: String(entry.id),
        chapter: String(entry.chapter),
        addedAt: Number(entry.addedAt),
      }));

    return {
      version: 1,
      diaryId,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      defaultRelayHints: Array.isArray(parsed.defaultRelayHints)
        ? parsed.defaultRelayHints.filter((relay) => typeof relay === 'string')
        : undefined,
      chapters: normalizedChapters,
      entries: normalizedEntries,
    };
  } catch {
    return null;
  }
}

export function buildDiaryIndexEvent(diaryIndex: DiaryIndex, pubkey: string): UnsignedEvent {
  const title = diaryIndex.title?.trim();
  if (title) {
    assertNoSensitiveMaterial(title, 'diary.title');
  }
  const tags: string[][] = [
    ['d', diaryIndex.diaryId],
    ['t', 'weedoshi'],
  ];

  if (title) {
    tags.push(['title', title]);
  }

  return {
    kind: DIARY_INDEX_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify(diaryIndex),
  };
}

export async function publishDiaryIndexEvent(
  event: UnsignedEvent,
  signer: DiarySigner,
  relays: string[],
  pool?: SimplePool
): Promise<Event> {
  if (relays.length === 0) {
    throw new Error('No relays configured for publish');
  }

  const localPool = pool ?? new SimplePool();

  let signed: Event;
  if (signer.type === 'nip07') {
    signed = await signer.signEvent(event);
  } else {
    signed = finalizeEvent(event, signer.secretKey as any) as Event;
  }

  await requireAtLeastOneSuccess(
    localPool.publish(relays, signed as any),
    'Failed to publish diary index to relays'
  );
  diagnostics.log(`Published diary index ${event.kind}:${getTagValue(event.tags, 'd') || 'unknown'}`, 'info');
  return signed;
}

export function defaultDiaryId(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `run-${year}-${month}`;
}

async function fetchEvents(
  pool: SimplePool,
  relayUrls: string[],
  filters: Filter[],
  timeoutMs: number = 3000
): Promise<Event[]> {
  return await new Promise<Event[]>((resolve) => {
    const collected = new Map<string, Event>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Array.from(collected.values()));
    };

    const sub = pool.subscribeMany(relayUrls, filters as any, {
      onevent(event: Event) {
        collected.set(event.id, event);
      },
      oneose() {
        finish();
        sub.close();
      },
    });

    setTimeout(() => {
      finish();
      sub.close();
    }, timeoutMs);
  });
}

export async function getLatestDiaryIndex(
  pool: SimplePool,
  relayUrls: string[],
  pubkey: string,
  diaryId?: string
): Promise<{ event: Event; index: DiaryIndex } | null> {
  if (!pubkey || relayUrls.length === 0) {
    return null;
  }

  const filter: Filter = diaryId
    ? { kinds: [DIARY_INDEX_KIND], authors: [pubkey], '#d': [diaryId], limit: 20 }
    : { kinds: [DIARY_INDEX_KIND], authors: [pubkey], '#t': ['weedoshi'], limit: 50 };

  const events = await fetchEvents(pool, relayUrls, [filter], 3500);
  const parsed = events
    .map((event) => ({ event, index: parseDiaryIndexEvent(event) }))
    .filter((item): item is { event: Event; index: DiaryIndex } => item.index !== null)
    .sort((a, b) => b.event.created_at - a.event.created_at);

  return parsed[0] ?? null;
}

export async function fetchEventsByIds(
  pool: SimplePool,
  relayUrls: string[],
  ids: string[]
): Promise<Map<string, Event>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const events = await fetchEvents(pool, relayUrls, [{ ids: uniqueIds, limit: uniqueIds.length * 2 }], 3500);
  const byId = new Map<string, Event>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return byId;
}

export async function fetchAuthorNotes(
  pool: SimplePool,
  relayUrls: string[],
  pubkey: string,
  limit: number = 100
): Promise<Event[]> {
  if (!pubkey || relayUrls.length === 0) return [];

  const filter: Filter = {
    // kind 1 = text notes, kind 20 = image/media posts (NIP-68)
    kinds: [1, 20],
    authors: [pubkey],
    limit,
  };

  try {
    const events = await pool.querySync(relayUrls, filter as any, {
      maxWait: 10000,
      label: 'author-notes',
    });

    return events.sort((a, b) => b.created_at - a.created_at);
  } catch {
    return [];
  }
}

export function nsecHexToSigner(privkeyHex: string): DiarySigner {
  return {
    type: 'nsec',
    secretKey: hexToBytes(privkeyHex),
  };
}

export class DiaryManager {
  private pool: SimplePool;

  constructor() {
    this.pool = new SimplePool();
  }

  getPool(): SimplePool {
    return this.pool;
  }

  close(relays: string[]): void {
    this.pool.close(relays);
  }
}

export const diaryManager = new DiaryManager();

import type { Event as NostrEvent, UnsignedEvent, Filter } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';
import type { AuthState } from './authManager';
import type { Diary, DiaryItemRef } from './diaryStore';
import type { GrowmiesState } from './growmiesStore';
import { requireAtLeastOneSuccess } from './networkResult';
import { assertNoSensitiveMaterial } from './securityBaseline';
import { LocalSigner } from './signers/localSigner';
import { ensureSignerBoundIdentity, getDefaultSigner, setLocalSignerPrivkey } from './signers/signerManager';
import type { Signer } from './signers/types';
import { eventValidator } from './eventValidator';
import { decodeCustomPlantSlug, encodeCustomPlantSlug, getPlantBySlug } from './plants/catalog';

const DIARY_KIND = 30078;
const GROWMIES_KIND = 30000;

export interface RemoteDiary {
  id: string;
  title: string;
  plant?: string;
  plantSlug?: string;
  species?: string;
  cultivar?: string;
  breeder?: string;
  plantWikiAPointer?: string;
  phase?: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  items: DiaryItemRef[];
}

async function signUnsignedEvent(unsignedEvent: UnsignedEvent, authState: AuthState): Promise<NostrEvent> {
  let signer: Signer;

  if (authState.method === 'nsec' && authState.privkey) {
    signer = new LocalSigner(authState.privkey);
  } else {
    setLocalSignerPrivkey(null);
    signer = getDefaultSigner();
  }

  const available = await signer.isAvailable();
  if (!available) {
    throw new Error('No signing method available');
  }

  const signerPubkey = await ensureSignerBoundIdentity(signer);
  if (authState.pubkey && authState.method === 'signer' && authState.pubkey !== signerPubkey) {
    throw new Error('Signer identity mismatch with authenticated user');
  }

  const toSign: UnsignedEvent & { id?: string; sig?: string } = {
    ...unsignedEvent,
    pubkey: signerPubkey,
  };

  const signed = await signer.signEvent(toSign);
  if (!signed?.id || !signed?.sig) {
    throw new Error('Signer returned invalid signed event');
  }

  return signed as NostrEvent;
}

function buildDiaryUnsignedEvent(diary: Diary, pubkey: string): UnsignedEvent {
  assertNoSensitiveMaterial(diary.title, 'diary.title');
  if (diary.plant) assertNoSensitiveMaterial(diary.plant, 'diary.plant');
  if (diary.cultivar) assertNoSensitiveMaterial(diary.cultivar, 'diary.cultivar');
  if (diary.breeder) assertNoSensitiveMaterial(diary.breeder, 'diary.breeder');

  const tags: string[][] = [
    ['d', `diary-${diary.id}`],
    ['title', diary.title],
    ['t', 'weedoshi-diary'],
  ];

  const plantSlug = diary.plantSlug || (diary.plant ? encodeCustomPlantSlug(diary.plant) : undefined);
  if (plantSlug) {
    tags.push(['plant', plantSlug]);
  }
  if (diary.species) {
    tags.push(['species', diary.species]);
  }
  if (diary.cultivar) {
    tags.push(['cultivar', diary.cultivar]);
  }
  if (diary.breeder) {
    tags.push(['breeder', diary.breeder]);
  }
  if (diary.plantWikiAPointer) {
    tags.push(['a', diary.plantWikiAPointer]);
  }

  for (const item of diary.items) {
    tags.push(['e', item.eventId]);
  }

  const content = JSON.stringify({
    id: diary.id,
    title: diary.title,
    plant: diary.plant,
    phase: diary.phase,
    coverImage: diary.coverImage,
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
  assertNoSensitiveMaterial(state.title, 'growmies.title');

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

  await requireAtLeastOneSuccess(pool.publish(relayUrls, signed), 'Failed to publish diary to relays');
  pool.close(relayUrls);
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
    const validEvents = events.filter((event) => eventValidator.validateEvent(event));

    const latestByDiary = new Map<string, NostrEvent>();
    for (const event of validEvents) {
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
        const getTagValue = (key: string): string | undefined => {
          const tag = event.tags.find((entry) => entry[0] === key && typeof entry[1] === 'string');
          return tag?.[1]?.trim() || undefined;
        };
        const plantSlugFromTag = getTagValue('plant');
        const speciesFromTag = getTagValue('species');
        const customPlant = plantSlugFromTag ? decodeCustomPlantSlug(plantSlugFromTag) : null;
        const catalogPlant = plantSlugFromTag ? getPlantBySlug(plantSlugFromTag)?.latin : undefined;
        const parsed = JSON.parse(event.content || '{}') as {
          title?: string;
          plant?: string;
          plantSlug?: string;
          species?: string;
          cultivar?: string;
          breeder?: string;
          plantWikiAPointer?: string;
          phase?: string;
          coverImage?: string;
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
          plant:
            (typeof parsed.plant === 'string' ? parsed.plant.trim() || undefined : undefined) ||
            customPlant ||
            catalogPlant ||
            speciesFromTag,
          plantSlug:
            plantSlugFromTag ||
            (typeof parsed.plantSlug === 'string' ? parsed.plantSlug.trim() || undefined : undefined),
          species:
            speciesFromTag ||
            (typeof parsed.species === 'string' ? parsed.species.trim() || undefined : undefined),
          cultivar:
            getTagValue('cultivar') ||
            (typeof parsed.cultivar === 'string' ? parsed.cultivar.trim() || undefined : undefined),
          breeder:
            getTagValue('breeder') ||
            (typeof parsed.breeder === 'string' ? parsed.breeder.trim() || undefined : undefined),
          plantWikiAPointer:
            getTagValue('a') ||
            (typeof parsed.plantWikiAPointer === 'string' ? parsed.plantWikiAPointer.trim() || undefined : undefined),
          phase: typeof parsed.phase === 'string' ? parsed.phase.trim() || undefined : undefined,
          coverImage: typeof parsed.coverImage === 'string' ? parsed.coverImage.trim() || undefined : undefined,
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
  await requireAtLeastOneSuccess(pool.publish(relayUrls, signed), 'Failed to publish Growmies list');
  pool.close(relayUrls);
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
    const validEvents = events.filter((event) => eventValidator.validateEvent(event));

    const latest = validEvents.sort((a, b) => b.created_at - a.created_at)[0];
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

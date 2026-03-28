import type { Event as NostrEvent, UnsignedEvent, Filter } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';
import type { AuthState } from './authManager';
import type { Diary, DiaryItemRef } from './diaryStore';
import type { GrowmiesState } from './growmiesStore';
import { publishWithDiagnostics, type PublishSummary } from './networkResult';
import { assertNoSensitiveMaterial } from './securityBaseline';
import { LocalSigner } from './signers/localSigner';
import { ensureSignerBoundIdentity, getDefaultSigner, setLocalSignerPrivkey } from './signers/signerManager';
import type { Signer } from './signers/types';
import { eventValidator } from './eventValidator';
import { decodeCustomPlantSlug, encodeCustomPlantSlug, getPlantBySlug } from './plants/catalog';
import { extractMediaFromContent, parseMediaFromEventTags } from './mediaExtraction';
import { diagnostics } from './diagnostics';

const DIARY_KIND = 30078;
const GROWMIES_KIND = 30000;

function logPublishSummary(summary: PublishSummary, label: string) {
  const successCount = summary.successCount;
  const failureCount = summary.failureCount;
  const total = successCount + failureCount;

  diagnostics.log(`${label}: ${successCount}/${total} relays accepted`, successCount > 0 ? 'info' : 'error');

  summary.diagnostics.forEach(d => {
    if (!d.success && d.message) {
      const prefix = d.prefix ? ` [${d.prefix}]` : '';
      diagnostics.log(`Relay ${d.relay} rejected:${prefix} ${d.message}`, 'warn');
    }
  });
}

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

function isValidImageUrl(value?: string): value is string {
  if (typeof value !== 'string') return false;
  return /^https?:\/\//i.test(value.trim());
}

function firstItemImage(item: DiaryItemRef): string | undefined {
  if (isValidImageUrl(item.image)) return item.image.trim();
  if (Array.isArray(item.mediaUrls)) {
    for (const media of item.mediaUrls) {
      if (isValidImageUrl(media)) return media.trim();
    }
  }
  if (typeof item.contentPreview === 'string' && item.contentPreview.trim().length > 0) {
    const extracted = extractMediaFromContent(item.contentPreview);
    for (const image of extracted.images) {
      if (isValidImageUrl(image)) return image.trim();
    }
  }
  return undefined;
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
  try {
    const signed = await signUnsignedEvent(buildDiaryUnsignedEvent(diary, authState.pubkey), authState);
    const summary = await publishWithDiagnostics(
      pool.publish(relayUrls, signed),
      relayUrls,
      'Failed to publish diary to relays'
    );
    logPublishSummary(summary, `Publish Diary "${diary.title}"`);
  } finally {
    pool.close(relayUrls);
  }
}

export async function fetchPublicDiaries(pubkey: string, relayUrls: string[]): Promise<RemoteDiary[]> {
  if (!pubkey || relayUrls.length === 0) return [];

  const pool = new SimplePool();
  const filter: Filter = {
    kinds: [DIARY_KIND],
    authors: [pubkey],
    limit: 120,
  };

  try {
    const events = await pool.querySync(relayUrls, filter, {
      maxWait: 6000,
      label: 'fetch-public-diaries',
    });
    const validEvents = events.filter((event) => eventValidator.validateEvent(event));

    const latestByDiary = new Map<string, NostrEvent>();
    for (const event of validEvents) {
      const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1]?.trim() || '';
      const hasPublicDiaryTag = event.tags.some(
        (tag) => tag[0] === 't' && typeof tag[1] === 'string' && tag[1].toLowerCase() === 'weedoshi-diary'
      );
      const hasLegacyDiaryTag = event.tags.some(
        (tag) => tag[0] === 't' && typeof tag[1] === 'string' && tag[1].toLowerCase() === 'weedoshi'
      );
      const isDiaryPrefixedDTag = dTag.toLowerCase().startsWith('diary-');
      if (!hasPublicDiaryTag && !hasLegacyDiaryTag && !isDiaryPrefixedDTag) continue;

      const diaryId = (isDiaryPrefixedDTag ? dTag.replace(/^diary-/i, '') : dTag).trim();
      if (!diaryId) continue;
      const current = latestByDiary.get(diaryId);
      if (!current || current.created_at < event.created_at) {
        latestByDiary.set(diaryId, event);
      }
    }

    const remote: RemoteDiary[] = [];
    const unresolvedEventIds = new Set<string>();
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
        const legacyEntries = Array.isArray((parsed as { entries?: unknown[] }).entries)
          ? ((parsed as { entries?: unknown[] }).entries as unknown[])
          : [];
        const normalizedParsedItems: DiaryItemRef[] = parsedItems
          .filter((item): item is DiaryItemRef => Boolean(item && typeof item.eventId === 'string' && item.eventId.trim().length > 0))
          .map((item) => {
            const mediaUrls = Array.isArray(item.mediaUrls)
              ? item.mediaUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
              : undefined;
            return {
              eventId: item.eventId,
              authorPubkey: item.authorPubkey || pubkey,
              createdAt: typeof item.createdAt === 'number' ? item.createdAt : event.created_at,
              addedAt: typeof item.addedAt === 'number' ? item.addedAt : event.created_at,
              contentPreview: typeof item.contentPreview === 'string' ? item.contentPreview : '',
              image: typeof item.image === 'string' ? item.image : undefined,
              mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
              phaseLabel: typeof item.phaseLabel === 'string' ? item.phaseLabel : undefined,
            };
          });
        if (normalizedParsedItems.length === 0 && legacyEntries.length > 0) {
          for (const entry of legacyEntries) {
            if (!entry || typeof entry !== 'object') continue;
            const candidate = entry as { id?: unknown; addedAt?: unknown; chapter?: unknown };
            if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) continue;
            normalizedParsedItems.push({
              eventId: candidate.id.trim(),
              authorPubkey: pubkey,
              createdAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : event.created_at,
              addedAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : event.created_at,
              contentPreview: '',
              phaseLabel: typeof candidate.chapter === 'string' ? candidate.chapter : undefined,
            });
          }
        }
        const itemMap = new Map(normalizedParsedItems.map((item) => [item.eventId, item]));
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
        for (const ref of itemMap.values()) {
          if (!firstItemImage(ref)) {
            unresolvedEventIds.add(ref.eventId);
          }
        }

        remote.push({
          id,
          title: parsed.title?.trim() || getTagValue('title') || id,
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
          coverImage: isValidImageUrl(parsed.coverImage) ? parsed.coverImage.trim() : undefined,
          createdAt: parsed.createdAt || event.created_at,
          updatedAt: parsed.updatedAt || event.created_at,
          isPublic: true,
          items: Array.from(itemMap.values()),
        });
      } catch {
        continue;
      }
    }

    if (unresolvedEventIds.size > 0) {
      const ids = Array.from(unresolvedEventIds);
      const mediaEvents = await pool.querySync(
        relayUrls,
        { ids, limit: Math.min(ids.length * 2, 400) },
        { maxWait: 5000, label: 'fetch-diary-item-media' }
      );
      const byId = new Map(
        mediaEvents
          .filter((event) => eventValidator.validateEvent(event))
          .map((event) => [event.id, event] as const)
      );

      for (const diary of remote) {
        for (const item of diary.items) {
          if (firstItemImage(item)) continue;
          const source = byId.get(item.eventId);
          if (!source) continue;
          const tagMedia = parseMediaFromEventTags(source);
          const textMedia = extractMediaFromContent(source.content || '');
          const mergedMedia = Array.from(
            new Set([...tagMedia.images, ...tagMedia.videos, ...textMedia.images, ...textMedia.videos])
          );
          if (!item.contentPreview && source.content) {
            item.contentPreview = source.content;
          }
          if (!item.image) {
            item.image = tagMedia.images[0] || textMedia.images[0];
          }
          if ((!item.mediaUrls || item.mediaUrls.length === 0) && mergedMedia.length > 0) {
            item.mediaUrls = mergedMedia;
          }
        }

        if (!isValidImageUrl(diary.coverImage)) {
          for (const item of diary.items) {
            const image = firstItemImage(item);
            if (image) {
              diary.coverImage = image;
              break;
            }
          }
        }
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
  try {
    const signed = await signUnsignedEvent(buildGrowmiesUnsignedEvent(state, authState.pubkey), authState);
    const summary = await publishWithDiagnostics(
      pool.publish(relayUrls, signed),
      relayUrls,
      'Failed to publish Growmies list'
    );
    logPublishSummary(summary, 'Publish Growmies');
  } finally {
    pool.close(relayUrls);
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

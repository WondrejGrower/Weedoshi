import { SimplePool } from 'nostr-tools';
import { getJson, setJson } from '../persistentStorage';
import { eventValidator } from '../eventValidator';
import { normalizePlantSlug } from './catalog';
const WIKI_KIND = 30818;
const CURATED_AUTHORS_KIND = 10101;
const CURATED_RELAYS_KIND = 10102;
const WIKI_CACHE_PREFIX = 'plant_wiki_cache_v1:';
const WIKI_TTL_MS = 24 * 60 * 60 * 1000;
function eventDTag(event) {
    const tag = event.tags.find((entry) => entry[0] === 'd' && typeof entry[1] === 'string');
    return (tag?.[1] || '').trim().toLowerCase();
}
function toAPointer(event, dTag) {
    return `${WIKI_KIND}:${event.pubkey}:${dTag}`;
}
async function collectWikiEventsBySlug(slug, relays, timeoutMs = 4500) {
    if (!slug || relays.length === 0)
        return [];
    const pool = new SimplePool();
    const normalized = normalizePlantSlug(slug);
    const filter = {
        kinds: [WIKI_KIND],
        '#d': [normalized],
        limit: 200,
    };
    const byId = new Map();
    try {
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                resolve();
            };
            const sub = pool.subscribeMany(relays, [filter], {
                onevent(event, relayUrl) {
                    if (!eventValidator.validateEvent(event))
                        return;
                    const dTag = eventDTag(event);
                    if (dTag !== normalized)
                        return;
                    byId.set(event.id, {
                        id: event.id,
                        pubkey: event.pubkey,
                        createdAt: event.created_at,
                        content: event.content || '',
                        dTag,
                        relayUrl,
                        tags: event.tags,
                        aPointer: toAPointer(event, dTag),
                    });
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
    finally {
        pool.close(relays);
    }
    return Array.from(byId.values());
}
async function fetchCuratorPreferences(relays, curatorPubkey) {
    if (!curatorPubkey || relays.length === 0) {
        return {
            preferredAuthors: new Set(),
            preferredRelays: new Set(),
        };
    }
    const pool = new SimplePool();
    const filters = [
        { kinds: [CURATED_AUTHORS_KIND], authors: [curatorPubkey], limit: 10 },
        { kinds: [CURATED_RELAYS_KIND], authors: [curatorPubkey], limit: 10 },
    ];
    try {
        const events = await pool.querySync(relays, filters, {
            maxWait: 3500,
            label: 'plant-wiki-curator-lists',
        });
        const valid = events.filter((event) => eventValidator.validateEvent(event));
        const newestByKind = new Map();
        for (const event of valid) {
            const current = newestByKind.get(event.kind);
            if (!current || event.created_at > current.created_at) {
                newestByKind.set(event.kind, event);
            }
        }
        const authorList = newestByKind.get(CURATED_AUTHORS_KIND);
        const relayList = newestByKind.get(CURATED_RELAYS_KIND);
        const preferredAuthors = new Set((authorList?.tags || [])
            .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string')
            .map((tag) => String(tag[1]).trim())
            .filter(Boolean));
        const preferredRelays = new Set((relayList?.tags || [])
            .filter((tag) => tag[0] === 'r' && typeof tag[1] === 'string')
            .map((tag) => String(tag[1]).trim())
            .filter(Boolean));
        return { preferredAuthors, preferredRelays };
    }
    catch {
        return {
            preferredAuthors: new Set(),
            preferredRelays: new Set(),
        };
    }
    finally {
        pool.close(relays);
    }
}
export function selectBestWikiArticle(articles, preferences) {
    if (articles.length === 0) {
        return {
            bestArticle: null,
            alternatives: [],
        };
    }
    const ranked = [...articles].sort((a, b) => {
        const aAuthor = preferences.preferredAuthors.has(a.pubkey) ? 1 : 0;
        const bAuthor = preferences.preferredAuthors.has(b.pubkey) ? 1 : 0;
        if (aAuthor !== bAuthor)
            return bAuthor - aAuthor;
        const aRelay = a.relayUrl && preferences.preferredRelays.has(a.relayUrl) ? 1 : 0;
        const bRelay = b.relayUrl && preferences.preferredRelays.has(b.relayUrl) ? 1 : 0;
        if (aRelay !== bRelay)
            return bRelay - aRelay;
        return b.createdAt - a.createdAt;
    });
    return {
        bestArticle: ranked[0],
        alternatives: ranked.slice(1),
    };
}
export async function fetchWikiArticlesBySlug(slug, relays, options) {
    const normalizedSlug = normalizePlantSlug(slug);
    if (!normalizedSlug || relays.length === 0) {
        return {
            bestArticle: null,
            alternatives: [],
        };
    }
    const [articles, preferences] = await Promise.all([
        collectWikiEventsBySlug(normalizedSlug, relays),
        fetchCuratorPreferences(relays, options?.curatorPubkey),
    ]);
    return selectBestWikiArticle(articles, preferences);
}
export async function getCachedWikiArticlesBySlug(slug) {
    const normalizedSlug = normalizePlantSlug(slug);
    if (!normalizedSlug)
        return null;
    const payload = await getJson(`${WIKI_CACHE_PREFIX}${normalizedSlug}`, null);
    if (!payload)
        return null;
    return payload.result;
}
export async function getWikiArticlesBySlugWithCache(slug, relays, options) {
    const normalizedSlug = normalizePlantSlug(slug);
    if (!normalizedSlug) {
        return {
            result: { bestArticle: null, alternatives: [] },
            fromCache: false,
        };
    }
    const cacheKey = `${WIKI_CACHE_PREFIX}${normalizedSlug}`;
    const payload = await getJson(cacheKey, null);
    const cacheFresh = payload && Date.now() - payload.cachedAt < WIKI_TTL_MS;
    if (!options?.forceRefresh && payload && cacheFresh) {
        return {
            result: payload.result,
            fromCache: true,
            cachedAt: payload.cachedAt,
        };
    }
    try {
        const result = await fetchWikiArticlesBySlug(normalizedSlug, relays, options);
        await setJson(cacheKey, {
            cachedAt: Date.now(),
            result,
        });
        return {
            result,
            fromCache: false,
            cachedAt: Date.now(),
        };
    }
    catch (error) {
        if (payload) {
            return {
                result: payload.result,
                fromCache: true,
                cachedAt: payload.cachedAt,
            };
        }
        throw error;
    }
}

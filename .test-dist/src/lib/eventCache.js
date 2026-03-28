import AsyncStorage from '@react-native-async-storage/async-storage';
import { diagnostics } from './diagnostics';
const CACHE_KEY_PREFIX = 'nostr_event_cache_';
const CACHE_METADATA_KEY = 'nostr_cache_metadata';
const CACHE_INDEX_KEY = 'nostr_cache_index';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Max events in cache
const FLUSH_DELAY_MS = 120;
/**
 * EventCache provides persistent caching of Nostr events
 * for offline support and faster app startup.
 */
export class EventCache {
    constructor(ttl = DEFAULT_TTL, maxSize = MAX_CACHE_SIZE) {
        Object.defineProperty(this, "memoryCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "ttl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "keyIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "pendingWrites", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "flushTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isFlushing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.ttl = ttl;
        this.maxSize = maxSize;
    }
    /**
     * Initialize cache - load from storage
     */
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            diagnostics.log('Initializing event cache...', 'info');
            await this.loadFromStorage();
            await this.cleanupOldEvents();
            this.isInitialized = true;
            diagnostics.log(`✅ Event cache initialized with ${this.memoryCache.size} events`, 'info');
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to initialize cache: ${error}`, 'warn');
        }
    }
    /**
     * Save an event to cache
     */
    async saveEvent(event, relayUrl) {
        const cached = {
            event,
            cachedAt: Date.now(),
            relayUrl,
        };
        this.memoryCache.set(event.id, cached);
        this.queueSet(`${CACHE_KEY_PREFIX}${event.id}`, JSON.stringify(cached));
        if (this.memoryCache.size > this.maxSize) {
            this.evictOldest();
        }
    }
    /**
     * Save multiple events at once
     */
    async saveEvents(events, relayUrl) {
        const now = Date.now();
        for (const event of events) {
            const cached = {
                event,
                cachedAt: now,
                relayUrl,
            };
            this.memoryCache.set(event.id, cached);
            this.queueSet(`${CACHE_KEY_PREFIX}${event.id}`, JSON.stringify(cached));
        }
        if (this.memoryCache.size > this.maxSize) {
            this.evictOldest();
        }
        await this.updateMetadata();
        diagnostics.log(`Cached ${events.length} events`, 'info');
    }
    /**
     * Get events matching a filter
     */
    async getEvents(filter) {
        await this.initialize();
        const results = [];
        const now = Date.now();
        for (const cached of this.memoryCache.values()) {
            if (now - cached.cachedAt > this.ttl) {
                continue;
            }
            const event = cached.event;
            if (filter.kinds && !filter.kinds.includes(event.kind)) {
                continue;
            }
            if (filter.authors && !filter.authors.includes(event.pubkey)) {
                continue;
            }
            if (filter['#t']) {
                const eventHashtags = event.tags
                    .filter((tag) => tag[0] === 't')
                    .map((tag) => tag[1]?.toLowerCase());
                const filterHashtags = filter['#t'].map((t) => t.toLowerCase());
                if (!filterHashtags.some((tag) => eventHashtags.includes(tag))) {
                    continue;
                }
            }
            if (filter.since && event.created_at < filter.since) {
                continue;
            }
            if (filter.until && event.created_at > filter.until) {
                continue;
            }
            results.push(event);
        }
        results.sort((a, b) => b.created_at - a.created_at);
        if (filter.limit && results.length > filter.limit) {
            return results.slice(0, filter.limit);
        }
        diagnostics.log(`Cache hit: ${results.length} events`, 'info');
        return results;
    }
    /**
     * Check if an event is in cache
     */
    has(eventId) {
        return this.memoryCache.has(eventId);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let validCount = 0;
        let expiredCount = 0;
        for (const cached of this.memoryCache.values()) {
            if (now - cached.cachedAt > this.ttl) {
                expiredCount++;
            }
            else {
                validCount++;
            }
        }
        return {
            totalEvents: this.memoryCache.size,
            validEvents: validCount,
            expiredEvents: expiredCount,
            maxSize: this.maxSize,
            ttlHours: this.ttl / (1000 * 60 * 60),
        };
    }
    /**
     * Clear all cached events
     */
    async clear() {
        this.memoryCache.clear();
        const keysToRemove = [...this.keyIndex, CACHE_METADATA_KEY, CACHE_INDEX_KEY];
        this.keyIndex.clear();
        this.pendingWrites.clear();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        try {
            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
            }
            diagnostics.log('✅ Event cache cleared', 'info');
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to clear cache: ${error}`, 'warn');
        }
    }
    /**
     * Remove old events beyond TTL
     */
    async cleanupOldEvents() {
        const now = Date.now();
        const expiredIds = [];
        for (const [id, cached] of this.memoryCache) {
            if (now - cached.cachedAt > this.ttl) {
                expiredIds.push(id);
            }
        }
        for (const id of expiredIds) {
            this.memoryCache.delete(id);
            this.queueRemove(`${CACHE_KEY_PREFIX}${id}`);
        }
        if (expiredIds.length > 0) {
            diagnostics.log(`Cleaned up ${expiredIds.length} expired events`, 'info');
            await this.updateMetadata();
        }
    }
    /**
     * Evict oldest events when cache is full
     */
    evictOldest() {
        const entries = Array.from(this.memoryCache.entries());
        entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
        const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1));
        for (const [id] of toRemove) {
            this.memoryCache.delete(id);
            this.queueRemove(`${CACHE_KEY_PREFIX}${id}`);
        }
        diagnostics.log(`Evicted ${toRemove.length} oldest events`, 'info');
    }
    queueSet(key, value) {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            this.keyIndex.add(key);
        }
        this.pendingWrites.set(key, value);
        this.scheduleFlush();
    }
    queueRemove(key) {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            this.keyIndex.delete(key);
        }
        this.pendingWrites.set(key, null);
        this.scheduleFlush();
    }
    scheduleFlush() {
        if (this.flushTimer) {
            return;
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushPendingWrites().catch((error) => {
                diagnostics.log(`⚠️ Failed to flush cache writes: ${error}`, 'warn');
            });
        }, FLUSH_DELAY_MS);
    }
    async flushPendingWrites() {
        if (this.isFlushing || this.pendingWrites.size === 0) {
            return;
        }
        this.isFlushing = true;
        try {
            while (this.pendingWrites.size > 0) {
                const snapshot = new Map(this.pendingWrites);
                this.pendingWrites.clear();
                const setOps = [];
                const removeOps = [];
                for (const [key, value] of snapshot.entries()) {
                    if (value === null) {
                        removeOps.push(key);
                    }
                    else {
                        setOps.push([key, value]);
                    }
                }
                if (setOps.length > 0) {
                    await Promise.all(setOps.map(([key, value]) => AsyncStorage.setItem(key, value)));
                }
                if (removeOps.length > 0) {
                    await AsyncStorage.multiRemove(removeOps);
                }
            }
            await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify([...this.keyIndex]));
        }
        finally {
            this.isFlushing = false;
            if (this.pendingWrites.size > 0) {
                this.scheduleFlush();
            }
        }
    }
    /**
     * Load all cached events from storage
     */
    async loadFromStorage() {
        try {
            const indexRaw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
            let cacheKeys = [];
            if (indexRaw) {
                try {
                    const parsed = JSON.parse(indexRaw);
                    if (Array.isArray(parsed)) {
                        cacheKeys = parsed.filter((key) => typeof key === 'string' && key.startsWith(CACHE_KEY_PREFIX));
                    }
                }
                catch {
                    cacheKeys = [];
                }
            }
            if (cacheKeys.length === 0) {
                const keys = await AsyncStorage.getAllKeys();
                cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
            }
            if (cacheKeys.length === 0) {
                this.keyIndex.clear();
                return;
            }
            this.keyIndex = new Set(cacheKeys);
            const items = await AsyncStorage.multiGet(cacheKeys);
            for (const [key, value] of items) {
                if (!value) {
                    this.keyIndex.delete(key);
                    continue;
                }
                try {
                    const cached = JSON.parse(value);
                    const eventId = key.replace(CACHE_KEY_PREFIX, '');
                    this.memoryCache.set(eventId, cached);
                }
                catch {
                    this.keyIndex.delete(key);
                }
            }
            await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify([...this.keyIndex]));
            diagnostics.log(`Loaded ${this.memoryCache.size} events from storage`, 'info');
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to load from storage: ${error}`, 'warn');
        }
    }
    /**
     * Update cache metadata
     */
    async updateMetadata() {
        try {
            const events = Array.from(this.memoryCache.values());
            if (events.length === 0) {
                this.queueRemove(CACHE_METADATA_KEY);
                return;
            }
            const timestamps = events.map((e) => e.event.created_at);
            const metadata = {
                totalEvents: events.length,
                oldestEventTime: Math.min(...timestamps),
                newestEventTime: Math.max(...timestamps),
                lastCleanup: Date.now(),
            };
            this.queueSet(CACHE_METADATA_KEY, JSON.stringify(metadata));
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to update metadata: ${error}`, 'warn');
        }
    }
}
// Singleton instance
export const eventCache = new EventCache();

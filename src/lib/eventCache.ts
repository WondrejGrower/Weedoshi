import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, Filter } from 'nostr-tools';
import { diagnostics } from './diagnostics';

const CACHE_KEY_PREFIX = 'nostr_event_cache_';
const CACHE_METADATA_KEY = 'nostr_cache_metadata';
const CACHE_INDEX_KEY = 'nostr_cache_index';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Max events in cache
const FLUSH_DELAY_MS = 120;

interface CachedEvent {
  event: Event;
  cachedAt: number;
  relayUrl?: string;
}

interface CacheMetadata {
  totalEvents: number;
  oldestEventTime: number;
  newestEventTime: number;
  lastCleanup: number;
}

/**
 * EventCache provides persistent caching of Nostr events
 * for offline support and faster app startup.
 */
export class EventCache {
  private memoryCache: Map<string, CachedEvent> = new Map();
  private ttl: number;
  private maxSize: number;
  private isInitialized = false;
  private keyIndex: Set<string> = new Set();
  private pendingWrites: Map<string, string | null> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor(ttl: number = DEFAULT_TTL, maxSize: number = MAX_CACHE_SIZE) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Initialize cache - load from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      diagnostics.log('Initializing event cache...', 'info');
      await this.loadFromStorage();
      await this.cleanupOldEvents();
      this.isInitialized = true;
      diagnostics.log(`✅ Event cache initialized with ${this.memoryCache.size} events`, 'info');
    } catch (error) {
      diagnostics.log(`⚠️ Failed to initialize cache: ${error}`, 'warn');
    }
  }

  /**
   * Save an event to cache
   */
  async saveEvent(event: Event, relayUrl?: string): Promise<void> {
    const cached: CachedEvent = {
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
  async saveEvents(events: Event[], relayUrl?: string): Promise<void> {
    const now = Date.now();
    for (const event of events) {
      const cached: CachedEvent = {
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
  async getEvents(filter: Filter): Promise<Event[]> {
    await this.initialize();

    const results: Event[] = [];
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
        const filterHashtags = (filter['#t'] as string[]).map((t) => t.toLowerCase());
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
  has(eventId: string): boolean {
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
      } else {
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
  async clear(): Promise<void> {
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
    } catch (error) {
      diagnostics.log(`⚠️ Failed to clear cache: ${error}`, 'warn');
    }
  }

  /**
   * Remove old events beyond TTL
   */
  private async cleanupOldEvents(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

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
  private evictOldest(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1));
    for (const [id] of toRemove) {
      this.memoryCache.delete(id);
      this.queueRemove(`${CACHE_KEY_PREFIX}${id}`);
    }

    diagnostics.log(`Evicted ${toRemove.length} oldest events`, 'info');
  }

  private queueSet(key: string, value: string): void {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      this.keyIndex.add(key);
    }
    this.pendingWrites.set(key, value);
    this.scheduleFlush();
  }

  private queueRemove(key: string): void {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      this.keyIndex.delete(key);
    }
    this.pendingWrites.set(key, null);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
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

  private async flushPendingWrites(): Promise<void> {
    if (this.isFlushing || this.pendingWrites.size === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      while (this.pendingWrites.size > 0) {
        const snapshot = new Map(this.pendingWrites);
        this.pendingWrites.clear();

        const setOps: [string, string][] = [];
        const removeOps: string[] = [];

        for (const [key, value] of snapshot.entries()) {
          if (value === null) {
            removeOps.push(key);
          } else {
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
    } finally {
      this.isFlushing = false;
      if (this.pendingWrites.size > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Load all cached events from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const indexRaw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      let cacheKeys: string[] = [];

      if (indexRaw) {
        try {
          const parsed = JSON.parse(indexRaw) as unknown;
          if (Array.isArray(parsed)) {
            cacheKeys = parsed.filter((key): key is string => typeof key === 'string' && key.startsWith(CACHE_KEY_PREFIX));
          }
        } catch {
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
          const cached: CachedEvent = JSON.parse(value);
          const eventId = key.replace(CACHE_KEY_PREFIX, '');
          this.memoryCache.set(eventId, cached);
        } catch {
          this.keyIndex.delete(key);
        }
      }

      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify([...this.keyIndex]));
      diagnostics.log(`Loaded ${this.memoryCache.size} events from storage`, 'info');
    } catch (error) {
      diagnostics.log(`⚠️ Failed to load from storage: ${error}`, 'warn');
    }
  }

  /**
   * Update cache metadata
   */
  private async updateMetadata(): Promise<void> {
    try {
      const events = Array.from(this.memoryCache.values());
      if (events.length === 0) {
        this.queueRemove(CACHE_METADATA_KEY);
        return;
      }

      const timestamps = events.map((e) => e.event.created_at);
      const metadata: CacheMetadata = {
        totalEvents: events.length,
        oldestEventTime: Math.min(...timestamps),
        newestEventTime: Math.max(...timestamps),
        lastCleanup: Date.now(),
      };

      this.queueSet(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      diagnostics.log(`⚠️ Failed to update metadata: ${error}`, 'warn');
    }
  }
}

// Singleton instance
export const eventCache = new EventCache();

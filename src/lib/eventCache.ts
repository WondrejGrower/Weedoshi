import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, Filter } from 'nostr-tools';
import { diagnostics } from './diagnostics';

const CACHE_KEY_PREFIX = 'nostr_event_cache_';
const CACHE_METADATA_KEY = 'nostr_cache_metadata';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Max events in cache

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

    // Add to memory cache
    this.memoryCache.set(event.id, cached);

    // Enforce max size
    if (this.memoryCache.size > this.maxSize) {
      await this.evictOldest();
    }

    // Persist to storage (batched)
    await this.persistEvent(event.id, cached);
  }

  /**
   * Save multiple events at once
   */
  async saveEvents(events: Event[], relayUrl?: string): Promise<void> {
    for (const event of events) {
      await this.saveEvent(event, relayUrl);
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
      // Check TTL
      if (now - cached.cachedAt > this.ttl) {
        continue;
      }

      const event = cached.event;

      // Filter by kind
      if (filter.kinds && !filter.kinds.includes(event.kind)) {
        continue;
      }

      // Filter by authors
      if (filter.authors && !filter.authors.includes(event.pubkey)) {
        continue;
      }

      // Filter by hashtags (#t tag)
      if (filter['#t']) {
        const eventHashtags = event.tags
          .filter(tag => tag[0] === 't')
          .map(tag => tag[1]?.toLowerCase());
        const filterHashtags = (filter['#t'] as string[]).map(t => t.toLowerCase());
        if (!filterHashtags.some(tag => eventHashtags.includes(tag))) {
          continue;
        }
      }

      // Filter by time
      if (filter.since && event.created_at < filter.since) {
        continue;
      }
      if (filter.until && event.created_at > filter.until) {
        continue;
      }

      results.push(event);
    }

    // Sort by created_at (newest first)
    results.sort((a, b) => b.created_at - a.created_at);

    // Apply limit
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
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove([...cacheKeys, CACHE_METADATA_KEY]);
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
    let removedCount = 0;

    for (const [id, cached] of this.memoryCache) {
      if (now - cached.cachedAt > this.ttl) {
        this.memoryCache.delete(id);
        await this.removeFromStorage(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      diagnostics.log(`Cleaned up ${removedCount} expired events`, 'info');
      await this.updateMetadata();
    }
  }

  /**
   * Evict oldest events when cache is full
   */
  private async evictOldest(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1)); // Remove 10%
    for (const [id] of toRemove) {
      this.memoryCache.delete(id);
      await this.removeFromStorage(id);
    }

    diagnostics.log(`Evicted ${toRemove.length} oldest events`, 'info');
  }

  /**
   * Persist a single event to storage
   */
  private async persistEvent(id: string, cached: CachedEvent): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${CACHE_KEY_PREFIX}${id}`,
        JSON.stringify(cached)
      );
    } catch (error) {
      diagnostics.log(`⚠️ Failed to persist event ${id}: ${error}`, 'warn');
    }
  }

  /**
   * Remove event from storage
   */
  private async removeFromStorage(id: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${id}`);
    } catch (error) {
      diagnostics.log(`⚠️ Failed to remove event ${id}: ${error}`, 'warn');
    }
  }

  /**
   * Load all cached events from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

      if (cacheKeys.length === 0) {
        return;
      }

      const items = await AsyncStorage.multiGet(cacheKeys);
      for (const [key, value] of items) {
        if (value) {
          try {
            const cached: CachedEvent = JSON.parse(value);
            const eventId = key.replace(CACHE_KEY_PREFIX, '');
            this.memoryCache.set(eventId, cached);
          } catch {
            // Skip invalid entries
          }
        }
      }

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
      if (events.length === 0) return;

      const timestamps = events.map(e => e.event.created_at);
      const metadata: CacheMetadata = {
        totalEvents: events.length,
        oldestEventTime: Math.min(...timestamps),
        newestEventTime: Math.max(...timestamps),
        lastCleanup: Date.now(),
      };

      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      diagnostics.log(`⚠️ Failed to update metadata: ${error}`, 'warn');
    }
  }
}

// Singleton instance
export const eventCache = new EventCache();
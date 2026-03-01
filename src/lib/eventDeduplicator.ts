import { LRUCache } from 'lru-cache';
import { diagnostics } from './diagnostics';

/**
 * EventDeduplicator prevents duplicate events from appearing in the feed
 * when the same event is received from multiple relays.
 * 
 * Uses LRU cache with max 10,000 events to balance memory usage and effectiveness.
 */
export class EventDeduplicator {
  private seenEvents: LRUCache<string, boolean>;
  private duplicateCount: number = 0;
  private uniqueCount: number = 0;

  constructor(maxSize: number = 10000) {
    this.seenEvents = new LRUCache<string, boolean>({
      max: maxSize,
      ttl: 1000 * 60 * 60 * 24, // 24 hours TTL
    });

    diagnostics.log(`EventDeduplicator initialized with max size ${maxSize}`, 'info');
  }

  /**
   * Check if an event has already been seen
   * @param eventId - The event ID to check
   * @returns true if this is a duplicate, false if it's new
   */
  isDuplicate(eventId: string): boolean {
    if (this.seenEvents.has(eventId)) {
      this.duplicateCount++;
      
      // Log duplicates periodically (every 10th)
      if (this.duplicateCount % 10 === 0) {
        diagnostics.log(
          `Filtered ${this.duplicateCount} duplicate events (${this.uniqueCount} unique)`,
          'info'
        );
      }
      
      return true;
    }

    // Mark as seen
    this.seenEvents.set(eventId, true);
    this.uniqueCount++;
    return false;
  }

  /**
   * Clear the cache (useful for testing or reset)
   */
  clear(): void {
    this.seenEvents.clear();
    this.duplicateCount = 0;
    this.uniqueCount = 0;
    diagnostics.log('EventDeduplicator cache cleared', 'info');
  }

  /**
   * Get statistics about deduplication
   */
  getStats() {
    return {
      cacheSize: this.seenEvents.size,
      duplicatesFiltered: this.duplicateCount,
      uniqueEvents: this.uniqueCount,
      filterRate: this.uniqueCount > 0 
        ? (this.duplicateCount / (this.duplicateCount + this.uniqueCount) * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  /**
   * Check if cache contains an event
   */
  has(eventId: string): boolean {
    return this.seenEvents.has(eventId);
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.seenEvents.size;
  }
}

// Singleton instance
export const eventDeduplicator = new EventDeduplicator();

import { diagnostics } from './diagnostics';
/**
 * EventDeduplicator prevents duplicate events from appearing in the feed
 * when the same event is received from multiple relays.
 */
export class EventDeduplicator {
    constructor(maxSize = 10000, ttlMs = 1000 * 60 * 60 * 24) {
        Object.defineProperty(this, "seenEvents", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "duplicateCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "uniqueCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ttlMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.seenEvents = new Map();
        diagnostics.log(`EventDeduplicator initialized with max size ${maxSize}`, 'info');
    }
    /**
     * Check if an event has already been seen
     * @param eventId - The event ID to check
     * @returns true if this is a duplicate, false if it's new
     */
    isDuplicate(eventId) {
        const now = Date.now();
        const existing = this.seenEvents.get(eventId);
        if (existing && now - existing <= this.ttlMs) {
            this.duplicateCount++;
            // Log duplicates periodically (every 10th)
            if (this.duplicateCount % 10 === 0) {
                diagnostics.log(`Filtered ${this.duplicateCount} duplicate events (${this.uniqueCount} unique)`, 'info');
            }
            return true;
        }
        // Expired or new entry: replace and move to MRU position.
        this.seenEvents.delete(eventId);
        this.seenEvents.set(eventId, now);
        this.uniqueCount++;
        this.evictIfNeeded();
        this.cleanupExpired(now);
        return false;
    }
    /**
     * Clear the cache (useful for testing or reset)
     */
    clear() {
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
     * Check if cache contains a non-expired event
     */
    has(eventId) {
        const ts = this.seenEvents.get(eventId);
        return ts !== undefined && Date.now() - ts <= this.ttlMs;
    }
    /**
     * Get current cache size
     */
    size() {
        return this.seenEvents.size;
    }
    evictIfNeeded() {
        while (this.seenEvents.size > this.maxSize) {
            const oldestKey = this.seenEvents.keys().next().value;
            if (!oldestKey)
                break;
            this.seenEvents.delete(oldestKey);
        }
    }
    cleanupExpired(now) {
        // Opportunistic cleanup from oldest entries only.
        for (const [id, ts] of this.seenEvents) {
            if (now - ts <= this.ttlMs) {
                break;
            }
            this.seenEvents.delete(id);
        }
    }
}
// Singleton instance
export const eventDeduplicator = new EventDeduplicator();

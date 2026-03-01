import { diagnostics } from './diagnostics';
import type { Event, Filter } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';

interface BatchRequest {
  id: string;
  filters: Filter[];
  relayUrls: string[];
  callback: (events: Event[]) => void;
  timestamp: number;
}

interface BatchStats {
  totalBatches: number;
  totalRequests: number;
  avgBatchSize: number;
  totalEventsFetched: number;
  avgLatency: number;
}

/**
 * BatchRequestManager optimizes network requests by batching multiple
 * queries together, reducing round-trips and improving performance
 */
export class BatchRequestManager {
  private pool: SimplePool;
  private pendingRequests: BatchRequest[] = [];
  private batchDelay: number = 100; // ms - wait before executing batch
  private maxBatchSize: number = 10; // max requests per batch
  private batchTimeout: number | null = null;
  private stats: BatchStats = {
    totalBatches: 0,
    totalRequests: 0,
    avgBatchSize: 0,
    totalEventsFetched: 0,
    avgLatency: 0,
  };
  private latencyHistory: number[] = [];

  constructor() {
    console.log('📦 BatchRequestManager: Initializing...');
    try {
      this.pool = new SimplePool();
      console.log('✅ BatchRequestManager: SimplePool created');
    } catch (error) {
      console.error('🔴 BatchRequestManager: Constructor error:', error);
      throw error;
    }
  }

  /**
   * Add a request to the batch queue
   */
  addRequest(
    filters: Filter[],
    relayUrls: string[],
    callback: (events: Event[]) => void
  ): string {
    const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: BatchRequest = {
      id: requestId,
      filters,
      relayUrls,
      callback,
      timestamp: Date.now(),
    };

    this.pendingRequests.push(request);
    this.stats.totalRequests++;

    diagnostics.log(
      `Added request ${requestId} to batch queue (${this.pendingRequests.length} pending)`,
      'info'
    );

    // Schedule batch execution
    this.scheduleBatchExecution();

    return requestId;
  }

  /**
   * Schedule batch execution with debouncing
   */
  private scheduleBatchExecution(): void {
    // Clear existing timeout
    if (this.batchTimeout !== null) {
      clearTimeout(this.batchTimeout);
    }

    // Execute immediately if we hit max batch size
    if (this.pendingRequests.length >= this.maxBatchSize) {
      this.executeBatch();
      return;
    }

    // Otherwise, wait for more requests
    this.batchTimeout = setTimeout(() => {
      this.executeBatch();
    }, this.batchDelay) as any;
  }

  /**
   * Execute batched requests
   */
  private async executeBatch(): Promise<void> {
    if (this.pendingRequests.length === 0) return;

    const batchStartTime = Date.now();
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    this.batchTimeout = null;

    this.stats.totalBatches++;
    const batchSize = requests.length;

    diagnostics.log(`Executing batch of ${batchSize} requests`, 'info');
    console.log(`📦 Batch execution: ${batchSize} requests`);

    // Group requests by relay URLs to optimize
    const relayGroups = this.groupByRelays(requests);

    for (const [_, groupRequests] of relayGroups) {
      await this.executeBatchForRelays(groupRequests);
    }

    // Update stats
    const latency = Date.now() - batchStartTime;
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }

    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    this.stats.avgLatency = Math.round(avgLatency);
    this.stats.avgBatchSize = this.stats.totalRequests / this.stats.totalBatches;

    diagnostics.log(
      `Batch completed in ${latency}ms (avg: ${this.stats.avgLatency}ms)`,
      'info'
    );
  }

  /**
   * Group requests by relay URLs for optimization
   */
  private groupByRelays(requests: BatchRequest[]): Map<string, BatchRequest[]> {
    const groups = new Map<string, BatchRequest[]>();

    for (const request of requests) {
      const relayKey = request.relayUrls.sort().join(',');
      if (!groups.has(relayKey)) {
        groups.set(relayKey, []);
      }
      groups.get(relayKey)!.push(request);
    }

    return groups;
  }

  /**
   * Execute batch for a specific set of relays
   */
  private async executeBatchForRelays(
    requests: BatchRequest[]
  ): Promise<void> {
    if (requests.length === 0) return;

    const relayUrls = requests[0].relayUrls;
    // Combine all filters
    const combinedFilters: Filter[] = [];
    for (const request of requests) {
      combinedFilters.push(...request.filters);
    }

    try {
      const allEvents: Event[] = [];
      let isSettled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Subscribe with combined filters
      const sub = this.pool.subscribeMany(
        relayUrls,
        combinedFilters as any,
        {
          onevent: (event: Event) => {
            allEvents.push(event);
          },
          oneose: () => {
            if (isSettled) return;
            isSettled = true;
            // Distribute events to respective callbacks
            this.distributeEvents(requests, allEvents);
            this.stats.totalEventsFetched += allEvents.length;
            sub.close();
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          },
        }
      );

      // Timeout after 3 seconds
      timeoutId = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        sub.close();
        if (allEvents.length > 0) {
          this.distributeEvents(requests, allEvents);
          this.stats.totalEventsFetched += allEvents.length;
          return;
        }
        // No events: still resolve requests once with an empty result
        this.distributeEvents(requests, []);
      }, 3000);
    } catch (error) {
      diagnostics.log(`Batch execution error: ${error}`, 'error');
      // Notify all callbacks with empty results
      for (const request of requests) {
        request.callback([]);
      }
    }
  }

  /**
   * Distribute fetched events to respective callbacks based on filters
   */
  private distributeEvents(requests: BatchRequest[], allEvents: Event[]): void {
    for (const request of requests) {
      // Filter events that match this request's filters
      const matchingEvents = allEvents.filter(event =>
        this.eventMatchesFilters(event, request.filters)
      );

      request.callback(matchingEvents);

      const latency = Date.now() - request.timestamp;
      diagnostics.log(
        `Request ${request.id} received ${matchingEvents.length} events in ${latency}ms`,
        'info'
      );
    }
  }

  /**
   * Check if an event matches any of the given filters
   */
  private eventMatchesFilters(event: Event, filters: Filter[]): boolean {
    for (const filter of filters) {
      if (this.eventMatchesFilter(event, filter)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if an event matches a specific filter
   */
  private eventMatchesFilter(event: Event, filter: Filter): boolean {
    // Check kinds
    if (filter.kinds && !filter.kinds.includes(event.kind)) {
      return false;
    }

    // Check authors
    if (filter.authors && !filter.authors.includes(event.pubkey)) {
      return false;
    }

    // Check IDs
    if (filter.ids && !filter.ids.includes(event.id)) {
      return false;
    }

    // Check #e tags
    if (filter['#e']) {
      const eTags = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
      const hasMatch = filter['#e'].some(eId => eTags.includes(eId));
      if (!hasMatch) return false;
    }

    // Check #p tags
    if (filter['#p']) {
      const pTags = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
      const hasMatch = filter['#p'].some(pId => pTags.includes(pId));
      if (!hasMatch) return false;
    }

    // Check since
    if (filter.since && event.created_at < filter.since) {
      return false;
    }

    // Check until
    if (filter.until && event.created_at > filter.until) {
      return false;
    }

    return true;
  }

  /**
   * Get batch statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.length;
  }

  /**
   * Set batch delay (ms)
   */
  setBatchDelay(delayMs: number): void {
    this.batchDelay = Math.max(10, Math.min(1000, delayMs)); // 10-1000ms
    diagnostics.log(`Batch delay set to ${this.batchDelay}ms`, 'info');
  }

  /**
   * Set max batch size
   */
  setMaxBatchSize(size: number): void {
    this.maxBatchSize = Math.max(1, Math.min(50, size)); // 1-50
    diagnostics.log(`Max batch size set to ${this.maxBatchSize}`, 'info');
  }

  /**
   * Clear pending requests
   */
  clear(): void {
    this.pendingRequests = [];
    if (this.batchTimeout !== null) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    diagnostics.log('Cleared all pending batch requests', 'info');
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBatches: 0,
      totalRequests: 0,
      avgBatchSize: 0,
      totalEventsFetched: 0,
      avgLatency: 0,
    };
    this.latencyHistory = [];
    diagnostics.log('Reset batch statistics', 'info');
  }
}

// Singleton instance
export const batchRequestManager = new BatchRequestManager();

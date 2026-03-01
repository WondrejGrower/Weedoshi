import type { Event, Filter } from 'nostr-tools';
import { SimplePool, nip19, getPublicKey } from 'nostr-tools';
import { diagnostics } from './diagnostics';
import { eventDeduplicator } from './eventDeduplicator';
import { eventValidator } from './eventValidator';
import { relayHealthMonitor } from './relayHealthMonitor';
import { eventCache } from './eventCache';

export interface NostrEvent extends Event {
  relayUrl?: string;
}

export class NostrClient {
  private pool: SimplePool;
  private relayUrls: string[] = [];
  private subscriptions: Map<string, () => void> = new Map();
  private connectionTimeouts: Map<string, number> = new Map();

  constructor() {
    console.log('🌐 NostrClient: Initializing...');
    try {
      console.log('🌐 NostrClient: Creating SimplePool...');
      this.pool = new SimplePool();
      console.log('✅ NostrClient: SimplePool created successfully');
      console.log('🌐 NostrClient: Checking WebSocket availability...');
      if (typeof WebSocket === 'undefined') {
        console.error('🔴 NostrClient: WebSocket is undefined! This will cause issues.');
      } else {
        console.log('✅ NostrClient: WebSocket is available');
      }
    } catch (error) {
      console.error('🔴 NostrClient: Constructor error:', error);
      throw error;
    }
  }

  setRelays(urls: string[]) {
    this.relayUrls = urls.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }

  getRelays(): string[] {
    return this.relayUrls;
  }

  async subscribeFeed(
    hashtags: string[],
    since: number = 0,
    onEvent: (event: NostrEvent) => void,
    onTimeout?: () => void
  ): Promise<string> {
    console.log('🌐 NostrClient: subscribeFeed called');
    console.log('🌐 NostrClient: Relay URLs:', this.relayUrls);
    console.log('🌐 NostrClient: Hashtags:', hashtags);
    console.log('🌐 NostrClient: Since:', new Date(since * 1000).toISOString());
    if (this.relayUrls.length === 0) {
      console.error('🔴 NostrClient: No relays configured!');
      diagnostics.log('No relays configured', 'error');
      throw new Error('No relays configured');
    }

    diagnostics.log(`Starting subscription to ${this.relayUrls.length} relays`, 'info');
    console.log('🌐 NostrClient: Starting subscribeFeed...');
    console.log(`🌐 NostrClient: Relays: ${this.relayUrls.join(', ')}`);

    // Initialize health tracking for all relays
    this.relayUrls.forEach(url => {
      relayHealthMonitor.initRelay(url);
      relayHealthMonitor.recordConnectionAttempt(url);
    });
    // Build filter with hashtag support
    const filter: Filter = {
      kinds: [1],
      since,
      limit: 100,
    };

    // Add hashtag filtering if hashtags are provided
    if (hashtags && hashtags.length > 0) {
      // Nostr uses #t tag for hashtags (lowercase)
      filter['#t'] = hashtags.map(tag => tag.toLowerCase());
      diagnostics.log(`Filtering by hashtags: ${hashtags.join(', ')}`, 'info');
    }

    // 🚀 NEW: Load cached events first (instant feed!)
    try {
      const cachedEvents = await eventCache.getEvents(filter);
      if (cachedEvents.length > 0) {
        diagnostics.log(`📦 Loaded ${cachedEvents.length} events from cache`, 'info');
        console.log(`📦 Cache: ${cachedEvents.length} events loaded instantly`);

        // Deliver cached events immediately
        cachedEvents.forEach(event => {
          const nostrEvent: NostrEvent = { ...event, relayUrl: 'cache' };
          onEvent(nostrEvent);
        });
      }
    } catch (error) {
      diagnostics.log(`⚠️ Failed to load from cache: ${error}`, 'warn');
    }
    const subId = Math.random().toString(36).substring(7);
    let eventReceived = false;
    let timeoutFired = false;
    let eventCount = 0;
    let duplicateCount = 0;
    const connectionStartTime = Date.now();

    // Timeout pro connection (5 sekund)
    const timeoutId = setTimeout(() => {
      if (!eventReceived && !timeoutFired) {
        diagnostics.log('Subscription timeout - no events received within 5s', 'warn');
        console.warn('⚠️ Nostr subscription timeout - no events received within 5s');

        // Mark all relays as failed if no events received
        this.relayUrls.forEach(url => {
          relayHealthMonitor.recordFailure(url, 'Connection timeout');
        });
        timeoutFired = true;
        if (onTimeout) onTimeout();
      }
    }, 5000) as unknown as number;

    this.connectionTimeouts.set(subId, timeoutId);
    const filters = [filter] as any;

    try {
      const sub = this.pool.subscribeMany(this.relayUrls, filters, {
        onevent(event: Event, relay?: string) {
          // Record success for the relay
          if (relay) {
            relayHealthMonitor.recordSuccess(relay);

            // Record latency on first event from this relay
            if (eventCount === 0) {
              const latency = Date.now() - connectionStartTime;
              relayHealthMonitor.recordLatency(relay, latency);
            }
          }
          // 1. Validate event signature FIRST (security)
          if (!eventValidator.validateEvent(event)) {
            diagnostics.log(`Rejected invalid event ${event.id.substring(0, 8)}...`, 'warn');
            return; // Skip invalid events
          }

          // 2. Check for duplicates
          if (eventDeduplicator.isDuplicate(event.id)) {
            duplicateCount++;
            return; // Skip duplicate events
          }

          // 🚀 NEW: Cache the event for future use
          eventCache.saveEvent(event, relay).catch(err => {
            diagnostics.log(`⚠️ Failed to cache event: ${err}`, 'warn');
          });
          eventReceived = true;
          eventCount++;
          if (eventCount === 1) {
            diagnostics.log(`First event received from ${relay || 'unknown relay'}`, 'info');
          }
          const nostrEvent: NostrEvent = { ...event, relayUrl: relay };
          onEvent(nostrEvent);
        },
        oneose() {
          // End of stored events - connection established
          const dedupStats = eventDeduplicator.getStats();
          const validatorStats = eventValidator.getStats();
          const healthStats = relayHealthMonitor.getStats();
          const cacheStats = eventCache.getStats();
          diagnostics.log(
            `End of stored events - ${eventCount} unique, ${duplicateCount} duplicates filtered`,
            'info'
          );
          console.log(`✅ Nostr: ${eventCount} unique events (${duplicateCount} duplicates filtered)`);
          console.log(`📊 Deduplication:`, dedupStats);
          console.log(`🔒 Validation:`, validatorStats);
          console.log(`💚 Relay Health:`, healthStats);
          console.log(`📦 Cache:`, cacheStats);
          eventReceived = true;
        },
      });

      this.subscriptions.set(subId, () => {
        diagnostics.log(`Closing subscription ${subId}`, 'info');
        sub.close();
        const timeout = this.connectionTimeouts.get(subId);
        if (timeout) {
          clearTimeout(timeout);
          this.connectionTimeouts.delete(subId);
        }
      });

      diagnostics.log(`Subscription ${subId} created successfully`, 'info');
      return subId;
    } catch (error) {
      const timeout = this.connectionTimeouts.get(subId);
      if (timeout) clearTimeout(timeout);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`Subscription failed: ${errorMsg}`, 'error');
      throw new Error(`Subscription failed: ${errorMsg}`);
    }
  }

  unsubscribe(subId: string) {
    const unsub = this.subscriptions.get(subId);
    if (unsub) {
      unsub();
      this.subscriptions.delete(subId);
    }
  }

  close() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions.clear();
    this.connectionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.connectionTimeouts.clear();
    this.pool.close(this.relayUrls);
  }

  decodeNsec(nsec: string): { pubkey: string; privkey: string } {
    try {
      const decoded = nip19.decode(nsec);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec key');
      }
      const privkeyData = decoded.data as Uint8Array;
      const privkey = Array.from(privkeyData)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const pubkey = getPublicKey(privkey as any);
      return { pubkey, privkey };
    } catch (error) {
      throw new Error(`Failed to decode nsec: ${error instanceof Error ? error.message : ''}`);
    }
  }

  pubkeyToNpub(pubkey: string): string {
    return nip19.npubEncode(pubkey);
  }

  npubToPubkey(npub: string): string {
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== 'npub') {
        throw new Error('Invalid npub');
      }
      return decoded.data as string;
    } catch (error) {
      throw new Error(`Failed to decode npub: ${error instanceof Error ? error.message : ''}`);
    }
  }

  /**
   * Get health information for all relays
   */
  getRelayHealth() {
    return relayHealthMonitor.getAllHealth();
  }

  /**
   * Get the best performing relays
   */
  getBestRelays(count: number = 3): string[] {
    return relayHealthMonitor.getBestRelays(count);
  }

  /**
   * Get relay health statistics
   */
  getRelayStats() {
    return relayHealthMonitor.getStats();
  }
}

export const nostrClient = new NostrClient();
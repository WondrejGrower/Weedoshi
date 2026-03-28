import { logger } from './logger';
import { SimplePool, nip19, getPublicKey } from 'nostr-tools';
import { diagnostics } from './diagnostics';
import { eventDeduplicator } from './eventDeduplicator';
import { eventValidator } from './eventValidator';
import { relayHealthMonitor } from './relayHealthMonitor';
import { eventCache } from './eventCache';
import { perfMonitor } from './perfMonitor';
export class NostrClient {
    constructor() {
        Object.defineProperty(this, "pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "relayUrls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "subscriptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "connectionTimeouts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        logger.info('🌐 NostrClient: Initializing...');
        try {
            logger.info('🌐 NostrClient: Creating SimplePool...');
            this.pool = new SimplePool();
            logger.info('✅ NostrClient: SimplePool created successfully');
            logger.info('🌐 NostrClient: Checking WebSocket availability...');
            if (typeof WebSocket === 'undefined') {
                logger.error('🔴 NostrClient: WebSocket is undefined! This will cause issues.');
            }
            else {
                logger.info('✅ NostrClient: WebSocket is available');
            }
        }
        catch (error) {
            logger.error('🔴 NostrClient: Constructor error:', error);
            throw error;
        }
    }
    setRelays(urls) {
        this.relayUrls = urls.filter(url => {
            if (typeof URL.canParse === 'function') {
                return URL.canParse(url);
            }
            try {
                const parsed = new URL(url);
                return Boolean(parsed);
            }
            catch {
                return false;
            }
        });
    }
    getRelays() {
        return this.relayUrls;
    }
    async querySyncTimed(relays, filter, opts) {
        const startedAt = Date.now();
        try {
            return await this.pool.querySync(relays, filter, opts);
        }
        finally {
            perfMonitor.recordQueryDuration(Date.now() - startedAt);
        }
    }
    async subscribeFeed(hashtags, since = 0, onEvent, onTimeout, searchQuery) {
        logger.info('🌐 NostrClient: subscribeFeed called');
        logger.info('🌐 NostrClient: Relay URLs:', this.relayUrls);
        logger.info('🌐 NostrClient: Hashtags:', hashtags);
        logger.info('🌐 NostrClient: Since:', new Date(since * 1000).toISOString());
        if (this.relayUrls.length === 0) {
            logger.error('🔴 NostrClient: No relays configured!');
            diagnostics.log('No relays configured', 'error');
            throw new Error('No relays configured');
        }
        diagnostics.log(`Starting subscription to ${this.relayUrls.length} relays`, 'info');
        logger.info('🌐 NostrClient: Starting subscribeFeed...');
        logger.info(`🌐 NostrClient: Relays: ${this.relayUrls.join(', ')}`);
        // Initialize health tracking for all relays
        this.relayUrls.forEach(url => {
            relayHealthMonitor.initRelay(url);
            relayHealthMonitor.recordConnectionAttempt(url);
        });
        // Build filter with hashtag support
        const filter = {
            kinds: [1],
            since,
            limit: 100,
        };
        const normalizedSearchQuery = searchQuery?.trim();
        if (normalizedSearchQuery) {
            filter.search = normalizedSearchQuery;
            diagnostics.log(`Relay-side NIP-50 search enabled: "${normalizedSearchQuery}"`, 'info');
        }
        // Keep relay query broad and apply hashtag filtering client-side.
        // Many events use inline hashtags in content without explicit #t tags.
        if (hashtags && hashtags.length > 0) {
            diagnostics.log(`Client-side hashtag filtering: ${hashtags.join(', ')}`, 'info');
        }
        // 🚀 NEW: Load cached events first (instant feed!)
        try {
            const cachedEvents = await eventCache.getEvents(filter);
            if (cachedEvents.length > 0) {
                diagnostics.log(`📦 Loaded ${cachedEvents.length} events from cache`, 'info');
                logger.info(`📦 Cache: ${cachedEvents.length} events loaded instantly`);
                // Deliver cached events immediately
                cachedEvents.forEach(event => {
                    if (!eventValidator.validateEvent(event)) {
                        return;
                    }
                    const nostrEvent = { ...event, relayUrl: 'cache' };
                    onEvent(nostrEvent);
                });
            }
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to load from cache: ${error}`, 'warn');
        }
        const subId = Math.random().toString(36).substring(7);
        let eventReceived = false;
        let timeoutFired = false;
        let eventCount = 0;
        let duplicateCount = 0;
        // Timeout pro connection (5 sekund)
        const timeoutId = setTimeout(() => {
            if (!eventReceived && !timeoutFired) {
                diagnostics.log('Subscription timeout - no events received within 5s', 'warn');
                logger.warn('⚠️ Nostr subscription timeout - no events received within 5s');
                // Mark all relays as failed if no events received
                this.relayUrls.forEach(url => {
                    relayHealthMonitor.recordFailure(url, 'Connection timeout');
                });
                timeoutFired = true;
                if (onTimeout)
                    onTimeout();
            }
        }, 5000);
        this.connectionTimeouts.set(subId, timeoutId);
        const filters = [filter];
        try {
            perfMonitor.recordSubscribeCall();
            const sub = this.pool.subscribeMany(this.relayUrls, filters, {
                onevent(event, relay) {
                    perfMonitor.recordNetworkEventReceived();
                    // Record success for the relay
                    if (relay) {
                        relayHealthMonitor.recordSuccess(relay);
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
                    const nostrEvent = { ...event, relayUrl: relay };
                    onEvent(nostrEvent);
                },
                oneose() {
                    // End of stored events - connection established
                    const dedupStats = eventDeduplicator.getStats();
                    const validatorStats = eventValidator.getStats();
                    const healthStats = relayHealthMonitor.getStats();
                    const cacheStats = eventCache.getStats();
                    diagnostics.log(`End of stored events - ${eventCount} unique, ${duplicateCount} duplicates filtered`, 'info');
                    logger.info(`✅ Nostr: ${eventCount} unique events (${duplicateCount} duplicates filtered)`);
                    logger.info(`📊 Deduplication:`, dedupStats);
                    logger.info(`🔒 Validation:`, validatorStats);
                    logger.info(`💚 Relay Health:`, healthStats);
                    logger.info(`📦 Cache:`, cacheStats);
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
        }
        catch (error) {
            const timeout = this.connectionTimeouts.get(subId);
            if (timeout)
                clearTimeout(timeout);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            diagnostics.log(`Subscription failed: ${errorMsg}`, 'error');
            throw new Error(`Subscription failed: ${errorMsg}`);
        }
    }
    async fetchRecentPublicNotes(limit = 80, maxWaitMs = 6000) {
        if (this.relayUrls.length === 0) {
            return [];
        }
        const filter = {
            kinds: [1],
            limit,
        };
        try {
            const events = await this.querySyncTimed(this.relayUrls, filter, {
                maxWait: maxWaitMs,
                label: 'fallback-public-notes',
            });
            return events
                .filter((event) => eventValidator.validateEvent(event))
                .map((event) => ({ ...event }));
        }
        catch (error) {
            diagnostics.log(`Fallback public notes fetch failed: ${error instanceof Error ? error.message : String(error)}`, 'warn');
            return [];
        }
    }
    async fetchNotesByTagHashtags(hashtags, limit = 300, maxWaitMs = 7000) {
        if (this.relayUrls.length === 0 || hashtags.length === 0) {
            return [];
        }
        const normalized = Array.from(new Set(hashtags
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)));
        if (normalized.length === 0) {
            return [];
        }
        const filter = {
            kinds: [1],
            '#t': normalized,
            limit,
        };
        try {
            const events = await this.querySyncTimed(this.relayUrls, filter, {
                maxWait: maxWaitMs,
                label: 'hashtag-backfill',
            });
            return events
                .filter((event) => eventValidator.validateEvent(event))
                .map((event) => ({ ...event }));
        }
        catch (error) {
            diagnostics.log(`Hashtag backfill fetch failed: ${error instanceof Error ? error.message : String(error)}`, 'warn');
            return [];
        }
    }
    async fetchNotesBySearchQuery(query, limit = 200, maxWaitMs = 7000) {
        if (this.relayUrls.length === 0) {
            return [];
        }
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return [];
        }
        const filter = {
            kinds: [1],
            limit,
        };
        filter.search = normalizedQuery;
        try {
            const events = await this.querySyncTimed(this.relayUrls, filter, {
                maxWait: maxWaitMs,
                label: 'search-backfill',
            });
            return events
                .filter((event) => eventValidator.validateEvent(event))
                .map((event) => ({ ...event }));
        }
        catch (error) {
            diagnostics.log(`Search backfill failed (relay may not support NIP-50): ${error instanceof Error ? error.message : String(error)}`, 'warn');
            return [];
        }
    }
    async fetchUserRelayPreferences(pubkey, seedRelays, maxWaitMs = 6000) {
        if (!pubkey || seedRelays.length === 0) {
            return [];
        }
        const filter = {
            kinds: [10002],
            authors: [pubkey],
            limit: 10,
        };
        try {
            const events = await this.querySyncTimed(seedRelays, filter, {
                maxWait: maxWaitMs,
                label: 'user-relay-preferences',
            });
            const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
            if (!latest) {
                return [];
            }
            const relays = latest.tags
                .filter((tag) => tag[0] === 'r' && typeof tag[1] === 'string')
                .map((tag) => String(tag[1]).trim())
                .filter((url) => url.startsWith('wss://'));
            return Array.from(new Set(relays));
        }
        catch (error) {
            diagnostics.log(`Failed to fetch user relay preferences: ${error instanceof Error ? error.message : String(error)}`, 'warn');
            return [];
        }
    }
    async fetchProfileMetadata(pubkey, relays, maxWaitMs = 6000) {
        if (!pubkey || relays.length === 0) {
            return null;
        }
        const filter = {
            kinds: [0],
            authors: [pubkey],
            limit: 5,
        };
        try {
            const events = await this.querySyncTimed(relays, filter, {
                maxWait: maxWaitMs,
                label: 'profile-metadata',
            });
            const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
            if (!latest || !latest.content) {
                return null;
            }
            const parsed = JSON.parse(latest.content);
            if (!parsed || typeof parsed !== 'object') {
                return null;
            }
            return parsed;
        }
        catch (error) {
            diagnostics.log(`Failed to fetch profile metadata: ${error instanceof Error ? error.message : String(error)}`, 'warn');
            return null;
        }
    }
    unsubscribe(subId) {
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
    decodeNsec(nsec) {
        try {
            const normalized = nsec.trim();
            if (!normalized) {
                throw new Error('nsec is empty');
            }
            const decoded = nip19.decode(normalized);
            if (decoded.type !== 'nsec') {
                throw new Error('Invalid key type (expected nsec)');
            }
            const privkeyData = decoded.data;
            if (!(privkeyData instanceof Uint8Array)) {
                throw new Error('Invalid nsec payload');
            }
            const privkey = Array.from(privkeyData)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            // nostr-tools v2 expects Uint8Array for secret key in modern APIs
            const pubkey = getPublicKey(privkeyData);
            return { pubkey, privkey };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown decode error';
            throw new Error(`Failed to decode nsec. ${msg}`);
        }
    }
    pubkeyToNpub(pubkey) {
        return nip19.npubEncode(pubkey);
    }
    npubToPubkey(npub) {
        try {
            const decoded = nip19.decode(npub);
            if (decoded.type !== 'npub') {
                throw new Error('Invalid npub');
            }
            return decoded.data;
        }
        catch (error) {
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
    getBestRelays(count = 3) {
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

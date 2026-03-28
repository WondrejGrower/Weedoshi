import { diagnostics } from './diagnostics';
import { logger } from './logger';
import { finalizeEvent, SimplePool, verifyEvent } from 'nostr-tools';
import { batchRequestManager } from './batchRequestManager';
import { requireAtLeastOneSuccess } from './networkResult';
function hexToBytes(hex) {
    const normalized = hex.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
        throw new Error('Invalid private key hex format');
    }
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
/**
 * ReactionManager handles NIP-25 reactions (kind:7 events)
 * Allows users to react to posts with emojis
 */
export class ReactionManager {
    constructor() {
        Object.defineProperty(this, "pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reactions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // eventId -> reactions[]
        Object.defineProperty(this, "reposts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // eventId -> unique reposter pubkeys
        Object.defineProperty(this, "zaps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        }); // eventId -> unique zapper pubkeys
        this.pool = new SimplePool();
    }
    /**
     * Publish a reaction to an event
     * NIP-25: kind:7 event with 'e' and 'p' tags
     */
    async publishReaction(emoji, eventId, eventAuthor, privkey, relayUrls) {
        try {
            diagnostics.log(`Publishing reaction ${emoji} to event ${eventId.substring(0, 8)}...`, 'info');
            // Create reaction event (kind:7)
            const reactionEvent = {
                kind: 7,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', eventId], // Event being reacted to
                    ['p', eventAuthor], // Author of the event
                ],
                content: emoji, // The emoji reaction
            };
            // Sign the event with private key
            const secretKey = typeof privkey === 'string' ? hexToBytes(privkey) : privkey;
            const signedEvent = finalizeEvent(reactionEvent, secretKey);
            // Publish to all relays and require at least one success.
            await requireAtLeastOneSuccess(this.pool.publish(relayUrls, signedEvent), 'Failed to publish reaction to relays');
            diagnostics.log(`✅ Reaction ${emoji} published successfully`, 'info');
            logger.info(`✅ Reaction published: ${emoji}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            diagnostics.log(`❌ Failed to publish reaction: ${errorMsg}`, 'error');
            throw new Error(`Failed to publish reaction: ${errorMsg}`);
        }
    }
    async publishReactionWithSigner(emoji, eventId, eventAuthor, relayUrls) {
        if (typeof window === 'undefined') {
            throw new Error('Browser signer is only available in web runtime');
        }
        const signer = window.nostr;
        if (!signer || typeof signer.getPublicKey !== 'function' || typeof signer.signEvent !== 'function') {
            throw new Error('Browser signer (NIP-07) is not available');
        }
        try {
            const pubkey = await signer.getPublicKey();
            const unsignedEvent = {
                kind: 7,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', eventId],
                    ['p', eventAuthor],
                ],
                content: emoji,
                pubkey,
            };
            const signedEvent = await signer.signEvent(unsignedEvent);
            if (!signedEvent?.id || !signedEvent?.sig) {
                throw new Error('Signer did not return a valid signed event');
            }
            await requireAtLeastOneSuccess(this.pool.publish(relayUrls, signedEvent), 'Failed to publish signer reaction to relays');
            diagnostics.log(`✅ Reaction ${emoji} published via browser signer`, 'info');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            diagnostics.log(`❌ Failed to publish signer reaction: ${errorMsg}`, 'error');
            throw new Error(`Failed to publish reaction via signer: ${errorMsg}`);
        }
    }
    /**
     * Fetch reactions for specific events
     */
    async fetchReactions(eventIds, relayUrls) {
        await this.fetchInteractions(eventIds, relayUrls);
    }
    async fetchInteractions(eventIds, relayUrls) {
        if (eventIds.length === 0)
            return;
        try {
            diagnostics.log(`Fetching interactions for ${eventIds.length} events`, 'info');
            // Use batch manager for optimized request
            const filter = {
                kinds: [7, 6, 16, 9735, 9734], // reactions, reposts, generic reposts, zaps
                '#e': eventIds, // Filter by event IDs
                limit: 1000,
            };
            batchRequestManager.addRequest([filter], relayUrls, (events) => {
                this.processInteractions(events);
                diagnostics.log(`Processed ${events.length} interactions (batched)`, 'info');
            });
        }
        catch (error) {
            diagnostics.log(`⚠️ Failed to fetch interactions: ${error}`, 'warn');
        }
    }
    async publishRepost(eventId, eventAuthor, privkey, relayUrls) {
        try {
            diagnostics.log(`Publishing repost for event ${eventId.substring(0, 8)}...`, 'info');
            const repostEvent = {
                kind: 6,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', eventId],
                    ['p', eventAuthor],
                ],
                content: '',
            };
            const secretKey = typeof privkey === 'string' ? hexToBytes(privkey) : privkey;
            const signedEvent = finalizeEvent(repostEvent, secretKey);
            await requireAtLeastOneSuccess(this.pool.publish(relayUrls, signedEvent), 'Failed to publish repost to relays');
            diagnostics.log('✅ Repost published successfully', 'info');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            diagnostics.log(`❌ Failed to publish repost: ${errorMsg}`, 'error');
            throw new Error(`Failed to publish repost: ${errorMsg}`);
        }
    }
    async publishRepostWithSigner(eventId, eventAuthor, relayUrls) {
        if (typeof window === 'undefined') {
            throw new Error('Browser signer is only available in web runtime');
        }
        const signer = window.nostr;
        if (!signer || typeof signer.getPublicKey !== 'function' || typeof signer.signEvent !== 'function') {
            throw new Error('Browser signer (NIP-07) is not available');
        }
        try {
            const pubkey = await signer.getPublicKey();
            const unsignedEvent = {
                kind: 6,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', eventId],
                    ['p', eventAuthor],
                ],
                content: '',
                pubkey,
            };
            const signedEvent = await signer.signEvent(unsignedEvent);
            if (!signedEvent?.id || !signedEvent?.sig) {
                throw new Error('Signer did not return a valid signed event');
            }
            await requireAtLeastOneSuccess(this.pool.publish(relayUrls, signedEvent), 'Failed to publish signer repost to relays');
            diagnostics.log('✅ Repost published via browser signer', 'info');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            diagnostics.log(`❌ Failed to publish signer repost: ${errorMsg}`, 'error');
            throw new Error(`Failed to publish repost via signer: ${errorMsg}`);
        }
    }
    /**
     * Process and store reactions
     */
    processReactions(events) {
        for (const event of events) {
            if (!this.isValidReactionEvent(event)) {
                continue;
            }
            // Find the 'e' tag (event being reacted to)
            const eTag = event.tags.find(tag => tag[0] === 'e');
            if (!eTag || !eTag[1])
                continue;
            const targetEventId = eTag[1];
            const emoji = event.content || '❤️'; // Default to heart if empty
            const reaction = {
                id: event.id,
                pubkey: event.pubkey,
                emoji,
                createdAt: event.created_at,
            };
            // Add to reactions map
            if (!this.reactions.has(targetEventId)) {
                this.reactions.set(targetEventId, []);
            }
            // Check if user already reacted with this emoji (avoid duplicates)
            const existing = this.reactions.get(targetEventId);
            const alreadyReacted = existing.some(r => r.pubkey === reaction.pubkey && r.emoji === reaction.emoji);
            if (!alreadyReacted) {
                existing.push(reaction);
            }
        }
    }
    processInteractions(events) {
        this.processReactions(events.filter((event) => event.kind === 7));
        this.processReposts(events.filter((event) => event.kind === 6 || event.kind === 16));
        this.processZaps(events.filter((event) => event.kind === 9735 || event.kind === 9734));
    }
    processReposts(events) {
        for (const event of events) {
            if (!this.isValidSignedEvent(event))
                continue;
            const eTag = event.tags.find((tag) => tag[0] === 'e');
            if (!eTag || !eTag[1])
                continue;
            const targetEventId = eTag[1];
            if (!this.reposts.has(targetEventId)) {
                this.reposts.set(targetEventId, new Set());
            }
            this.reposts.get(targetEventId).add(event.pubkey);
        }
    }
    processZaps(events) {
        for (const event of events) {
            if (!this.isValidSignedEvent(event))
                continue;
            const eTag = event.tags.find((tag) => tag[0] === 'e');
            if (!eTag || !eTag[1])
                continue;
            const targetEventId = eTag[1];
            if (!this.zaps.has(targetEventId)) {
                this.zaps.set(targetEventId, new Set());
            }
            this.zaps.get(targetEventId).add(event.pubkey);
        }
    }
    isValidReactionEvent(event) {
        if (event.kind !== 7)
            return false;
        return this.isValidSignedEvent(event);
    }
    isValidSignedEvent(event) {
        if (!event.id || !event.pubkey || !event.sig || !Array.isArray(event.tags)) {
            return false;
        }
        try {
            return verifyEvent(event);
        }
        catch {
            return false;
        }
    }
    getRepostCount(eventId) {
        return this.reposts.get(eventId)?.size || 0;
    }
    hasUserReposted(eventId, userPubkey) {
        return this.reposts.get(eventId)?.has(userPubkey) || false;
    }
    getZapCount(eventId) {
        return this.zaps.get(eventId)?.size || 0;
    }
    /**
     * Get reactions for a specific event, grouped by emoji
     */
    getReactions(eventId) {
        const reactions = this.reactions.get(eventId) || [];
        // Group by emoji
        const grouped = new Map();
        for (const reaction of reactions) {
            if (!grouped.has(reaction.emoji)) {
                grouped.set(reaction.emoji, new Set());
            }
            grouped.get(reaction.emoji).add(reaction.pubkey);
        }
        // Convert to array
        return Array.from(grouped.entries()).map(([emoji, pubkeys]) => ({
            emoji,
            count: pubkeys.size,
            pubkeys: Array.from(pubkeys),
        }));
    }
    /**
     * Check if current user has reacted to an event
     */
    hasUserReacted(eventId, userPubkey, emoji) {
        const reactions = this.reactions.get(eventId) || [];
        return reactions.some(r => r.pubkey === userPubkey && r.emoji === emoji);
    }
    /**
     * Clear all cached reactions
     */
    clear() {
        this.reactions.clear();
        this.reposts.clear();
        this.zaps.clear();
        diagnostics.log('Cleared all reactions', 'info');
    }
    /**
     * Get reaction statistics
     */
    getStats() {
        const totalEvents = this.reactions.size;
        let totalReactions = 0;
        for (const reactions of this.reactions.values()) {
            totalReactions += reactions.length;
        }
        let totalReposts = 0;
        for (const reposts of this.reposts.values()) {
            totalReposts += reposts.size;
        }
        let totalZaps = 0;
        for (const zaps of this.zaps.values()) {
            totalZaps += zaps.size;
        }
        return {
            totalEvents,
            totalReactions,
            totalReposts,
            totalZaps,
            avgReactionsPerEvent: totalEvents > 0 ? (totalReactions / totalEvents).toFixed(1) : 0,
        };
    }
}
// Singleton instance
export const reactionManager = new ReactionManager();

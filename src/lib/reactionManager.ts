import { diagnostics } from './diagnostics';
import type { Event, Filter } from 'nostr-tools';
import { finalizeEvent, SimplePool } from 'nostr-tools';
import { batchRequestManager } from './batchRequestManager';

function hexToBytes(hex: string): Uint8Array {
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

interface Reaction {
  id: string;
  pubkey: string;
  emoji: string;
  createdAt: number;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  pubkeys: string[];
}

interface BrowserSigner {
  getPublicKey?: () => Promise<string>;
  signEvent?: (event: any) => Promise<any>;
}

/**
 * ReactionManager handles NIP-25 reactions (kind:7 events)
 * Allows users to react to posts with emojis
 */
export class ReactionManager {
  private pool: SimplePool;
  private reactions: Map<string, Reaction[]> = new Map(); // eventId -> reactions[]

  constructor() {
    this.pool = new SimplePool();
  }

  /**
   * Publish a reaction to an event
   * NIP-25: kind:7 event with 'e' and 'p' tags
   */
  async publishReaction(
    emoji: string,
    eventId: string,
    eventAuthor: string,
    privkey: string | Uint8Array,
    relayUrls: string[]
  ): Promise<void> {
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
      const signedEvent = finalizeEvent(reactionEvent, secretKey as any);

      // Publish to all relays (at least one must succeed)
      const publishPromises = relayUrls.map(relay =>
        this.pool.publish([relay], signedEvent as any)
      );

      await Promise.race(publishPromises);

      diagnostics.log(`✅ Reaction ${emoji} published successfully`, 'info');
      console.log(`✅ Reaction published: ${emoji}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`❌ Failed to publish reaction: ${errorMsg}`, 'error');
      throw new Error(`Failed to publish reaction: ${errorMsg}`);
    }
  }

  async publishReactionWithSigner(
    emoji: string,
    eventId: string,
    eventAuthor: string,
    relayUrls: string[]
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Browser signer is only available in web runtime');
    }

    const signer = (window as any).nostr as BrowserSigner | undefined;
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

      const publishPromises = relayUrls.map(relay => this.pool.publish([relay], signedEvent));
      await Promise.race(publishPromises);
      diagnostics.log(`✅ Reaction ${emoji} published via browser signer`, 'info');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`❌ Failed to publish signer reaction: ${errorMsg}`, 'error');
      throw new Error(`Failed to publish reaction via signer: ${errorMsg}`);
    }
  }

  /**
   * Fetch reactions for specific events
   */
  async fetchReactions(
    eventIds: string[],
    relayUrls: string[]
  ): Promise<void> {
    if (eventIds.length === 0) return;

    try {
      diagnostics.log(`Fetching reactions for ${eventIds.length} events`, 'info');

      // Use batch manager for optimized request
      const filter: Filter = {
        kinds: [7], // Reaction events
        '#e': eventIds, // Filter by event IDs
        limit: 1000,
      };

      batchRequestManager.addRequest(
        [filter],
        relayUrls,
        (reactions: Event[]) => {
          this.processReactions(reactions);
          diagnostics.log(`Processed ${reactions.length} reactions (batched)`, 'info');
        }
      );
    } catch (error) {
      diagnostics.log(`⚠️ Failed to fetch reactions: ${error}`, 'warn');
    }
  }

  /**
   * Process and store reactions
   */
  private processReactions(events: Event[]): void {
    for (const event of events) {
      // Find the 'e' tag (event being reacted to)
      const eTag = event.tags.find(tag => tag[0] === 'e');
      if (!eTag || !eTag[1]) continue;

      const targetEventId = eTag[1];
      const emoji = event.content || '❤️'; // Default to heart if empty

      const reaction: Reaction = {
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
      const existing = this.reactions.get(targetEventId)!;
      const alreadyReacted = existing.some(
        r => r.pubkey === reaction.pubkey && r.emoji === reaction.emoji
      );

      if (!alreadyReacted) {
        existing.push(reaction);
      }
    }
  }

  /**
   * Get reactions for a specific event, grouped by emoji
   */
  getReactions(eventId: string): ReactionGroup[] {
    const reactions = this.reactions.get(eventId) || [];
    // Group by emoji
    const grouped = new Map<string, Set<string>>();
    for (const reaction of reactions) {
      if (!grouped.has(reaction.emoji)) {
        grouped.set(reaction.emoji, new Set());
      }
      grouped.get(reaction.emoji)!.add(reaction.pubkey);
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
  hasUserReacted(eventId: string, userPubkey: string, emoji: string): boolean {
    const reactions = this.reactions.get(eventId) || [];
    return reactions.some(r => r.pubkey === userPubkey && r.emoji === emoji);
  }

  /**
   * Clear all cached reactions
   */
  clear(): void {
    this.reactions.clear();
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

    return {
      totalEvents,
      totalReactions,
      avgReactionsPerEvent: totalEvents > 0 ? (totalReactions / totalEvents).toFixed(1) : 0,
    };
  }
}

// Singleton instance
export const reactionManager = new ReactionManager();

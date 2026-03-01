import { diagnostics } from './diagnostics';
import type { Event, Filter } from 'nostr-tools';
import { finalizeEvent, SimplePool } from 'nostr-tools';
import { batchRequestManager } from './batchRequestManager';

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
    privkey: string,
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
      const signedEvent = finalizeEvent(reactionEvent, privkey as any);

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
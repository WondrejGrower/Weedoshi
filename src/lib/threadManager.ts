import { diagnostics } from './diagnostics';
import type { Event, Filter } from 'nostr-tools';
import { batchRequestManager } from './batchRequestManager';

interface Thread {
  rootId: string;
  rootEvent: Event | null;
  replies: Event[];
  replyCount: number;
}

interface EventRelationship {
  rootId: string | null;
  replyToId: string | null;
  mentions: string[];
}

/**
 * ThreadManager handles NIP-10 threading
 * Organizes events into conversation threads
 */
export class ThreadManager {
  private threads: Map<string, Thread> = new Map(); // rootId -> Thread
  private eventRelations: Map<string, EventRelationship> = new Map(); // eventId -> relations

  /**
   * Parse NIP-10 tags from an event
   * Returns root, reply, and mention event IDs
   */
  parseEventTags(event: Event): EventRelationship {
    const eTags = event.tags.filter(tag => tag[0] === 'e');
    let rootId: string | null = null;
    let replyToId: string | null = null;
    const mentions: string[] = [];

    // NIP-10: Use 'root' and 'reply' markers if present
    const rootTag = eTags.find(tag => tag[3] === 'root');
    const replyTag = eTags.find(tag => tag[3] === 'reply');
    const mentionTags = eTags.filter(tag => tag[3] === 'mention');

    if (rootTag) {
      rootId = rootTag[1];
    }

    if (replyTag) {
      replyToId = replyTag[1];
    }

    if (mentionTags.length > 0) {
      mentions.push(...mentionTags.map(tag => tag[1]));
    }

    // Fallback for deprecated format (no markers)
    if (!rootId && !replyTag && eTags.length > 0) {
      // First e tag is root
      rootId = eTags[0][1];
      // Last e tag is reply (if more than one)
      if (eTags.length > 1) {
        replyToId = eTags[eTags.length - 1][1];
        // Middle tags are mentions
        if (eTags.length > 2) {
          mentions.push(...eTags.slice(1, -1).map(tag => tag[1]));
        }
      } else {
        // Only one e tag - it's both root and reply
        replyToId = rootId;
      }
    }

    return { rootId, replyToId, mentions };
  }

  /**
   * Add event to thread structure
   */
  addEvent(event: Event): void {
    const relations = this.parseEventTags(event);
    this.eventRelations.set(event.id, relations);

    // If event has no root, it's a root event
    if (!relations.rootId) {
      if (!this.threads.has(event.id)) {
        this.threads.set(event.id, {
          rootId: event.id,
          rootEvent: event,
          replies: [],
          replyCount: 0,
        });
      } else {
        // Update root event if it was previously unknown
        const thread = this.threads.get(event.id)!;
        if (!thread.rootEvent) {
          thread.rootEvent = event;
        }
      }
    } else {
      // Event is a reply
      const rootId = relations.rootId;
      if (!this.threads.has(rootId)) {
        // Create thread with unknown root
        this.threads.set(rootId, {
          rootId,
          rootEvent: null,
          replies: [event],
          replyCount: 1,
        });
      } else {
        // Add to existing thread
        const thread = this.threads.get(rootId)!;
        // Avoid duplicates
        if (!thread.replies.some(r => r.id === event.id)) {
          thread.replies.push(event);
          thread.replyCount++;
        }
      }
    }
  }

  /**
   * Add multiple events to thread structure
   */
  addEvents(events: Event[]): void {
    for (const event of events) {
      this.addEvent(event);
    }
    diagnostics.log(`Added ${events.length} events to thread manager`, 'info');
  }

  /**
   * Get thread for a specific event (either root or reply)
   */
  getThread(eventId: string): Thread | null {
    // Check if it's a root event
    if (this.threads.has(eventId)) {
      return this.threads.get(eventId)!;
    }

    // Check if it's a reply
    const relations = this.eventRelations.get(eventId);
    if (relations?.rootId) {
      return this.threads.get(relations.rootId) || null;
    }

    return null;
  }

  /**
   * Get all threads (sorted by most recent activity)
   */
  getAllThreads(): Thread[] {
    const threads = Array.from(this.threads.values());
    // Sort by most recent reply or root event
    return threads.sort((a, b) => {
      const aTime = a.replies.length > 0 
        ? Math.max(...a.replies.map(r => r.created_at), a.rootEvent?.created_at || 0)
        : a.rootEvent?.created_at || 0;
      const bTime = b.replies.length > 0
        ? Math.max(...b.replies.map(r => r.created_at), b.rootEvent?.created_at || 0)
        : b.rootEvent?.created_at || 0;
      return bTime - aTime;
    });
  }

  /**
   * Get reply count for an event
   */
  getReplyCount(eventId: string): number {
    const thread = this.threads.get(eventId);
    return thread?.replyCount || 0;
  }

  /**
   * Get direct replies to an event
   */
  getDirectReplies(eventId: string): Event[] {
    const thread = this.getThread(eventId);
    if (!thread) return [];

    // Filter replies that directly reply to this event
    return thread.replies.filter(reply => {
      const relations = this.eventRelations.get(reply.id);
      return relations?.replyToId === eventId;
    });
  }

  /**
   * Get all replies in a thread (sorted by time)
   */
  getThreadReplies(eventId: string): Event[] {
    const thread = this.getThread(eventId);
    if (!thread) return [];

    return thread.replies.sort((a, b) => a.created_at - b.created_at);
  }

  /**
   * Check if event is a reply
   */
  isReply(eventId: string): boolean {
    const relations = this.eventRelations.get(eventId);
    return relations?.rootId !== null;
  }

  /**
   * Check if event is a root (not a reply)
   */
  isRoot(eventId: string): boolean {
    return !this.isReply(eventId);
  }

  /**
   * Get event relationships
   */
  getRelationships(eventId: string): EventRelationship | null {
    return this.eventRelations.get(eventId) || null;
  }

  /**
   * Clear all threads
   */
  clear(): void {
    this.threads.clear();
    this.eventRelations.clear();
    diagnostics.log('Cleared all threads', 'info');
  }

  /**
   * Get threading statistics
   */
  getStats() {
    const totalThreads = this.threads.size;
    let totalReplies = 0;
    let maxReplies = 0;
    for (const thread of this.threads.values()) {
      totalReplies += thread.replyCount;
      maxReplies = Math.max(maxReplies, thread.replyCount);
    }

    return {
      totalThreads,
      totalReplies,
      avgRepliesPerThread: totalThreads > 0 ? (totalReplies / totalThreads).toFixed(1) : 0,
      maxReplies,
    };
  }

  /**
   * Fetch thread replies for specific events (using batch manager)
   */
  async fetchThreadReplies(
    eventIds: string[],
    relayUrls: string[]
  ): Promise<void> {
    if (eventIds.length === 0) return;

    try {
      diagnostics.log(`Fetching thread replies for ${eventIds.length} events`, 'info');

      // Use batch manager for optimized request
      const filter: Filter = {
        kinds: [1], // Text notes
        '#e': eventIds, // Replies to these events
        limit: 500,
      };

      batchRequestManager.addRequest(
        [filter],
        relayUrls,
        (replies: Event[]) => {
          this.addEvents(replies);
          diagnostics.log(`Processed ${replies.length} thread replies (batched)`, 'info');
        }
      );
    } catch (error) {
      diagnostics.log(`⚠️ Failed to fetch thread replies: ${error}`, 'warn');
    }
  }
}

// Singleton instance
export const threadManager = new ThreadManager();
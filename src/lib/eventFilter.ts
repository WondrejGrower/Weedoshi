import type { NostrEvent } from './nostrClient';

export type FilteredEvent = NostrEvent & {
  hashtags: string[];
  timestamp: string;
  author: string;
  id: string;
  content: string;
};

/**
 * Extract hashtags from event tags (preferred method)
 */
export function extractTagHashtags(event: NostrEvent): string[] {
  const hashtags: string[] = [];
  const tags = event.tags || [];
  
  for (const tag of tags) {
    if (tag[0] === 't' && tag[1]) {
      hashtags.push(tag[1].toLowerCase());
    }
  }
  
  return hashtags;
}

/**
 * Parse hashtags from event content (fallback method)
 */
export function parseContentHashtags(content: string): string[] {
  const hashtags: string[] = [];
  const regex = /#(\w+)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  
  return hashtags;
}

/**
 * Get all hashtags from an event (tags preferred, then content)
 */
export function getAllHashtags(event: NostrEvent): string[] {
  const tagHashtags = extractTagHashtags(event);
  if (tagHashtags.length > 0) {
    return tagHashtags;
  }
  return parseContentHashtags(event.content);
}

/**
 * Check if event matches any of the target hashtags
 */
export function matchesHashtags(event: NostrEvent, targetHashtags: string[]): boolean {
  const eventHashtags = getAllHashtags(event);
  const normalizedTargets = targetHashtags.map(h => h.toLowerCase());
  
  return eventHashtags.some(h => normalizedTargets.includes(h));
}

/**
 * Filter events by hashtags and deduplicate by event ID
 */
export function filterAndDeduplicateEvents(
  events: NostrEvent[],
  targetHashtags: string[]
): FilteredEvent[] {
  const seen = new Set<string>();
  const filtered: FilteredEvent[] = [];
  
  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    
    if (matchesHashtags(event, targetHashtags)) {
      seen.add(event.id);
      const hashtags = getAllHashtags(event);
      const date = new Date(event.created_at * 1000);
      const timestamp = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      filtered.push({
        ...event,
        hashtags,
        timestamp,
        author: event.pubkey,
        id: event.id,
        content: event.content,
      });
    }
  }
  
  return filtered.sort((a, b) => b.created_at - a.created_at);
}
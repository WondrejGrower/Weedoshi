/**
 * Extract hashtags from event tags (preferred method)
 */
export function extractTagHashtags(event) {
    const hashtags = [];
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
export function parseContentHashtags(content) {
    const hashtags = [];
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
export function getAllHashtags(event) {
    const tagHashtags = extractTagHashtags(event);
    if (tagHashtags.length > 0) {
        return tagHashtags;
    }
    return parseContentHashtags(event.content);
}
/**
 * Check if event matches any of the target hashtags
 */
export function matchesHashtags(event, targetHashtags) {
    const eventHashtags = getAllHashtags(event);
    const normalizedTargets = targetHashtags.map(h => h.toLowerCase());
    return eventHashtags.some(h => normalizedTargets.includes(h));
}
/**
 * Filter events by hashtags and deduplicate by event ID
 */
export function filterAndDeduplicateEvents(events, targetHashtags) {
    const seen = new Set();
    const filtered = [];
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
/**
 * Deduplicate and format events without hashtag filtering.
 * Used as a safe fallback when strict hashtag matching yields no results.
 */
export function deduplicateAndFormatEvents(events) {
    const seen = new Set();
    const formatted = [];
    for (const event of events) {
        if (seen.has(event.id)) {
            continue;
        }
        seen.add(event.id);
        const hashtags = getAllHashtags(event);
        const date = new Date(event.created_at * 1000);
        const timestamp = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        formatted.push({
            ...event,
            hashtags,
            timestamp,
            author: event.pubkey,
            id: event.id,
            content: event.content,
        });
    }
    return formatted.sort((a, b) => b.created_at - a.created_at);
}

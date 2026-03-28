const FEED_SEARCH_STOPWORDS = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'from',
    'have',
    'just',
    'your',
    'about',
    'weed',
    'plant',
]);
function normalize(input) {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
export function tokenizeFeedSearchText(input, limit = 28) {
    const normalized = normalize(input);
    const tokens = normalized.match(/[a-z0-9_#]{2,}/g) || [];
    return tokens
        .filter((token) => token.length > 2 && !FEED_SEARCH_STOPWORDS.has(token))
        .slice(0, limit);
}
export function splitFeedQueryTerms(queryInput) {
    return normalize(queryInput)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}
export function eventMatchesFeedQuery(event, queryTerms, authorLabel) {
    if (queryTerms.length === 0)
        return true;
    const keywordSpace = [
        event.content || '',
        event.author || '',
        authorLabel || '',
        event.hashtags.map((tag) => `#${tag}`).join(' '),
    ]
        .join(' ')
        .toLowerCase();
    return queryTerms.every((term) => keywordSpace.includes(term));
}
export function buildFeedSearchSuggestions(events, authorNames, queryInput, maxSuggestions = 8) {
    const query = queryInput.trim().toLowerCase();
    if (!query)
        return [];
    const scores = new Map();
    const addScore = (keyword, value) => {
        if (!keyword)
            return;
        scores.set(keyword, (scores.get(keyword) || 0) + value);
    };
    for (const event of events.slice(0, 260)) {
        for (const tag of event.hashtags.slice(0, 8)) {
            addScore(`#${tag.toLowerCase()}`, 6);
            addScore(tag.toLowerCase(), 4);
        }
        for (const token of tokenizeFeedSearchText(event.content || '', 20)) {
            addScore(token, 1);
        }
        const authorName = authorNames[event.author] || '';
        for (const token of tokenizeFeedSearchText(authorName, 8)) {
            addScore(token, 3);
        }
    }
    return Array.from(scores.entries())
        .map(([keyword, score]) => ({ keyword, score }))
        .filter((item) => item.keyword.includes(query))
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.keyword.localeCompare(b.keyword);
    })
        .slice(0, maxSuggestions)
        .map((item) => item.keyword);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContentHashtags, filterAndDeduplicateEvents } from '../../src/lib/eventFilter';
test('parseContentHashtags normalizes hashtag values', () => {
    const parsed = parseContentHashtags('Grow #Weedoshi with #GrowLog and #weed');
    assert.deepEqual(parsed, ['weedoshi', 'growlog', 'weed']);
});
test('filterAndDeduplicateEvents filters by hashtag, deduplicates, and sorts newest-first', () => {
    const base = {
        kind: 1,
        pubkey: 'a'.repeat(64),
        sig: 'b'.repeat(128),
    };
    const events = [
        {
            ...base,
            id: 'event-old',
            created_at: 100,
            content: 'Old #weed',
            tags: [['t', 'weed']],
        },
        {
            ...base,
            id: 'event-new',
            created_at: 200,
            content: 'New #weed',
            tags: [['t', 'weed']],
        },
        {
            ...base,
            id: 'event-new',
            created_at: 200,
            content: 'Duplicate #weed',
            tags: [['t', 'weed']],
        },
        {
            ...base,
            id: 'event-skip',
            created_at: 300,
            content: 'No matching hashtag',
            tags: [['t', 'nostr']],
        },
    ];
    const filtered = filterAndDeduplicateEvents(events, ['weed']);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, 'event-new');
    assert.equal(filtered[1].id, 'event-old');
});

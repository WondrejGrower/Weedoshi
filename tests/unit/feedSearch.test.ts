import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedSearchSuggestions,
  eventMatchesFeedQuery,
  splitFeedQueryTerms,
} from '../../src/features/home/feedSearch';
import type { FilteredEvent } from '../../src/lib/eventFilter';

function makeEvent(id: string, content: string, hashtags: string[], author: string): FilteredEvent {
  return {
    id,
    pubkey: author,
    created_at: 1700000000,
    kind: 1,
    sig: 'sig',
    content,
    tags: [],
    hashtags,
    timestamp: 'Jan 1',
    author,
  };
}

test('splitFeedQueryTerms normalizes and tokenizes query', () => {
  const terms = splitFeedQueryTerms('  Wondřej   grow  ');
  assert.deepEqual(terms, ['wondrej', 'grow']);
});

test('eventMatchesFeedQuery matches content, hashtags, and author labels', () => {
  const event = makeEvent('e1', 'My grow diary update', ['weedstr'], 'pubkey123');
  assert.equal(eventMatchesFeedQuery(event, ['grow']), true);
  assert.equal(eventMatchesFeedQuery(event, ['#weedstr']), true);
  assert.equal(eventMatchesFeedQuery(event, ['wondrej'], 'Wondrej Grower'), true);
  assert.equal(eventMatchesFeedQuery(event, ['missing']), false);
});

test('buildFeedSearchSuggestions prioritizes common hashtags and known author terms', () => {
  const events = [
    makeEvent('1', 'Wondrej posted new setup with lamp', ['weedstr', 'setup'], 'pk1'),
    makeEvent('2', 'Another setup with nutrients', ['setup'], 'pk2'),
  ];
  const authorNames = { pk1: 'Wondrej', pk2: 'Grow Mate' };

  const suggestions = buildFeedSearchSuggestions(events, authorNames, 'se');
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0], '#setup');
  assert.ok(suggestions.includes('setup'));
});

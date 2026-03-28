import test from 'node:test';
import assert from 'node:assert/strict';
import { SimplePool, type Event } from 'nostr-tools';
import { fetchGrowmiesList, fetchPublicDiaries } from '../../src/lib/nostrSync';
import { eventValidator } from '../../src/lib/eventValidator';

test('fetchPublicDiaries ignores events rejected by validator', async () => {
  const validDiaryEvent = {
    id: 'valid-diary',
    pubkey: 'a'.repeat(64),
    kind: 30078,
    created_at: 1700000100,
    tags: [
      ['d', 'diary-run-a'],
      ['t', 'weedoshi-diary'],
    ],
    content: JSON.stringify({
      id: 'run-a',
      title: 'Run A',
      items: [],
      createdAt: 1700000000,
      updatedAt: 1700000100,
    }),
    sig: 'f'.repeat(128),
  } as unknown as Event;
  const invalidDiaryEvent = {
    ...validDiaryEvent,
    id: 'invalid-diary',
    created_at: 1700000200,
    content: JSON.stringify({ title: 'tampered' }),
  } as Event;

  const originalQuerySync = (SimplePool.prototype as any).querySync;
  const originalClose = (SimplePool.prototype as any).close;
  const originalValidate = eventValidator.validateEvent.bind(eventValidator);

  (SimplePool.prototype as any).querySync = async () => [invalidDiaryEvent, validDiaryEvent];
  (SimplePool.prototype as any).close = () => {};
  (eventValidator as any).validateEvent = (event: Event) => event.id !== 'invalid-diary';

  try {
    const result = await fetchPublicDiaries('a'.repeat(64), ['wss://relay.damus.io']);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'run-a');
    assert.equal(result[0].title, 'Run A');
  } finally {
    (SimplePool.prototype as any).querySync = originalQuerySync;
    (SimplePool.prototype as any).close = originalClose;
    (eventValidator as any).validateEvent = originalValidate;
  }
});

test('fetchGrowmiesList ignores events rejected by validator and returns latest valid list', async () => {
  const validGrowmiesEvent = {
    id: 'valid-growmies',
    pubkey: 'a'.repeat(64),
    kind: 30000,
    created_at: 1700000100,
    tags: [
      ['d', 'growmies'],
      ['p', 'b'.repeat(64)],
      ['p', 'c'.repeat(64)],
    ],
    content: JSON.stringify({ title: 'growmies', updatedAt: 1700000100 }),
    sig: 'f'.repeat(128),
  } as unknown as Event;
  const invalidGrowmiesEvent = {
    ...validGrowmiesEvent,
    id: 'invalid-growmies',
    created_at: 1700000200,
    content: JSON.stringify({ title: 'tampered' }),
  } as Event;

  const originalQuerySync = (SimplePool.prototype as any).querySync;
  const originalClose = (SimplePool.prototype as any).close;
  const originalValidate = eventValidator.validateEvent.bind(eventValidator);

  (SimplePool.prototype as any).querySync = async () => [invalidGrowmiesEvent, validGrowmiesEvent];
  (SimplePool.prototype as any).close = () => {};
  (eventValidator as any).validateEvent = (event: Event) => event.id !== 'invalid-growmies';

  try {
    const result = await fetchGrowmiesList('a'.repeat(64), ['wss://relay.damus.io']);
    assert.ok(result);
    assert.deepEqual(result?.authors, ['b'.repeat(64), 'c'.repeat(64)]);
  } finally {
    (SimplePool.prototype as any).querySync = originalQuerySync;
    (SimplePool.prototype as any).close = originalClose;
    (eventValidator as any).validateEvent = originalValidate;
  }
});

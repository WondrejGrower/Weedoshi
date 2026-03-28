import test from 'node:test';
import assert from 'node:assert/strict';
import type { Event } from 'nostr-tools';
import { nostrClient } from '../../src/lib/nostrClient';
import { eventCache } from '../../src/lib/eventCache';
import { eventValidator } from '../../src/lib/eventValidator';

test('nostrClient skips cached events rejected by validator before emitting to feed', async () => {
  const valid = {
    id: 'valid-cache-event',
    pubkey: 'a'.repeat(64),
    kind: 1,
    created_at: 1700000000,
    tags: [],
    content: 'hello',
    sig: 'f'.repeat(128),
  } as unknown as Event;
  const invalid = {
    ...valid,
    id: 'invalid-cache-event',
    content: 'tampered',
  } as Event;

  const originalGetEvents = eventCache.getEvents.bind(eventCache);
  const originalSubscribeMany = (nostrClient as any).pool.subscribeMany;
  const originalValidate = eventValidator.validateEvent.bind(eventValidator);

  eventCache.getEvents = async () => [invalid, valid];
  (nostrClient as any).pool.subscribeMany = () => ({
    close: () => {},
  });
  (eventValidator as any).validateEvent = (event: Event) => event.id !== 'invalid-cache-event';
  nostrClient.setRelays(['wss://relay.damus.io']);

  const received: Event[] = [];
  try {
    const subId = await nostrClient.subscribeFeed([], 0, (event) => {
      received.push(event as Event);
    });
    nostrClient.unsubscribe(subId);
    assert.equal(received.length, 1);
    assert.equal(received[0].id, valid.id);
  } finally {
    eventCache.getEvents = originalGetEvents;
    (nostrClient as any).pool.subscribeMany = originalSubscribeMany;
    (eventValidator as any).validateEvent = originalValidate;
  }
});

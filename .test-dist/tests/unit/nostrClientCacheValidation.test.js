import test from 'node:test';
import assert from 'node:assert/strict';
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
    };
    const invalid = {
        ...valid,
        id: 'invalid-cache-event',
        content: 'tampered',
    };
    const originalGetEvents = eventCache.getEvents.bind(eventCache);
    const originalSubscribeMany = nostrClient.pool.subscribeMany;
    const originalValidate = eventValidator.validateEvent.bind(eventValidator);
    eventCache.getEvents = async () => [invalid, valid];
    nostrClient.pool.subscribeMany = () => ({
        close: () => { },
    });
    eventValidator.validateEvent = (event) => event.id !== 'invalid-cache-event';
    nostrClient.setRelays(['wss://relay.damus.io']);
    const received = [];
    try {
        const subId = await nostrClient.subscribeFeed([], 0, (event) => {
            received.push(event);
        });
        nostrClient.unsubscribe(subId);
        assert.equal(received.length, 1);
        assert.equal(received[0].id, valid.id);
    }
    finally {
        eventCache.getEvents = originalGetEvents;
        nostrClient.pool.subscribeMany = originalSubscribeMany;
        eventValidator.validateEvent = originalValidate;
    }
});

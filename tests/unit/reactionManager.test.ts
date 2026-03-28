import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { finalizeEvent } from 'nostr-tools';
import { ReactionManager } from '../../src/lib/reactionManager';

function makeSecretKey(seed: number): Uint8Array {
  const key = new Uint8Array(32);
  key.fill(seed);
  return key;
}

test('reactionManager ignores reactions with invalid signatures', () => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
  }

  const manager = new ReactionManager();
  const secretKey = makeSecretKey(7);
  const targetEventId = 'f'.repeat(64);
  const targetAuthor = 'a'.repeat(64);

  const validReaction = finalizeEvent(
    {
      kind: 7,
      created_at: 1710000000,
      tags: [
        ['e', targetEventId],
        ['p', targetAuthor],
      ],
      content: '🔥',
    },
    secretKey
  );

  const invalidReaction = {
    ...validReaction,
    sig: '0'.repeat(128),
  };

  (
    manager as unknown as {
      processReactions: (events: Array<typeof validReaction>) => void;
    }
  ).processReactions([invalidReaction, validReaction]);

  const groups = manager.getReactions(targetEventId);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].emoji, '🔥');
  assert.equal(groups[0].count, 1);
});

test('reactionManager tracks repost and zap counts from interactions', () => {
  const manager = new ReactionManager();
  const targetEventId = 'e'.repeat(64);

  const repostA = {
    id: 'repost-a',
    kind: 6,
    pubkey: 'a'.repeat(64),
    created_at: 1710000001,
    tags: [['e', targetEventId]],
    content: '',
    sig: 'f'.repeat(128),
  };
  const repostB = {
    ...repostA,
    id: 'repost-b',
    pubkey: 'b'.repeat(64),
  };
  const zapA = {
    id: 'zap-a',
    kind: 9735,
    pubkey: 'c'.repeat(64),
    created_at: 1710000002,
    tags: [['e', targetEventId]],
    content: '',
    sig: 'f'.repeat(128),
  };

  const originalValidate = (
    manager as unknown as {
      isValidSignedEvent: (event: unknown) => boolean;
    }
  ).isValidSignedEvent;

  (
    manager as unknown as {
      isValidSignedEvent: (event: unknown) => boolean;
      processInteractions: (events: unknown[]) => void;
    }
  ).isValidSignedEvent = () => true;

  (
    manager as unknown as {
      processInteractions: (events: unknown[]) => void;
    }
  ).processInteractions([repostA, repostB, zapA]);

  assert.equal(manager.getRepostCount(targetEventId), 2);
  assert.equal(manager.getZapCount(targetEventId), 1);
  assert.equal(manager.hasUserReposted(targetEventId, 'a'.repeat(64)), true);

  (
    manager as unknown as {
      isValidSignedEvent: (event: unknown) => boolean;
    }
  ).isValidSignedEvent = originalValidate;
});

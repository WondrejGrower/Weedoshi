import test from 'node:test';
import assert from 'node:assert/strict';
import { relayManager } from '../../src/lib/relayManager';

test('relayManager rejects non-wss relay URLs', () => {
  assert.throws(
    () => relayManager.addRelay('ws://example.com'),
    /must use wss:\/\//
  );
});

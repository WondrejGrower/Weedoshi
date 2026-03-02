import test from 'node:test';
import assert from 'node:assert/strict';
import { publishPublicDiary } from '../../src/lib/nostrSync';
import type { AuthState } from '../../src/lib/authManager';
import type { Diary } from '../../src/lib/diaryStore';

test('publishPublicDiary fails before publish when no signer is available', async () => {
  (globalThis as any).window = {};

  const diary: Diary = {
    id: 'run-1',
    title: 'Run 1',
    createdAt: 1700000000,
    updatedAt: 1700000000,
    isPublic: true,
    syncStatus: 'local-only',
    items: [],
  };

  const authState: AuthState = {
    isLoggedIn: true,
    isReadOnly: false,
    pubkey: 'd'.repeat(64),
    privkey: null,
    method: 'signer',
  };

  await assert.rejects(
    () => publishPublicDiary(diary, authState, ['wss://relay.damus.io']),
    /No signing method available/
  );
});

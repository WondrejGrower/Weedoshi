import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { diaryStore } from '../../src/lib/diaryStore';
async function clearStorage() {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
        await AsyncStorage.multiRemove(keys);
    }
}
test('diaryStore creates diary and manages items', async () => {
    await clearStorage();
    await diaryStore.setUser('pubkey-diary-user');
    const diary = await diaryStore.createDiary('My Run', false);
    assert.ok(diary.id.length > 0);
    const event = {
        id: 'event-1',
        pubkey: 'author-1',
        created_at: 1700000000,
        kind: 1,
        tags: [],
        content: 'Plant update',
        sig: 'f'.repeat(128),
    };
    await diaryStore.addItemToDiary(diary.id, event);
    await diaryStore.addItemToDiary(diary.id, event); // duplicate ignored
    const withItem = diaryStore.getDiary(diary.id);
    assert.equal(withItem?.items.length, 1);
    assert.equal(withItem?.items[0].eventId, 'event-1');
    await diaryStore.removeItemFromDiary(diary.id, 'event-1');
    const afterRemove = diaryStore.getDiary(diary.id);
    assert.equal(afterRemove?.items.length, 0);
});

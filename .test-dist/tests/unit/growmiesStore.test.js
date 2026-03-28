import test from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { growmiesStore } from '../../src/lib/growmiesStore';
async function clearStorage() {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
        await AsyncStorage.multiRemove(keys);
    }
}
test('growmiesStore manages unique list and onlyGrowmies flag', async () => {
    await clearStorage();
    await growmiesStore.setUser('pubkey-growmies-user');
    await growmiesStore.add('alice');
    await growmiesStore.add('alice');
    await growmiesStore.add('bob');
    assert.deepEqual(growmiesStore.list().sort(), ['alice', 'bob']);
    await growmiesStore.setOnlyGrowmies(true);
    assert.equal(growmiesStore.isOnlyGrowmies(), true);
    await growmiesStore.remove('alice');
    assert.deepEqual(growmiesStore.list(), ['bob']);
});

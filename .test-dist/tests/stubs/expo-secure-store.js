const store = new Map();
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export async function setItemAsync(key, value, _options) {
    store.set(key, value);
}
export async function getItemAsync(key) {
    return store.has(key) ? store.get(key) : null;
}
export async function deleteItemAsync(key) {
    store.delete(key);
}
export function __resetSecureStore() {
    store.clear();
}

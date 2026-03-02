const store = new Map();

const AsyncStorage = {
  async setItem(key, value) {
    store.set(key, value);
  },
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async removeItem(key) {
    store.delete(key);
  },
  async getAllKeys() {
    return Array.from(store.keys());
  },
  async multiGet(keys) {
    return keys.map((key) => [key, store.has(key) ? store.get(key) : null]);
  },
  async multiRemove(keys) {
    for (const key of keys) {
      store.delete(key);
    }
  },
};

module.exports = AsyncStorage;

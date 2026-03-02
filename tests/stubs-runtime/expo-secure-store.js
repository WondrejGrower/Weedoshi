const store = new Map();

const SecureStore = {
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  async setItemAsync(key, value) {
    store.set(key, value);
  },
  async getItemAsync(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async deleteItemAsync(key) {
    store.delete(key);
  },
};

module.exports = SecureStore;

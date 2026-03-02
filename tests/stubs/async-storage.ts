const store = new Map<string, string>();

const AsyncStorage = {
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? store.get(key)! : null;
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },
  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    return keys.map((key) => [key, store.has(key) ? store.get(key)! : null]);
  },
  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      store.delete(key);
    }
  },
};

export function __resetAsyncStorage() {
  store.clear();
}

export default AsyncStorage;

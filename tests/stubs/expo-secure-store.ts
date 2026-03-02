const store = new Map<string, string>();

export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';

export async function setItemAsync(
  key: string,
  value: string,
  _options?: { keychainAccessible?: string }
): Promise<void> {
  store.set(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? store.get(key)! : null;
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export function __resetSecureStore() {
  store.clear();
}

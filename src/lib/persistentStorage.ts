import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type JsonValue = unknown;

const DB_NAME = 'weedoshi-db';
const STORE_NAME = 'kv';
const STORAGE_PREFIX = 'weedoshi:';

function isWebRuntime(): boolean {
  return Platform.OS === 'web';
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onerror = () => reject(req.error || new Error('IndexedDB set failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'));
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'));
  });
}

function fullKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

async function getRaw(key: string): Promise<string | null> {
  const scoped = fullKey(key);

  if (isWebRuntime()) {
    if (hasIndexedDb()) {
      try {
        return await idbGet(scoped);
      } catch {
        // fallback below
      }
    }

    if (hasLocalStorage()) {
      return localStorage.getItem(scoped);
    }
  }

  return await AsyncStorage.getItem(scoped);
}

async function setRaw(key: string, value: string): Promise<void> {
  const scoped = fullKey(key);

  if (isWebRuntime()) {
    if (hasIndexedDb()) {
      try {
        await idbSet(scoped, value);
        return;
      } catch {
        // fallback below
      }
    }

    if (hasLocalStorage()) {
      localStorage.setItem(scoped, value);
      return;
    }
  }

  await AsyncStorage.setItem(scoped, value);
}

async function removeRaw(key: string): Promise<void> {
  const scoped = fullKey(key);

  if (isWebRuntime()) {
    if (hasIndexedDb()) {
      try {
        await idbDelete(scoped);
      } catch {
        // fallback below
      }
    }

    if (hasLocalStorage()) {
      localStorage.removeItem(scoped);
      return;
    }
  }

  await AsyncStorage.removeItem(scoped);
}

export async function getJson<T = JsonValue>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await getRaw(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: JsonValue): Promise<void> {
  await setRaw(key, JSON.stringify(value));
}

export async function removeJson(key: string): Promise<void> {
  await removeRaw(key);
}

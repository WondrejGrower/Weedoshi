import AsyncStorage from '@react-native-async-storage/async-storage';
const DB_NAME = 'weedoshi-db';
const STORE_NAME = 'kv';
const STORAGE_PREFIX = 'weedoshi:';
function isWebRuntime() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}
function hasIndexedDb() {
    return typeof indexedDB !== 'undefined';
}
function hasLocalStorage() {
    return typeof localStorage !== 'undefined';
}
async function openDb() {
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
async function idbGet(key) {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
        req.onsuccess = () => resolve(req.result ?? null);
    });
}
async function idbSet(key, value) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onerror = () => reject(req.error || new Error('IndexedDB set failed'));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'));
    });
}
async function idbDelete(key) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'));
    });
}
function fullKey(key) {
    return `${STORAGE_PREFIX}${key}`;
}
async function getRaw(key) {
    const scoped = fullKey(key);
    if (isWebRuntime()) {
        if (hasIndexedDb()) {
            try {
                return await idbGet(scoped);
            }
            catch {
                // fallback below
            }
        }
        if (hasLocalStorage()) {
            return localStorage.getItem(scoped);
        }
    }
    return await AsyncStorage.getItem(scoped);
}
async function setRaw(key, value) {
    const scoped = fullKey(key);
    if (isWebRuntime()) {
        if (hasIndexedDb()) {
            try {
                await idbSet(scoped, value);
                return;
            }
            catch {
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
async function removeRaw(key) {
    const scoped = fullKey(key);
    if (isWebRuntime()) {
        if (hasIndexedDb()) {
            try {
                await idbDelete(scoped);
            }
            catch {
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
export async function getJson(key, fallback) {
    try {
        const raw = await getRaw(key);
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export async function setJson(key, value) {
    await setRaw(key, JSON.stringify(value));
}
export async function removeJson(key) {
    await removeRaw(key);
}

import { getJson, setJson } from './persistentStorage';
import { fetchGrowmiesList, publishGrowmiesList } from './nostrSync';
const VERSION = 1;
function keyFor(pubkey) {
    return `growmies:${pubkey}`;
}
function nowTs() {
    return Math.floor(Date.now() / 1000);
}
function defaultState() {
    const ts = nowTs();
    return {
        listId: 'growmies',
        title: 'Growmies',
        authors: [],
        onlyGrowmies: false,
        createdAt: ts,
        updatedAt: ts,
        syncStatus: 'local-only',
    };
}
class GrowmiesStore {
    constructor() {
        Object.defineProperty(this, "pubkey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: defaultState()
        });
    }
    async setUser(pubkey) {
        this.pubkey = pubkey;
        if (!pubkey) {
            this.state = defaultState();
            return;
        }
        const persisted = await getJson(keyFor(pubkey), null);
        if (!persisted || persisted.version !== VERSION) {
            this.state = defaultState();
            await this.persist();
            return;
        }
        this.state = persisted.state;
    }
    async persist() {
        if (!this.pubkey)
            return;
        await setJson(keyFor(this.pubkey), {
            version: VERSION,
            state: this.state,
        });
    }
    getState() {
        return {
            ...this.state,
            authors: [...this.state.authors],
        };
    }
    list() {
        return [...this.state.authors];
    }
    isOnlyGrowmies() {
        return this.state.onlyGrowmies;
    }
    async setOnlyGrowmies(enabled) {
        this.state.onlyGrowmies = enabled;
        this.state.updatedAt = nowTs();
        await this.persist();
    }
    async add(pubkey) {
        const normalized = pubkey.trim();
        if (!normalized)
            return;
        if (this.state.authors.includes(normalized))
            return;
        this.state.authors.push(normalized);
        this.state.updatedAt = nowTs();
        if (this.state.syncStatus === 'synced') {
            this.state.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async remove(pubkey) {
        this.state.authors = this.state.authors.filter((item) => item !== pubkey);
        this.state.updatedAt = nowTs();
        if (this.state.syncStatus === 'synced') {
            this.state.syncStatus = 'local-only';
        }
        await this.persist();
    }
    async sync(authState, relayUrls) {
        this.state.syncStatus = 'syncing';
        this.state.syncError = undefined;
        await this.persist();
        try {
            await publishGrowmiesList(this.state, authState, relayUrls);
            this.state.syncStatus = 'synced';
            this.state.updatedAt = nowTs();
            this.state.syncError = undefined;
            await this.persist();
        }
        catch (error) {
            this.state.syncStatus = 'error';
            this.state.syncError = error instanceof Error ? error.message : 'Growmies sync failed';
            await this.persist();
            throw error;
        }
    }
    async mergeFromRelays(ownerPubkey, relayUrls) {
        const remote = await fetchGrowmiesList(ownerPubkey, relayUrls);
        if (!remote)
            return false;
        const merged = Array.from(new Set([...this.state.authors, ...remote.authors]));
        const changed = merged.length !== this.state.authors.length;
        if (!changed)
            return false;
        this.state.authors = merged;
        this.state.syncStatus = 'synced';
        this.state.updatedAt = nowTs();
        await this.persist();
        return true;
    }
}
export const growmiesStore = new GrowmiesStore();

import type { AuthState } from './authManager';
import { getJson, setJson } from './persistentStorage';
import { fetchGrowmiesList, publishGrowmiesList } from './nostrSync';

export type GrowmiesSyncStatus = 'local-only' | 'syncing' | 'synced' | 'error';

export interface GrowmiesState {
  listId: string;
  title: string;
  authors: string[];
  onlyGrowmies: boolean;
  createdAt: number;
  updatedAt: number;
  syncStatus: GrowmiesSyncStatus;
  syncError?: string;
}

interface PersistedGrowmies {
  version: number;
  state: GrowmiesState;
}

const VERSION = 1;

function keyFor(pubkey: string): string {
  return `growmies:${pubkey}`;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

function defaultState(): GrowmiesState {
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
  private pubkey: string | null = null;
  private state: GrowmiesState = defaultState();

  async setUser(pubkey: string | null): Promise<void> {
    this.pubkey = pubkey;
    if (!pubkey) {
      this.state = defaultState();
      return;
    }

    const persisted = await getJson<PersistedGrowmies | null>(keyFor(pubkey), null);
    if (!persisted || persisted.version !== VERSION) {
      this.state = defaultState();
      await this.persist();
      return;
    }

    this.state = persisted.state;
  }

  private async persist(): Promise<void> {
    if (!this.pubkey) return;
    await setJson(keyFor(this.pubkey), {
      version: VERSION,
      state: this.state,
    } as PersistedGrowmies);
  }

  getState(): GrowmiesState {
    return {
      ...this.state,
      authors: [...this.state.authors],
    };
  }

  list(): string[] {
    return [...this.state.authors];
  }

  isOnlyGrowmies(): boolean {
    return this.state.onlyGrowmies;
  }

  async setOnlyGrowmies(enabled: boolean): Promise<void> {
    this.state.onlyGrowmies = enabled;
    this.state.updatedAt = nowTs();
    await this.persist();
  }

  async add(pubkey: string): Promise<void> {
    const normalized = pubkey.trim();
    if (!normalized) return;
    if (this.state.authors.includes(normalized)) return;
    this.state.authors.push(normalized);
    this.state.updatedAt = nowTs();
    if (this.state.syncStatus === 'synced') {
      this.state.syncStatus = 'local-only';
    }
    await this.persist();
  }

  async remove(pubkey: string): Promise<void> {
    this.state.authors = this.state.authors.filter((item) => item !== pubkey);
    this.state.updatedAt = nowTs();
    if (this.state.syncStatus === 'synced') {
      this.state.syncStatus = 'local-only';
    }
    await this.persist();
  }

  async sync(authState: AuthState, relayUrls: string[]): Promise<void> {
    this.state.syncStatus = 'syncing';
    this.state.syncError = undefined;
    await this.persist();

    try {
      await publishGrowmiesList(this.state, authState, relayUrls);
      this.state.syncStatus = 'synced';
      this.state.updatedAt = nowTs();
      this.state.syncError = undefined;
      await this.persist();
    } catch (error) {
      this.state.syncStatus = 'error';
      this.state.syncError = error instanceof Error ? error.message : 'Growmies sync failed';
      await this.persist();
      throw error;
    }
  }

  async mergeFromRelays(ownerPubkey: string, relayUrls: string[]): Promise<boolean> {
    const remote = await fetchGrowmiesList(ownerPubkey, relayUrls);
    if (!remote) return false;

    const merged = Array.from(new Set([...this.state.authors, ...remote.authors]));
    const changed = merged.length !== this.state.authors.length;
    if (!changed) return false;

    this.state.authors = merged;
    this.state.syncStatus = 'synced';
    this.state.updatedAt = nowTs();
    await this.persist();
    return true;
  }
}

export const growmiesStore = new GrowmiesStore();

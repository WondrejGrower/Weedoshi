import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Relay {
  url: string;
  enabled: boolean;
  custom?: boolean;
}

const DEFAULT_RELAYS: Relay[] = [
  { url: 'wss://relay.damus.io', enabled: true },
  { url: 'wss://relay.snort.social', enabled: true },
  { url: 'wss://nostr.band', enabled: true },
  { url: 'wss://nostr-pub.wellorder.net', enabled: false },
];

class RelayManager {
  private relays: Relay[] = [...DEFAULT_RELAYS];

  constructor() {
    // Sync init with defaults
  }

  async loadState() {
    await this.loadFromStorage();
  }

  getAllRelays(): Relay[] {
    return [...this.relays];
  }

  getEnabledUrls(): string[] {
    return this.relays
      .filter(r => r.enabled)
      .map(r => r.url);
  }

  enableRelay(url: string): void {
    const relay = this.relays.find(r => r.url === url);
    if (relay) {
      relay.enabled = true;
      this.saveToStorage();
    }
  }

  disableRelay(url: string): void {
    const relay = this.relays.find(r => r.url === url);
    if (relay) {
      relay.enabled = false;
      this.saveToStorage();
    }
  }

  addRelay(url: string): boolean {
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid relay URL');
    }

    if (this.relays.some(r => r.url === url)) {
      return false;
    }

    this.relays.push({ url, enabled: true, custom: true });
    this.saveToStorage();
    return true;
  }

  removeRelay(url: string): void {
    this.relays = this.relays.filter(r => r.url !== url);
    this.saveToStorage();
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem('nostr_relays', JSON.stringify(this.relays));
    } catch (error) {
      console.warn('Failed to save relays:', error);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('nostr_relays');
      if (stored) {
        this.relays = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load relays:', error);
    }
  }
}

export const relayManager = new RelayManager();
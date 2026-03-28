import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
const DEFAULT_RELAYS = [
    { url: 'wss://relay.damus.io', enabled: true },
    { url: 'wss://relay.snort.social', enabled: true },
    { url: 'wss://nostr.band', enabled: true },
    { url: 'wss://nostr-pub.wellorder.net', enabled: false },
];
class RelayManager {
    constructor() {
        Object.defineProperty(this, "relays", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [...DEFAULT_RELAYS]
        });
        // Sync init with defaults
    }
    async loadState() {
        await this.loadFromStorage();
    }
    getAllRelays() {
        return [...this.relays];
    }
    getEnabledUrls() {
        return this.relays
            .filter(r => r.enabled)
            .map(r => r.url);
    }
    enableRelay(url) {
        const relay = this.relays.find(r => r.url === url);
        if (relay) {
            relay.enabled = true;
            this.saveToStorage();
        }
    }
    disableRelay(url) {
        const relay = this.relays.find(r => r.url === url);
        if (relay) {
            relay.enabled = false;
            this.saveToStorage();
        }
    }
    addRelay(url) {
        const normalizedUrl = url.trim();
        const isValidUrl = typeof URL.canParse === 'function'
            ? URL.canParse(normalizedUrl)
            : (() => {
                try {
                    const parsed = new URL(normalizedUrl);
                    return Boolean(parsed);
                }
                catch {
                    return false;
                }
            })();
        if (!isValidUrl) {
            throw new Error('Invalid relay URL');
        }
        const parsed = new URL(normalizedUrl);
        if (parsed.protocol !== 'wss:') {
            throw new Error('Relay URL must use wss://');
        }
        if (this.relays.some(r => r.url === normalizedUrl)) {
            return false;
        }
        this.relays.push({ url: normalizedUrl, enabled: true, custom: true });
        this.saveToStorage();
        return true;
    }
    removeRelay(url) {
        this.relays = this.relays.filter(r => r.url !== url);
        this.saveToStorage();
    }
    async saveToStorage() {
        try {
            await AsyncStorage.setItem('nostr_relays', JSON.stringify(this.relays));
        }
        catch (error) {
            logger.warn('Failed to save relays:', error);
        }
    }
    async loadFromStorage() {
        try {
            const stored = await AsyncStorage.getItem('nostr_relays');
            if (stored) {
                this.relays = JSON.parse(stored);
            }
        }
        catch (error) {
            logger.warn('Failed to load relays:', error);
        }
    }
}
export const relayManager = new RelayManager();

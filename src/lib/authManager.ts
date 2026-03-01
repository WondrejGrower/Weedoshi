import AsyncStorage from '@react-native-async-storage/async-storage';
import { nostrClient } from './nostrClient';
import { secureKeyManager } from './secureKeyManager';
import { diagnostics } from './diagnostics';

export interface AuthState {
  isLoggedIn: boolean;
  isReadOnly: boolean;
  pubkey: string | null;
  privkey: string | null;
  method: 'nsec' | 'npub' | null;
}

class AuthManager {
  private state: AuthState;

  constructor() {
    this.state = {
      isLoggedIn: false,
      isReadOnly: false,
      pubkey: null,
      privkey: null,
      method: null,
    };
  }

  async loadState() {
    await this.loadFromStorage();
  }

  async loginWithNsec(nsec: string) {
    try {
      const { pubkey, privkey } = nostrClient.decodeNsec(nsec);

      // Store nsec securely using SecureKeyManager
      await secureKeyManager.storeKey(nsec, pubkey);
      this.state = {
        isLoggedIn: true,
        isReadOnly: false,
        pubkey,
        privkey,
        method: 'nsec',
      };

      await this.saveToStorage();
      diagnostics.log(`✅ Logged in with nsec: ${pubkey.substring(0, 8)}...`, 'info');
      console.log('Logged in with nsec:', pubkey);
    } catch (error) {
      diagnostics.log(`❌ Failed to login with nsec: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed to login with nsec: ${error instanceof Error ? error.message : ''}`);
    }
  }

  async loginWithNpub(npub: string) {
    try {
      const pubkey = nostrClient.npubToPubkey(npub);
      this.state = {
        isLoggedIn: true,
        isReadOnly: true,
        pubkey,
        privkey: null,
        method: 'npub',
      };
      await this.saveToStorage();
      diagnostics.log(`✅ Logged in with npub (read-only): ${pubkey.substring(0, 8)}...`, 'info');
      console.log('Logged in with npub:', pubkey);
    } catch (error) {
      diagnostics.log(`❌ Failed to login with npub: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed to login with npub: ${error instanceof Error ? error.message : ''}`);
    }
  }

  async logout() {
    // Delete secure keys
    await secureKeyManager.deleteKey();
    this.state = {
      isLoggedIn: false,
      isReadOnly: false,
      pubkey: null,
      privkey: null,
      method: null,
    };
    await this.saveToStorage();
    diagnostics.log('🔒 Logged out and cleared secure keys', 'info');
    console.log('Logged out');
  }

  getState(): AuthState {
    return { ...this.state };
  }

  private async saveToStorage() {
    try {
      // Only store non-sensitive data (pubkey, method)
      // Sensitive data (nsec) is stored in SecureKeyManager
      const toStore = {
        pubkey: this.state.pubkey,
        method: this.state.method,
      };
      await AsyncStorage.setItem('nostr_auth', JSON.stringify(toStore));
      diagnostics.log('Auth state saved to storage', 'info');
    } catch (error) {
      diagnostics.log(`⚠️ Failed to save auth state: ${error}`, 'warn');
      console.warn('Failed to save auth state:', error);
    }
  }

  private async loadFromStorage() {
    try {
      const stored = await AsyncStorage.getItem('nostr_auth');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.pubkey && data.method) {
          // Check if we have a secure key stored
          const hasSecureKey = await secureKeyManager.hasKey();

          if (data.method === 'nsec' && hasSecureKey) {
            // Load nsec from secure storage
            const nsec = await secureKeyManager.getKey();
            if (nsec) {
              try {
                const { pubkey, privkey } = nostrClient.decodeNsec(nsec);
                this.state = {
                  isLoggedIn: true,
                  isReadOnly: false,
                  pubkey,
                  privkey,
                  method: 'nsec',
                };
                diagnostics.log('✅ Restored nsec login from secure storage', 'info');
                console.log('Restored auth state from secure storage');
                return;
              } catch (error) {
                diagnostics.log('⚠️ Failed to decode stored nsec, clearing state', 'warn');
                await this.logout();
                return;
              }
            }
          }

          // npub login (read-only)
          if (data.method === 'npub') {
            this.state = {
              isLoggedIn: true,
              isReadOnly: true,
              pubkey: data.pubkey,
              privkey: null,
              method: 'npub',
            };
            diagnostics.log('✅ Restored npub login (read-only)', 'info');
            console.log('Restored auth state from storage (read-only)');
          }
        }
      }
    } catch (error) {
      diagnostics.log(`⚠️ Failed to load auth state: ${error}`, 'warn');
      console.warn('Failed to load auth state:', error);
    }
  }
}

export const authManager = new AuthManager();
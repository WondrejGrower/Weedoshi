import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { diagnostics } from './diagnostics';

const STORAGE_KEY = 'nostr_private_key';
const PUBKEY_KEY = 'nostr_public_key';

/**
 * SecureKeyManager handles secure storage of Nostr keys
 * using native Keychain (iOS) / Keystore (Android) / SecureStorage (Web)
 */
export class SecureKeyManager {
  /**
   * Store a private key securely
   * @param nsec - The nsec (private key) to store
   * @param pubkey - The corresponding public key
   */
  async storeKey(nsec: string, pubkey: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Web fallback - use localStorage with warning
        diagnostics.log('⚠️ Web platform: Using localStorage (not fully secure)', 'warn');
        localStorage.setItem(STORAGE_KEY, nsec);
        localStorage.setItem(PUBKEY_KEY, pubkey);
      } else {
        // Native platforms - use secure storage
        await SecureStore.setItemAsync(STORAGE_KEY, nsec, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        await SecureStore.setItemAsync(PUBKEY_KEY, pubkey, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        diagnostics.log('✅ Private key stored securely in native Keychain/Keystore', 'info');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`❌ Failed to store key: ${errorMsg}`, 'error');
      throw new Error(`Failed to store key securely: ${errorMsg}`);
    }
  }

  /**
   * Retrieve the stored private key
   * @returns The nsec or null if not found
   */
  async getKey(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(STORAGE_KEY);
      } else {
        return await SecureStore.getItemAsync(STORAGE_KEY);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`⚠️ Failed to retrieve key: ${errorMsg}`, 'warn');
      return null;
    }
  }

  /**
   * Retrieve the stored public key
   */
  async getPubkey(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(PUBKEY_KEY);
      } else {
        return await SecureStore.getItemAsync(PUBKEY_KEY);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`⚠️ Failed to retrieve pubkey: ${errorMsg}`, 'warn');
      return null;
    }
  }

  /**
   * Delete the stored keys (logout)
   */
  async deleteKey(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PUBKEY_KEY);
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        await SecureStore.deleteItemAsync(PUBKEY_KEY);
      }
      diagnostics.log('🔒 Private key deleted from secure storage', 'info');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.log(`⚠️ Failed to delete key: ${errorMsg}`, 'warn');
    }
  }

  /**
   * Check if a key is stored
   */
  async hasKey(): Promise<boolean> {
    const key = await this.getKey();
    return key !== null && key.length > 0;
  }

  /**
   * Check if secure storage is available (native platforms)
   */
  isSecureStorageAvailable(): boolean {
    return Platform.OS !== 'web';
  }
}

// Singleton instance
export const secureKeyManager = new SecureKeyManager();

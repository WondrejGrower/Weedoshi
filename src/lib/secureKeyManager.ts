import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { diagnostics } from './diagnostics';
import { getFeatures } from '../runtime/features';
import { getRuntimeMode } from '../runtime/mode';

const STORAGE_KEY = 'nostr_private_key';
const PUBKEY_KEY = 'nostr_public_key';
const WEB_APP_ENCRYPTED_PREFIX = 'enc:v1:';
const WEB_APP_FALLBACK_SECRET = 'weedoshi-web-app-storage';

function toBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(value);
  }
  return Buffer.from(value, 'utf-8').toString('base64');
}

function fromBase64(value: string): string {
  if (typeof atob === 'function') {
    return atob(value);
  }
  return Buffer.from(value, 'base64').toString('utf-8');
}

function xorCipher(input: string, secret: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ secret.charCodeAt(i % secret.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

function encryptForWeb(nsec: string, pubkey: string): string {
  const cipher = xorCipher(nsec, `${WEB_APP_FALLBACK_SECRET}:${pubkey}`);
  return `${WEB_APP_ENCRYPTED_PREFIX}${toBase64(cipher)}`;
}

function decryptForWeb(payload: string, pubkey: string): string | null {
  try {
    if (!payload.startsWith(WEB_APP_ENCRYPTED_PREFIX)) {
      return payload;
    }
    const encoded = payload.slice(WEB_APP_ENCRYPTED_PREFIX.length);
    const cipher = fromBase64(encoded);
    return xorCipher(cipher, `${WEB_APP_FALLBACK_SECRET}:${pubkey}`);
  } catch {
    return null;
  }
}

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
        const features = getFeatures(getRuntimeMode());
        if (features.requireBrowserSigner) {
          throw new Error('nsec storage is disabled in web mode');
        }

        // App mode on web: encrypted fallback (still lower trust than native secure storage).
        diagnostics.log(
          '⚠️ Web app mode: Using encrypted localStorage fallback (prefer native secure storage)',
          'warn'
        );
        localStorage.setItem(STORAGE_KEY, encryptForWeb(nsec, pubkey));
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
        const features = getFeatures(getRuntimeMode());
        if (features.requireBrowserSigner) {
          return null;
        }

        const pubkey = localStorage.getItem(PUBKEY_KEY);
        const payload = localStorage.getItem(STORAGE_KEY);
        if (!payload || !pubkey) return null;
        return decryptForWeb(payload, pubkey);
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import { secureKeyManager } from './secureKeyManager';
import { diagnostics } from './diagnostics';
import { getFeatures } from '../runtime/features';
import { getRuntimeMode } from '../runtime/mode';
import { Nip07Signer } from './signers/nip07Signer';
import { Nip46Signer } from './signers/nip46Signer';
import type { Signer } from './signers/types';
import { ensureSignerBoundIdentity, getDefaultSigner } from './signers/signerManager';

export type SignerKind = 'nip07' | 'nip46' | 'local';
export type Nip46PairingPhase = 'unavailable' | 'idle' | 'pairing' | 'paired' | 'error';

export interface Nip46PairingState {
  phase: Nip46PairingPhase;
  connectionUri: string | null;
  code: string | null;
  message: string | null;
}

export interface AuthState {
  isLoggedIn: boolean;
  isReadOnly: boolean;
  pubkey: string | null;
  privkey: string | null;
  method: 'nsec' | 'npub' | 'signer' | null;
  signerKind?: SignerKind | null;
}

interface BrowserSigner {
  getPublicKey?: () => Promise<string>;
  signEvent?: (event: any) => Promise<any>;
}

interface Nip46BridgeLike {
  isAvailable?: () => Promise<boolean> | boolean;
  getPublicKey?: () => Promise<string>;
  signEvent?: (event: any) => Promise<any>;
  getSessionState?: () => Promise<unknown> | unknown;
  pair?: (input?: string) => Promise<unknown> | unknown;
  startPairing?: (input?: string) => Promise<unknown> | unknown;
  connect?: (input?: string) => Promise<unknown> | unknown;
  approvePairing?: () => Promise<unknown> | unknown;
  finalizePairing?: () => Promise<unknown> | unknown;
  disconnect?: () => Promise<unknown> | unknown;
}

function getNip46Bridge(): Nip46BridgeLike | null {
  return (globalThis as { __WEEDOSHI_NIP46__?: Nip46BridgeLike }).__WEEDOSHI_NIP46__ || null;
}

function normalizeNip46PairingState(input: unknown, fallbackPhase: Nip46PairingPhase): Nip46PairingState {
  if (!input || typeof input !== 'object') {
    return {
      phase: fallbackPhase,
      connectionUri: null,
      code: null,
      message: null,
    };
  }

  const obj = input as Record<string, unknown>;
  const rawPhase = String(obj.phase || obj.status || obj.state || fallbackPhase).toLowerCase();
  const phase: Nip46PairingPhase =
    rawPhase === 'paired' || rawPhase === 'connected'
      ? 'paired'
      : rawPhase === 'pairing' || rawPhase === 'pending'
        ? 'pairing'
        : rawPhase === 'idle'
          ? 'idle'
          : rawPhase === 'error' || rawPhase === 'failed'
            ? 'error'
            : fallbackPhase;

  const connectionUri =
    typeof obj.connectionUri === 'string'
      ? obj.connectionUri
      : typeof obj.pairingUri === 'string'
        ? obj.pairingUri
        : typeof obj.bunkerUri === 'string'
          ? obj.bunkerUri
          : typeof obj.uri === 'string'
            ? obj.uri
            : null;

  const code =
    typeof obj.code === 'string'
      ? obj.code
      : typeof obj.pairingCode === 'string'
        ? obj.pairingCode
        : typeof obj.token === 'string'
          ? obj.token
          : null;

  const message =
    typeof obj.message === 'string'
      ? obj.message
      : typeof obj.error === 'string'
        ? obj.error
        : null;

  return {
    phase,
    connectionUri,
    code,
    message,
  };
}

async function getNostrClient() {
  const module = await import('./nostrClient');
  return module.nostrClient;
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
      signerKind: null,
    };
  }

  async loadState() {
    await this.loadFromStorage();
  }

  async loginWithNsec(nsec: string) {
    try {
      const features = getFeatures(getRuntimeMode());
      if (!features.allowNsecLogin) {
        throw new Error('nsec login is disabled in web mode. Connect a browser signer instead.');
      }

      const normalized = nsec.trim();
      if (!normalized.startsWith('nsec1')) {
        throw new Error('Invalid nsec format. Expected key starting with nsec1...');
      }

      const nostrClient = await getNostrClient();
      const { pubkey, privkey } = nostrClient.decodeNsec(normalized);

      // Store nsec securely using SecureKeyManager
      await secureKeyManager.storeKey(normalized, pubkey);
      this.state = {
        isLoggedIn: true,
        isReadOnly: false,
        pubkey,
        privkey,
        method: 'nsec',
        signerKind: null,
      };

      await this.saveToStorage();
      diagnostics.log(`✅ Logged in with nsec: ${pubkey.substring(0, 8)}...`, 'info');
      logger.info('Logged in with nsec:', pubkey);
    } catch (error) {
      diagnostics.log(`❌ Failed to login with nsec: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed to login with nsec: ${error instanceof Error ? error.message : ''}`);
    }
  }

  async loginWithNpub(npub: string) {
    try {
      const nostrClient = await getNostrClient();
      const pubkey = nostrClient.npubToPubkey(npub);
      this.state = {
        isLoggedIn: true,
        isReadOnly: true,
        pubkey,
        privkey: null,
        method: 'npub',
        signerKind: null,
      };
      await this.saveToStorage();
      diagnostics.log(`✅ Logged in with npub (read-only): ${pubkey.substring(0, 8)}...`, 'info');
      logger.info('Logged in with npub:', pubkey);
    } catch (error) {
      diagnostics.log(`❌ Failed to login with npub: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed to login with npub: ${error instanceof Error ? error.message : ''}`);
    }
  }

  isBrowserSignerAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const signer = (window as any).nostr as BrowserSigner | undefined;
    return typeof signer?.getPublicKey === 'function';
  }

  isNip46SignerAvailable(): boolean {
    const bridge = getNip46Bridge();
    return Boolean(
      bridge &&
        typeof bridge.getPublicKey === 'function' &&
        typeof bridge.signEvent === 'function'
    );
  }

  isNip46BridgePresent(): boolean {
    return Boolean(getNip46Bridge());
  }

  private canBrowserSignerSign(): boolean {
    if (typeof window === 'undefined') return false;
    const signer = (window as any).nostr as BrowserSigner | undefined;
    return typeof signer?.signEvent === 'function';
  }

  async loginWithBrowserSigner() {
    try {
      if (!this.isBrowserSignerAvailable()) {
        throw new Error('No browser signer found (NIP-07/Nostr Connect provider missing)');
      }

      const signer = (window as any).nostr as BrowserSigner;
      const pubkey = await signer.getPublicKey!();
      if (!pubkey) {
        throw new Error('Signer did not return a public key');
      }

      this.state = {
        isLoggedIn: true,
        isReadOnly: !this.canBrowserSignerSign(),
        pubkey,
        privkey: null,
        method: 'signer',
        signerKind: 'nip07',
      };
      await this.saveToStorage();
      diagnostics.log(`✅ Connected browser signer: ${pubkey.substring(0, 8)}...`, 'info');
    } catch (error) {
      diagnostics.log(`❌ Failed to connect browser signer: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(
        `Failed to connect browser signer: ${error instanceof Error ? error.message : ''}`
      );
    }
  }

  async loginWithSignerFirst() {
    try {
      const signer = getDefaultSigner();
      const available = await signer.isAvailable();
      if (!available) {
        throw new Error('No signer available (NIP-07/NIP-46 missing)');
      }

      const pubkey = await ensureSignerBoundIdentity(signer);
      const canSign = typeof signer.signEvent === 'function';

      this.state = {
        isLoggedIn: true,
        isReadOnly: !canSign,
        pubkey,
        privkey: null,
        method: 'signer',
        signerKind: signer.kind,
      };
      await this.saveToStorage();
      diagnostics.log(`✅ Connected signer-first (${signer.kind}): ${pubkey.substring(0, 8)}...`, 'info');
    } catch (error) {
      diagnostics.log(`❌ Failed signer-first login: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed signer-first login: ${error instanceof Error ? error.message : ''}`);
    }
  }

  async connectNip46Session() {
    try {
      const signer = new Nip46Signer();
      const available = await signer.isAvailable();
      if (!available) {
        throw new Error('NIP-46 signer not available');
      }

      const pubkey = await ensureSignerBoundIdentity(signer);
      this.state = {
        isLoggedIn: true,
        isReadOnly: false,
        pubkey,
        privkey: null,
        method: 'signer',
        signerKind: 'nip46',
      };
      await this.saveToStorage();
      diagnostics.log(`✅ Connected NIP-46 signer session: ${pubkey.substring(0, 8)}...`, 'info');
    } catch (error) {
      diagnostics.log(`❌ Failed to connect NIP-46 signer session: ${error instanceof Error ? error.message : ''}`, 'error');
      throw new Error(`Failed to connect NIP-46 signer session: ${error instanceof Error ? error.message : ''}`);
    }
  }

  async disconnectNip46Session() {
    const bridge = getNip46Bridge();
    if (bridge && typeof bridge.disconnect === 'function') {
      try {
        await bridge.disconnect();
      } catch {
        // Keep logout deterministic even if bridge-level disconnect fails.
      }
    }

    if (this.state.method === 'signer' && this.state.signerKind === 'nip46') {
      await this.logout();
      diagnostics.log('Disconnected NIP-46 signer session', 'info');
    }
  }

  getSignerSessionStatus(): SignerKind | 'none' {
    if (!this.state.isLoggedIn || this.state.method !== 'signer' || !this.state.signerKind) {
      return 'none';
    }
    return this.state.signerKind;
  }

  async getNip46PairingState(): Promise<Nip46PairingState> {
    const bridge = getNip46Bridge();
    if (!bridge) {
      return {
        phase: 'unavailable',
        connectionUri: null,
        code: null,
        message: 'NIP-46 bridge not available',
      };
    }

    if (typeof bridge.getSessionState === 'function') {
      try {
        const raw = await bridge.getSessionState();
        return normalizeNip46PairingState(raw, this.isNip46SignerAvailable() ? 'paired' : 'idle');
      } catch {
        return {
          phase: 'error',
          connectionUri: null,
          code: null,
          message: 'Failed to load NIP-46 session state',
        };
      }
    }

    return {
      phase: this.isNip46SignerAvailable() ? 'paired' : 'idle',
      connectionUri: null,
      code: null,
      message: null,
    };
  }

  async startNip46Pairing(pairInput?: string): Promise<Nip46PairingState> {
    const bridge = getNip46Bridge();
    if (!bridge) {
      throw new Error('NIP-46 bridge not available');
    }

    const input = pairInput?.trim() || undefined;
    const pairMethod =
      typeof bridge.pair === 'function'
        ? bridge.pair.bind(bridge)
        : typeof bridge.startPairing === 'function'
          ? bridge.startPairing.bind(bridge)
          : typeof bridge.connect === 'function'
            ? bridge.connect.bind(bridge)
            : null;

    if (!pairMethod) {
      throw new Error('NIP-46 pairing is not supported by current bridge');
    }

    try {
      const raw = await pairMethod(input);
      return normalizeNip46PairingState(raw, this.isNip46SignerAvailable() ? 'paired' : 'pairing');
    } catch {
      throw new Error('NIP-46 pairing failed');
    }
  }

  async approveNip46Pairing(): Promise<Nip46PairingState> {
    const bridge = getNip46Bridge();
    if (!bridge) {
      throw new Error('NIP-46 bridge not available');
    }

    const approveMethod =
      typeof bridge.approvePairing === 'function'
        ? bridge.approvePairing.bind(bridge)
        : typeof bridge.finalizePairing === 'function'
          ? bridge.finalizePairing.bind(bridge)
          : null;

    if (!approveMethod) {
      throw new Error('NIP-46 approval is not supported by current bridge');
    }

    try {
      const raw = await approveMethod();
      return normalizeNip46PairingState(raw, this.isNip46SignerAvailable() ? 'paired' : 'pairing');
    } catch {
      throw new Error('NIP-46 approval failed');
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
      signerKind: null,
    };
    await this.saveToStorage();
    diagnostics.log('🔒 Logged out and cleared secure keys', 'info');
    logger.info('Logged out');
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
        signerKind: this.state.method === 'signer' ? this.state.signerKind || null : null,
      };
      await AsyncStorage.setItem('nostr_auth', JSON.stringify(toStore));
      diagnostics.log('Auth state saved to storage', 'info');
    } catch (error) {
      diagnostics.log(`⚠️ Failed to save auth state: ${error}`, 'warn');
      logger.warn('Failed to save auth state:', error);
    }
  }

  private async loadFromStorage() {
    try {
      const stored = await AsyncStorage.getItem('nostr_auth');
      if (stored) {
        const data = JSON.parse(stored);
        const features = getFeatures(getRuntimeMode());
        if (data.pubkey && data.method) {
          // Check if we have a secure key stored
          const hasSecureKey = await secureKeyManager.hasKey();

          if (data.method === 'nsec' && hasSecureKey && features.allowNsecLogin) {
            // Load nsec from secure storage
            const nsec = await secureKeyManager.getKey();
            if (nsec) {
              try {
                const nostrClient = await getNostrClient();
                const { pubkey, privkey } = nostrClient.decodeNsec(nsec);
                this.state = {
                  isLoggedIn: true,
                  isReadOnly: false,
                  pubkey,
                  privkey,
                  method: 'nsec',
                };
                diagnostics.log('✅ Restored nsec login from secure storage', 'info');
                logger.info('Restored auth state from secure storage');
                return;
              } catch (error) {
                diagnostics.log('⚠️ Failed to decode stored nsec, clearing state', 'warn');
                await this.logout();
                return;
              }
            }
          }
          if (data.method === 'nsec' && (!hasSecureKey || !features.allowNsecLogin)) {
            await AsyncStorage.removeItem('nostr_auth');
            diagnostics.log('Cleared stale nsec auth state (no secure key available)', 'warn');
            return;
          }

          // npub login (read-only)
          if (data.method === 'npub') {
            this.state = {
              isLoggedIn: true,
              isReadOnly: true,
              pubkey: data.pubkey,
              privkey: null,
              method: 'npub',
              signerKind: null,
            };
            diagnostics.log('✅ Restored npub login (read-only)', 'info');
            logger.info('Restored auth state from storage (read-only)');
          }

          if (data.method === 'signer') {
            const preferred = this.resolveSigner(data.signerKind);
            const available = preferred ? await preferred.isAvailable() : false;
            if (!preferred || !available) {
              await AsyncStorage.removeItem('nostr_auth');
              diagnostics.log('Cleared stale signer auth state (signer unavailable)', 'warn');
              return;
            }

            const signerPubkey = await ensureSignerBoundIdentity(preferred);
            if (signerPubkey !== data.pubkey) {
              await AsyncStorage.removeItem('nostr_auth');
              diagnostics.log('Cleared stale signer auth state (identity mismatch)', 'warn');
              return;
            }

            this.state = {
              isLoggedIn: true,
              isReadOnly: false,
              pubkey: signerPubkey,
              privkey: null,
              method: 'signer',
              signerKind: preferred.kind,
            };
            diagnostics.log(`✅ Restored signer login state (${preferred.kind})`, 'info');
          }
        }
      }
    } catch (error) {
      diagnostics.log(`⚠️ Failed to load auth state: ${error}`, 'warn');
      logger.warn('Failed to load auth state:', error);
    }
  }

  private resolveSigner(preferredKind: unknown): Signer | null {
    if (preferredKind === 'nip46') {
      return new Nip46Signer();
    }
    if (preferredKind === 'nip07') {
      return new Nip07Signer();
    }
    const signer = getDefaultSigner();
    if (signer.kind === 'local') {
      return null;
    }
    return signer;
  }
}

export const authManager = new AuthManager();

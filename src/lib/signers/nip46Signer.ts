import type { Signer } from './types';

interface Nip46Bridge {
  isAvailable?: () => Promise<boolean> | boolean;
  getPublicKey?: () => Promise<string>;
  signEvent?: <T extends { pubkey?: string; id?: string; sig?: string }>(event: T) => Promise<T>;
}

function getNip46Bridge(): Nip46Bridge | null {
  const globalBridge = (globalThis as { __WEEDOSHI_NIP46__?: Nip46Bridge }).__WEEDOSHI_NIP46__;
  return globalBridge || null;
}

export class Nip46Signer implements Signer {
  kind: Signer['kind'] = 'nip46';

  async isAvailable(): Promise<boolean> {
    const bridge = getNip46Bridge();
    if (!bridge || typeof bridge.getPublicKey !== 'function' || typeof bridge.signEvent !== 'function') {
      return false;
    }

    if (typeof bridge.isAvailable === 'function') {
      return await bridge.isAvailable();
    }

    return true;
  }

  async getPublicKey(): Promise<string> {
    const bridge = getNip46Bridge();
    if (!bridge || typeof bridge.getPublicKey !== 'function') {
      throw new Error('NIP-46 signer not available');
    }

    const pubkey = await bridge.getPublicKey();
    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('NIP-46 signer returned invalid public key');
    }

    return pubkey;
  }

  async signEvent<T extends { pubkey?: string; id?: string; sig?: string }>(evt: T): Promise<T> {
    const bridge = getNip46Bridge();
    if (!bridge || typeof bridge.signEvent !== 'function') {
      throw new Error('NIP-46 signer not available');
    }

    try {
      const signed = await bridge.signEvent(evt);
      if (!signed || typeof signed !== 'object') {
        throw new Error('NIP-46 signer returned invalid signed event');
      }
      return signed;
    } catch {
      throw new Error('NIP-46 signing failed');
    }
  }
}

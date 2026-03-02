import { finalizeEvent, getPublicKey } from 'nostr-tools';
import type { Signer } from './types';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Invalid private key for local signer');
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export class LocalSigner implements Signer {
  kind: Signer['kind'] = 'local';
  private readonly secretKey: Uint8Array | null;

  constructor(privkeyHex?: string | null) {
    this.secretKey = privkeyHex ? hexToBytes(privkeyHex) : null;
  }

  isAvailable(): boolean {
    return this.secretKey !== null;
  }

  async getPublicKey(): Promise<string> {
    if (!this.secretKey) {
      throw new Error('Local signer not enabled');
    }
    return getPublicKey(this.secretKey as any);
  }

  async signEvent<T extends { pubkey?: string; id?: string; sig?: string }>(evt: T): Promise<T> {
    if (!this.secretKey) {
      throw new Error('Local signer not enabled');
    }
    return finalizeEvent(evt as any, this.secretKey as any) as unknown as T;
  }
}

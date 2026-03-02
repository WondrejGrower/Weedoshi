import type { Signer } from './types';

interface BrowserNostr {
  getPublicKey?: () => Promise<string>;
  signEvent?: <T extends { pubkey?: string; id?: string; sig?: string }>(event: T) => Promise<T>;
}

function getBrowserNostr(): BrowserNostr | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { nostr?: BrowserNostr }).nostr;
  return candidate || null;
}

export class Nip07Signer implements Signer {
  kind: Signer['kind'] = 'nip07';

  isAvailable(): boolean {
    const nostr = getBrowserNostr();
    return Boolean(nostr && typeof nostr.getPublicKey === 'function' && typeof nostr.signEvent === 'function');
  }

  async getPublicKey(): Promise<string> {
    const nostr = getBrowserNostr();
    if (!nostr || typeof nostr.getPublicKey !== 'function') {
      throw new Error('NIP-07 signer not available');
    }

    const pubkey = await nostr.getPublicKey();
    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('NIP-07 signer returned invalid public key');
    }

    return pubkey;
  }

  async signEvent<T extends { pubkey?: string; id?: string; sig?: string }>(evt: T): Promise<T> {
    const nostr = getBrowserNostr();
    if (!nostr || typeof nostr.signEvent !== 'function') {
      throw new Error('NIP-07 signer not available');
    }

    try {
      const signed = await nostr.signEvent(evt);
      if (!signed || typeof signed !== 'object') {
        throw new Error('NIP-07 signer returned invalid signed event');
      }
      return signed;
    } catch {
      throw new Error('NIP-07 signing failed');
    }
  }
}

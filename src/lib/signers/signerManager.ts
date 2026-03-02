import { LocalSigner } from './localSigner';
import { Nip46Signer } from './nip46Signer';
import { Nip07Signer } from './nip07Signer';
import type { Signer } from './types';

let configuredLocalPrivkey: string | null = null;

export function setLocalSignerPrivkey(privkeyHex: string | null): void {
  configuredLocalPrivkey = privkeyHex;
}

export function getDefaultSigner(): Signer {
  const nip07 = new Nip07Signer();
  if (nip07.isAvailable()) {
    return nip07;
  }

  const nip46 = new Nip46Signer();
  // NIP-46 availability may be async, but if bridge is present it can still sign.
  // Runtime signing code validates availability again before use.
  if ((globalThis as { __WEEDOSHI_NIP46__?: unknown }).__WEEDOSHI_NIP46__) {
    return nip46;
  }

  return new LocalSigner(configuredLocalPrivkey);
}

export async function ensureSignerBoundIdentity(signer: Signer): Promise<string> {
  const pubkey = await signer.getPublicKey();
  if (!/^[a-f0-9]{64}$/i.test(pubkey)) {
    throw new Error(`Signer ${signer.kind} returned invalid pubkey`);
  }
  return pubkey.toLowerCase();
}

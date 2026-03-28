function getBrowserNostr() {
    if (typeof window === 'undefined')
        return null;
    const candidate = window.nostr;
    return candidate || null;
}
export class Nip07Signer {
    constructor() {
        Object.defineProperty(this, "kind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'nip07'
        });
    }
    isAvailable() {
        const nostr = getBrowserNostr();
        return Boolean(nostr && typeof nostr.getPublicKey === 'function' && typeof nostr.signEvent === 'function');
    }
    async getPublicKey() {
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
    async signEvent(evt) {
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
        }
        catch {
            throw new Error('NIP-07 signing failed');
        }
    }
}

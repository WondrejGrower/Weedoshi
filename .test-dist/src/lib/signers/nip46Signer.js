function getNip46Bridge() {
    const globalBridge = globalThis.__WEEDOSHI_NIP46__;
    return globalBridge || null;
}
export class Nip46Signer {
    constructor() {
        Object.defineProperty(this, "kind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'nip46'
        });
    }
    async isAvailable() {
        const bridge = getNip46Bridge();
        if (!bridge || typeof bridge.getPublicKey !== 'function' || typeof bridge.signEvent !== 'function') {
            return false;
        }
        if (typeof bridge.isAvailable === 'function') {
            return await bridge.isAvailable();
        }
        return true;
    }
    async getPublicKey() {
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
    async signEvent(evt) {
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
        }
        catch {
            throw new Error('NIP-46 signing failed');
        }
    }
}

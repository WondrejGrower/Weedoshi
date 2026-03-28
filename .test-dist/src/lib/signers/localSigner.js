import { finalizeEvent, getPublicKey } from 'nostr-tools';
function hexToBytes(hex) {
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
export class LocalSigner {
    constructor(privkeyHex) {
        Object.defineProperty(this, "kind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'local'
        });
        Object.defineProperty(this, "secretKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.secretKey = privkeyHex ? hexToBytes(privkeyHex) : null;
    }
    isAvailable() {
        return this.secretKey !== null;
    }
    async getPublicKey() {
        if (!this.secretKey) {
            throw new Error('Local signer not enabled');
        }
        return getPublicKey(this.secretKey);
    }
    async signEvent(evt) {
        if (!this.secretKey) {
            throw new Error('Local signer not enabled');
        }
        return finalizeEvent(evt, this.secretKey);
    }
}

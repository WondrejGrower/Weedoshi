export interface Signer {
  kind: 'nip07' | 'local' | 'nip46';
  isAvailable(): Promise<boolean> | boolean;
  getPublicKey(): Promise<string>;
  signEvent<T extends { pubkey?: string; id?: string; sig?: string }>(evt: T): Promise<T>;
}

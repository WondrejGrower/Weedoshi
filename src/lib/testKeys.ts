/**
 * Test keys for Weedoshi Diaries
 * These are example keys for testing purposes
 * DO NOT use these in production!
 */

export const TEST_KEYS = {
  // Example nsec (private key) - for full access
  nsec: 'nsec1...',

  // Example npub (public key) - for read-only access
  npub: 'npub1...',
};

export const TEST_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nostr.band',
];

export const TEST_HASHTAGS = ['weedstr', 'weed', 'cannabis', 'grow', 'livingsoil'];

/**
 * Helper to explain how to get your own keys
 */
export function getYourOwnKeysGuide(): string {
  return `
To get your own Nostr keys:

1. Visit: https://www.nostrvue.app/ or https://www.nostrplebs.com/
2. Click "Generate new keys"
3. Save your nsec (private key) securely
4. Your npub will be automatically generated

Never share your nsec key!
Use npub for read-only access when sharing public links.
  `.trim();
}
# Weedoshi — Nostr client for growers by growers. SANCTIFIED ₿Y NATURE

Decentralized Nostr client focused on the cannabis community, built with Expo + React Native.

## Features

- Nostr auth with `nsec` (full access) and `npub` (read-only)
- Multi-relay feed with deduplication and event validation
- Hashtag filtering for cannabis-related content
- Reaction support (NIP-25)
- Thread parsing (NIP-10)
- Relay health diagnostics and smart relay selection
- Local event cache for faster startup
- Plant Encyclopedia flow:
  - offline plant catalog (latin/common/synonyms)
  - Plant picker with recents/favorites/custom
  - lazy NIP-54 wiki fetch (kind 30818) on plant details screen

## Tech Stack

- Expo SDK 52
- React Native 0.76
- Expo Router 4
- TypeScript 5
- nostr-tools 2
- AsyncStorage + expo-secure-store

## Requirements

- Node.js 18+
- npm (or bun)
- For iOS device/simulator testing: Xcode tools on macOS

## Web vs App mode

Runtime mode is selected automatically:

- `web` mode: when app is opened in a browser on `weedoshi.to` or `www.weedoshi.to`
- `app` mode: all other cases (native runtime, local dev, wrappers)

Optional override via environment variable:

- `APP_MODE=web` or `APP_MODE=app`
- framework-compatible aliases are also read: `VITE_APP_MODE`, `NEXT_PUBLIC_APP_MODE`
- note: `weedoshi.to` and `www.weedoshi.to` are always forced to `web` mode for safety

Behavior differences:

- `web` mode:
  - nsec login is disabled
  - browser signer is preferred (NIP-07 / Nostr Connect provider)
  - read-only fallback is available via `npub`
  - native-only features are hidden
- `app` mode:
  - existing nsec login flow stays enabled
  - native features remain enabled

## Getting Started

```bash
npm install
npm run dev
```

This starts the Expo dev server (Metro) and shows a QR code.

## Run Targets

```bash
npm run ios      # open iOS simulator (macOS)
npm run android  # open Android emulator/device
npm run dev      # start Expo dev server
npm run build    # export production web bundle to ./dist
npm run preview  # serve ./dist locally on http://localhost:4173
```

Web is also available through Expo (`w`) from the dev server.

## Scripts

```bash
npm run dev
npm run ios
npm run android
npm run build
npm run preview
npm run lint
npm run type-check
```

## Project Structure

```text
app/
  _layout.tsx          # App bootstrap + initialization
  index.tsx            # Main screen
src/
  components/          # UI components
  lib/                 # Nostr/auth/relay/cache managers
assets/
```

## Security Notes

- `nsec` is stored in secure storage on native platforms (`expo-secure-store`).
- On web app mode, `nsec` is kept in session memory only (not persisted across refresh/restart).
- Never share your `nsec`.

## Documentation

- [QUICK_START.md](QUICK_START.md)
- [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md)
- [METRO_TROUBLESHOOTING.md](METRO_TROUBLESHOOTING.md)
- [TESTING.md](TESTING.md)
- [SECURITY.md](SECURITY.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## Plant Encyclopedia

### Extend the offline catalog

File: `assets/plants/catalog.min.json`

Schema:

```json
{
  "version": 1,
  "items": [
    {"id":"cannabis-sativa","latin":"Cannabis sativa","common":["hemp"],"syn":["c. sativa"]}
  ]
}
```

- `id` should stay stable and slug-like (`lowercase-ascii-with-dashes`).
- Keep bundle small: names/synonyms only, no images/descriptions.

### NIP-54 wiki integration

- Plant details screen queries relays for NIP-54 wiki events:
  - `kind: 30818`
  - `#d = <normalized plant slug>`
- Client-side ranking only:
  - prefer curated authors from optional NIP-51 kind `10101` (`p` tags)
  - prefer curated relays from optional NIP-51 kind `10102` (`r` tags)
  - fallback to newest (`created_at`)
- Results are cached locally per slug for 24h with manual refresh support.

### Privacy note

When publishing public diary events, Weedoshi publishes plant references as tags (no encyclopedia payload):

- `["plant", "<slug-or-custom>"]`
- `["species", "<latin_name>"]` (optional)
- `["cultivar", "<free_text>"]` (optional)
- `["breeder", "<free_text>"]` (optional)
- `["a", "<30818:pubkey:d>"]` (optional NIP-54 pointer)

## Roadmap

### 1) Security & Signing

- [x] Security baseline (log redaction + publish leak guard)
- [x] Signer-first layer (NIP-07 ready, local signer fallback)
- [ ] NIP-46 end-to-end session UX and recovery flows
- [ ] Session persistence improvements for trusted-device mode

### 2) Profile & Navigation

- [x] Profile-first landing flow
- [x] Bottom navigation (Feed / Profile / Growmies)
- [x] Settings menu moved to gear button
- [ ] Final responsive polish for tablet and desktop spacing

### 3) Diary UX

- [x] Diary tiles on profile with cover previews
- [x] Dedicated diary detail page (`/diary/[id]`)
- [x] Custom phase/week editing per entry
- [x] Cover image selection in diary edit mode
- [ ] Drag-and-drop entry ordering and richer timeline filters

### 4) Feed & Discovery

- [x] Default hashtag focus (`#weedstr` + `#plantstr`) with user override
- [x] Feed filter toggles and custom hashtag input
- [ ] Better author metadata hydration (display names, avatars, relay fallbacks)
- [ ] Smarter media/link classification and preview reliability

### 5) Growmies

- [x] Growmies list and quick add actions
- [x] Growmies-only feed mode
- [ ] Growmies settings consolidation and relay sync hardening
- [ ] Follow graph import/export for account migration

## License

MIT

Credits: Wondrej D. Grower & LLM's

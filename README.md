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
- On web fallback, storage is less secure; treat browser environment as lower trust.
- Never share your `nsec`.

## Documentation

- [QUICK_START.md](QUICK_START.md)
- [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md)
- [METRO_TROUBLESHOOTING.md](METRO_TROUBLESHOOTING.md)
- [TESTING.md](TESTING.md)
- [SECURITY.md](SECURITY.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## License

MIT

Credits: Wondrej D. Grower & LLM's

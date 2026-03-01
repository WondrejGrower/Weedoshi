# 🔧 Polyfills for iOS Compatibility

## Overview

This app uses **nostr-tools** which requires WebSocket and crypto APIs that are not natively available in React Native iOS environment. We use polyfills to provide these APIs.

---

## 📦 Installed Polyfills

### 1. **react-native-url-polyfill**
- **Purpose**: Provides WebSocket polyfill for React Native
- **Why needed**: `nostr-tools` SimplePool uses WebSocket API which is not available in React Native
- **Import**: `import 'react-native-url-polyfill/auto';`

### 2. **react-native-get-random-values**
- **Purpose**: Provides `crypto.getRandomValues()` polyfill
- **Why needed**: Crypto operations for signature verification and key generation
- **Import**: `import 'react-native-get-random-values';`

### 3. **expo-crypto**
- **Purpose**: Native crypto implementation for Expo
- **Why needed**: Optimized crypto operations for better performance
- **Usage**: Used by other libraries automatically

---

## 🚨 Critical Import Order

**IMPORTANT:** Polyfills **MUST** be imported **FIRST** in `app/_layout.tsx`, before any other imports.

```typescript
// ✅ CORRECT - Polyfills FIRST
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { Stack } from 'expo-router';
// ... other imports
```

```typescript
// ❌ WRONG - Other imports before polyfills
import { Stack } from 'expo-router';
import 'react-native-url-polyfill/auto'; // TOO LATE!
```

If polyfills are not imported first, WebSocket will be undefined when nostr-tools tries to use it.

---

## 🔍 Verification

On app startup, check console logs for:

```
🔍 App: Checking polyfills...
🔍 App: WebSocket available: ✅ YES
🔍 App: crypto.getRandomValues available: ✅ YES
```

If you see `🔴 NO`, polyfills are not loaded correctly.

---

## 🐛 Troubleshooting

### WebSocket still undefined

**Problem:** `WebSocket is undefined` error  
**Solution:** 
1. Verify `react-native-url-polyfill` is in `package.json`
2. Check import is at the **very top** of `app/_layout.tsx`
3. Restart Metro bundler: `bun expo start --clear`

### crypto.getRandomValues is not a function

**Problem:** Crypto errors  
**Solution:**
1. Verify `react-native-get-random-values` is in `package.json`
2. Check import is before any crypto usage
3. Clear cache and rebuild

### SimplePool connection fails

**Problem:** Relay connections fail  
**Solution:**
1. Check WebSocket polyfill is loaded (see logs)
2. Verify relay URLs use `wss://` not `ws://`
3. Reduce number of concurrent connections (iOS limit: 6)

---

## 📱 Platform Differences

### iOS
- **Requires all polyfills** (WebSocket + crypto)
- **Connection limit**: Max 6 concurrent WebSocket connections
- **Network security**: Only `wss://` allowed (not `ws://`)

### Web
- **No polyfills needed** (browser provides WebSocket and crypto)
- **Higher connection limit**
- Both `ws://` and `wss://` work

### Android
- **Similar to iOS** (requires polyfills)
- **Connection limit**: Higher than iOS
- Same security requirements

---

## 🔐 Security Note

These polyfills are **safe and recommended**:
- Official React Native packages
- Maintained by Expo and React Native community
- Used in production by thousands of apps
- No security vulnerabilities

---

## 📚 References

- [react-native-url-polyfill](https://github.com/charpeni/react-native-url-polyfill)
- [react-native-get-random-values](https://github.com/LinusU/react-native-get-random-values)
- [expo-crypto](https://docs.expo.dev/versions/latest/sdk/crypto/)
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools)

---

## ✅ Success Criteria

Polyfills are working correctly when:
- ✅ No "WebSocket is undefined" errors
- ✅ No crypto errors
- ✅ SimplePool connects to relays
- ✅ Events are fetched successfully
- ✅ Signature verification works

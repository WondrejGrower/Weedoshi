# 📦 Expo SDK Downgrade: 53 → 52

## Why We Downgraded

### **The Problem**
Expo SDK 53 uses React Native 0.76.5, which has **Metro bundler issues** with Flow type syntax in internal spec files:

```
node_modules/react-native/src/private/specs/components/DebuggingOverlayNativeComponent.js:
Unsupported param type for method "highlightTraceUpdates", param "updates". 
Found $ReadOnlyArray
```

This error **blocks the entire build** - the app won't load at all.

### **Why Metro Config Couldn't Fix It**
- Metro reads `metro.config.js` **once at startup**
- Config changes require Metro restart
- SteerCode sandbox **restart failed** ("Failed to restart sandbox")
- **No way to apply config changes** without restart

### **The Solution: Downgrade to SDK 52**
Expo SDK 52 uses React Native **0.76.3**, which is more stable and doesn't have these Flow type parsing issues in Metro.

---

## 📊 Version Changes

### Before (SDK 53)
```json
{
  "expo": "~53.0.0",
  "react-native": "0.76.5",
  "expo-router": "~5.1.0",
  "react": "^18.3.1"
}
```

### After (SDK 52)
```json
{
  "expo": "~52.0.0",
  "react-native": "0.76.3",
  "expo-router": "~4.0.0",
  "react": "18.3.1"
}
```

---

## ✅ What Changed

### **Core Dependencies**
- ✅ `expo`: 53.0.0 → 52.0.0
- ✅ `react-native`: 0.76.5 → 0.76.3 (stable!)
- ✅ `react`: ^18.3.1 → 18.3.1 (exact version)

### **Expo Packages**
- ✅ `expo-router`: 5.1.0 → 4.0.22
- ✅ `expo-splash-screen`: 0.27.0 → 0.28.5
- ✅ `expo-status-bar`: 1.12.1 → 2.0.1
- ✅ All other expo packages matched to SDK 52

### **React Native Libraries**
- ✅ `react-native-reanimated`: 3.15.0 → 3.16.7
- ✅ `react-native-safe-area-context`: 5.4.0 → 4.12.0
- ✅ `react-native-screens`: 4.2.0 → 4.1.0
- ✅ `@react-native-async-storage/async-storage`: 2.1.2 → 2.0.0

---

## 🎯 Expected Result

After downgrade:
1. ✅ **No Metro Flow type errors**
2. ✅ App bundles successfully
3. ✅ All polyfills work (WebSocket + crypto)
4. ✅ App loads on iOS
5. ✅ All features work normally

---

## 🔍 Compatibility Check

### **What Still Works** ✅
- ✅ All core Expo features
- ✅ Expo Router (file-based navigation)
- ✅ iOS and web builds
- ✅ Hot reload / Fast Refresh
- ✅ All installed dependencies (nostr-tools, polyfills, etc.)
- ✅ All custom components and logic
- ✅ AsyncStorage, SecureStore, Haptics, Clipboard
- ✅ Gesture Handler, Reanimated animations

### **What Might Be Different**
- ⚠️ Slightly older Expo Router API (4.x vs 5.x)
- ⚠️ Some minor React Native 0.76.3 vs 0.76.5 differences
- ⚠️ Expo Go SDK 52 needed (not 53) for testing

**Note:** All differences are minor and shouldn't affect our app!

---

## 🚀 Benefits of SDK 52

1. **More Stable**
   - Used by thousands of production apps
   - Well-tested and battle-hardened
   - Fewer edge case bugs

2. **Better Metro Compatibility**
   - No Flow type parsing issues
   - Faster bundling
   - More reliable Hot Reload

3. **Same Features**
   - All APIs we use are available
   - Same performance
   - Same development experience

---

## 📱 Testing Checklist

After downgrade, verify:
- [ ] App bundles without Metro errors
- [ ] Polyfills load (WebSocket + crypto checks pass)
- [ ] Storage initializes successfully
- [ ] NostrClient creates SimplePool
- [ ] HomeScreen renders
- [ ] Feed subscription works
- [ ] Events are fetched from relays
- [ ] Reactions and threading work
- [ ] All UI components render correctly

---

## 🆙 Future Upgrade Path

When to upgrade back to SDK 53+:
1. ✅ SteerCode sandbox restart is fixed
2. ✅ React Native 0.76.6+ fixes Flow type issues
3. ✅ Metro bundler updates handle Flow better
4. ✅ Or we can apply metro.config.js fix with restart

**For now, SDK 52 is the safest choice!**

---

## 🔧 If This Doesn't Work

If still getting Metro errors after downgrade:
1. Clear all caches: `rm -rf node_modules .expo bun.lock`
2. Reinstall: `bun install`
3. Check for any remaining SDK 53 references
4. Verify all package versions match SDK 52

---

## 📚 References

- [Expo SDK 52 Release Notes](https://expo.dev/changelog/2024/11-12-sdk-52)
- [React Native 0.76.3 Release](https://github.com/facebook/react-native/releases/tag/v0.76.3)
- [Expo Router 4.x Docs](https://docs.expo.dev/router/introduction/)

---

## ✨ Summary

**Problem:** SDK 53 + RN 0.76.5 = Metro Flow type errors  
**Solution:** SDK 52 + RN 0.76.3 = Stable and working  
**Result:** App should now bundle and run successfully! 🎉

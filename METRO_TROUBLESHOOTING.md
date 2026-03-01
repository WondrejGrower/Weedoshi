# 🔧 Metro Bundler Troubleshooting

## Overview

This document covers common Metro bundler issues and their solutions, specifically for React Native 0.76.x with Expo.

---

## 🚨 Critical Error: DebuggingOverlayNativeComponent Flow Types

### **Error Message:**
```
node_modules/react-native/src/private/specs/components/DebuggingOverlayNativeComponent.js:
Unsupported param type for method "highlightTraceUpdates", param "updates". 
Found $ReadOnlyArray
```

### **What Causes This:**
- Metro bundler tries to parse React Native **internal spec files**
- These files use **Flow type syntax** (`$ReadOnlyArray`, `$ReadOnly`, etc.)
- Metro's Babel transformer doesn't know how to handle Flow by default
- This **blocks the entire build** - app won't load

### **The Fix:**

We've configured `metro.config.js` to:
1. **Blacklist** React Native internal specs from transformation
2. Use Expo's Babel transformer correctly
3. Enable inline requires for better performance

```javascript
// metro.config.js
config.resolver = {
  ...config.resolver,
  blacklistRE: /node_modules\/react-native\/src\/private\/specs\/.*/,
};
```

This tells Metro to **skip** processing these internal files entirely.

---

## 🛠️ Other Common Metro Errors

### 1. **"Unable to resolve module"**

**Error:**
```
error: Error: Unable to resolve module react-native-url-polyfill
```

**Solution:**
```bash
bun install
# Or if that doesn't work:
rm -rf node_modules bun.lock
bun install
```

### 2. **"Invariant Violation: Module AppRegistry is not a registered callable module"**

**Error:**
```
Invariant Violation: Module AppRegistry is not a registered callable module
```

**Solution:**
- Clear Metro cache: `expo start --clear`
- Check that `index.js` or entry point is correct
- Verify `app/_layout.tsx` imports are correct

### 3. **"Cannot find module 'expo/metro-config'"**

**Error:**
```
Cannot find module 'expo/metro-config'
```

**Solution:**
```bash
bun add -D @expo/metro-config
# Or reinstall Expo:
bun add expo@~53.0.0
```

### 4. **"SyntaxError: Unexpected token"**

**Error:**
```
SyntaxError: Unexpected token '<' or '}'
```

**Solution:**
- Check for JSX syntax errors in your code
- Verify all files have correct imports
- Run `bun run type-check` to find TypeScript errors

---

## 🔄 Clear Metro Cache

If you experience strange bundling issues, always try clearing cache:

```bash
# Method 1: Via Expo CLI
expo start --clear

# Method 2: Manual cleanup
rm -rf node_modules/.cache
rm -rf .expo

# Method 3: Full reset (nuclear option)
rm -rf node_modules bun.lock
bun install
expo start --clear
```

---

## 📊 Metro Config Explained

### **Our Current Configuration:**

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Configure Babel transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('expo/metro-config/babel-transformer'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true, // Performance optimization
    },
  }),
};

// 2. Blacklist problematic files
config.resolver = {
  ...config.resolver,
  blacklistRE: /node_modules\/react-native\/src\/private\/specs\/.*/,
};

module.exports = config;
```

### **What Each Part Does:**

1. **`getDefaultConfig(__dirname)`**
   - Gets Expo's recommended Metro config
   - Includes web support, asset handling, etc.

2. **`babelTransformerPath`**
   - Uses Expo's Babel transformer
   - Handles JSX, TypeScript, and modern JS

3. **`inlineRequires: true`**
   - Performance optimization
   - Reduces bundle size and improves load time

4. **`blacklistRE`**
   - Regular expression to skip certain files
   - Prevents Metro from processing React Native internals

---

## 🐛 Debugging Metro Issues

### **Step 1: Check Metro Terminal**
Look for the **first error** in Metro bundler output:
```
error: [Error message]
```

### **Step 2: Check Error Location**
Metro tells you exactly which file caused the error:
```
/home/user/app/node_modules/react-native/...
```

### **Step 3: Common Patterns**

| Error Pattern | Likely Cause |
|--------------|--------------|
| `Unsupported param type` | Flow types in internal files |
| `Unable to resolve module` | Missing dependency |
| `SyntaxError` | Code syntax error |
| `Invariant Violation` | React Native init issue |

---

## 🚀 Prevention Tips

### **1. Keep Dependencies Updated**
```bash
bun update
```

### **2. Use Exact Versions**
For critical packages, pin exact versions in `package.json`:
```json
{
  "dependencies": {
    "expo": "53.0.0", // Not "~53.0.0"
    "react-native": "0.76.5"
  }
}
```

### **3. Test After Installing New Packages**
```bash
bun add some-package
expo start --clear  # Always clear cache
```

### **4. Monitor Metro Warnings**
Not all warnings are critical, but they can hint at future issues:
- ⚠️ Yellow = Warning (may be OK)
- 🔴 Red = Error (must fix)

---

## 📚 References

- [Expo Metro Config Docs](https://docs.expo.dev/guides/customizing-metro/)
- [Metro Bundler Docs](https://metrobundler.dev/)
- [React Native 0.76 Release Notes](https://reactnative.dev/blog)

---

## ✅ Success Checklist

Metro is working correctly when:
- ✅ No red errors in terminal
- ✅ App loads on device/simulator
- ✅ Fast Refresh works
- ✅ TypeScript compiles without errors
- ✅ Hot reload updates instantly

If you see the error screen, check:
1. Metro terminal for errors
2. `metro.config.js` for correct blacklistRE
3. All dependencies installed
4. Cache cleared

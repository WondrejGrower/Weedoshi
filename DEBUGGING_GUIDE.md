# 🔍 Weedoshi Diaries - Debugging Guide

## iOS Loading Issue - Diagnostic System

### 🎯 Objective
Identify why the app is not loading in SteerCode iOS environment.

---

## 📊 Logging System Overview

We've implemented **comprehensive logging** throughout the app initialization process to track where failures occur.

### **Logging Phases**

#### 1️⃣ **App Initialization** (`app/_layout.tsx`)
```
🚀 App: Starting initialization...
🚀 App: Platform: ios
🚀 App: React Native version: [version]
🔍 App: Checking polyfills...
🔍 App: WebSocket available: ✅ YES
🔍 App: crypto.getRandomValues available: ✅ YES
📦 App: Step 1/3 - Initializing storage...
✅ App: Storage initialized successfully
🔐 App: Step 2/3 - Loading auth state...
✅ App: Auth state loaded
🔄 App: Step 3/3 - Loading relay state...
✅ App: Relay state loaded
🎉 App: Initialization complete!
👋 App: Hiding splash screen...
✅ App: Splash screen hidden
✅ App: Rendering main app...
```

**Failures logged as:**
```
⚠️ App: Initialization timeout (5s) - proceeding anyway
🔴 App: Initialization error: [error message]
🔴 App: Error stack: [stack trace]
```

#### 2️⃣ **Storage Initialization** (`src/lib/storageInit.ts`)
```
📦 Storage: Already initialized, skipping
📦 Storage: Starting initialization...
📦 Storage: Testing AsyncStorage availability...
📦 Storage: Writing test value...
✅ Storage: Test write successful
📦 Storage: Reading test value...
✅ Storage: Test read successful, value: test
📦 Storage: Removing test value...
✅ Storage: Test cleanup successful
🎉 Storage: Initialization complete!
```

**Failures logged as:**
```
🔴 Storage: Initialization failed: [error]
🔴 Storage: Error details: [details]
```

#### 3️⃣ **NostrClient Initialization** (`src/lib/nostrClient.ts`)
```
🌐 NostrClient: Initializing...
🌐 NostrClient: Creating SimplePool...
✅ NostrClient: SimplePool created successfully
🌐 NostrClient: Checking WebSocket availability...
✅ NostrClient: WebSocket is available
```

**Failures logged as:**
```
🔴 NostrClient: WebSocket is undefined! This will cause issues.
🔴 NostrClient: Constructor error: [error]
🔴 NostrClient: No relays configured!
```

#### 4️⃣ **Feed Subscription** (`app/index.tsx`)
```
🏠 HomeScreen: Component mounted
🏠 HomeScreen: Auth state: Logged out
🏠 HomeScreen: Relay URLs: [...]
🏠 HomeScreen: Hashtags: [...]
📡 HomeScreen: subscribeFeed called
📡 HomeScreen: Setting relays: [...]
📡 HomeScreen: Starting subscription...
✅ HomeScreen: Subscription created: [subId]
```

**Failures logged as:**
```
⚠️ HomeScreen: No relays enabled
⚠️ HomeScreen: Overall timeout reached (10s)
🔴 HomeScreen: subscribeFeed error: [error]
🔴 HomeScreen: Error stack: [stack trace]
```

---

## 🛡️ Error Handling Features

### **1. Error Boundary**
- Catches all React component errors
- Displays user-friendly error screen
- Shows full stack trace for debugging
- "Try Again" button to reset

### **2. Initialization Timeout**
- **5-second timeout** on initialization
- App proceeds even if storage fails
- Warning displayed to user
- Prevents infinite loading

### **3. Graceful Degradation**
- App continues even with partial failures
- Features may be limited but app is usable
- Clear error messages guide user

---

## 🔍 Known iOS Issues

### **Potential Problems:**

1. **WebSocket Polyfill Missing**
   - React Native iOS doesn't have native WebSocket for nostr-tools
   - **Check:** Look for `WebSocket is undefined` in logs
   - **Fix:** Add `react-native-url-polyfill`

2. **AsyncStorage Failure**
   - iOS storage permissions or corruption
   - **Check:** Look for storage initialization errors
   - **Fix:** Clear app data and reinstall

3. **Crypto Compatibility**
   - nostr-tools crypto may fail on iOS
   - **Check:** Look for signature verification errors
   - **Fix:** Add `expo-crypto` polyfill

4. **SimplePool Connection Limit**
   - iOS limits WebSocket connections (max 6)
   - **Check:** Count enabled relays
   - **Fix:** Reduce to 3 relays max

5. **Network Security**
   - iOS blocks non-secure WebSocket (ws://)
   - **Check:** Verify all relays use wss://
   - **Fix:** Remove any ws:// relays

---

## 📱 How to Debug

### **Step 1: Check Console Logs**
Look for the **first error** in the sequence:
- 🔴 indicates errors
- ⚠️ indicates warnings
- ✅ indicates success

### **Step 2: Identify Failure Point**
Match the last successful log to the phase:
- Storage initialization?
- NostrClient creation?
- Component mount?
- Feed subscription?

### **Step 3: Check Error Boundary**
If app shows error screen:
- Read error message
- Check component stack
- Look at full stack trace

### **Step 4: Common Fixes**

**If stuck on loading screen:**
- Check if timeout warning appears after 5s
- Look for storage initialization errors
- Verify WebSocket availability

**If "No relays configured" error:**
- Default relays should auto-load
- Check relay manager initialization
- Verify storage is working

**If timeout on subscription:**
- Too many relays (reduce to 3)
- Relay URLs invalid (must be wss://)
- Network connectivity issue

---

## 🧪 Testing Checklist

- [ ] Storage initialization completes
- [ ] Auth manager loads state
- [ ] Relay manager loads state
- [ ] Splash screen hides
- [ ] HomeScreen component mounts
- [ ] NostrClient initializes
- [ ] WebSocket is available
- [ ] Feed subscription starts
- [ ] Events are received

---

## 🚀 Next Steps

Based on logs, implement fixes:

1. **Add WebSocket polyfill**
2. **Reduce default relays to 3**
3. **Add crypto polyfills**
4. **Validate all relay URLs**
5. **Add connection retry logic**

---

## 📞 Support

Check console logs for:
- Exact error messages
- Stack traces
- Timing of failures
- Which phase failed

This will help identify the root cause quickly.
# 🚀 Quick Start Guide - Weedoshi Diaries

## Quick Test of Timeout Fixes

### 1. Start the App
```bash
bun run dev
```

### 2. Test Scenarios

#### ✅ **Test 1: Normal Operation (Good Relays)**
1. Keep default relays enabled
2. Click "Refresh" button
3. **Expected**: Events load within 1-3 seconds
4. **Result**: Feed displays cannabis-related posts

#### ⚠️ **Test 2: Slow Relay Response**
1. Add a slow relay: `wss://slow-relay-example.com`
2. Click "Refresh"
3. **Expected**: Warning after 5 seconds, but continues
4. **Result**: May show warning but other relays continue

#### ❌ **Test 3: All Relays Unreachable**
1. Disable all good relays
2. Add fake relay: `wss://fake-relay-test.com`
3. Click "Refresh"
4. **Expected**: Error message after 10 seconds
5. **Result**: "⚠️ Relays not responding. Check your connection or try different relays."

#### 🔄 **Test 4: Network Recovery**
1. Start with bad relays (error state)
2. Re-enable good relays
3. Click "Refresh" again
4. **Expected**: Successful connection and feed loads
5. **Result**: App recovers gracefully

### 3. Check Diagnostics

Open browser console (for web) or React Native debugger:

```javascript
// View all diagnostic logs
import { diagnostics } from './src/lib/diagnostics';
console.log(diagnostics.getLogs());

// View last error
console.log(diagnostics.getLastError());
```

### 4. Expected Log Output

**Successful connection:**
```
[2026-02-28T...] [INFO] Starting subscription to 3 relays
[2026-02-28T...] [INFO] First event received from wss://relay.damus.io
[2026-02-28T...] [INFO] End of stored events - received 42 total events
[2026-02-28T...] [INFO] Subscription abc123 created successfully
```

**Timeout scenario:**
```
[2026-02-28T...] [INFO] Starting subscription to 1 relays
[2026-02-28T...] [WARN] Subscription timeout - no events received within 5s
```

## Default Configuration

### Relays (Default Enabled)
- `wss://relay.damus.io`
- `wss://relay.nostr.band`
- `wss://nos.lol`

### Hashtags (Default)
- `weedstr`
- `weed`
- `cannabis`
- `grow`
- `livingsoil`

### Timeouts
- **Relay timeout**: 5 seconds
- **Overall timeout**: 10 seconds
- **Loading grace period**: 3 seconds

## Troubleshooting

### Issue: App hangs on loading
**Solution**: Check if Expo Metro is running. Restart with:
```bash
bun run dev
```

### Issue: "No relays enabled" error
**Solution**: Enable at least one relay in the Relays panel

### Issue: No events loading
**Possible causes:**
1. All relays are slow/down (wait for timeout)
2. No posts with selected hashtags in last 7 days
3. Network connectivity issue

**Solution**: Try different relays or hashtags

### Issue: TypeScript errors
**Check:**
```bash
bun run type-check
```

## Development Commands

```bash
# Start development server
bun run dev

# Run on iOS
bun run ios

# Run on Android
bun run android

# Type check
bun run type-check

# Lint (note: prettier plugin has known issues)
bun run lint
```

## Key Features to Test

- ✅ **Login**: Test with nsec (full access) or npub (read-only)
- ✅ **Relay Management**: Enable/disable/add custom relays
- ✅ **Hashtag Filtering**: Add/remove hashtags
- ✅ **Feed Refresh**: Should complete within 10s max
- ✅ **Timeout Handling**: Should show warnings/errors appropriately
- ✅ **Error Recovery**: Can recover from errors by refreshing

## Performance Expectations

| Action | Expected Time | Timeout |
|--------|--------------|---------|
| Good relay connection | 1-3s | 5s warning |
| All relays tried | 3-7s | 10s error |
| Feed refresh | 2-5s | 10s max |
| Loading indicator | 0-3s | Auto-hide |

## Success Criteria

✅ App never hangs indefinitely  
✅ Clear feedback on all connection states  
✅ Errors are actionable and user-friendly  
✅ Can recover from errors without restart  
✅ No memory leaks on repeated refreshes  

---

**Ready to test!** 🎉
# Quick Start Guide - 5 Minutes ⚡

Get Weedoshi Diaries (WD) running locally in 5 minutes!

## 1. Prerequisites (1 minute)

Check you have Node.js installed:
```bash
node --version  # Should be 16+
npm --version   # Should be 8+
```

Don't have it? Download from https://nodejs.org/

## 2. Clone & Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/weedoshi-diaries.git
cd weedoshi-diaries

# Install dependencies
npm install
```

## 3. Start Development (1 minute)

```bash
npm run dev
```

Your app opens at **http://localhost:5173** 🎉

## 4. Get Test Keys (1 minute)

1. Visit https://www.nostrplebs.com/
2. Click "Generate Keys"
3. Copy your **nsec** (private key)
4. Copy your **npub** (public key)

**Keep nsec secret!** 🔒

## 5. Test the App

1. Paste your nsec into the login form
2. Click "Login"
3. Enable a relay (e.g., Damus)
4. Add hashtags: weed, cannabis, grow
5. Watch the feed load! 🌿

## Common Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check code quality
npm run lint

# Fix lint issues
npm run lint -- --fix
```

## Project Structure

```
src/
├── App.tsx                 # Main app
├── components/            # UI components
│   ├── AuthPanel.tsx      # Login/logout
│   ├── RelayPanel.tsx     # Relay management
│   ├── HashtagPanel.tsx   # Hashtag filtering
│   ├── Feed.tsx           # Feed display
│   └── ...other components
└── lib/                   # Core logic
    ├── nostrClient.ts     # Nostr protocol
    ├── authManager.ts     # Authentication
    └── ...other logic
```

## Troubleshooting

**Port 5173 already in use?**
```bash
npm run dev -- --port 3000
```

**npm install fails?**
```bash
# Clear cache and try again
npm cache clean --force
npm install
```

**Build fails with TypeScript errors?**
```bash
# Check for errors
npm run build

# Fix formatting
npm run lint -- --fix
```

**Can't login?**
1. Make sure nsec is copied completely (no spaces)
2. Check browser console (F12) for errors
3. Try generating new keys at nostrplebs.com

## Next Steps

- 📖 Read [README.md](README.md) for full documentation
- 🚀 Deploy to [Vercel](DEPLOYMENT.md) (one command!)
- 🤝 Contribute! See [CONTRIBUTING.md](CONTRIBUTING.md)
- 💬 Join community on Nostr (#weedoshi hashtag)

## Need Help?

- **FAQ**: See [FAQ.md](FAQ.md)
- **Testing**: See [TESTING.md](TESTING.md)
- **Advanced tips**: See [POWER_TIPS.md](POWER_TIPS.md)
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Happy growing!** 🌿

Questions? Ask on Nostr using #weedoshi or #weed hashtags!
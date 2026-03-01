# Weedoshi Diaries (WD) - Testing Guide

Complete testing scenarios and checklists for QA and development.

## Pre-Testing Setup

### 1. Generate Test Keys

Visit https://www.nostrplebs.com/ and generate:
- **Test Account 1 (nsec)**: Full access key pair
- **Test Account 2 (npub)**: Public key only for read-only testing

Save these for repeated testing.

### 2. Start Development Server

```bash
npm run dev
# Server runs at http://localhost:5173
```

### 3. Browser DevTools

Open DevTools (F12) and keep Console tab visible to catch any errors.

## Test Scenarios 🧪

### Authentication Tests

#### Test 1.1: nsec Login
**Steps:**
1. Paste test nsec into nsec input field
2. Click "Login" button
3. Verify logged in state shows pubkey

**Expected Results:**
- ✅ "Logged in as" message appears
- ✅ Pubkey displays (shortened)
- ✅ Logout button visible
- ✅ No errors in console
- ✅ Data persists on page refresh

**Edge Cases:**
- Invalid nsec format → Error message
- Empty field → Error message
- Extra spaces → Trimmed and works
- Very long key → Works correctly

#### Test 1.2: npub Login
**Steps:**
1. Click npub tab
2. Paste test npub
3. Click "Login" button

**Expected Results:**
- ✅ Logged in with npub
- ✅ Shows "read-only" mode indicator
- ✅ Feed still loads content
- ✅ Cannot post (future feature)

#### Test 1.3: Logout
**Steps:**
1. Login with nsec/npub
2. Click "Logout" button
3. Verify logged out

**Expected Results:**
- ✅ Auth state clears
- ✅ Login form visible again
- ✅ localStorage cleared
- ✅ Page refresh shows logged out state

#### Test 1.4: Persistence
**Steps:**
1. Login with nsec
2. Refresh page (F5)
3. Check if still logged in

**Expected Results:**
- ✅ Still logged in after refresh
- ✅ Pubkey restored from storage
- ✅ Feed reloads automatically

### Relay Management Tests

#### Test 2.1: Enable/Disable Default Relays
**Steps:**
1. Start logged in
2. Toggle each default relay on/off
3. Watch feed update

**Expected Results:**
- ✅ Each relay can be toggled
- ✅ Feed content updates when relay toggled
- ✅ Toggle state persists on refresh
- ✅ No errors in console

**Relays to test:**
- [ ] Damus (wss://relay.damus.io)
- [ ] Snort (wss://nostr.snort.social)
- [ ] Nostr.band (wss://nostr.band)
- [ ] Nostr-pub (wss://nostr-pub.semisol.dev)

#### Test 2.2: Add Custom Relay
**Steps:**
1. Enter relay URL: `wss://nos.lol`
2. Click "Add" button
3. Wait 5 seconds
4. Verify relay appears in list
5. Toggle it to enable

**Expected Results:**
- ✅ Relay added to list
- ✅ Custom relay appears with checkbox
- ✅ Feed updates with content from new relay
- ✅ Persists on refresh
- ✅ No connection errors

**Test Multiple Custom Relays:**
- Add 2-3 different relays
- Verify all appear in list
- Toggle each on/off

#### Test 2.3: Remove Custom Relay
**Steps:**
1. Add custom relay
2. Click X button next to it
3. Verify relay removed

**Expected Results:**
- ✅ Relay removed from list
- ✅ Removal persists on refresh
- ✅ Feed content updates
- ✅ No errors

#### Test 2.4: Invalid Relay URL
**Steps:**
1. Try to add: `http://invalid.com` (http not wss)
2. Try to add: `not-a-url`
3. Try to add: empty string

**Expected Results:**
- ✅ Error message for invalid URLs
- ✅ Relay not added
- ✅ User told why it failed
- ✅ Can try again

#### Test 2.5: Relay Offline
**Steps:**
1. Add relay that might be offline
2. Wait 10 seconds
3. Check if feed loads from other relays

**Expected Results:**
- ✅ App doesn't crash
- ✅ Other relays still work
- ✅ No hanging connections
- ✅ Feed loads from available relays

### Hashtag Filtering Tests

#### Test 3.1: Default Hashtags
**Steps:**
1. Login with relays enabled
2. Verify default hashtags appear:
   - weedstr
   - weed
   - cannabis
   - grow
   - livingsoil

**Expected Results:**
- ✅ All 5 default hashtags present
- ✅ Feed filters by these tags
- ✅ Content matches filters
- ✅ Persists on refresh

#### Test 3.2: Add Custom Hashtag
**Steps:**
1. Type `#test` in input field
2. Press Enter (or click Add button)
3. Verify hashtag appears in list

**Expected Results:**
- ✅ Hashtag added to filter
- ✅ Feed updates immediately
- ✅ Only content with hashtag shows
- ✅ Persists on refresh

#### Test 3.3: Remove Hashtag
**Steps:**
1. Click X next to any hashtag
2. Verify removed from list

**Expected Results:**
- ✅ Hashtag removed
- ✅ Feed updates to show different content
- ✅ Removal persists on refresh

#### Test 3.4: No Hashtags
**Steps:**
1. Remove all hashtags
2. Observe feed

**Expected Results:**
- ✅ Feed shows message (no filters)
- ✅ No content displayed (expected)
- ✅ Add hashtag re-enables feed

#### Test 3.5: Hashtag with Special Characters
**Steps:**
1. Add hashtag: `#growing-tips`
2. Add hashtag: `#2024-harvest`
3. Add hashtag: `#soil.microbes`

**Expected Results:**
- ✅ All special chars work
- ✅ Feed filters correctly
- ✅ No parsing errors

#### Test 3.6: Case Sensitivity
**Steps:**
1. Add: `#Weed`
2. Add: `#CANNABIS`
3. Compare with default lowercase versions

**Expected Results:**
- ✅ Hashtags work case-insensitive
- ✅ `#Weed` matches `#weed` content
- ✅ Filters work as expected

### Feed Tests

#### Test 4.1: Feed Loads Content
**Steps:**
1. Enable at least 2 relays
2. Add hashtags
3. Wait 5 seconds
4. Observe feed

**Expected Results:**
- ✅ Content appears in feed
- ✅ Posts show author, time, content
- ✅ Hashtags display as badges
- ✅ Timestamps formatted correctly

#### Test 4.2: Real-time Updates
**Steps:**
1. Keep feed open for 2 minutes
2. Watch for new content

**Expected Results:**
- ✅ Feed updates with new posts
- ✅ New posts appear at top
- ✅ No duplicates shown
- ✅ Performance stays smooth

#### Test 4.3: Refresh Button
**Steps:**
1. Click Refresh button
2. Observe feed reloading

**Expected Results:**
- ✅ Loading indicator shows
- ✅ Feed clears and reloads
- ✅ New content fetched
- ✅ Button disabled while loading

#### Test 4.4: Empty Feed
**Steps:**
1. Add hashtag that doesn't exist: `#fakehashtagxyz123`
2. Wait 5 seconds

**Expected Results:**
- ✅ Empty state message appears
- ✅ Helpful message shows
- ✅ No errors
- ✅ Hashtag can be removed

#### Test 4.5: Error Handling
**Steps:**
1. Disable all relays
2. Try to refresh
3. Observe error state

**Expected Results:**
- ✅ Error message appears
- ✅ Retry button available
- ✅ Message is helpful
- ✅ Enable relay to fix

#### Test 4.6: Feed Items Display
**Steps:**
1. Look at individual feed items
2. Verify all fields present:
   - Author (shortened pubkey)
   - Timestamp (formatted date/time)
   - Content (full text)
   - Hashtags (as badges)
   - Relay source

**Expected Results:**
- ✅ All fields present and readable
- ✅ Timestamps are human-readable
- ✅ Long content wraps correctly
- ✅ Hashtags show as colored badges

### UI/UX Tests

#### Test 5.1: Responsive Layout
**Steps:**
1. Test at different screen sizes:
   - Desktop: 1920x1080
   - Tablet: 768x1024
   - Mobile: 375x667

**Expected Results:**
- ✅ Desktop: Sidebar (left) + Feed (right)
- ✅ Tablet: Single column layout
- ✅ Mobile: Single column layout
- ✅ All content readable on each size
- ✅ No horizontal scrolling
- ✅ Buttons clickable on mobile

#### Test 5.2: Dark Mode (if implemented)
**Steps:**
1. Toggle dark/light mode
2. Check contrast
3. Verify all text readable

**Expected Results:**
- ✅ Colors adjust for dark mode
- ✅ WCAG AA contrast maintained
- ✅ Preference persists
- ✅ No broken elements

#### Test 5.3: Button Interactions
**Steps:**
1. Click each button to verify response:
   - Login button
   - Logout button
   - Relay toggles
   - Remove buttons
   - Refresh button
   - Add buttons

**Expected Results:**
- ✅ All buttons respond immediately
- ✅ Disabled state shows properly
- ✅ Loading state shows while processing
- ✅ No double-click issues
- ✅ Hover states visible

#### Test 5.4: Input Fields
**Steps:**
1. Test each input field:
   - nsec input
   - npub input
   - Relay URL input
   - Hashtag input

**Expected Results:**
- ✅ Can type and clear
- ✅ Placeholder text visible
- ✅ Error messages helpful
- ✅ No lag when typing
- ✅ Copy/paste works

### localStorage Persistence Tests

#### Test 6.1: Auth Persistence
**Steps:**
1. Login with nsec
2. Open DevTools → Application → localStorage
3. Verify pubkey stored
4. Refresh page
5. Verify still logged in

**Expected Results:**
- ✅ pubkey stored in localStorage
- ✅ nsec NOT stored (security)
- ✅ Login state persists
- ✅ Can see stored data key

#### Test 6.2: Relay Configuration Persistence
**Steps:**
1. Configure relays (enable/disable/add)
2. Check localStorage
3. Refresh page
4. Verify configuration restored

**Expected Results:**
- ✅ Relay list stored
- ✅ Toggle states saved
- ✅ Custom relays saved
- ✅ Restored on refresh

#### Test 6.3: Hashtag Persistence
**Steps:**
1. Modify hashtags (add/remove)
2. Refresh page
3. Verify hashtags restored

**Expected Results:**
- ✅ Hashtag list saved
- ✅ Custom hashtags saved
- ✅ Restored exactly on refresh

#### Test 6.4: localStorage Clearing
**Steps:**
1. Clear all site data (DevTools → Storage → Clear Site Data)
2. Refresh page
3. Verify defaults loaded

**Expected Results:**
- ✅ App resets to initial state
- ✅ Defaults load (hashtags, relays)
- ✅ Must login again
- ✅ No errors

### Browser Compatibility Tests

#### Test 7.1: Chrome/Chromium
```
[ ] Chrome latest
[ ] Chromium latest
[ ] Edge latest
```

**Expected Results:**
- ✅ All features work
- ✅ No console errors
- ✅ Performance smooth
- ✅ WebSocket stable

#### Test 7.2: Firefox
```
[ ] Firefox latest
[ ] Firefox ESR
```

**Expected Results:**
- ✅ All features work
- ✅ No console errors
- ✅ Performance acceptable
- ✅ WebSocket stable

#### Test 7.3: Safari
```
[ ] Safari on Mac (latest)
[ ] Safari on iPhone (latest)
```

**Expected Results:**
- ✅ All features work
- ✅ No console errors
- ✅ Mobile experience good
- ✅ WebSocket works

#### Test 7.4: Mobile Browsers
```
[ ] Chrome Mobile (Android)
[ ] Safari (iPhone)
[ ] Firefox Mobile (Android)
```

**Expected Results:**
- ✅ Touch interactions work
- ✅ Responsive layout works
- ✅ No zoom required
- ✅ localStorage works

### Performance Tests

#### Test 8.1: Initial Load Time
**Steps:**
1. Open DevTools → Network tab
2. Hard refresh (Ctrl+Shift+R)
3. Measure time to interactive

**Expected Results:**
- ✅ Page interactive < 2 seconds
- ✅ Bundle size ~310KB
- ✅ Gzipped ~100KB
- ✅ No large assets

#### Test 8.2: Feed Loading Performance
**Steps:**
1. Enable multiple relays (4+)
2. Add multiple hashtags (5+)
3. Wait for content to load
4. Check DevTools → Performance tab

**Expected Results:**
- ✅ Content loads within 5 seconds
- ✅ 60 FPS during scrolling
- ✅ No jank or stutter
- ✅ Smooth animations

#### Test 8.3: Memory Usage
**Steps:**
1. Keep app open for 5 minutes
2. Check DevTools → Memory
3. Monitor for leaks

**Expected Results:**
- ✅ Memory usage stable
- ✅ No continuous growth
- ✅ Garbage collection works
- ✅ No console warnings

### Security Tests

#### Test 9.1: nsec Security
**Steps:**
1. Check DevTools → Application → localStorage
2. Search for nsec or private key

**Expected Results:**
- ✅ nsec never appears in storage
- ✅ Only pubkey stored
- ✅ No sensitive data exposed
- ✅ Password manager warning? None (good)

#### Test 9.2: Input Sanitization
**Steps:**
1. Try to add relay URL: `<script>alert('xss')</script>`
2. Try to add hashtag: `<img src=x onerror=alert('xss')>`
3. Try invalid inputs

**Expected Results:**
- ✅ Invalid inputs rejected
- ✅ No XSS vulnerability
- ✅ No alerts/execution
- ✅ Error message shown

#### Test 9.3: NoSQL Injection (if applicable)
**Steps:**
1. Check if localStorage can be exploited
2. Try special characters in inputs

**Expected Results:**
- ✅ No injection vulnerabilities
- ✅ Special chars handled safely
- ✅ Data integrity maintained

## Manual Testing Checklist ✅

### Pre-Release Checklist

**Setup**
- [ ] Install dependencies: `npm install`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Dev server starts: `npm run dev`

**Core Features**
- [ ] nsec login works
- [ ] npub login works
- [ ] Logout clears data
- [ ] Relays enable/disable
- [ ] Add custom relay
- [ ] Remove relay
- [ ] Hashtags add/remove
- [ ] Feed loads and updates
- [ ] Refresh button works
- [ ] Error states display
- [ ] Empty states display

**Data Persistence**
- [ ] Auth persists on refresh
- [ ] Relays persist on refresh
- [ ] Hashtags persist on refresh
- [ ] Clearing cache resets app

**UI/UX**
- [ ] Desktop layout correct
- [ ] Mobile layout correct
- [ ] All buttons clickable
- [ ] No layout shifts
- [ ] Text readable
- [ ] Images load (if any)

**Performance**
- [ ] Page loads fast
- [ ] Feed updates smooth
- [ ] No console errors
- [ ] No memory leaks
- [ ] Scroll smooth

**Browsers**
- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari (if available)
- [ ] Mobile browser

**Security**
- [ ] nsec not stored
- [ ] No XSS vulnerabilities
- [ ] Input validation works
- [ ] No sensitive data exposed

## Automated Testing (Future)

Planned for future versions:
- [ ] Unit tests (Jest)
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Accessibility tests (axe)

## Bug Report Template

Found a bug? Create an issue with:

```markdown
## Bug Title

### Description
Clear description of the bug

### Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Screenshots
Attach screenshots if helpful

### Environment
- Browser: Chrome 120
- OS: Windows 10
- Device: Desktop/Mobile
- URL: http://localhost:5173

### Console Errors
Paste any errors from F12 → Console
```

## Performance Baselines

Expected performance metrics:

| Metric | Target | Actual |
|--------|--------|--------|
| First Contentful Paint | < 1s | |
| Largest Contentful Paint | < 2s | |
| Time to Interactive | < 2s | |
| Bundle Size | < 320KB | 310KB ✅ |
| Gzipped Size | < 110KB | 101KB ✅ |
| Feed Load Time | < 5s | |
| Scroll FPS | 60 | |

## Testing Tools

Recommended tools for testing:

- **DevTools** (F12) - Browser developer tools
- **Lighthouse** (DevTools) - Performance audits
- **nostr.watch** - Check relay status
- **nostrplebs.com** - Generate test keys
- **speedtest.net** - Check internet speed

## Contact & Support

Need help testing?
- Ask on Nostr: #weedoshi or #weed
- Report bugs on GitHub
- Check FAQ.md for common issues

---

**Happy Testing!** 🌿

Last Updated: 2026-02-27
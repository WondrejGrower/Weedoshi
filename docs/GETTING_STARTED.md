# Getting Started with Weedoshi Diaries (WD)

Welcome to Weedoshi Diaries (WD)! This guide will help you get up and running quickly.

## What is Weedoshi Diaries (WD)?

Weedoshi Diaries (WD) is a **decentralized cannabis community feed reader** built on the Nostr protocol.

### Key Features
- 🔐 **Decentralized** - No company, no servers, fully peer-to-peer
- 🌍 **Global** - Connect with growers worldwide
- 🚀 **Fast** - Lightweight, instant loading
- 🔒 **Private** - Your data stays on your device
- 📱 **Mobile-friendly** - Works on all devices

## 5-Minute Setup

### Step 1: Generate Your Keys (1 min)
1. Visit https://www.nostrplebs.com/
2. Click "Generate Keys"
3. Save your keys:
   - **nsec** (private) = Your password
   - **npub** (public) = Your username

**⚠️ Keep nsec secret!**

### Step 2: Login (30 seconds)
1. Choose login type:
   - **nsec**: Full access to your account
   - **npub**: Read-only mode
2. Paste your key
3. Click "Login"

### Step 3: Configure Relays (30 seconds)
1. Check the default relays (Damus, Snort, Nostr.band, Nostr-pub)
2. Enable at least one relay
3. The app connects to Nostr network

### Step 4: Set Hashtags (1 min)
Choose what content you want to see:

**Default hashtags:**
- `#weedstr` - Weedoshi community
- `#weed` - General cannabis
- `#cannabis` - Cannabis content
- `#grow` - Growing tips
- `#livingsoil` - Soil growing

Add or remove hashtags as you like!

### Step 5: Explore (2 min)
Watch the feed load real-time content from the Nostr network! 🎉

## Understanding the Interface

### Authentication Panel (Top Left)
- Shows your login status
- Login/logout buttons
- Read-only indicator (if using npub)

### Relay Panel (Middle Left)
- List of enabled relays
- Toggle relays on/off
- Add custom relay URLs
- Remove relays

### Hashtag Panel (Bottom Left)
- Current hashtags filtering feed
- Add new hashtags
- Remove hashtags
- See default hashtags

### Main Feed (Right)
- Real-time content from all relays
- Filtered by your hashtags
- Newest posts at top
- Refresh button to reload

## Common Questions

### Is my data private?
Yes! Your **private key** (nsec) is never stored. Only your **public key** (pubkey) is saved in your browser. Everything stays on your device.

### What are relays?
Relays are independent servers storing Nostr data. Think of them like:
- Independent databases
- Owned by different people
- Working together
- Censorship-resistant by design

### Why do I need relays?
Relays connect you to the Nostr network where content is stored. At least one relay must be enabled to see content.

### Can I add custom relays?
Yes! If you know a relay URL (starting with `wss://`), you can add it. Great for:
- Private relays
- Specific communities
- Personal nodes

### How do hashtags work?
Hashtags filter content to show only what you want:
1. Add hashtag: `#grow`
2. Feed shows only notes with `#grow`
3. Keeps your feed focused

### What if I lose my nsec?
Unfortunately, you can't recover it. That's why you should:
- Write it down securely
- Use a password manager
- Keep it safe

## Troubleshooting

### Feed not loading?
1. Check internet connection
2. Enable at least one relay
3. Click Refresh button
4. Try a different relay

### Can't login?
1. Make sure nsec/npub is complete (no spaces)
2. Check browser console (F12) for errors
3. Generate new keys at nostrplebs.com

### Relays not connecting?
1. Verify relay URL (starts with `wss://`)
2. Check relay status at nostr.watch
3. Try a different relay
4. Check your internet

## Next Steps

- 📖 Read [FAQ.md](../FAQ.md) - 40+ answered questions
- 🔧 Try [POWER_TIPS.md](../POWER_TIPS.md) - Advanced techniques
- 🚀 Deploy to [Vercel](../DEPLOYMENT.md) - One-click deployment
- 🤝 Contribute - See [CONTRIBUTING.md](../CONTRIBUTING.md)

## Join the Community

Connect on Nostr:
- **#weedoshi** - App-specific
- **#weed** - General cannabis
- **#cannabis** - Cannabis content
- **#grow** - Growing tips
- **#livingsoil** - Soil growing

## Key Concepts

### Public vs Private
- **pubkey (public)** - Your identity, safe to share
- **nsec (private)** - Your secret key, never share!

### Read-only vs Full Access
- **npub login** - Read-only, safer
- **nsec login** - Full access, can publish (future)

### Relay Strategies
- **Speed**: Use 2-3 fast relays
- **Discovery**: Use all relays
- **Privacy**: Use diverse relays

### Hashtag Strategies
- **Focus**: 3-5 hashtags
- **Discovery**: 10+ hashtags
- **Niche**: Very specific hashtags

## Need Help?

1. **FAQ** - Check [FAQ.md](../FAQ.md)
2. **Nostr** - Ask using #weedoshi
3. **GitHub** - Report issues
4. **POWER_TIPS** - See advanced tips

## Security Reminders

### ✅ Do This
- Keep nsec secret
- Use secure device
- Keep browser updated
- Logout on shared computers
- Back up nsec securely

### ❌ Don't Do This
- Share nsec online
- Paste nsec in console
- Use same password everywhere
- Store nsec in plain text
- Give nsec to anyone

---

**Ready to explore the cannabis community?**

Login and start discovering growers, tips, and community content! 🌿

Questions? Ask on Nostr using #weedoshi hashtag!

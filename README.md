# Weedoshi Diaries (WD) 🌿

A decentralized cannabis community feed reader built on the **Nostr protocol**. Read, discover, and connect with the global cannabis growing community without intermediaries.

**Live Demo**: https://weedoshi.vercel.app (coming soon)

## Features ✨

- 🔐 **Decentralized Authentication** - nsec (full) & npub (read-only) login via Nostr
- 🔄 **Multi-Relay Support** - Connect to multiple relays for reliability and censorship resistance
- #️⃣ **Smart Hashtag Filtering** - Filter cannabis-related content (weedstr, weed, cannabis, grow, livingsoil)
- ⚡ **Real-time Feed** - Live event streaming with automatic deduplication
- 📱 **Responsive Design** - Works on desktop and mobile browsers
- 💾 **Client-side Only** - No backend, no servers, 100% your data
- 🚀 **Fast & Lightweight** - ~310KB bundle (101KB gzipped)

## Quick Start 🚀

### Prerequisites
- Node.js 16+ 
- npm or bun
- A browser (Chrome, Firefox, Safari, or Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/weedoshi-diaries.git
cd weedoshi-diaries

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

The app will open at **http://localhost:5173**

### Get Your Keys

1. Visit https://www.nostrplebs.com/
2. Generate your **nsec** (private key) and **npub** (public key)
3. Keep your **nsec** secret (like a password)
4. Share your **npub** publicly (like a username)

### Using the App

1. **Login** - Enter your nsec (full access) or npub (read-only)
2. **Configure Relays** - Enable at least one relay to connect to Nostr
3. **Set Hashtags** - Filter to see only cannabis-related content
4. **Explore Feed** - See real-time posts from the community

## Available Scripts 📝

```bash
# Development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Check code quality
npm run lint

# Fix lint issues
npm run lint -- --fix
```

## Technology Stack 🛠️

- **React 19.2** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 7.3** - Fast bundler
- **Tailwind CSS 4.2** - Responsive styling
- **nostr-tools 2.23.2** - Nostr protocol
- **ESLint + Prettier** - Code quality & formatting

## Project Structure 📂

```
weedoshi-diaries/
├── src/
│   ├── App.tsx                 # Main application
│   ├── main.tsx               # React entry point
│   ├── index.css              # Tailwind CSS
│   ├── components/            # React components
│   │   ├── AuthPanel.tsx      # Login/logout UI
│   │   ├── RelayPanel.tsx     # Relay management
│   │   ├── HashtagPanel.tsx   # Hashtag filtering
│   │   ├── Feed.tsx           # Feed display
│   │   ├── FeedItem.tsx       # Individual note
│   │   └── InfoPanel.tsx      # Quick start guide
│   └── lib/                   # Core logic
│       ├── nostrClient.ts     # Nostr protocol client
│       ├── authManager.ts     # Authentication
│       ├── relayManager.ts    # Relay configuration
│       ├── eventFilter.ts     # Event filtering
│       └── testKeys.ts        # Test utilities
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
├── eslint.config.js           # ESLint rules
├── README.md                  # This file
├── DEPLOYMENT.md              # Deployment guide
├── TESTING.md                 # Test scenarios
├── FAQ.md                     # Frequently asked questions
├── CONTRIBUTING.md            # Contributing guide
├── CHANGELOG.md               # Version history
├── POWER_TIPS.md              # Advanced tips
└── LICENSE                    # MIT License
```

## Documentation 📚

- **[FAQ.md](FAQ.md)** - Answer to common questions
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - How to deploy the app
- **[TESTING.md](TESTING.md)** - Test scenarios and checklist
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical deep dive
- **[POWER_TIPS.md](POWER_TIPS.md)** - Advanced usage tips
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[CONTRIBUTORS.md](CONTRIBUTORS.md)** - List of contributors

## Key Concepts 🎯

### Authentication
- **nsec** (private key) = Full access to your account
- **npub** (public key) = Read-only access
- Private keys never stored, only pubkey persists

### Relays
Servers that store Nostr data. Think of them like independent databases that work together:
- Default relays: Damus, Snort, Nostr.band, Nostr-pub
- Add your own custom relays
- Enable/disable as needed

### Hashtags
Filter content to see only what you care about:
- Default: `#weedstr` `#weed` `#cannabis` `#grow` `#livingsoil`
- Add custom hashtags for niche interests
- Extracts from both event tags and content

### Feed
Real-time events from enabled relays, filtered by your hashtags:
- Most recent first
- Last 7 days of history
- Automatic duplicate removal
- Click refresh for manual update

## Security 🔒

✅ **What's Protected**
- Your private key (nsec) is never stored
- Only your public key (pubkey) persists
- No server can access your private key
- All data stays on your device

⚠️ **Your Responsibility**
- Never share your nsec online
- Keep nsec in a password manager or written down
- Logout on shared computers
- Don't paste nsec in console or chat

## Browser Support 🌐

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Android Chrome)
- ✅ Any browser with WebSocket support

## Performance ⚡

- **Bundle size**: ~309KB (101KB gzipped)
- **Build time**: ~2 seconds
- **Load time**: Instant on modern devices
- **60 FPS**: Smooth interactions

## Deployment 🚀

### Quick Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Your app goes live instantly at `https://your-project.vercel.app`

See [DEPLOYMENT.md](DEPLOYMENT.md) for more options:
- Vercel (recommended, free)
- Netlify (free)
- GitHub Pages (free)
- Self-hosted VPS (any provider)

## Contributing 🤝

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- How to report bugs
- How to suggest features
- Code style guidelines
- Development workflow
- Areas we need help with

## License 📄

MIT License - See [LICENSE](LICENSE) file

Free to use, modify, and distribute. Perfect for developers and communities.

## Community 💬

Connect with us on Nostr:
- **#weedoshi** - App-specific discussions
- **#weed** - General weed talk
- **#cannabis** - Cannabis content
- **#grow** - Growing techniques
- **#livingsoil** - Living soil methods

## Roadmap 🗺️

### Current: v1.0.0 ✅
- Login (nsec/npub)
- Relay management
- Hashtag filtering
- Real-time feed

### Planned: v1.1.0
- Post creation
- User profiles
- Better relay management
- Relay status indicators

### Planned: v1.2.0
- Note reactions
- Search functionality
- Dark mode
- Image support

### Planned: v2.0.0
- Mobile native apps
- Advanced features
- Community tools

## FAQ ❓

**Q: Is my data private?**
A: Yes! Your public posts are on Nostr (by design), your private key stays secret. No central server tracks you.

**Q: Do you store my nsec?**
A: No. We only store your pubkey. Your nsec is decoded and discarded immediately after login.

**Q: Can I use this on mobile?**
A: Yes! The web app works great on iPhone and Android browsers. Native apps coming in v2.0.

**Q: Is this legal?**
A: Weedoshi Diaries (WD) is a reading tool. Cannabis laws vary by location - respect local laws.

**Q: What if relays go down?**
A: That's the beauty of decentralization! If one relay is offline, others still work.

See [FAQ.md](FAQ.md) for 40+ more questions!

## Troubleshooting 🔧

**Feed not loading?**
1. Check internet connection
2. Enable at least one relay
3. Click Refresh button
4. Try different relay

**Can't login?**
1. Verify nsec/npub format
2. Remove extra spaces/line breaks
3. Generate new keys at https://www.nostrplebs.com/

**Relays not connecting?**
1. Check relay URL starts with `wss://`
2. Try different relay
3. Check if relay is online (https://nostr.watch)

See [TESTING.md](TESTING.md) for detailed troubleshooting!

## Getting Help 🆘

1. **Check [FAQ.md](FAQ.md)** - Might have your answer
2. **Read [POWER_TIPS.md](POWER_TIPS.md)** - Advanced usage
3. **Ask on Nostr** - Use #weedoshi or #weed hashtags
4. **Report bugs** - Open GitHub issue with details

## Support the Project 🌱

Love Weedoshi Diaries (WD)? Here's how you can help:

- ⭐ Star the repository
- 🐛 Report bugs
- 💡 Suggest features
- 🤝 Contribute code
- 📢 Share with friends
- 💬 Join the community on Nostr

## Credits 🙏

- Built by Ondřej and the Weedoshi Diaries (WD) community
- Powered by [Nostr Protocol](https://nostr.com)
- Thanks to [nostr-tools](https://github.com/nbd-wtf/nostr-tools) team

## Status 📊

- **Version**: 1.0.0
- **Status**: MVP Complete ✅
- **Last Updated**: 2026-02-27
- **Next Release**: v1.1.0 (coming soon)

---

**Made with 🌿 for the cannabis growing community**

Questions? Ask on Nostr using #weedoshi or #weed!
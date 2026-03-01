# Weedoshi Diaries (WD) Documentation

Welcome to the comprehensive documentation for Weedoshi Diaries (WD)!

## Quick Links

### Getting Started 🚀
- [Getting Started Guide](GETTING_STARTED.md) - 5-minute setup
- [Quick Start](../QUICK_START.md) - Clone and run locally
- [FAQ](../FAQ.md) - 40+ answered questions

### Using the App 📱
- [Power Tips](../POWER_TIPS.md) - Advanced techniques
- [User Guide](../README.md) - Full feature documentation
- [Troubleshooting](../TESTING.md#troubleshooting-power-tips) - Common issues

### Development 👨‍💻
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Architecture](../IMPLEMENTATION_SUMMARY.md) - Technical deep dive
- [Testing](../TESTING.md) - QA and testing guide

### Deployment 🚀
- [Deployment Guide](../DEPLOYMENT.md) - Deploy your own instance
- [GitHub](https://github.com/yourusername/weedoshi-diaries) - Source code

### Community & Support 💬
- [Code of Conduct](../CODE_OF_CONDUCT.md) - Community guidelines
- [Security Policy](../SECURITY.md) - Responsible disclosure
- [Changelog](../CHANGELOG.md) - Version history
- [Contributors](../CONTRIBUTORS.md) - Credits

## Documentation By Role

### For Users 👥
Start here if you're new to the app:
1. [Getting Started Guide](GETTING_STARTED.md)
2. [FAQ](../FAQ.md)
3. [Power Tips](../POWER_TIPS.md)
4. [User Guide](../README.md)

### For Developers 👨‍💻
Start here if you want to contribute:
1. [Quick Start](../QUICK_START.md)
2. [Contributing Guide](../CONTRIBUTING.md)
3. [Architecture](../IMPLEMENTATION_SUMMARY.md)
4. [Testing Guide](../TESTING.md)

### For DevOps 🚀
Start here if you want to deploy:
1. [Deployment Guide](../DEPLOYMENT.md)
2. [Security Policy](../SECURITY.md)
3. [Contributing Guide](../CONTRIBUTING.md)

## Documentation Map

```
weedoshi-diaries/
├── docs/                          # Documentation
│   ├── README.md                 # This file
│   └── GETTING_STARTED.md        # Getting started guide
├── README.md                      # Main project readme
├── QUICK_START.md                 # 5-minute setup
├── FAQ.md                         # Frequently asked questions
├── POWER_TIPS.md                  # Advanced usage tips
├── CONTRIBUTING.md                # Contribution guide
├── IMPLEMENTATION_SUMMARY.md       # Technical details
├── TESTING.md                      # Testing guide
├── DEPLOYMENT.md                   # Deployment options
├── CHANGELOG.md                    # Version history
├── CONTRIBUTORS.md                 # Credits
├── CODE_OF_CONDUCT.md             # Community guidelines
└── SECURITY.md                     # Security policy
```

## Feature Documentation

### Authentication
- [Getting Started - Step 2](GETTING_STARTED.md#step-2-login-30-seconds)
- [FAQ - Authentication](../FAQ.md#authentication)
- [Security - Private Keys](../SECURITY.md#for-users)

### Relays
- [Getting Started - Step 3](GETTING_STARTED.md#step-3-configure-relays-30-seconds)
- [FAQ - Relays](../FAQ.md#relays)
- [Power Tips - Relay Strategies](../POWER_TIPS.md#relay-strategies)

### Hashtags
- [Getting Started - Step 4](GETTING_STARTED.md#step-4-set-hashtags-1-min)
- [FAQ - Hashtags](../FAQ.md#hashtag-filtering)
- [Power Tips - Hashtag Strategies](../POWER_TIPS.md#hashtag-strategies)

### Feed
- [Getting Started - Step 5](GETTING_STARTED.md#step-5-explore-2-min)
- [FAQ - Feed](../FAQ.md#feed)
- [Power Tips - Feed Optimization](../POWER_TIPS.md#performance-hacks)

## Technology & Architecture

### Tech Stack
- React 19.2
- TypeScript 5.9
- Vite 7.3
- Tailwind CSS 4.2
- nostr-tools 2.23.2

See [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) for details.

### Key Concepts
- **Decentralized**: No central server
- **Client-side**: All logic in browser
- **Nostr Protocol**: Decentralized standard
- **Relays**: Independent data servers
- **WebSocket**: Real-time communication

## Roadmap

### Current: v1.0.0 ✅
- Login (nsec/npub)
- Relay management
- Hashtag filtering
- Real-time feed
- Responsive design

### Planned: v1.1.0
- Post creation
- User profiles
- Relay status
- Better relay management

### Planned: v1.2.0
- Note reactions
- Search functionality
- Dark mode
- Image support

### Planned: v2.0.0
- Mobile native apps
- Advanced features
- Community tools

See [CHANGELOG.md](../CHANGELOG.md) for complete version history.

## Getting Help

### Quick Answer?
→ Check [FAQ.md](../FAQ.md)

### Advanced Techniques?
→ Read [POWER_TIPS.md](../POWER_TIPS.md)

### Bug or Issue?
→ Check [TESTING.md](../TESTING.md) troubleshooting

### Want to Contribute?
→ See [CONTRIBUTING.md](../CONTRIBUTING.md)

### Security Concern?
→ Read [SECURITY.md](../SECURITY.md)

### Community Questions?
→ Ask on Nostr using #weedoshi or #weed

## Community

Connect with the Weedoshi Diaries (WD) community:

- **Nostr**: Use #weedoshi hashtag
- **GitHub**: Open issues and discussions
- **Twitter**: Follow updates
- **Web**: https://weedoshi.vercel.app

## Contributing

We welcome contributions!

- **Report Bugs**: See [SECURITY.md](../SECURITY.md)
- **Suggest Features**: Open a GitHub issue
- **Submit Code**: See [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Improve Docs**: Pull requests welcome!

See [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) for community guidelines.

## License

Weedoshi Diaries (WD) is licensed under the **MIT License**.

See [LICENSE](../LICENSE) for details.

## Latest Updates

- **v1.0.0** (2026-02-27) - Initial MVP release
- Complete feature set implemented
- All documentation complete
- Ready for deployment

See [CHANGELOG.md](../CHANGELOG.md) for full history.

## Site Map

```
https://weedoshi.vercel.app/
├── Getting Started
│   ├── Overview
│   ├── Setup Guide
│   ├── Key Concepts
│   └── Troubleshooting
├── Features
│   ├── Authentication
│   ├── Relays
│   ├── Hashtags
│   └── Feed
├── Development
│   ├── Contributing
│   ├── Architecture
│   ├── Testing
│   └── Deployment
└── Community
    ├── Code of Conduct
    ├── Security Policy
    ├── FAQ
    └── Support
```

## Quick Reference

### Common Commands
```bash
npm run dev          # Start development
npm run build        # Build for production
npm run preview      # Preview build
npm run lint         # Check code quality
npm run lint -- --fix # Fix lint issues
```

### Common Links
- **GitHub**: https://github.com/yourusername/weedoshi-diaries
- **Nostr Keys**: https://www.nostrplebs.com/
- **Relay Status**: https://nostr.watch
- **Nostr Relay List**: https://nostr.band

### Important Files
- `App.tsx` - Main application
- `components/` - UI components
- `lib/` - Core logic
- `index.html` - Entry point
- `package.json` - Dependencies

---

## Still Have Questions?

1. Check the relevant documentation above
2. Search [FAQ.md](../FAQ.md)
3. Ask on Nostr (#weedoshi or #weed)
4. Open a GitHub issue
5. Check [POWER_TIPS.md](../POWER_TIPS.md)

## Feedback

We'd love to hear from you!

- What docs are missing?
- What's confusing?
- What would help?

Let us know on Nostr using #weedoshi!

---

**Welcome to Weedoshi Diaries (WD)!** 🌿

Happy growing and exploring! 🚀

# Changelog

All notable changes to Weedoshi Diaries (WD) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-27

### Added
- Initial MVP release
- **Authentication**
  - nsec (private key) login with full access
  - npub (public key) login with read-only access
  - Secure key handling - only pubkey stored locally
  - Session persistence via localStorage
  
- **Relay Management**
  - Enable/disable relays with toggle buttons
  - 4 default reliable relays (Damus, Snort, Nostr.band, Nostr-pub)
  - Add custom relay URLs with validation
  - Remove custom relays
  - Persistent relay configuration

- **Hashtag Filtering**
  - Dynamic hashtag filtering system
  - 5 default hashtags: weedstr, weed, cannabis, grow, livingsoil
  - Add custom hashtags
  - Remove hashtags
  - Persistent hashtag preferences

- **Real-time Feed**
  - Live event streaming from multiple Nostr relays
  - Automatic event deduplication
  - 7-day event history window
  - Hashtag extraction from event tags and content
  - Event sorting by timestamp (newest first)
  - Refresh button for manual updates

- **User Interface**
  - Responsive grid layout (sidebar + main feed)
  - AuthPanel component for login/logout
  - RelayPanel component for relay management
  - HashtagPanel component for hashtag filtering
  - Feed component with loading states
  - FeedItem component displaying individual notes
  - InfoPanel component with quick start guide
  - Header with app branding
  - Footer with version info and links

- **State Management**
  - AuthManager for authentication logic
  - RelayManager for relay configuration
  - EventFilter for hashtag matching and deduplication
  - NostrClient for Nostr protocol communication

- **Error Handling**
  - User-friendly error messages
  - Loading state indicators
  - Empty state messages
  - Retry functionality
  - Graceful degradation

- **Documentation**
  - README.md with setup instructions
  - DEPLOYMENT.md with deployment guides
  - TESTING.md with test scenarios
  - FAQ.md with comprehensive Q&A
  - IMPLEMENTATION_SUMMARY.md with technical details
  - CONTRIBUTING.md with contribution guidelines
  - CHANGELOG.md (this file)

### Technical Details
- Built with React 19.2 + TypeScript 5.9
- Vite 7.3 for fast development and builds
- Tailwind CSS 4.2 for responsive styling
- nostr-tools 2.23.2 for Nostr protocol
- ESLint for code quality
- Prettier for code formatting
- Zero external backend dependencies

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Android Chrome)
- Any browser with WebSocket support

### Performance
- Bundle size: ~309KB (101KB gzipped)
- Fast cold start on modern devices
- Optimized relay connections
- Efficient event deduplication
- No unnecessary re-renders

### Known Limitations
- Read-only feed (publishing in v2.0)
- No note reactions/likes (v2.0)
- No user profiles (v2.0)
- No search functionality (v2.0)
- No media support (images/video)
- No dark mode (v1.1)

### Security
- Private keys never stored locally
- Only public keys persisted
- No authentication server required
- All data client-side only
- No tracking or analytics

---

## Planned Releases

### [1.1.0] - Planned
- Note creation/publishing
- User profile pages
- Relay status indicators
- Improved relay management
- Better error recovery

### [1.2.0] - Planned
- Note reactions (likes, reposts)
- Search functionality
- Dark mode support
- Image display
- Push notifications

### [2.0.0] - Planned
- Mobile native apps (iOS/Android)
- Advanced features
- Community moderation tools
- Enhanced performance

---

## Version History Details

### Key Decisions in v1.0.0
1. **Client-side only** - No backend required, fully decentralized
2. **localStorage persistence** - Simple state management
3. **Read-only MVP** - Focus on content consumption first
4. **Multiple relays** - Reliability and censorship resistance
5. **Hashtag filtering** - Cannabis-specific content focus
6. **Responsive design** - Works on desktop and mobile

### Breaking Changes
None (initial release)

### Deprecations
None (initial release)

### Security Advisories
None reported

---

## Contributing

Want to contribute to Weedoshi Diaries (WD)? See [CONTRIBUTING.md](CONTRIBUTING.md)

## Support

- 📖 See [FAQ.md](FAQ.md) for common questions
- 🐛 Report bugs on GitHub Issues
- 💬 Ask questions on Nostr (#weedoshi or #weed)
- 📚 Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details

## License

MIT - See LICENSE file

---

**Last Updated**: 2026-02-27  
**Current Version**: 1.0.0

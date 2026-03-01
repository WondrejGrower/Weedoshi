# Contributing to Weedoshi Diaries (WD)

Welcome to Weedoshi Diaries (WD)! We're excited that you want to contribute to our decentralized cannabis community feed reader.

## Code of Conduct

- Be respectful and inclusive
- Welcome feedback and criticism
- Respect the cannabis community
- Follow local laws where you live

## Getting Started

### Prerequisites
- Node.js 16+ (check: `node --version`)
- npm or bun (we use bun)
- Git

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/weedoshi-diaries.git
cd weedoshi-diaries
```

2. **Install dependencies**
```bash
npm install
# or
bun install
```

3. **Start development server**
```bash
npm run dev
# or
bun dev
```

Open http://localhost:5173 in your browser.

### Generate Test Keys

For development, generate test keys at https://www.nostrplebs.com/

## Project Structure

```
src/
├── App.tsx                    # Main app component
├── components/               # React components
│   ├── AuthPanel.tsx        # Authentication UI
│   ├── RelayPanel.tsx       # Relay management
│   ├── HashtagPanel.tsx     # Hashtag filtering
│   ├── Feed.tsx             # Feed container
│   ├── FeedItem.tsx         # Individual note
│   └── InfoPanel.tsx        # Quick start guide
├── lib/                      # Core libraries
│   ├── nostrClient.ts       # Nostr protocol
│   ├── authManager.ts       # Auth state
│   ├── relayManager.ts      # Relay config
│   └── eventFilter.ts       # Event filtering
└── index.css                # Tailwind imports
```

## Making Changes

### Bug Fixes
1. Create an issue describing the bug
2. Create a branch: `git checkout -b fix/bug-description`
3. Make your fix
4. Test thoroughly
5. Create a pull request

### New Features
1. Create an issue describing the feature
2. Get feedback from maintainers
3. Create a branch: `git checkout -b feature/feature-name`
4. Implement the feature
5. Write tests if applicable
6. Create a pull request

### Code Style

We use ESLint for code quality. Check before committing:

```bash
npm run lint
```

Fix issues:
```bash
npm run lint -- --fix
```

## Development Workflow

### Before You Start

1. Create a new branch from `main`
2. Keep commits small and focused
3. Write clear commit messages

### During Development

```bash
# Start dev server
npm run dev

# Check for errors
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

Manual testing checklist:

- [ ] nsec login works
- [ ] npub login works (read-only)
- [ ] Logout clears data
- [ ] Relay enable/disable works
- [ ] Add custom relay works
- [ ] Remove relay works
- [ ] Hashtag filtering works
- [ ] Feed updates on relay change
- [ ] Feed updates on hashtag change
- [ ] Refresh button works
- [ ] Error states display correctly
- [ ] localStorage persists data
- [ ] App works on mobile browser

### Browser Testing

Test on multiple browsers:
- Chrome/Chromium
- Firefox
- Safari (if available)
- Mobile browsers (iPhone Safari, Android Chrome)

## Commit Messages

Write clear, concise commit messages:

```bash
# Good
git commit -m "Fix relay connection timeout issue"
git commit -m "Add custom relay URL validation"
git commit -m "Improve feed loading performance"

# Bad
git commit -m "fix stuff"
git commit -m "update"
git commit -m "WIP"
```

Format: `<type>: <description>`

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Code refactoring
- `perf:` Performance improvement
- `test:` Tests

## Pull Requests

When creating a pull request:

1. **Clear title**: "Add user profile page" (not "update")
2. **Description**: Explain what changed and why
3. **Link issues**: "Fixes #123"
4. **Include screenshots**: For UI changes
5. **Test instructions**: How to test your changes
6. **Checklist**: Mark completed items

## Areas for Contribution

### High Priority
- [ ] Post/publish feature (requires nsec)
- [ ] Note reactions (likes, reposts)
- [ ] Search functionality
- [ ] Dark mode support
- [ ] Error boundary improvements

### Medium Priority
- [ ] User profiles
- [ ] Relay status indicators
- [ ] Image/media support
- [ ] Push notifications
- [ ] Performance optimizations

### Low Priority
- [ ] UI polish
- [ ] Additional themes
- [ ] Documentation improvements
- [ ] Translation/i18n
- [ ] Analytics

## Documentation

Help us improve documentation:

- Update README.md
- Improve FAQ.md
- Add code comments
- Create tutorials
- Share knowledge

## Reporting Issues

Found a bug? Create an issue with:

1. **Title**: Clear description
2. **Description**: What happened?
3. **Steps to reproduce**: How to recreate
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happened
6. **Screenshots**: If applicable
7. **Environment**: Browser, OS, device

## Feature Requests

Want a new feature? Create an issue with:

1. **Title**: Feature description
2. **Problem**: What problem does it solve?
3. **Solution**: How should it work?
4. **Alternatives**: Other solutions?
5. **Use case**: Why is this needed?

## License

By contributing, you agree your code is licensed under the MIT License.

## Questions?

- Ask on Nostr using #weedoshi or #weed hashtags
- Open a discussion on GitHub
- Email the maintainers

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Recognized in the community

## Technology Stack

- **React 19.2** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 7.3** - Build tool
- **Tailwind CSS 4.2** - Styling
- **nostr-tools 2.23.2** - Nostr protocol
- **ESLint** - Code quality

## Resources

- [Nostr Documentation](https://nostr.com)
- [nostr-tools API](https://github.com/nbd-wtf/nostr-tools)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org)

## Deployment

See DEPLOYMENT.md for deployment instructions.

## Future Roadmap

### v1.1.0
- Post creation
- User profiles
- Better relay management

### v1.2.0
- Note reactions
- Search functionality
- Dark mode

### v2.0.0
- Mobile native apps
- Advanced features
- Community moderation tools

## Thanks! 🌿

Your contributions make Weedoshi Diaries (WD) better for everyone!

---

**Happy coding!** 🚀

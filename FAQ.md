# Weedoshi Diaries (WD) - Frequently Asked Questions

## Getting Started

### What is Weedoshi Diaries (WD)?
Weedoshi Diaries (WD) is a decentralized cannabis community feed reader built on the Nostr protocol. It allows growers and cannabis enthusiasts to read content from the community without needing a traditional server or account. Your data is yours, completely decentralized.

### How do I get started?
1. Visit [Nostr Plebs](https://www.nostrplebs.com/) to generate your nsec (private key) and npub (public key)
2. Open Weedoshi Diaries (WD)
3. Choose either:
   - **nsec login** for full access (can publish in future versions)
   - **npub login** for read-only access
4. Enable at least one relay to connect to the Nostr network
5. View the cannabis community feed!

## Authentication

### What's the difference between nsec and npub?
- **nsec**: Your private key. Full access to your account. Never share this with anyone. Like your password.
- **npub**: Your public key. Read-only access. Safe to share. Anyone can use this to view your profile.

### Is my nsec secure in the app?
Yes! Weedoshi Diaries (WD) only stores your **public key (pubkey)** in browser localStorage. Your private key (nsec) is decoded and discarded immediately after login. It's never saved anywhere.

### Can I recover my account if I lose my nsec?
No. Your nsec is the only way to access your account. Store it securely (write it down, password manager, etc.). If you lose it, the account is lost.

### What does "read-only" mean with npub login?
With npub login, you can:
- ✅ Read all cannabis community content
- ✅ View other growers' notes
- ✅ See hashtag feeds
- ❌ Cannot publish notes (future feature)
- ❌ Cannot like/react to notes (future feature)

### Why should I use nsec login if npub is safer?
nsec login will enable publishing features in future versions. Use npub login if you only want to read content.

## Relays

### What are relays?
Relays are servers that store Nostr data. They're decentralized - no single company controls them. Weedoshi Diaries (WD) connects to multiple relays to get the most recent content.

### Which relays should I use?
Weedoshi Diaries (WD) comes with 4 default relays that are reliable:
- **Damus** - Popular relay, well-maintained
- **Snort** - Fast relay, good for reading
- **Nostr.band** - Discovery relay
- **Nostr-pub** - Community relay

You can enable/disable any relay. Start with all enabled for best results.

### Can I add custom relays?
Yes! Click "Add custom relay" in the Relay Panel and paste a relay URL (must start with `wss://`). Custom relays are saved in browser storage.

### Why can't I connect to some relays?
Common reasons:
- Relay might be offline - try again later
- Your ISP might block WebSocket connections - try a different network
- Corporate network might have restrictions - use a VPN
- Relay might require authentication - not supported yet

### How many relays should I enable?
At least 1, preferably 2-4. More relays = more content but slower loading. Less relays = faster but might miss content.

## Hashtag Filtering

### What are hashtags for?
Hashtags filter the feed to show only cannabis-related content. Default hashtags are:
- `weedstr` - General Weedoshi community tag
- `weed` - General weed discussions
- `cannabis` - Cannabis content
- `grow` - Growing tips and techniques
- `livingsoil` - Living soil growing methods

### Can I add custom hashtags?
Yes! Type a hashtag in the Hashtag Panel and press Enter or click Add. Custom hashtags are saved in browser storage.

### Should I remove default hashtags?
You can! If you only care about specific topics, remove the defaults and add your own. The feed will be customized to your interests.

### How do hashtags work?
Weedoshi Diaries (WD) checks if notes have hashtags in:
1. **Event tags** (preferred) - Official hashtags from the author
2. **Content** - Hashtags mentioned in the text (with # symbol)

Both are matched against your filter list.

## Feed

### Why is the feed empty?
1. Make sure at least one relay is enabled
2. Check your internet connection
3. Verify relays are responding (try disabling/enabling them)
4. Add some hashtags to filter
5. Give it a moment to load - relays might be slow

### Why is the feed loading slowly?
- Relays might be slow
- Your internet connection might be slow
- Too many hashtags might slow search
- Try enabling fewer relays and see if it helps

### How old is the content?
Weedoshi Diaries (WD) shows notes from the last 7 days. Older content isn't loaded to keep performance fast.

### Can I search for specific content?
Not yet. Search functionality is planned for future versions. For now, use hashtag filtering.

### What if I see spam or inappropriate content?
Weedoshi Diaries (WD) doesn't have moderation since it's decentralized. You can:
- Filter by only hashtags you trust
- Block specific relays if they're problematic
- Report relays to the Nostr community

## Data & Privacy

### Is my data private?
Your **public notes** are visible on the Nostr network - that's by design. Your **private key** should never be shared - keep it secret!

### How is my data stored?
Weedoshi Diaries (WD) stores only:
- Your public key (pubkey) - safe to share
- Your authentication method (nsec/npub)
- Enabled relays
- Custom hashtags

All stored in browser localStorage (not on our servers).

### Can I delete my data?
Yes! Logout from Weedoshi Diaries (WD) and your data is cleared from the app. To delete your Nostr account entirely, you'd need to coordinate with relays (not yet fully supported on Nostr).

### Is my location tracked?
No. Weedoshi Diaries (WD) is a client-side app with no tracking. We don't know who you are or where you are.

### Do you collect my data?
No. We don't have servers, databases, or any way to track users. Your data stays on your device.

## Technical Issues

### App isn't loading
1. Refresh the page (F5 or Cmd+R)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try a different browser
4. Check your internet connection

### Relays not connecting
1. Check your internet connection
2. Try disabling/enabling relays
3. Try adding a different relay
4. Check if relays are online (ask on Nostr)

### Feed shows old content or duplicates
1. Click the Refresh button
2. Unsubscribe from and re-enable relays
3. Clear browser cache

### Browser is crashing
1. Close other apps to free memory
2. Restart your browser
3. Try a different browser

### Lost my login
1. Your pubkey is stored in browser storage
2. If you cleared it, you'll need your nsec to login again
3. If you lost your nsec, unfortunately the account can't be recovered

### Performance is slow
1. Disable some relays
2. Reduce number of hashtags
3. Restart your browser
4. Try a different device

## Account & Security

### How do I logout?
Click the "Logout" button in the Authentication Panel. Your pubkey is removed from storage.

### What happens if someone steals my nsec?
They can access your account. This is why you must keep nsec secret:
- Don't share it online
- Don't paste it in chat
- Don't store it in email
- Write it down or use a password manager

### Can I change my keys?
No. Your Nostr account is tied to your key pair. If you want a new account, generate new keys at [Nostr Plebs](https://www.nostrplebs.com/).

### How do I backup my account?
Save your nsec in a safe place:
- Password manager (1Password, Bitwarden, etc.)
- Written down and stored securely
- Hardware wallet (for advanced users)

**Never store it in plain text files or email.**

## Future Features

### When will I be able to post notes?
Posting (publishing) is planned for future versions. Currently you can only read content. nsec login will enable this feature.

### Will there be reactions/likes?
Yes, planned for future versions. You'll be able to like, react, and interact with notes.

### Will there be dark mode?
Possibly! It depends on community feedback. Let us know if you want it!

### What about mobile apps?
A mobile version might be built in the future. For now, the web app works on mobile devices.

### Will there be notifications?
Push notifications are planned for future versions. This would alert you to new content from specific creators.

## Community & Support

### Where can I ask questions?
Ask questions on Nostr itself! Look for the `#weedoshi` or `#weed` hashtags and ask the community.

### How do I report bugs?
Report bugs on GitHub (link in the footer of the app).

### Can I contribute to development?
Yes! Weedoshi Diaries (WD) is open source. Check GitHub for contribution guidelines.

### Is there a community?
Yes! Find us on Nostr using hashtags:
- `#weedoshi` - WD community
- `#weed` - General weed discussions
- `#cannabis` - Cannabis content
- `#grow` - Growing tips
- `#livingsoil` - Soil growing

### How do I stay updated?
Follow the Weedoshi Diaries (WD) account on Nostr and watch GitHub releases for updates.

## Legal

### Is this legal?
Weedoshi Diaries (WD) is a tool for reading content. Cannabis laws vary by location. Respect local laws where you live.

### Do you store user data?
No. We're completely decentralized with no servers or databases.

### What's your privacy policy?
We don't have one because we don't collect data. Check your browser's privacy settings for localStorage data.

## Troubleshooting Checklist

**Feed not loading?**
- [ ] Internet connected?
- [ ] At least one relay enabled?
- [ ] Relays are online?
- [ ] Try clicking Refresh button?

**Can't login?**
- [ ] Correct nsec/npub format?
- [ ] Key pasted completely (no line breaks)?
- [ ] Try removing extra spaces?

**Relays not working?**
- [ ] Relay URL is correct (wss://)?
- [ ] Try disabling/re-enabling?
- [ ] Try different relay?

**Data cleared?**
- [ ] Did you clear browser storage?
- [ ] Logout doesn't delete pubkey from app
- [ ] Your nsec still works if you login again

Still stuck? Ask the Nostr community on `#weedoshi` or `#weed` hashtags!

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-27  
**App**: Weedoshi Diaries (WD)

# Security Policy for Weedoshi Diaries (WD)

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Weedoshi Diaries (WD), please report it responsibly to the maintainers before publicly disclosing it.

### How to Report

1. **Do NOT create a public GitHub issue** for security vulnerabilities
2. **Email the maintainers** with details (contact info - to be added)
3. **Or use GitHub Security Advisory** (private reporting)

### What to Include

When reporting a vulnerability, please provide:
- Description of the vulnerability
- Steps to reproduce (if possible)
- Potential impact
- Suggested fix (if you have one)
- Your contact information
- Timeline for disclosure (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix Development**: Depends on severity
- **Release**: As soon as possible after fix
- **Public Disclosure**: After fix is released (with your consent)

## Severity Levels

### Critical 🔴
- Allows remote code execution
- Exposes private keys (nsec)
- Enables account takeover
- **Timeline**: Fix within 24-48 hours

### High 🟠
- Can compromise user data
- Enables unauthorized access
- Causes significant functionality loss
- **Timeline**: Fix within 1 week

### Medium 🟡
- Affects data integrity
- Impacts specific user groups
- Requires specific conditions to exploit
- **Timeline**: Fix within 2 weeks

### Low 🟢
- Minor information disclosure
- Requires user interaction
- Limited impact
- **Timeline**: Fix when possible

## Security Best Practices

### For Users

✅ **DO:**
- Keep your browser updated
- Use strong passwords
- Store nsec securely
- Logout on shared computers
- Enable 2FA on your operating system
- Keep your device secure

❌ **DON'T:**
- Share your nsec online
- Paste nsec in console
- Use public WiFi without VPN
- Store nsec in plain text
- Give nsec to anyone (even support)
- Use same passwords everywhere

### For Developers

✅ **DO:**
- Follow secure coding practices
- Validate all inputs
- Use HTTPS everywhere
- Keep dependencies updated
- Run security audits
- Test for XSS/CSRF/injection vulnerabilities
- Review security before releases

❌ **DON'T:**
- Log sensitive data
- Commit secrets to git
- Use eval() or similar
- Trust user input
- Disable security warnings
- Use outdated libraries
- Ignore security advisories

## Known Security Considerations

### Current Implementation

1. **Private Keys Not Stored**
   - nsec is never persisted
   - Only pubkey stored locally
   - Secure by design

2. **Client-Side Only**
   - No backend servers
   - No database breaches possible
   - User data stays local

3. **No Authentication Server**
   - Uses Nostr protocol
   - Your keys are your identity
   - No passwords to be compromised

### Potential Risks

1. **Browser Vulnerabilities**
   - Our security depends on browser security
   - Keep browser updated
   - Use browser security extensions

2. **Device Compromise**
   - If device is compromised, nsec can be stolen
   - Use secure devices
   - Keep OS updated

3. **User Error**
   - Sharing nsec exposes account
   - Losing nsec loses account access
   - Write it down securely

## Dependency Security

We use established, well-maintained dependencies:

- **React** (19.2) - Actively maintained by Meta
- **TypeScript** (5.9) - Actively maintained by Microsoft
- **Vite** (7.3) - Actively maintained
- **Tailwind CSS** (4.2) - Widely used, actively maintained
- **nostr-tools** (2.23.2) - Community-reviewed Nostr library

### Dependency Updates

- Monitor security advisories regularly
- Update dependencies when security patches available
- Run `npm audit` before releases
- Test after major updates

## Security Testing

Before release, we:
- [ ] Check for XSS vulnerabilities
- [ ] Check for input injection attacks
- [ ] Verify no secrets in code
- [ ] Test on multiple browsers
- [ ] Check for memory leaks
- [ ] Verify HTTPS/WSS only
- [ ] Test error handling
- [ ] Check localStorage security

## Third-Party Services

Weedoshi Diaries (WD) currently:
- ✅ Uses only client-side code
- ✅ Connects to Nostr relays (your choice)
- ❌ Does NOT collect data
- ❌ Does NOT use analytics
- ❌ Does NOT track users
- ❌ Does NOT share data

Future versions may integrate:
- Payment processors (if needed)
- Analytics (optional, user consent)
- CDN services (for performance)

We will always disclose third-party services.

## Privacy Policy

### What We Collect
- **Nothing** (We don't have a server)
- Your data stays on your device
- Your localStorage is your data

### What Relays See
- Your **public key** (pubkey)
- **Public notes** you read
- Your **IP address** (from relay connection)

### What We Can't See
- Your **private key** (nsec) - never sent to us
- Your **personal information**
- What notes you read
- Your **location**

## Compliance

Weedoshi Diaries (WD) aims to comply with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- Standard web security practices
- Responsible disclosure guidelines

Since we don't collect data, compliance is straightforward.

## Security Contacts

To report security issues:
- **Email**: [Contact email - to be added]
- **GitHub Security Advisory**: [Repository link - to be added]
- **Nostr DM**: [Contact method - to be added]

## Security Updates

- Check [CHANGELOG.md](CHANGELOG.md) for updates
- Follow [Releases](https://github.com/yourusername/weedoshi-diaries/releases) on GitHub
- Subscribe to Nostr updates (#weedoshi)

## Questions?

- Read [FAQ.md](FAQ.md) for security FAQs
- Ask on Nostr (#weedoshi or #weed)
- Email maintainers

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Academy](https://portswigger.net/web-security)
- [MDN Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Nostr Security Guide](https://docs.nostr.com/security)

---

Thank you for helping keep Weedoshi Diaries (WD) secure! 🔒

Last Updated: 2026-02-27

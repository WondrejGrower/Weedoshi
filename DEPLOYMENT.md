# Deployment Guide for Weedoshi Diaries (WD)

## Quick Deployment Options

### Option 1: Vercel (Recommended - Zero Config)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Vercel automatically detects Vite and deploys with zero configuration. Your app will be live at `https://your-project.vercel.app`

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Or connect your GitHub repository for automatic deployments on every push.

### Option 3: GitHub Pages

1. Update `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/weedoshi/', // Replace with your repo name
  plugins: [react()],
})
```

2. Deploy:
```bash
npm run build
npm install -g gh-pages
gh-pages -d dist
```

Your app will be at `https://your-username.github.io/weedoshi/`

### Option 4: Self-Hosted (Any VPS)

1. Build the app:
```bash
npm run build
```

2. Upload `dist/` folder to your server:
```bash
rsync -avz dist/ user@server.com:/var/www/weedoshi/
```

3. Configure your web server (nginx/Apache):

**Nginx**:
```nginx
server {
    listen 80;
    server_name weedoshi.example.com;
    root /var/www/weedoshi;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Apache**:
```apache
<Directory /var/www/weedoshi>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>
```

## Pre-Deployment Checklist

- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run build` - successful build
- [ ] Test locally with `npm run preview`
- [ ] Verify all features work:
  - [ ] nsec login
  - [ ] npub login
  - [ ] Relay enable/disable
  - [ ] Custom relay addition
  - [ ] Hashtag filtering
  - [ ] Feed updates
  - [ ] Refresh button
  - [ ] localStorage persistence
- [ ] Check browser console for errors (F12)
- [ ] Test on mobile device if possible

## Environment Configuration

No environment variables required! The app is 100% client-side.

All configuration (relays, hashtags, auth) is stored in browser localStorage.

## Performance Optimization

The build is already optimized:

- **Bundle size**: ~309KB (101KB gzipped)
- **Code splitting**: Single bundle (small enough for instant load)
- **Caching**: Long-term caching on `assets/` files
- **Minification**: Vite handles automatic minification
- **Tree-shaking**: Unused code removed

## Monitoring & Analytics (Optional)

Add Google Analytics:

1. Create a project at https://analytics.google.com/
2. Get your Measurement ID (G-XXXXXXXXXX)
3. Add to `index.html` before `</head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## Troubleshooting Deployments

### App doesn't load or shows blank page
- Check browser console for errors (F12 → Console)
- Verify all assets are loading (F12 → Network)
- Make sure web server serves `index.html` for all routes (SPA routing)

### Relay connections fail in production
- Relays require WSS (secure WebSocket)
- Check that your server allows WebSocket connections
- Some corporate proxies block WebSocket - users may need VPN

### localStorage not working
- Private/incognito mode disables localStorage
- Some browsers restrict it in certain contexts
- User should use normal browsing mode

### CORS errors
- The app uses public Nostr relays (WSS endpoints)
- If relays block connections, try adding different relays
- User can't bypass relay CORS restrictions

## Domain Configuration

### Custom Domain (Vercel)
1. Go to Vercel dashboard
2. Select your project
3. Settings → Domains
4. Add your custom domain
5. Update DNS records as shown

### Custom Domain (Netlify)
1. Go to Netlify dashboard
2. Site settings → Domain management
3. Add custom domain
4. Update DNS records

### SSL/HTTPS
All deployment platforms provide free SSL certificates. HTTPS is required for:
- Secure WebSocket (WSS) connections to relays
- localStorage access in some browsers

## Rollback & Updates

### Simple Update
```bash
npm run build
# Redeploy the dist/ folder
```

### Rollback (Vercel)
1. Go to Vercel dashboard
2. Deployments → Find previous deployment
3. Click "Promote to Production"

### Rollback (GitHub Pages)
```bash
# Revert to previous commit
git revert <commit-hash>
git push
# Re-run deployment
```

## Version Tracking

Add version to `src/App.tsx`:
```typescript
const APP_VERSION = '1.0.0'; // Update on each release
```

Display in footer or console:
```typescript
console.log(`Weedoshi Diaries (WD) v${APP_VERSION}`);
```

## Future Enhancements for Deployment

- [ ] Service Worker for offline support
- [ ] Progressive Web App (PWA) manifest
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] User feedback widget

## Support & Help

If deployment fails:
1. Check platform documentation
2. Verify `dist/` folder exists and has content
3. Check node version: `node --version` (should be 16+)
4. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
5. Try building again: `npm run build`

## Cost Comparison

| Platform | Cost | Setup | Features |
|----------|------|-------|----------|
| Vercel | Free | 2 min | Fast deploys, edge functions |
| Netlify | Free | 2 min | Git integration, forms |
| GitHub Pages | Free | 5 min | Git integration, custom domain |
| AWS S3 + CloudFront | ~$2-5/mo | 10 min | Scalable, low latency |
| Self-hosted VPS | $5-20/mo | 20 min | Full control |

**Recommended for MVP**: Vercel (instant deploys, zero config, free tier)

## Maintenance

After deployment:
- Monitor relay connectivity
- Check browser console for errors
- Track user feedback
- Update relays if they become unstable
- Keep dependencies updated (run `npm update`)

Enjoy your deployed app! 🌿
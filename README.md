# Pixelary Law Firm Migration Workspace

Reusable workspace for migrating law firm WordPress sites to Astro.js on Cloudflare Pages, with built-in SEO improvements and analytics tracking.

## Structure

```
├── toolkit/                 # Analytics & audit scripts
│   ├── baseline-audit.mjs   # Lighthouse performance audit (mobile + desktop)
│   ├── seo-crawler.mjs      # On-site SEO checker (meta tags, schema, images, etc.)
│   ├── compare-reports.mjs  # Before/after comparison report generator
│   └── reports/             # Output directory for audit reports
├── template/                # Astro starter template (copy per client)
│   ├── astro.config.mjs     # Cloudflare Pages + sitemap config
│   ├── src/components/      # SEOHead, LocalBusinessSchema, ContactForm
│   ├── src/layouts/         # BaseLayout with SEO, schema, analytics
│   ├── functions/api/       # CF Pages Function for contact form (Resend)
│   └── public/              # Static assets + robots.txt
└── prompts/
    ├── MIGRATION_PROMPT.md  # Claude Code prompt template (fill in & paste)
    └── CLIENT_CHECKLIST.md  # Full pre/during/post migration checklist
```

## Quick Start: New Client

### 1. Run baseline audit on the current WordPress site

```bash
cd toolkit
npm install
node baseline-audit.mjs https://current-site.com --label before
node seo-crawler.mjs https://current-site.com --label before
```

### 2. Set up client project

```bash
# Create new repo from template
cp -r template/ ~/projects/clientname-site/
cd ~/projects/clientname-site/

# Drop WordPress backup in
mkdir wp-source
# ... extract public_html contents into wp-source/

# Install dependencies
npm install
```

### 3. Run migration with Claude Code

1. Open the client project in Claude Code
2. Copy `prompts/MIGRATION_PROMPT.md`
3. Replace all `{{PLACEHOLDER}}` values with client info
4. Paste into Claude Code and iterate

### 4. Deploy to Cloudflare Pages

1. Push repo to GitHub
2. Connect repo to Cloudflare Pages
3. Build command: `npm run build`
4. Build output: `dist/`
5. Set environment variables: `RESEND_API_KEY`, `CONTACT_EMAIL`, `FROM_EMAIL`

### 5. Run post-migration audit and compare

```bash
cd toolkit
node baseline-audit.mjs https://clientname.pages.dev --label after
node seo-crawler.mjs https://clientname.pages.dev --label after
node compare-reports.mjs \
  --before reports/current_site_before_YYYY-MM-DD.json \
  --after reports/clientname_after_YYYY-MM-DD.json \
  --seo-before reports/current_site_seo_before_YYYY-MM-DD.json \
  --seo-after reports/clientname_seo_after_YYYY-MM-DD.json
```

## Cost

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Cloudflare Pages | 500 builds/month, unlimited bandwidth | More than enough |
| Resend | 100 emails/day | Contact form submissions |
| GitHub | Unlimited private repos | — |
| Google Search Console | Free | Set up post-migration |

**Total recurring cost per client: $0**

## Dependencies

- Node.js 18+
- Chrome/Chromium (for Lighthouse — auto-detected)
- npm

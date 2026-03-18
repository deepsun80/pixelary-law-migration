# Pixelary Law Firm Migration Workspace

Reusable workspace for migrating law firm WordPress sites to Astro.js on Cloudflare Pages, with built-in SEO improvements and analytics tracking.

**This is the master template repo — never modify it for a specific client.**

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

### 1. Create the client repo

```bash
# Create and initialize
mkdir clientname-site
cd clientname-site
git init

# Copy Astro template
cp -r ../pixelary-law-migration/template/* .
cp ../pixelary-law-migration/template/.* . 2>/dev/null

# Copy toolkit (runs from client repo, reports stay with client data)
cp -r ../pixelary-law-migration/toolkit ./toolkit

# Copy prompts for reference
cp -r ../pixelary-law-migration/prompts ./prompts

# Drop WordPress backup in
mkdir wp-source
# ... extract the client's public_html contents into wp-source/

# Install Astro dependencies
npm install

# Install toolkit dependencies
cd toolkit && npm install && cd ..

# Add .gitignore (copy from template repo or create — see below)
cp ../pixelary-law-migration/.gitignore .

# Initial commit
git add .
git commit -m "Initial: scaffold from Pixelary template"
```

Your client repo will look like this:

```
clientname-site/
├── src/                  # Astro site (pages, layouts, components)
├── functions/            # CF Pages Function (contact form handler)
├── public/               # Static assets + robots.txt
├── wp-source/            # WP backup — gitignored, local only
├── toolkit/              # Audit scripts + reports
│   ├── baseline-audit.mjs
│   ├── seo-crawler.mjs
│   ├── compare-reports.mjs
│   └── reports/          # before/after JSONs
├── prompts/              # Migration prompt + checklist (for reference)
├── astro.config.mjs
├── package.json
└── .gitignore
```

### 2. Run baseline audit (before migration)

```bash
cd toolkit
node baseline-audit.mjs https://current-site.com --label before
node seo-crawler.mjs https://current-site.com --label before
```

Reports save to `toolkit/reports/`. Run this while the WordPress site is still live.

### 3. Run migration with Claude Code

1. Open the client repo root in Claude Code
2. Open `prompts/MIGRATION_PROMPT.md`
3. Replace all `{{PLACEHOLDER}}` values with client info
4. Paste into Claude Code and iterate
5. Use Sonnet 4.6 — fast and well-suited for this structured work

### 4. Deploy to Cloudflare Pages

1. Push repo to GitHub (e.g., `pixelary/clientname-site`)
2. Connect repo to Cloudflare Pages
3. Build command: `npm run build`
4. Build output: `dist/`
5. Set environment variables in CF Pages dashboard:
   - `RESEND_API_KEY` — from https://resend.com/api-keys
   - `CONTACT_EMAIL` — client's email to receive form submissions
   - `FROM_EMAIL` — `onboarding@resend.dev` for staging (verify client domain for production)
6. Staging URL will be: `clientname.pages.dev`
7. Ensure `robots.txt` has `Disallow: /` while in staging

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

This generates a JSON comparison and a markdown summary you can share with the client or use for LinkedIn content.

### 6. Go live

1. Add client's custom domain in Cloudflare Pages
2. Update DNS (CNAME to `clientname.pages.dev` or use CF nameservers)
3. Remove `Disallow` from `robots.txt`, push
4. Verify SSL is active
5. Set up Google Search Console, submit sitemap
6. Verify client domain in Resend, update `FROM_EMAIL` env var
7. Test contact form on production

See `prompts/CLIENT_CHECKLIST.md` for the full detailed checklist.

## Cost

| Service               | Free Tier                             | Notes                    |
| --------------------- | ------------------------------------- | ------------------------ |
| Cloudflare Pages      | 500 builds/month, unlimited bandwidth | More than enough         |
| Resend                | 100 emails/day                        | Contact form submissions |
| GitHub                | Unlimited private repos               | —                        |
| Google Search Console | Free                                  | Set up post-migration    |

**Total recurring cost per client: $0**

## Dependencies

- Node.js 18+
- Chrome/Chromium (for Lighthouse — auto-detected)
- npm

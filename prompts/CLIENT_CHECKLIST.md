# Pixelary Client Migration Checklist

## Pre-Migration (Before Starting)

### Client Info to Collect
- [ ] Firm name (exact legal name for schema)
- [ ] Practice areas (list all)
- [ ] Office address (street, city, state, zip)
- [ ] Phone number
- [ ] Email for contact form submissions
- [ ] Google Analytics Measurement ID (if they have GA set up)
- [ ] Current live URL
- [ ] WordPress backup file (full public_html)
- [ ] Social media URLs (for schema `sameAs`)
- [ ] Business hours
- [ ] Any specific content changes they want (even though we're preserving content)

### Baseline Audit
- [ ] Run `node baseline-audit.mjs <live-url> --label before`
- [ ] Run `node seo-crawler.mjs <live-url> --label before`
- [ ] Screenshot current site (homepage + key pages) for reference
- [ ] Pull Google Analytics data: monthly traffic, top pages, bounce rate (last 90 days)
- [ ] Save all reports in `toolkit/reports/`

### Setup
- [ ] Create client GitHub repo (e.g., `pixelary/clientname-site`)
- [ ] Copy `template/` folder contents into the new repo
- [ ] Drop WordPress backup into `wp-source/` in the repo
- [ ] Update `astro.config.mjs` with client domain
- [ ] Set up Cloudflare Pages project connected to the repo

---

## During Migration (Claude Code Session)

- [ ] Paste `MIGRATION_PROMPT.md` (with client placeholders filled in) into Claude Code
- [ ] Verify Claude Code's analysis of the WP theme structure
- [ ] Review converted pages against live site (visual comparison)
- [ ] Test contact form submission locally
- [ ] Verify all images load
- [ ] Check mobile responsiveness
- [ ] Confirm build succeeds (`npm run build`)

---

## Post-Migration: Staging

### Deploy to Staging
- [ ] Push to GitHub → Cloudflare Pages auto-deploys
- [ ] Verify staging URL works (`clientname.pages.dev`)
- [ ] Ensure `robots.txt` has `Disallow: /` for staging
- [ ] Set CF Pages environment variables:
  - `RESEND_API_KEY` — from Resend dashboard
  - `CONTACT_EMAIL` — client's receiving email
  - `FROM_EMAIL` — `onboarding@resend.dev` for testing (verify domain later for production)

### Client Review
- [ ] Share staging URL with client
- [ ] Client reviews all pages for content accuracy
- [ ] Client tests contact form (receives test email)
- [ ] Collect any change requests
- [ ] Implement fixes

### Post-Migration Audit
- [ ] Run `node baseline-audit.mjs <staging-url> --label after`
- [ ] Run `node seo-crawler.mjs <staging-url> --label after`
- [ ] Run `node compare-reports.mjs --before <before.json> --after <after.json> --seo-before <seo_before.json> --seo-after <seo_after.json>`
- [ ] Review comparison report — verify improvements

---

## Go-Live

### DNS Cutover
- [ ] Add client's custom domain to Cloudflare Pages
- [ ] Update DNS records (either CNAME to `clientname.pages.dev` or use CF nameservers)
- [ ] Remove `Disallow` from `robots.txt`
- [ ] Verify SSL certificate is active
- [ ] Set up Google Search Console for the domain (add as property, verify via DNS)
- [ ] Submit sitemap to Google Search Console
- [ ] Verify domain in Resend, update `FROM_EMAIL` env var
- [ ] Test contact form on production domain

### Post-Launch
- [ ] Monitor Google Search Console for crawl errors (first 2 weeks)
- [ ] Set up basic uptime monitoring (e.g., Cloudflare analytics or free Uptime Robot)
- [ ] Share before/after comparison report with client
- [ ] Get client permission to use results in marketing (LinkedIn post, case study)
- [ ] Schedule 30-day follow-up to check rankings

---

## Content for Marketing

### LinkedIn Post Data Points
- Lighthouse performance score: before → after
- Page load time: before → after
- Page weight: before → after KB
- Number of HTTP requests: before → after
- SEO issues fixed: X
- CLS improvement
- Any ranking changes (check at 30/60/90 days)

### Narrative Angle
"Same design. Same content. Different technology. Here's what happened when we rebuilt a law firm's website on modern infrastructure with basic SEO best practices."

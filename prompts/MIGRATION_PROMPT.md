# WordPress → Astro Migration Prompt for Claude Code

> **Instructions:** Copy this entire prompt into Claude Code when starting a new client migration.
> Replace all `{{PLACEHOLDER}}` values with client-specific info before pasting.

---

## Context

I'm migrating a WordPress site to Astro.js for deployment on Cloudflare Pages. This is a **content-preserving migration** — the design and content stay the same, but we're rebuilding on modern, fast infrastructure with SEO improvements.

### Client Info
- **Firm name:** {{CLIENT_NAME}}
- **Current live URL:** {{LIVE_URL}}
- **Practice areas:** {{PRACTICE_AREAS}} (e.g., "Family Law, Criminal Defense, Personal Injury")
- **Location:** {{CITY}}, {{STATE}}
- **Phone:** {{PHONE}}
- **Email:** {{EMAIL}}
- **Address:** {{STREET_ADDRESS}}, {{CITY}}, {{STATE}} {{ZIP}}

### Project Structure

This project was scaffolded from the Pixelary migration template. Key locations:

```
/
├── src/
│   ├── layouts/BaseLayout.astro     ← Master layout (SEO head, schema, analytics)
│   ├── components/
│   │   ├── SEOHead.astro            ← Per-page SEO meta tags (already built)
│   │   ├── LocalBusinessSchema.astro ← JSON-LD for law firm (already built)
│   │   └── ContactForm.astro        ← Contact form with CF Pages Function (already built)
│   ├── pages/                       ← Convert WP pages to Astro pages here
│   └── styles/                      ← Global and page-specific styles
├── functions/api/contact.js         ← CF Pages Function for form submission
├── public/                          ← Static assets (images, favicon, etc.)
├── wp-source/                       ← WordPress backup (public_html contents)
│   ├── wp-content/themes/{{THEME}}/
│   ├── wp-content/uploads/
│   └── ... (other WP files)
└── astro.config.mjs                 ← Already configured for CF Pages + sitemap
```

## Task

### Phase 1: Analyze the WordPress Source

1. Examine the WordPress backup in `wp-source/`:
   - Identify the active theme in `wp-content/themes/`
   - List all pages/templates in the theme (look at `page.php`, `page-*.php`, `front-page.php`, `single.php`, `header.php`, `footer.php`, etc.)
   - Identify the CSS files (typically `style.css` in the theme, plus any in `wp-content/themes/{{THEME}}/css/` or `wp-content/themes/{{THEME}}/assets/`)
   - Identify JavaScript files used
   - List all images in `wp-content/uploads/` that are actually used in the pages
   - Check for any plugins that affect frontend rendering (contact form plugins, sliders, galleries)

2. Give me a summary of what you found:
   - Number of pages to convert
   - Theme structure
   - Any dynamic features (forms, sliders, maps) that need special handling
   - List of assets to migrate

### Phase 2: Convert to Astro

For each WordPress page/template:

1. **Extract the HTML content** from the PHP templates, stripping out WordPress PHP functions (`wp_head()`, `the_content()`, `get_template_part()`, loops, etc.)
2. **Create corresponding Astro pages** in `src/pages/`:
   - `index.astro` for the homepage
   - Other pages matching the WP site structure (e.g., `about.astro`, `practice-areas.astro`, `contact.astro`)
3. **Use the BaseLayout** for every page — it already has SEO head, schema, and analytics
4. **Preserve the exact same visual design:**
   - Copy the theme's CSS into `src/styles/` (clean it up — remove WP-specific selectors like `.wp-block-*`, `#wpadminbar`, etc.)
   - Keep the same class names where possible so CSS continues to work
   - Convert any SCSS/LESS to plain CSS if needed
5. **Move static assets:**
   - Copy used images from `wp-content/uploads/` to `public/images/`
   - Update all image paths in the HTML to reference `/images/...`
   - Add `width` and `height` attributes to all `<img>` tags (measure from the actual image files)
   - Add descriptive `alt` text to any images missing it

### Phase 3: SEO Improvements

Apply these improvements during the conversion (these are the "basic SEO" optimizations that will show up in our before/after audit):

1. **Meta tags:** Set unique, descriptive `<title>` and `<meta name="description">` for every page using the SEOHead component. Title format: `Page Name | {{CLIENT_NAME}} | {{CITY}} {{STATE}}`
2. **Heading hierarchy:** Ensure exactly one `<h1>` per page, with proper `<h2>`→`<h3>` nesting
3. **Image optimization:**
   - Convert images to WebP format where possible (or at minimum ensure they're reasonably compressed)
   - Add `loading="lazy"` to below-fold images
   - Add `width` and `height` to prevent CLS
   - Ensure all images have `alt` text
4. **Semantic HTML:** Replace generic `<div>` wrappers with `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` where appropriate
5. **LocalBusiness schema:** Update the `LocalBusinessSchema` component props in `BaseLayout.astro` with the actual client info listed above
6. **Open Graph tags:** The SEOHead component handles this — just pass correct props per page
7. **Performance:**
   - Remove any unused CSS (WordPress themes ship with massive stylesheets)
   - Remove jQuery and any WP-specific JS that's no longer needed
   - Inline critical CSS if possible
   - Preconnect to any external resources (fonts, etc.)
8. **Accessibility:** Ensure focus styles exist, ARIA labels on interactive elements, proper form labels

### Phase 4: Contact Form

The contact form component (`src/components/ContactForm.astro`) and the CF Pages Function (`functions/api/contact.js`) are already built. You need to:

1. Integrate the `<ContactForm />` component into the contact page (and optionally a CTA section on other pages)
2. Match the form's styling to the rest of the site's design
3. Verify the form fields match what the client needs (the default has: name, email, phone, message)

### Phase 5: Final Checks

Before we call this done:

1. Run `npm run build` and fix any build errors
2. Check every page renders correctly in dev (`npm run dev`)
3. Verify all internal links work (no broken links)
4. Verify images all load correctly
5. Check mobile responsiveness on all pages
6. Ensure `robots.txt` in `public/` has the staging `Disallow` uncommented (we'll change it for production)
7. Ensure the sitemap generates correctly at `/sitemap-index.xml`

## Important Notes

- **Do NOT change the visual design.** The client expects their site to look the same. We're improving the underlying technology and SEO, not redesigning.
- **Do NOT add any AI features or mentions.** This is a pure web migration.
- **Do NOT use any WordPress PHP** — this is a static Astro site. No PHP anywhere.
- **Preserve all existing content exactly** — text, images, layout. Don't edit the client's copy.
- If you encounter a WordPress plugin feature (like a slider, accordion, map embed), replicate it with lightweight vanilla JS or CSS — no heavy libraries.

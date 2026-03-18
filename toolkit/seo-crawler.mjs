#!/usr/bin/env node

/**
 * Pixelary SEO Crawler
 * 
 * Crawls a website starting from the given URL, checking each page for
 * on-site SEO factors: meta tags, heading hierarchy, image alt text,
 * structured data (JSON-LD), Open Graph tags, canonical URLs, and more.
 * Also checks for sitemap.xml and robots.txt at the domain root.
 * 
 * Usage:
 *   node seo-crawler.mjs <url> [--label before|after] [--max-pages 20] [--output ./reports]
 * 
 * Examples:
 *   node seo-crawler.mjs https://example-lawfirm.com --label before
 *   node seo-crawler.mjs https://new-site.pages.dev --label after --max-pages 10
 */

import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const startUrl = args.find((a) => a.startsWith("http"));
const label = args.includes("--label")
  ? args[args.indexOf("--label") + 1]
  : "snapshot";
const maxPages = args.includes("--max-pages")
  ? parseInt(args[args.indexOf("--max-pages") + 1], 10)
  : 20;
const outputDir = args.includes("--output")
  ? args[args.indexOf("--output") + 1]
  : path.join(__dirname, "reports");

if (!startUrl) {
  console.error(
    "\n❌ Usage: node seo-crawler.mjs <url> [--label before|after] [--max-pages 20]\n"
  );
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const baseOrigin = new URL(startUrl).origin;

// ---------------------------------------------------------------------------
// Fetch helper with timeout and error handling
// ---------------------------------------------------------------------------
async function safeFetch(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "PixelaryBot/1.0 (SEO Audit; +https://pixelaryweb.com)",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page-level SEO analysis
// ---------------------------------------------------------------------------
function analyzePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const issues = [];
  const warnings = [];
  const info = [];

  // --- Title ---
  const title = $("title").first().text().trim();
  if (!title) {
    issues.push("Missing <title> tag");
  } else {
    info.push(`Title (${title.length} chars): "${title}"`);
    if (title.length < 30) warnings.push(`Title too short (${title.length} chars, aim for 50-60)`);
    if (title.length > 65) warnings.push(`Title too long (${title.length} chars, aim for 50-60)`);
  }

  // --- Meta Description ---
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() || "";
  if (!metaDesc) {
    issues.push("Missing meta description");
  } else {
    info.push(`Meta description (${metaDesc.length} chars)`);
    if (metaDesc.length < 120)
      warnings.push(`Meta description short (${metaDesc.length} chars, aim for 150-160)`);
    if (metaDesc.length > 165)
      warnings.push(`Meta description long (${metaDesc.length} chars, aim for 150-160)`);
  }

  // --- Canonical ---
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  if (!canonical) {
    warnings.push("No canonical URL set");
  } else {
    info.push(`Canonical: ${canonical}`);
  }

  // --- Headings ---
  const headings = {};
  for (let i = 1; i <= 6; i++) {
    const tags = $(`h${i}`);
    if (tags.length > 0) {
      headings[`h${i}`] = tags
        .map((_, el) => $(el).text().trim().slice(0, 80))
        .get();
    }
  }
  if (!headings.h1 || headings.h1.length === 0) {
    issues.push("Missing H1 tag");
  } else if (headings.h1.length > 1) {
    warnings.push(`Multiple H1 tags found (${headings.h1.length})`);
  }

  // --- Images ---
  const images = $("img");
  let imagesWithoutAlt = 0;
  let imagesWithoutDimensions = 0;
  let totalImages = images.length;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt && !$(el).attr("role")?.includes("presentation")) {
      imagesWithoutAlt++;
    }
    if (!$(el).attr("width") && !$(el).attr("height")) {
      imagesWithoutDimensions++;
    }
  });
  if (imagesWithoutAlt > 0) {
    issues.push(`${imagesWithoutAlt}/${totalImages} images missing alt text`);
  }
  if (imagesWithoutDimensions > 0) {
    warnings.push(
      `${imagesWithoutDimensions}/${totalImages} images missing explicit dimensions (CLS risk)`
    );
  }

  // --- Open Graph ---
  const og = {};
  $("meta[property^='og:']").each((_, el) => {
    og[$(el).attr("property")] = $(el).attr("content");
  });
  if (!og["og:title"]) warnings.push("Missing og:title");
  if (!og["og:description"]) warnings.push("Missing og:description");
  if (!og["og:image"]) warnings.push("Missing og:image");

  // --- Structured Data (JSON-LD) ---
  const jsonLdScripts = $('script[type="application/ld+json"]');
  const structuredData = [];
  jsonLdScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      structuredData.push(data);
    } catch {
      warnings.push("Invalid JSON-LD structured data found");
    }
  });
  const hasLocalBusiness = structuredData.some(
    (d) =>
      d["@type"] === "LocalBusiness" ||
      d["@type"] === "Attorney" ||
      d["@type"] === "LegalService" ||
      (Array.isArray(d["@type"]) &&
        d["@type"].some((t) =>
          ["LocalBusiness", "Attorney", "LegalService"].includes(t)
        ))
  );
  if (!hasLocalBusiness) {
    warnings.push(
      "No LocalBusiness/Attorney/LegalService schema found (important for law firms)"
    );
  }
  if (structuredData.length === 0) {
    issues.push("No structured data (JSON-LD) found");
  }

  // --- Viewport ---
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  if (!viewport) issues.push("Missing viewport meta tag");

  // --- Language ---
  const lang = $("html").attr("lang") || "";
  if (!lang) warnings.push('Missing lang attribute on <html>');

  // --- Links ---
  const internalLinks = new Set();
  const externalLinks = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
      return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.origin === baseOrigin) {
        internalLinks.add(resolved.pathname);
      } else {
        externalLinks.add(resolved.href);
      }
    } catch {
      // malformed URL, skip
    }
  });

  return {
    url: pageUrl,
    title,
    metaDescription: metaDesc,
    canonical,
    headings,
    images: {
      total: totalImages,
      missingAlt: imagesWithoutAlt,
      missingDimensions: imagesWithoutDimensions,
    },
    openGraph: og,
    structuredData: structuredData.map((d) => ({
      type: d["@type"],
      name: d.name,
    })),
    hasLocalBusinessSchema: hasLocalBusiness,
    lang,
    hasViewport: !!viewport,
    links: {
      internal: internalLinks.size,
      external: externalLinks.size,
      internalPaths: [...internalLinks],
    },
    issues,
    warnings,
    info,
  };
}

// ---------------------------------------------------------------------------
// Domain-level checks
// ---------------------------------------------------------------------------
async function checkRobotsTxt() {
  const url = `${baseOrigin}/robots.txt`;
  console.log(`  Checking robots.txt ...`);
  const res = await safeFetch(url);
  if (!res || !res.ok) return { exists: false, content: null };
  const text = await res.text();
  return {
    exists: true,
    content: text.slice(0, 2000), // truncate for report
    hasSitemap: text.toLowerCase().includes("sitemap"),
  };
}

async function checkSitemap() {
  const urls = [
    `${baseOrigin}/sitemap.xml`,
    `${baseOrigin}/sitemap_index.xml`,
    `${baseOrigin}/wp-sitemap.xml`,
  ];
  console.log(`  Checking sitemap ...`);
  for (const url of urls) {
    const res = await safeFetch(url);
    if (res && res.ok) {
      const text = await res.text();
      const urlCount = (text.match(/<loc>/g) || []).length;
      return { exists: true, url, urlCount };
    }
  }
  return { exists: false, url: null, urlCount: 0 };
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------
async function crawl() {
  const visited = new Set();
  const queue = [startUrl];
  const pageResults = [];

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift();
    const normalized = new URL(currentUrl, baseOrigin).href.replace(/\/$/, "");

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    console.log(`  [${visited.size}/${maxPages}] ${normalized}`);

    const res = await safeFetch(normalized);
    if (!res || !res.ok) {
      pageResults.push({
        url: normalized,
        error: res ? `HTTP ${res.status}` : "Fetch failed",
        issues: [`Page returned ${res ? res.status : "network error"}`],
        warnings: [],
      });
      continue;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) continue;

    const html = await res.text();
    const analysis = analyzePage(html, normalized);
    pageResults.push(analysis);

    // Add discovered internal links to queue
    if (analysis.links?.internalPaths) {
      for (const p of analysis.links.internalPaths) {
        const full = `${baseOrigin}${p}`.replace(/\/$/, "");
        if (!visited.has(full) && !queue.includes(full)) {
          queue.push(full);
        }
      }
    }
  }

  return pageResults;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Pixelary SEO Crawler — ${label.toUpperCase()}`);
  console.log(`  Start URL: ${startUrl}`);
  console.log(`  Max pages: ${maxPages}`);
  console.log(`${"=".repeat(60)}\n`);

  // Domain-level checks
  const robotsTxt = await checkRobotsTxt();
  const sitemap = await checkSitemap();

  // Crawl pages
  console.log(`\n  Crawling pages...\n`);
  const pages = await crawl();

  // Compile report
  const report = {
    meta: {
      url: startUrl,
      label,
      timestamp: new Date().toISOString(),
      tool: "pixelary-seo-crawler",
      version: "1.0.0",
      pagesCrawled: pages.length,
    },
    domainChecks: {
      robotsTxt,
      sitemap,
    },
    pages,
    summary: {
      totalPages: pages.length,
      totalIssues: pages.reduce((n, p) => n + (p.issues?.length || 0), 0),
      totalWarnings: pages.reduce((n, p) => n + (p.warnings?.length || 0), 0),
      pagesWithMissingTitle: pages.filter((p) =>
        p.issues?.some((i) => i.includes("title"))
      ).length,
      pagesWithMissingMetaDesc: pages.filter(
        (p) =>
          p.issues?.some((i) => i.includes("meta description")) 
      ).length,
      pagesWithMissingH1: pages.filter((p) =>
        p.issues?.some((i) => i.includes("H1"))
      ).length,
      pagesWithMissingAltText: pages.filter(
        (p) => p.images?.missingAlt > 0
      ).length,
      pagesWithStructuredData: pages.filter(
        (p) => p.structuredData?.length > 0
      ).length,
      pagesWithLocalBusinessSchema: pages.filter(
        (p) => p.hasLocalBusinessSchema
      ).length,
    },
  };

  // Save
  const hostname = new URL(startUrl).hostname.replace(/\./g, "_");
  const filename = `${hostname}_seo_${label}_${new Date().toISOString().slice(0, 10)}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  // Console summary
  console.log(`\n${"─".repeat(60)}`);
  console.log("  SEO AUDIT SUMMARY");
  console.log(`${"─".repeat(60)}`);
  console.log(`  Pages crawled: ${report.summary.totalPages}`);
  console.log(`  Total issues:  ${report.summary.totalIssues}`);
  console.log(`  Total warnings: ${report.summary.totalWarnings}`);
  console.log(`  robots.txt: ${robotsTxt.exists ? "✅ Found" : "❌ Missing"}`);
  console.log(
    `  Sitemap: ${sitemap.exists ? `✅ Found (${sitemap.urlCount} URLs)` : "❌ Not found"}`
  );
  console.log(
    `  Missing titles: ${report.summary.pagesWithMissingTitle}/${report.summary.totalPages}`
  );
  console.log(
    `  Missing meta desc: ${report.summary.pagesWithMissingMetaDesc}/${report.summary.totalPages}`
  );
  console.log(
    `  Missing H1: ${report.summary.pagesWithMissingH1}/${report.summary.totalPages}`
  );
  console.log(
    `  Missing alt text: ${report.summary.pagesWithMissingAltText}/${report.summary.totalPages}`
  );
  console.log(
    `  Has structured data: ${report.summary.pagesWithStructuredData}/${report.summary.totalPages}`
  );
  console.log(
    `  Has LocalBusiness schema: ${report.summary.pagesWithLocalBusinessSchema}/${report.summary.totalPages}`
  );
  console.log(`\n  📄 Report saved: ${outPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

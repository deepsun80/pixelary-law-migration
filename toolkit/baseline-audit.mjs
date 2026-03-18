#!/usr/bin/env node

/**
 * Pixelary Baseline Audit Script
 * 
 * Runs Google Lighthouse audits (mobile + desktop) against a live URL
 * and captures Core Web Vitals, performance scores, page weight, and
 * request counts. Saves results as JSON for later comparison.
 * 
 * Usage:
 *   node baseline-audit.mjs <url> [--label before|after] [--output ./reports]
 * 
 * Examples:
 *   node baseline-audit.mjs https://example-lawfirm.com --label before
 *   node baseline-audit.mjs https://new-site.pages.dev --label after
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http"));
const label = args.includes("--label")
  ? args[args.indexOf("--label") + 1]
  : "snapshot";
const outputDir = args.includes("--output")
  ? args[args.indexOf("--output") + 1]
  : path.join(__dirname, "reports");

if (!url) {
  console.error(
    "\n❌ Usage: node baseline-audit.mjs <url> [--label before|after] [--output ./reports]\n"
  );
  process.exit(1);
}

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Runs Lighthouse via the CLI (npx) for a given strategy.
 * Returns the parsed JSON report.
 */
function runLighthouse(targetUrl, strategy = "mobile") {
  const tmpFile = path.join(
    outputDir,
    `_tmp_lh_${strategy}_${Date.now()}.json`
  );

  console.log(`\n🔍 Running Lighthouse (${strategy}) on ${targetUrl} ...`);

  try {
    execSync(
      `npx lighthouse "${targetUrl}" ` +
        `--output=json ` +
        `--output-path="${tmpFile}" ` +
        `--chrome-flags="--headless --no-sandbox --disable-gpu" ` +
        `--preset=${strategy === "desktop" ? "desktop" : "perf"} ` +
        `--only-categories=performance,accessibility,best-practices,seo ` +
        `--quiet`,
      { stdio: "pipe", timeout: 120_000 }
    );
  } catch (err) {
    console.error(`⚠️  Lighthouse (${strategy}) failed: ${err.message}`);
    return null;
  }

  if (!fs.existsSync(tmpFile)) return null;

  const report = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
  fs.unlinkSync(tmpFile); // clean up temp file
  return report;
}

/**
 * Extracts the metrics we care about from a Lighthouse JSON report.
 */
function extractMetrics(report) {
  if (!report) return null;

  const cats = report.categories || {};
  const audits = report.audits || {};

  // Category scores (0–100)
  const scores = {};
  for (const [key, cat] of Object.entries(cats)) {
    scores[key] = Math.round((cat.score || 0) * 100);
  }

  // Core Web Vitals
  const cwv = {
    LCP_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
    CLS: audits["cumulative-layout-shift"]?.numericValue ?? null,
    TBT_ms: audits["total-blocking-time"]?.numericValue ?? null, // proxy for FID/INP in lab
    FCP_ms: audits["first-contentful-paint"]?.numericValue ?? null,
    TTFB_ms: audits["server-response-time"]?.numericValue ?? null,
    SI_ms: audits["speed-index"]?.numericValue ?? null,
  };

  // Page weight & requests
  const resourceSummary = audits["resource-summary"]?.details?.items || [];
  const totalRow = resourceSummary.find((r) => r.resourceType === "total");
  const pageWeight = {
    totalBytes: totalRow?.transferSize ?? null,
    totalRequests: totalRow?.requestCount ?? null,
    breakdown: resourceSummary
      .filter((r) => r.resourceType !== "total")
      .map((r) => ({
        type: r.resourceType,
        bytes: r.transferSize,
        requests: r.requestCount,
      })),
  };

  // Notable audit flags
  const flags = [];
  const flagAudits = [
    "render-blocking-resources",
    "uses-optimized-images",
    "uses-webp-images",
    "offscreen-images",
    "unminified-css",
    "unminified-javascript",
    "unused-css-rules",
    "unused-javascript",
    "uses-text-compression",
    "uses-responsive-images",
    "efficient-animated-content",
    "legacy-javascript",
  ];

  for (const id of flagAudits) {
    const audit = audits[id];
    if (audit && audit.score !== null && audit.score < 1) {
      flags.push({
        id,
        title: audit.title,
        score: audit.score,
        savings_ms: audit.numericValue ?? null,
        description: audit.displayValue || "",
      });
    }
  }

  return { scores, cwv, pageWeight, flags };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Pixelary Site Audit — ${label.toUpperCase()}`);
  console.log(`  URL: ${url}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}`);

  const mobileReport = runLighthouse(url, "mobile");
  const desktopReport = runLighthouse(url, "desktop");

  const result = {
    meta: {
      url,
      label,
      timestamp: new Date().toISOString(),
      tool: "pixelary-audit-toolkit",
      version: "1.0.0",
    },
    mobile: extractMetrics(mobileReport),
    desktop: extractMetrics(desktopReport),
  };

  // Save JSON report
  const hostname = new URL(url).hostname.replace(/\./g, "_");
  const filename = `${hostname}_${label}_${new Date().toISOString().slice(0, 10)}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  // Console summary
  console.log(`\n${"─".repeat(60)}`);
  console.log("  RESULTS SUMMARY");
  console.log(`${"─".repeat(60)}`);

  for (const device of ["mobile", "desktop"]) {
    const data = result[device];
    if (!data) {
      console.log(`\n  ${device.toUpperCase()}: ❌ Audit failed`);
      continue;
    }
    console.log(`\n  ${device.toUpperCase()}:`);
    console.log(
      `    Performance: ${data.scores.performance}  |  SEO: ${data.scores.seo}`
    );
    console.log(
      `    Accessibility: ${data.scores.accessibility}  |  Best Practices: ${data.scores["best-practices"]}`
    );
    console.log(
      `    LCP: ${Math.round(data.cwv.LCP_ms)}ms  |  CLS: ${data.cwv.CLS?.toFixed(3)}  |  TBT: ${Math.round(data.cwv.TBT_ms)}ms`
    );
    console.log(
      `    FCP: ${Math.round(data.cwv.FCP_ms)}ms  |  TTFB: ${Math.round(data.cwv.TTFB_ms)}ms`
    );
    const kb = data.pageWeight.totalBytes
      ? (data.pageWeight.totalBytes / 1024).toFixed(0)
      : "?";
    console.log(
      `    Page weight: ${kb} KB  |  Requests: ${data.pageWeight.totalRequests}`
    );
    if (data.flags.length > 0) {
      console.log(`    ⚠️  ${data.flags.length} optimization opportunities found`);
    }
  }

  console.log(`\n  📄 Report saved: ${outPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

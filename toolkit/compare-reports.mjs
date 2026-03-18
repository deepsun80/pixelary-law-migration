#!/usr/bin/env node

/**
 * Pixelary Report Comparator
 *
 * Compares a "before" and "after" audit report (from baseline-audit.mjs)
 * and generates a summary showing deltas. Also optionally merges SEO
 * crawler reports.
 *
 * Usage:
 *   node compare-reports.mjs --before <before.json> --after <after.json> [--seo-before <seo_before.json> --seo-after <seo_after.json>] [--output ./reports]
 *
 * Examples:
 *   node compare-reports.mjs --before reports/site_before_2025-03-18.json --after reports/site_after_2025-04-01.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const beforePath = getArg("before");
const afterPath = getArg("after");
const seoBefore = getArg("seo-before");
const seoAfter = getArg("seo-after");
const outputDir = getArg("output") || path.join(__dirname, "reports");

if (!beforePath || !afterPath) {
  console.error(
    "\n❌ Usage: node compare-reports.mjs --before <before.json> --after <after.json>\n"
  );
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function delta(before, after) {
  if (before == null || after == null) return { before, after, change: null };
  const diff = after - before;
  const pct =
    before !== 0 ? ((diff / Math.abs(before)) * 100).toFixed(1) : null;
  return {
    before: Math.round(before * 1000) / 1000,
    after: Math.round(after * 1000) / 1000,
    change: Math.round(diff * 1000) / 1000,
    percentChange: pct ? `${diff >= 0 ? "+" : ""}${pct}%` : "N/A",
    improved:
      // For scores, higher is better; for timing metrics, lower is better
      null, // set contextually below
  };
}

function scoreImproved(d) {
  if (d.change == null) return "—";
  return d.change > 0 ? "✅ +" + d.change : d.change < 0 ? "⬇️ " + d.change : "➡️ No change";
}

function timingImproved(d) {
  if (d.change == null) return "—";
  return d.change < 0 ? "✅ " + d.change + "ms faster" : d.change > 0 ? "⬇️ +" + d.change + "ms slower" : "➡️ No change";
}

function bytesImproved(d) {
  if (d.change == null) return "—";
  const kb = (d.change / 1024).toFixed(1);
  return d.change < 0 ? `✅ ${kb} KB smaller` : `⬇️ +${kb} KB larger`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const before = loadJSON(beforePath);
  const after = loadJSON(afterPath);

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  Pixelary Before / After Comparison`);
  console.log(`${"=".repeat(64)}`);
  console.log(`  Before: ${before.meta.url} (${before.meta.timestamp})`);
  console.log(`  After:  ${after.meta.url} (${after.meta.timestamp})`);
  console.log(`${"=".repeat(64)}`);

  const comparison = {
    meta: {
      beforeUrl: before.meta.url,
      afterUrl: after.meta.url,
      beforeDate: before.meta.timestamp,
      afterDate: after.meta.timestamp,
      generatedAt: new Date().toISOString(),
    },
    lighthouse: {},
    seo: null,
  };

  for (const device of ["mobile", "desktop"]) {
    const b = before[device];
    const a = after[device];

    if (!b || !a) {
      console.log(`\n  ${device.toUpperCase()}: ⚠️ Missing data for comparison`);
      continue;
    }

    const scores = {};
    for (const cat of Object.keys(b.scores)) {
      const d = delta(b.scores[cat], a.scores[cat]);
      scores[cat] = { ...d, display: scoreImproved(d) };
    }

    const cwv = {};
    for (const metric of Object.keys(b.cwv)) {
      const d = delta(b.cwv[metric], a.cwv[metric]);
      cwv[metric] = { ...d, display: timingImproved(d) };
    }

    const pageWeight = {
      totalBytes: {
        ...delta(b.pageWeight.totalBytes, a.pageWeight.totalBytes),
        display: bytesImproved(delta(b.pageWeight.totalBytes, a.pageWeight.totalBytes)),
      },
      totalRequests: delta(b.pageWeight.totalRequests, a.pageWeight.totalRequests),
    };

    comparison.lighthouse[device] = { scores, cwv, pageWeight };

    // Console output
    console.log(`\n  ${device.toUpperCase()} — Lighthouse Scores`);
    console.log(`  ${"─".repeat(56)}`);
    for (const [cat, d] of Object.entries(scores)) {
      console.log(
        `    ${cat.padEnd(18)} ${String(d.before).padStart(4)} → ${String(d.after).padStart(4)}  ${d.display}`
      );
    }

    console.log(`\n  ${device.toUpperCase()} — Core Web Vitals`);
    console.log(`  ${"─".repeat(56)}`);
    for (const [metric, d] of Object.entries(cwv)) {
      const unit = metric === "CLS" ? "" : "ms";
      console.log(
        `    ${metric.padEnd(12)} ${String(d.before + unit).padStart(10)} → ${String(d.after + unit).padStart(10)}  ${d.display}`
      );
    }

    console.log(`\n  ${device.toUpperCase()} — Page Weight`);
    console.log(`  ${"─".repeat(56)}`);
    const bKB = (b.pageWeight.totalBytes / 1024).toFixed(0);
    const aKB = (a.pageWeight.totalBytes / 1024).toFixed(0);
    console.log(
      `    Total size     ${bKB.padStart(8)} KB → ${aKB.padStart(8)} KB  ${pageWeight.totalBytes.display}`
    );
    console.log(
      `    Requests       ${String(b.pageWeight.totalRequests).padStart(8)} → ${String(a.pageWeight.totalRequests).padStart(8)}`
    );
  }

  // Optional SEO comparison
  if (seoBefore && seoAfter) {
    const sb = loadJSON(seoBefore);
    const sa = loadJSON(seoAfter);

    comparison.seo = {
      before: sb.summary,
      after: sa.summary,
      improvements: {
        issuesFixed: sb.summary.totalIssues - sa.summary.totalIssues,
        warningsFixed: sb.summary.totalWarnings - sa.summary.totalWarnings,
      },
    };

    console.log(`\n  SEO CRAWLER COMPARISON`);
    console.log(`  ${"─".repeat(56)}`);
    console.log(`    Issues:    ${sb.summary.totalIssues} → ${sa.summary.totalIssues}  (${comparison.seo.improvements.issuesFixed} fixed)`);
    console.log(`    Warnings:  ${sb.summary.totalWarnings} → ${sa.summary.totalWarnings}  (${comparison.seo.improvements.warningsFixed} fixed)`);
  }

  // Save comparison report
  const filename = `comparison_${new Date().toISOString().slice(0, 10)}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(comparison, null, 2));

  console.log(`\n  📄 Comparison report saved: ${outPath}\n`);

  // Generate markdown summary (for LinkedIn / client sharing)
  const md = generateMarkdown(comparison, before, after);
  const mdPath = path.join(outputDir, `comparison_${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`  📝 Markdown summary saved: ${mdPath}\n`);
}

// ---------------------------------------------------------------------------
// Markdown generator for sharing
// ---------------------------------------------------------------------------
function generateMarkdown(comparison, before, after) {
  let md = `# Website Migration Results\n\n`;
  md += `**Before:** ${before.meta.url} (${before.meta.timestamp.slice(0, 10)})\n`;
  md += `**After:** ${after.meta.url} (${after.meta.timestamp.slice(0, 10)})\n\n`;

  for (const device of ["mobile", "desktop"]) {
    const data = comparison.lighthouse[device];
    if (!data) continue;

    md += `## ${device.charAt(0).toUpperCase() + device.slice(1)}\n\n`;
    md += `### Lighthouse Scores\n\n`;
    md += `| Category | Before | After | Change |\n`;
    md += `|----------|--------|-------|--------|\n`;
    for (const [cat, d] of Object.entries(data.scores)) {
      md += `| ${cat} | ${d.before} | ${d.after} | ${d.display} |\n`;
    }

    md += `\n### Core Web Vitals\n\n`;
    md += `| Metric | Before | After | Change |\n`;
    md += `|--------|--------|-------|--------|\n`;
    for (const [metric, d] of Object.entries(data.cwv)) {
      const unit = metric === "CLS" ? "" : "ms";
      md += `| ${metric} | ${d.before}${unit} | ${d.after}${unit} | ${d.display} |\n`;
    }

    md += `\n### Page Weight\n\n`;
    const bKB = (data.pageWeight.totalBytes.before / 1024).toFixed(0);
    const aKB = (data.pageWeight.totalBytes.after / 1024).toFixed(0);
    md += `- **Total size:** ${bKB} KB → ${aKB} KB (${data.pageWeight.totalBytes.display})\n`;
    md += `- **Requests:** ${data.pageWeight.totalRequests.before} → ${data.pageWeight.totalRequests.after}\n\n`;
  }

  if (comparison.seo) {
    md += `## SEO Improvements\n\n`;
    md += `- **Issues fixed:** ${comparison.seo.improvements.issuesFixed}\n`;
    md += `- **Warnings resolved:** ${comparison.seo.improvements.warningsFixed}\n`;
  }

  return md;
}

main();

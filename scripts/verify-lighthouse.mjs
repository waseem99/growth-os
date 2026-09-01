import { readFile } from "node:fs/promises";

const reportPath = process.argv[2];
if (!reportPath) throw new Error("Usage: node scripts/verify-lighthouse.mjs <report.json>");

const report = JSON.parse(await readFile(reportPath, "utf8"));
const score = (name) => Number(report.categories?.[name]?.score ?? 0) * 100;
const auditValue = (name) => Number(report.audits?.[name]?.numericValue ?? Number.POSITIVE_INFINITY);

const results = {
  performance: score("performance"),
  accessibility: score("accessibility"),
  seo: score("seo"),
  lcpMs: auditValue("largest-contentful-paint"),
  cls: auditValue("cumulative-layout-shift"),
  totalBlockingTimeMs: auditValue("total-blocking-time")
};

const failures = [];
if (results.performance < 90) failures.push(`Performance ${results.performance.toFixed(0)} < 90`);
if (results.accessibility < 90) failures.push(`Accessibility ${results.accessibility.toFixed(0)} < 90`);
if (results.seo < 95) failures.push(`SEO ${results.seo.toFixed(0)} < 95`);
if (results.lcpMs > 2500) failures.push(`LCP ${results.lcpMs.toFixed(0)}ms > 2500ms`);
if (results.cls >= 0.1) failures.push(`CLS ${results.cls.toFixed(3)} >= 0.1`);
// Lighthouse does not provide field INP. TBT is used as the deterministic lab responsiveness proxy;
// production INP remains a field/RUM release check documented in the runbook.
if (results.totalBlockingTimeMs > 200) failures.push(`TBT ${results.totalBlockingTimeMs.toFixed(0)}ms > 200ms lab responsiveness budget`);

console.log(JSON.stringify({ lighthouseReleaseGate: results }, null, 2));
if (failures.length) {
  console.error(`Lighthouse release gate failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

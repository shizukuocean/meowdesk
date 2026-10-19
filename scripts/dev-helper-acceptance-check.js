const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "analysis");
const dataRoot = process.env.MEOWDESK_DEV_HELPER_DATA_DIR || path.join(root, "tmp", "external-acceptance");
const blockerStatuses = new Set(["open", "failed", "regression"]);
const pendingStatuses = new Set(["review"]);

function readJson(fileName, fallback) {
  const filePath = path.join(dataRoot, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = String(item?.[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function issueSummary(issue) {
  return {
    id: String(issue.id || ""),
    title: String(issue.title || ""),
    status: String(issue.status || "unknown"),
    severity: String(issue.severity || ""),
    blockName: String(issue.blockName || ""),
    updatedAt: String(issue.updatedAt || "")
  };
}

function main() {
  const issues = readJson("issues.json", []);
  const specs = readJson("specs.json", []);
  const projects = readJson("projects.json", []);
  const blocks = readJson("blocks.json", []);
  const unresolvedIssues = issues.map(issueSummary).filter((issue) => blockerStatuses.has(issue.status));
  const pendingReviewIssues = issues.map(issueSummary).filter((issue) => pendingStatuses.has(issue.status));
  const passedIssues = issues.map(issueSummary).filter((issue) => issue.status === "passed");
  const report = {
    generatedAt: new Date().toISOString(),
    dataRoot,
    ok: unresolvedIssues.length === 0,
    totals: {
      projects: projects.length,
      blocks: blocks.length,
      specs: specs.length,
      issues: issues.length
    },
    issueStatusCounts: countBy(issues, "status"),
    issueSeverityCounts: countBy(issues, "severity"),
    specStatusCounts: countBy(specs, "status"),
    unresolvedIssues,
    pendingReviewIssues,
    passedIssues
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "meodesk-dev-helper-acceptance.json");
  const mdPath = path.join(outDir, "meodesk-dev-helper-acceptance.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, [
    "# Meowdesk Dev Helper Acceptance",
    "",
    `> Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- ok: ${report.ok}`,
    `- dataRoot: \`${report.dataRoot}\``,
    `- projects: ${report.totals.projects}`,
    `- blocks: ${report.totals.blocks}`,
    `- specs: ${report.totals.specs}`,
    `- issues: ${report.totals.issues}`,
    `- issueStatusCounts: \`${JSON.stringify(report.issueStatusCounts)}\``,
    `- issueSeverityCounts: \`${JSON.stringify(report.issueSeverityCounts)}\``,
    `- specStatusCounts: \`${JSON.stringify(report.specStatusCounts)}\``,
    "",
    "## Unresolved Issues",
    "",
    ...(report.unresolvedIssues.length
      ? report.unresolvedIssues.map((issue) => `- [ ] ${issue.id} ${issue.severity} ${issue.title} (${issue.status}, ${issue.blockName})`)
      : ["- none"]),
    "",
    "## Pending Review",
    "",
    ...(report.pendingReviewIssues.length
      ? report.pendingReviewIssues.map((issue) => `- [ ] ${issue.id} ${issue.severity} ${issue.title} (${issue.status}, ${issue.blockName})`)
      : ["- none"]),
    "",
    "## Passed Issues",
    "",
    ...(report.passedIssues.length
      ? report.passedIssues.map((issue) => `- [x] ${issue.id} ${issue.severity} ${issue.title} (${issue.blockName})`)
      : ["- none"]),
    "",
    "This reads the external Meow Dev Helper / Problem Logger data. It does not start the helper app or merge it into Meowdesk.",
    ""
  ].join("\n"), "utf8");

  console.log(JSON.stringify({
    ok: report.ok,
    unresolved: report.unresolvedIssues.length,
    pendingReview: report.pendingReviewIssues.length,
    passed: report.passedIssues.length,
    report: path.relative(root, mdPath)
  }));
  if (!report.ok) process.exit(1);
}

main();

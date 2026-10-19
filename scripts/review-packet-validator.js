"use strict";

const fs = require("node:fs");
const path = require("node:path");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function isCommit(value) {
  return /^[0-9a-f]{40}$/i.test(String(value || ""));
}

function main() {
  const packetArg = process.argv[2];
  if (!packetArg) {
    throw new Error("Usage: node scripts/review-packet-validator.js <review-packet-directory>");
  }

  const packetDir = path.resolve(packetArg);
  const manifestPath = path.join(packetDir, "packet-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Missing packet-manifest.json in " + packetDir);
  }

  const manifest = JSON.parse(readText(manifestPath));
  const issues = [];
  const requiredFiles = Array.isArray(manifest.requiredFiles) ? manifest.requiredFiles : [];

  if (manifest.schema !== "meowdesk.review-packet.v1") issues.push("unsupported manifest schema");
  if (!isCommit(manifest.baseCommit)) issues.push("baseCommit must be a full commit hash");
  if (!isCommit(manifest.headCommit)) issues.push("headCommit must be a full commit hash");
  if (!isCommit(manifest.archiveCommit)) issues.push("archiveCommit must be a full commit hash");
  if (!manifest.branch) issues.push("branch is required");
  if (!requiredFiles.length) issues.push("requiredFiles must not be empty");

  for (const relativePath of requiredFiles) {
    const filePath = path.join(packetDir, relativePath);
    if (!fs.existsSync(filePath)) {
      issues.push("missing required file: " + relativePath);
    }
  }

  const markdownFiles = fs.readdirSync(packetDir)
    .filter((name) => name.toLowerCase().endsWith(".md"));
  const placeholderPattern = /\$(?:head|base|visual)\b/;
  const scriptResiduePattern = /(?:Set-Content\s+-LiteralPath|Join-Path\s+[^\r\n]+review-packets|^\s*@"\s*$)/m;
  for (const name of markdownFiles) {
    const source = readText(path.join(packetDir, name));
    if (placeholderPattern.test(source)) issues.push("unexpanded placeholder in " + name);
    if (scriptResiduePattern.test(source)) issues.push("generation script residue in " + name);
  }

  const missingMaterialsPath = path.join(packetDir, "MISSING_MATERIALS_IF_LIVE_WORKTREE_REQUIRED.md");
  if (fs.existsSync(missingMaterialsPath)) {
    const firstLine = readText(missingMaterialsPath).split(/\r?\n/, 1)[0];
    if (firstLine !== "# Missing materials if live B worktree judgment is required") {
      issues.push("MISSING_MATERIALS_IF_LIVE_WORKTREE_REQUIRED.md has the wrong title/content");
    }
  }

  const bundleHeadPath = path.join(packetDir, "bundle-head.txt");
  if (fs.existsSync(bundleHeadPath)) {
    const bundleHead = readText(bundleHeadPath).trim();
    if (bundleHead !== manifest.headCommit) {
      issues.push("bundle-head.txt does not match manifest headCommit");
    }
  }

  const bundleStatusPath = path.join(packetDir, "bundle-status-short.txt");
  if (fs.existsSync(bundleStatusPath) && readText(bundleStatusPath).trim()) {
    issues.push("bundle-status-short.txt is not clean");
  }

  const result = {
    ok: issues.length === 0,
    packetDir,
    headCommit: manifest.headCommit,
    committedBundleState: manifest.committedBundleState,
    liveWorktreeFreshlyVerified: Boolean(manifest.liveWorktreeFreshlyVerified),
    requiredFiles: requiredFiles.length,
    markdownFiles: markdownFiles.length,
    issues
  };
  console.log(JSON.stringify(result, null, 2));
  if (issues.length) process.exitCode = 1;
}

main();

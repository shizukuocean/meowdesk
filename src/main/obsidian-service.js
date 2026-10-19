"use strict";

const fs = require("fs");
const path = require("path");

function extractTags(raw) {
  const tags = new Set();
  const tagPattern = /(^|[\s([{])#([A-Za-z0-9_\-/\u4e00-\u9fff]+)/g;
  let match;
  while ((match = tagPattern.exec(raw)) !== null) {
    const tag = match[2].replace(/\/+$/, "");
    if (tag) tags.add(`#${tag}`);
  }
  return [...tags].slice(0, 40);
}

function extractWikiLinks(raw) {
  const links = new Set();
  const linkPattern = /\[\[([^\]\n]+)\]\]/g;
  let match;
  while ((match = linkPattern.exec(raw)) !== null) {
    const target = match[1]
      .split("|")[0]
      .split("#")[0]
      .split("^")[0]
      .trim();
    if (target) links.add(target);
  }
  return [...links].slice(0, 120);
}

function extractExcerpt(raw) {
  const body = raw
    .replace(/^---[\s\S]*?---/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
    .filter((line) => line && !line.startsWith("!") && !line.startsWith("[["));
  return (body[0] || "").replace(/\s+/g, " ").slice(0, 160);
}

function addFileToTree(root, file) {
  const parts = file.relativePath.split(path.sep);
  let cursor = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isFile = index === parts.length - 1;
    if (isFile) {
      cursor.children.push({
        type: "file",
        name: file.name,
        title: file.title,
        path: file.path,
        relativePath: file.relativePath
      });
      return;
    }

    let folder = cursor.children.find((child) => child.type === "folder" && child.name === part);
    if (!folder) {
      const relativePath = parts.slice(0, index + 1).join(path.sep);
      folder = {
        type: "folder",
        name: part,
        relativePath,
        children: []
      };
      cursor.children.push(folder);
    }
    cursor = folder;
  }
}

function sortTree(node) {
  if (!node.children) return node;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true });
  });
  node.children.forEach(sortTree);
  return node;
}

function summarizeTags(files) {
  const counts = new Map();
  for (const file of files) {
    for (const tag of file.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-Hans-CN"))
    .slice(0, 80);
}

async function scanObsidianVault(rootPath) {
  const files = [];
  const maxFiles = 5000;
  const maxDepth = 12;

  async function walk(dirPath, depth) {
    if (files.length >= maxFiles || depth > maxDepth) return;
    let entries = [];
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true });
    });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const relativePath = path.relative(rootPath, fullPath);
        let stats = null;
        let raw = "";
        try {
          const [nextStats, nextRaw] = await Promise.all([
            fs.promises.stat(fullPath),
            fs.promises.readFile(fullPath, "utf8")
          ]);
          stats = nextStats;
          raw = nextRaw.slice(0, 260000);
        } catch {
          // Keep the file in the tree even if one note cannot be indexed.
        }
        files.push({
          name: entry.name,
          title: entry.name.replace(/\.md$/i, ""),
          path: fullPath,
          relativePath,
          folder: path.dirname(relativePath) === "." ? "" : path.dirname(relativePath),
          size: stats?.size || 0,
          modifiedAt: stats?.mtimeMs || 0,
          tags: extractTags(raw),
          links: extractWikiLinks(raw),
          excerpt: extractExcerpt(raw)
        });
      }
    }
  }

  await walk(rootPath, 0);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN", { numeric: true }));
  const tree = {
    type: "folder",
    name: path.basename(rootPath),
    path: rootPath,
    relativePath: "",
    children: []
  };
  files.forEach((file) => addFileToTree(tree, file));
  return {
    path: rootPath,
    name: path.basename(rootPath),
    files,
    tree: sortTree(tree),
    tags: summarizeTags(files)
  };
}

module.exports = {
  scanObsidianVault
};

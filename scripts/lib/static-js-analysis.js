const fs = require("fs");
const path = require("path");

const JS_KEYWORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "function",
  "return",
  "typeof",
  "new",
  "class",
  "super",
  "import",
  "require",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "JSON",
  "Date",
  "Math",
  "RegExp",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Error",
  "encodeURIComponent",
  "decodeURIComponent",
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite"
]);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function previousNonSpace(source, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = source[i];
    if (!/\s/.test(ch)) return ch;
  }
  return "";
}

function looksLikeRegexStart(source, index) {
  const prev = previousNonSpace(source, index);
  return !prev || "([{=,:;!&|?+-*~^<>".includes(prev);
}

function skipQuoted(source, index, quote) {
  let i = index + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return source.length;
}

function skipTemplate(source, index) {
  let i = index + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") return i + 1;
    i += 1;
  }
  return source.length;
}

function skipRegex(source, index) {
  let i = index + 1;
  let inClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) {
      i += 1;
      while (/[a-z]/i.test(source[i] || "")) i += 1;
      return i;
    }
    i += 1;
  }
  return source.length;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "'" || ch === "\"") {
      i = skipQuoted(source, i, ch);
      continue;
    }
    if (ch === "`") {
      i = skipTemplate(source, i);
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (ch === "/" && looksLikeRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function stripJsTrivia(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "'" || ch === "\"") {
      const end = skipQuoted(source, i, ch);
      out += " ".repeat(Math.max(1, end - i));
      i = end;
      continue;
    }
    if (ch === "`") {
      const end = skipTemplate(source, i);
      out += " ".repeat(Math.max(1, end - i));
      i = end;
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i + 2);
      const stop = end < 0 ? source.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === "/" && looksLikeRegexStart(source, i)) {
      const end = skipRegex(source, i);
      out += " ".repeat(Math.max(1, end - i));
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function extractFunctionDeclarations(source, filePath = "") {
  const functions = [];
  const pattern = /(?:^|[^\w$])((?:async\s+)?function)\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    const keywordIndex = match.index + match[0].indexOf(match[1]);
    const name = match[2];
    const openIndex = source.indexOf("{", pattern.lastIndex);
    if (openIndex < 0) continue;
    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex < 0) continue;
    const sourceText = source.slice(keywordIndex, closeIndex + 1);
    functions.push({
      name,
      filePath,
      start: keywordIndex,
      end: closeIndex + 1,
      line: lineNumberAt(source, keywordIndex),
      source: sourceText,
      body: source.slice(openIndex + 1, closeIndex)
    });
    pattern.lastIndex = closeIndex + 1;
  }
  return functions;
}

function extractAssignedFunctionDeclarations(source, filePath = "") {
  const functions = [];
  const patterns = [
    {
      re: /(?:^|[^\w$])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g,
      openIndex(match, pattern) {
        return pattern.lastIndex - 1;
      }
    },
    {
      re: /(?:^|[^\w$])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(/g,
      openIndex(match, pattern) {
        return source.indexOf("{", pattern.lastIndex);
      }
    }
  ];

  for (const item of patterns) {
    let match;
    while ((match = item.re.exec(source))) {
      const name = match[1];
      const nameIndex = match.index + match[0].indexOf(name);
      const openIndex = item.openIndex(match, item.re);
      if (openIndex < 0) continue;
      const closeIndex = findMatchingBrace(source, openIndex);
      if (closeIndex < 0) continue;
      const sourceText = source.slice(nameIndex, closeIndex + 1);
      functions.push({
        name,
        filePath,
        start: nameIndex,
        end: closeIndex + 1,
        line: lineNumberAt(source, nameIndex),
        source: sourceText,
        body: source.slice(openIndex + 1, closeIndex)
      });
      item.re.lastIndex = closeIndex + 1;
    }
  }

  return functions;
}

function extractDependencies(source) {
  const deps = [];
  const patterns = [
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bfrom\s+["']([^"']+)["']/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) deps.push(match[1]);
  }
  return [...new Set(deps)].sort();
}

function findCalls(source, knownFunctionNames) {
  const clean = stripJsTrivia(source);
  const calls = new Map();
  const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(clean))) {
    const name = match[1];
    if (JS_KEYWORDS.has(name)) continue;
    if (knownFunctionNames && !knownFunctionNames.has(name)) continue;
    calls.set(name, (calls.get(name) || 0) + 1);
  }
  return calls;
}

function extractIpcChannels(source) {
  const channels = [];
  const patterns = [
    { kind: "ipcMain.handle", re: /\bipcMain\.handle\s*\(\s*["']([^"']+)["']/g },
    { kind: "ipcMain.on", re: /\bipcMain\.on\s*\(\s*["']([^"']+)["']/g },
    { kind: "ipcRenderer.invoke", re: /\bipcRenderer\.invoke\s*\(\s*["']([^"']+)["']/g },
    { kind: "ipcRenderer.send", re: /\bipcRenderer\.send\s*\(\s*["']([^"']+)["']/g },
    { kind: "webContents.send", re: /\bwebContents\.send\s*\(\s*["']([^"']+)["']/g }
  ];
  for (const item of patterns) {
    let match;
    while ((match = item.re.exec(source))) {
      channels.push({ kind: item.kind, channel: match[1], line: lineNumberAt(source, match.index) });
    }
  }
  return channels;
}

function extractWorkbenchApi(source) {
  const exposed = [];
  const exposeMatch = source.match(/contextBridge\.exposeInMainWorld\s*\(\s*["']workbench["']\s*,\s*\{([\s\S]*?)\n\}\);/);
  if (exposeMatch) {
    const block = exposeMatch[1];
    const pattern = /^\s*([A-Za-z_$][\w$]*)\s*:/gm;
    let match;
    while ((match = pattern.exec(block))) exposed.push(match[1]);
  }
  const used = [];
  const usedPattern = /\bwindow\.workbench\.([A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = usedPattern.exec(source))) used.push(match[1]);
  return {
    exposed: [...new Set(exposed)].sort(),
    used: [...new Set(used)].sort()
  };
}

function analyzeJavaScriptFile(filePath) {
  const source = readText(filePath);
  const functions = [
    ...extractFunctionDeclarations(source, filePath),
    ...extractAssignedFunctionDeclarations(source, filePath)
  ].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));

  return {
    filePath,
    source,
    dependencies: extractDependencies(source),
    functions,
    ipc: extractIpcChannels(source),
    workbench: extractWorkbenchApi(source)
  };
}

function walkFiles(root, options = {}) {
  const include = options.include || /\.(js|mjs|cjs|jsx|ts|tsx|html|css|md|yaml|json)$/i;
  const excludeDirs = new Set(options.excludeDirs || ["node_modules", ".git"]);
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (excludeDirs.has(entry.name)) continue;
        visit(path.join(dir, entry.name));
        continue;
      }
      const filePath = path.join(dir, entry.name);
      if (include.test(entry.name)) files.push(filePath);
    }
  };
  visit(root);
  return files;
}

function analyzeProject(root, options = {}) {
  const files = walkFiles(root, options);
  const jsFiles = files.filter((filePath) => /\.(js|mjs|cjs|jsx|ts|tsx)$/i.test(filePath));
  const jsAnalyses = jsFiles.map(analyzeJavaScriptFile);
  const functions = jsAnalyses.flatMap((item) => item.functions);
  const knownNames = new Set(functions.map((item) => item.name));
  const callEdges = [];
  const functionSummaries = [];

  for (const fn of functions) {
    const calls = findCalls(fn.body, knownNames);
    calls.delete(fn.name);
    const outgoing = [...calls.entries()].map(([target, count]) => ({ target, count })).sort((a, b) => a.target.localeCompare(b.target));
    functionSummaries.push({
      name: fn.name,
      filePath: fn.filePath,
      line: fn.line,
      outgoingCount: outgoing.length,
      outgoingCallCount: outgoing.reduce((sum, item) => sum + item.count, 0)
    });
    for (const edge of outgoing) {
      callEdges.push({
        from: fn.name,
        to: edge.target,
        count: edge.count,
        filePath: fn.filePath,
        line: fn.line
      });
    }
  }

  const incoming = new Map();
  const outgoing = new Map();
  for (const fn of functions) {
    incoming.set(fn.name, 0);
    outgoing.set(fn.name, 0);
  }
  for (const edge of callEdges) {
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1);
  }

  const functionIndex = functions.map((fn) => ({
    name: fn.name,
    filePath: normalizePath(path.relative(root, fn.filePath)),
    line: fn.line,
    incoming: incoming.get(fn.name) || 0,
    outgoing: outgoing.get(fn.name) || 0
  })).sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing) || a.name.localeCompare(b.name));

  return {
    root,
    files: files.map((filePath) => normalizePath(path.relative(root, filePath))).sort(),
    jsFiles: jsAnalyses.map((item) => ({
      filePath: normalizePath(path.relative(root, item.filePath)),
      dependencies: item.dependencies,
      functionCount: item.functions.length,
      ipc: item.ipc,
      workbench: item.workbench
    })),
    functions: functionIndex,
    callEdges: callEdges.map((edge) => ({
      ...edge,
      filePath: normalizePath(path.relative(root, edge.filePath))
    })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    topIncoming: functionIndex.slice().sort((a, b) => b.incoming - a.incoming || b.outgoing - a.outgoing).slice(0, 40),
    topOutgoing: functionIndex.slice().sort((a, b) => b.outgoing - a.outgoing || b.incoming - a.incoming).slice(0, 40),
    leafFunctions: functionIndex.filter((item) => item.outgoing === 0).slice(0, 80),
    isolatedFunctions: functionIndex.filter((item) => item.incoming === 0 && item.outgoing === 0).slice(0, 80)
  };
}

module.exports = {
  analyzeProject,
  extractDependencies,
  extractAssignedFunctionDeclarations,
  extractFunctionDeclarations,
  extractIpcChannels,
  extractWorkbenchApi,
  findCalls,
  lineNumberAt,
  normalizePath,
  readText,
  stripJsTrivia,
  walkFiles
};

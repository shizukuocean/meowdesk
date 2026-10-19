const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const indexHtmlPath = path.join(repoRoot, "src", "renderer-app", "index.html");
const mainTsxPath = path.join(repoRoot, "src", "renderer-app", "src", "main.tsx");

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function main() {
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
  const mainTsx = fs.readFileSync(mainTsxPath, "utf8");

  assert(indexHtml.includes("/vs/vs-preflight.js"), "VS error preflight should stay available while legacy CSS compatibility remains");
  assert(indexHtml.includes("/vs/vs-visual.css"), "VS CSS compatibility layer should stay explicit until styles are migrated");
  assert(!indexHtml.includes("/vs/vs-visual.js"), "Default renderer must not load the legacy VS DOM/state mutator");
  assert(!indexHtml.includes("/vs/gsap.min.js"), "Default renderer must not load global GSAP only for the legacy VS mutator");
  assert(mainTsx.includes("vs-legacy-css-compat"), "React entry should explicitly mark VS as CSS compatibility only");
  assert(mainTsx.includes("css-compat-only"), "React entry should expose CSS-only VS mode for smoke checks");

  console.log(JSON.stringify({
    ok: true,
    legacyJsLoaded: false,
    cssCompatMode: true
  }));
}

main();

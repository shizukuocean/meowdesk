const fs = require("fs");
const path = require("path");

const MEOW_PACKAGE_SCHEMA_ID = "meodesk.meow.package.v0";
const MEOW_PACKAGE_MAX_FILE_BYTES = 10 * 1024 * 1024;
const MEOW_PACKAGE_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MEOW_PACKAGE_SKIP_DIRECTORIES = new Set([
  ".git",
  ".codex",
  ".cache",
  "node_modules",
  "exports",
  "tmp",
  "temp"
]);

function safeFilePart(value, fallback = "conversation") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function createWorkshopService(options = {}) {
  const {
    ensureDirectory,
    invalidateAgentInterfaceCache = () => {},
    meodeskHomePath,
    showOpenDialog,
    writeFileIfMissing
  } = options;
  if (typeof ensureDirectory !== "function") throw new Error("createWorkshopService requires ensureDirectory.");
  if (typeof meodeskHomePath !== "function") throw new Error("createWorkshopService requires meodeskHomePath.");
  if (typeof writeFileIfMissing !== "function") throw new Error("createWorkshopService requires writeFileIfMissing.");

  function extensionEntryPath(basePath, entry) {
    const entryText = String(entry || "index.html").replace(/^[/\\]+/, "");
    const resolved = path.resolve(basePath, entryText);
    const relative = path.relative(basePath, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
    return fs.existsSync(resolved) ? resolved : "";
  }

  function safeWorkshopFolderName(value) {
    const cleaned = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 80);
    return cleaned || `workshop-${Date.now().toString(36)}`;
  }

  function workshopTargetForType(type) {
    return type === "sidebar-widget" ? "workspace-sidebar" : "main-nav";
  }

  function workshopRuntimeForType(type) {
    return type === "sidebar-widget" ? "meodesk-sidebar-widget" : "html";
  }

  function htmlEscape(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function workshopStarterEntryHtml(project, manifest = {}) {
    const isSidebarWidget = String(manifest.type || project?.type || "") === "sidebar-widget";
    const name = htmlEscape(manifest.name || project?.name || "Meodesk Workshop Artifact");
    const summary = htmlEscape(manifest.summary || (isSidebarWidget ? "Right sidebar widget draft" : "Feature page draft"));
    return [
      "<!doctype html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  <title>${name}</title>`,
      "  <style>",
      "    :root {",
      "      color-scheme: light dark;",
      "      --meodesk-bg: #f8fafc;",
      "      --meodesk-panel: #ffffff;",
      "      --meodesk-text: #18212f;",
      "      --meodesk-muted: #667085;",
      "      --meodesk-border: #d8dee8;",
      "      --meodesk-accent: #6d8cff;",
      "      --meodesk-radius: 10px;",
      "      --meodesk-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
      "    }",
      "    * { box-sizing: border-box; }",
      "    body {",
      "      margin: 0;",
      "      min-height: 100vh;",
      "      display: grid;",
      "      place-items: stretch;",
      "      background: transparent;",
      "      color: var(--meodesk-text);",
      "      font-family: var(--meodesk-font);",
      "    }",
      "    main {",
      "      width: 100%;",
      "      min-height: 100vh;",
      "      display: grid;",
      "      gap: 10px;",
      "      align-content: start;",
      "      padding: 16px;",
      "      background: var(--meodesk-panel);",
      "      border: 1px solid color-mix(in srgb, var(--meodesk-border) 82%, transparent);",
      "      border-radius: var(--meodesk-radius);",
      "    }",
      "    h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0; }",
      "    p { margin: 0; color: var(--meodesk-muted); font-size: 13px; line-height: 1.55; }",
      "    .accent { color: var(--meodesk-accent); font-weight: 650; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <main>",
      `    <h1>${name}</h1>`,
      `    <p>${summary}</p>`,
      `    <p><span class="accent">${isSidebarWidget ? "右侧栏组件" : "功能页"}</span> 草稿已创建。Agent 可以从这里继续实现真实内容。</p>`,
      "  </main>",
      "  <script>",
      "    function applyMeodeskTheme(theme) {",
      "      const tokens = theme?.tokens || theme;",
      "      if (!tokens || typeof tokens !== 'object') return;",
      "      if (theme?.colorScheme) document.documentElement.style.colorScheme = String(theme.colorScheme);",
      "      for (const [key, value] of Object.entries(tokens)) {",
      "        if (String(key).startsWith('--meodesk-')) document.documentElement.style.setProperty(key, String(value));",
      "      }",
      "    }",
      "    window.addEventListener('message', (event) => {",
      "      const data = event.data || {};",
      "      if ((data.type === 'meodesk:init' || data.type === 'meodesk:theme') && (data.theme || data.tokens)) {",
      "        applyMeodeskTheme(data.theme || { tokens: data.tokens, colorScheme: data.colorScheme });",
      "      }",
      "    });",
      "    window.parent?.postMessage({ source: 'meodesk-extension', type: 'meodesk:ready' }, '*');",
      "  </script>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  function ensureWorkshopStarterEntry(projectPath, project, manifest = {}) {
    const entry = String(manifest.entry || "index.html").replace(/^[/\\]+/, "");
    const entryPath = path.resolve(projectPath, entry);
    const relative = path.relative(projectPath, entryPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
    ensureDirectory(path.dirname(entryPath));
    writeFileIfMissing(entryPath, `${workshopStarterEntryHtml(project, manifest)}\n`);
    return entryPath;
  }

  function meowPackageMarkdown(project, manifest = null) {
    const target = String(project?.target || manifest?.target || "").trim();
    const type = String(project?.type || manifest?.type || "").trim();
    const runtime = String(manifest?.runtime || "").trim();
    return [
      `# ${project?.name || manifest?.name || "Meodesk 扩展包"}`,
      "",
      "这是一个 Meodesk `.meow` 成品包说明文件。",
      "它是可安装、可启用、可发布的运行单元，不是开发源本体。",
      "",
      "## 包约定",
      "",
      `- schema: ${MEOW_PACKAGE_SCHEMA_ID}`,
      `- type: ${type || "feature-page"}`,
      `- target: ${target || workshopTargetForType(type)}`,
      `- runtime: ${runtime || workshopRuntimeForType(type)}`,
      "- 开发源仍然保留在工程目录里。",
      "- 安装 `.meow` 后，Meodesk 会把它还原为 `extensions/<id>/` 工程目录。",
      "- 版本线继续以 `versions/` 和 manifest version 为准。",
      "- 这个包可以来自 HTML demo，也可以来自更正式的 Meodesk 扩展形态。",
      "- 只要 manifest 和入口符合宿主约定，就可以被 Meodesk 安装、预览、启用、发布或继续迭代。",
      "- 推荐 manifest.ui.theme=inherit，让成品包默认继承 Meodesk 宿主主题，而不是固定一套外部网页皮肤。"
    ].join("\n");
  }

  function workshopProjectMarkdown(project) {
    return [
      `# ${project.name}`,
      "",
      "这是一个 Meodesk 工坊工程目录。用户把本目录路径交给 Agent 后，Agent 应自行读取本文件、manifest 和 versions 目录继续开发。",
      "",
      "## 工程信息",
      "",
      `- projectId: ${project.id}`,
      `- name: ${project.name}`,
      `- type: ${project.type}`,
      `- target: ${project.target}`,
      `- currentVersion: ${project.version}`,
      `- entry: ${project.entry || "index.html"}`,
      `- entryPath: ${project.entryPath || ""}`,
      `- projectPath: ${project.path}`,
      `- manifestPath: ${project.manifestPath}`,
      `- versionsDir: ${project.versionsDir}`,
      "",
      "## Agent 读取规则",
      "",
      "- Meodesk 只承载、扫描、预览和启用作品，不替 Agent 创作、调试或迭代。",
      "- 继续开发时，先读取 `meodesk-extension.manifest.json`，再检查当前入口文件和 `versions/` 下的版本快照。",
      "- 右侧栏组件必须能在 `target=workspace-sidebar` 的容器里适配宽高；除此之外不要把作品形态限制成固定模板。",
      "- 默认按 `ui.theme=inherit` 开发：优先使用宿主注入的 `--meodesk-*` 主题变量，让作品继承 Meodesk 的字体、颜色、边线、圆角和按钮感觉。",
      "- 右侧栏组件不要默认再包一层完整网页外壳；Meodesk 已提供右侧栏外框，作品内容应透明或使用宿主 surface。",
      "- 做出可用版本后，可以更新根 manifest 的 version/status，也可以在 `versions/<version>/` 下保存快照。",
      "- 用户要求“使用”时，Meodesk 会从 manifest 和选定版本加载作品。",
      "- 需要安装、使用、发布、备份或分享时，可以生成 `.meow` 成品包；`.meow` 是作品的成品态，不替换工程目录。"
    ].join("\n");
  }

  function writeWorkshopProjectDocs(projectPath, project, manifest = null) {
    if (!projectPath) return;
    writeFileIfMissing(path.join(projectPath, "MEODESK_PROJECT.md"), `${workshopProjectMarkdown(project)}\n`);
    writeFileIfMissing(path.join(projectPath, "MEODESK_PACKAGE.md"), `${meowPackageMarkdown(project, manifest)}\n`);
  }

  function createWorkshopProject(payload = {}) {
    const type = ["feature-page", "sidebar-widget"].includes(payload.type) ? payload.type : "feature-page";
    const name = String(payload.name || "").trim();
    if (!name) throw new Error("请输入工程名称。");
    const extensionsDir = meodeskHomePath("extensions");
    ensureDirectory(extensionsDir);
    const folderName = safeWorkshopFolderName(payload.folderName || name);
    const projectPath = path.join(extensionsDir, folderName);
    if (fs.existsSync(projectPath) && !fs.statSync(projectPath).isDirectory()) {
      throw new Error("同名路径已存在，但不是文件夹。");
    }
    ensureDirectory(projectPath);

    const fallbackId = `workshop-${Date.now().toString(36)}`;
    const manifestPath = path.join(projectPath, "meodesk-extension.manifest.json");
    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        manifest = null;
      }
    }
    if (!manifest) {
      const id = safeFilePart(payload.id || folderName, fallbackId);
      manifest = {
        schema: "meodesk.extension.manifest.v0",
        id,
        type,
        name,
        version: "0.1.0",
        summary: "",
        target: workshopTargetForType(type),
        entry: "index.html",
        runtime: workshopRuntimeForType(type),
        status: "draft",
        createdBy: "Meodesk Workshop",
        permissions: [],
        files: ["MEODESK_PROJECT.md", "MEODESK_PACKAGE.md", "index.html"],
        compatibility: { meodesk: ">=0.1.0" },
        versioning: { current: "0.1.0", channel: "dev", versionsDir: "versions" },
        ui: {
          theme: "inherit",
          surface: type === "sidebar-widget" ? "host" : "panel",
          chrome: type === "sidebar-widget" ? "minimal" : "host",
          density: type === "sidebar-widget" ? "compact" : "auto",
          tokenProtocol: "meodesk.theme.v0"
        }
      };
      if (type === "sidebar-widget") {
        manifest.sidebarWidget = {
          title: name,
          minWidth: 240,
          minHeight: 120,
          preferredHeight: 260,
          maxHeight: 960,
          resizeMode: "responsive",
          protocol: "meodesk.sidebar-widget.v0"
        };
      } else {
        manifest.page = {
          navLabel: name,
          route: id,
          icon: ""
        };
      }
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }

    const project = {
      id: String(manifest.id || safeFilePart(folderName, fallbackId)),
      name: String(manifest.name || name),
      type: String(manifest.type || type),
      target: String(manifest.target || workshopTargetForType(type)),
      version: String(manifest.version || "0.1.0"),
      entry: String(manifest.entry || "index.html"),
      runtime: String(manifest.runtime || workshopRuntimeForType(type)),
      status: String(manifest.status || "draft"),
      path: projectPath,
      manifestPath,
      versionsDir: path.join(projectPath, "versions"),
      entryPath: ""
    };
    ensureDirectory(project.versionsDir);
    project.entryPath = ensureWorkshopStarterEntry(projectPath, project, manifest);
    writeWorkshopProjectDocs(projectPath, project, manifest);
    invalidateAgentInterfaceCache();
    return {
      ok: true,
      project,
      createdAt: new Date().toISOString()
    };
  }

  function findWorkshopProjectDirectory(projectId) {
    const id = String(projectId || "").trim();
    if (!id) return null;
    const extensionsDir = meodeskHomePath("extensions");
    if (!fs.existsSync(extensionsDir)) return null;
    for (const entry of fs.readdirSync(extensionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(extensionsDir, entry.name);
      if (entry.name === id) return directory;
      const manifestPath = path.join(directory, "meodesk-extension.manifest.json");
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        if (String(manifest?.id || "").trim() === id) return directory;
      } catch {
        // Ignore broken manifests while looking for another project.
      }
    }
    return null;
  }

  function markWorkshopProjectReady(payload = {}) {
    const projectId = payload.id || payload.projectId || payload.folderName;
    const directory = findWorkshopProjectDirectory(projectId);
    if (!directory) throw new Error("未找到工程目录。");
    const manifestPath = path.join(directory, "meodesk-extension.manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("工程缺少 meodesk-extension.manifest.json。");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entryPath = extensionEntryPath(directory, manifest.entry);
    if (!entryPath) throw new Error("入口文件还不存在，暂时不能制作完成。");
    const version = String(manifest.version || "0.1.0").trim() || "0.1.0";
    manifest.version = version;
    manifest.status = "ready";
    manifest.versioning = {
      ...(manifest.versioning && typeof manifest.versioning === "object" ? manifest.versioning : {}),
      current: version,
      channel: manifest.versioning?.channel || "dev",
      versionsDir: manifest.versioning?.versionsDir || "versions"
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    invalidateAgentInterfaceCache();
    return {
      ok: true,
      id: String(manifest.id || projectId),
      name: String(manifest.name || path.basename(directory)),
      version,
      path: directory,
      manifestPath,
      entryPath
    };
  }

  function normalizeMeowRelativePath(filePath) {
    const normalized = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) return "";
    const segments = normalized.split("/").filter(Boolean);
    if (!segments.length) return "";
    if (segments.some((segment) => segment === "." || segment === "..")) return "";
    return segments.join("/");
  }

  function collectMeowPackageFiles(rootPath) {
    const files = [];
    let totalBytes = 0;

    function walk(currentPath, relativePath = "") {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      for (const entry of entries) {
        if (MEOW_PACKAGE_SKIP_DIRECTORIES.has(entry.name)) continue;
        const nextRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const nextPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          walk(nextPath, nextRelativePath);
          continue;
        }
        if (!entry.isFile() && !entry.isSymbolicLink()) continue;
        if (nextRelativePath.toLowerCase().endsWith(".meow")) continue;
        const stats = fs.statSync(nextPath);
        if (stats.size > MEOW_PACKAGE_MAX_FILE_BYTES) {
          throw new Error(`文件过大，无法打包：${nextRelativePath}`);
        }
        totalBytes += stats.size;
        if (totalBytes > MEOW_PACKAGE_MAX_TOTAL_BYTES) {
          throw new Error("工程内容太大，暂时无法生成 .meow 成品包。");
        }
        const buffer = fs.readFileSync(nextPath);
        files.push({
          path: nextRelativePath,
          encoding: "base64",
          content: buffer.toString("base64"),
          size: stats.size,
          modifiedAt: stats.mtimeMs || 0
        });
      }
    }

    walk(rootPath);
    return files;
  }

  function workshopPackageFileName(project, version = "") {
    const base = safeFilePart(project?.id || project?.name || "meow-package", "meow-package");
    const versionPart = safeFilePart(version || project?.version || "0.1.0", "0.1.0");
    return `${base}-v${versionPart}.meow`;
  }

  function normalizeMeowPackageObject(raw) {
    if (!raw || typeof raw !== "object") throw new Error("`.meow` 包内容不是有效对象。");
    if (String(raw.schema || "") !== MEOW_PACKAGE_SCHEMA_ID) {
      throw new Error("`.meow` 包版本不受支持。");
    }
    const manifest = raw.manifest && typeof raw.manifest === "object" ? raw.manifest : null;
    if (!manifest) throw new Error("`.meow` 包缺少 manifest。");
    if (!Array.isArray(raw.files)) throw new Error("`.meow` 包缺少文件列表。");
    return {
      ...raw,
      manifest,
      files: raw.files.filter((file) => file && typeof file === "object")
    };
  }

  function writeMeowPackageFiles(targetPath, packageObject) {
    for (const file of packageObject.files || []) {
      const rawRelativePath = String(file.path || "");
      const relativePath = normalizeMeowRelativePath(rawRelativePath);
      if (!relativePath) {
        throw new Error(`.meow 包包含非法路径：${rawRelativePath || "(empty)"}`);
      }
      const destinationPath = path.join(targetPath, relativePath);
      const destinationRoot = path.resolve(targetPath);
      const resolvedDestination = path.resolve(destinationPath);
      const relativeToRoot = path.relative(destinationRoot, resolvedDestination);
      if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        throw new Error(`.meow 包包含非法路径：${relativePath}`);
      }
      ensureDirectory(path.dirname(destinationPath));
      const encoding = String(file.encoding || "base64");
      const content = String(file.content || "");
      const buffer = encoding === "utf8" ? Buffer.from(content, "utf8") : Buffer.from(content, "base64");
      fs.writeFileSync(destinationPath, buffer);
    }
  }

  function packageProjectSnapshot(packageObject) {
    const manifest = packageObject.manifest || {};
    return {
      id: String(manifest.id || packageObject.package?.id || "").trim(),
      name: String(manifest.name || packageObject.package?.name || "Meodesk 扩展").trim(),
      type: String(manifest.type || packageObject.package?.type || "feature-page").trim(),
      target: String(manifest.target || packageObject.package?.target || workshopTargetForType(manifest.type || packageObject.package?.type || "feature-page")),
      version: String(manifest.version || packageObject.package?.version || "0.1.0").trim() || "0.1.0",
      path: "",
      manifestPath: path.join("", "meodesk-extension.manifest.json"),
      versionsDir: path.join("", "versions")
    };
  }

  function publishText(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function normalizeWorkshopPublishDraft(input = {}, project = {}, manifest = {}) {
    const record = input && typeof input === "object" ? input : {};
    const title = publishText(record.title || record.name || manifest.name || project.name, 80);
    const summary = publishText(record.summary || record.description || manifest.summary || "", 800);
    const changelog = publishText(record.changelog || record.releaseNotes || "", 1600);
    const version = publishText(record.version || manifest.version || project.version || "0.1.0", 40) || "0.1.0";
    return {
      title,
      summary,
      changelog,
      version,
      source: "local-publish-test"
    };
  }

  function workshopExistingProjectSummary(projectPath) {
    if (!projectPath || !fs.existsSync(projectPath)) return null;
    const manifestPath = path.join(projectPath, "meodesk-extension.manifest.json");
    let manifest = {};
    try {
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      }
    } catch {
      manifest = {};
    }
    return {
      id: String(manifest.id || path.basename(projectPath)),
      name: String(manifest.name || path.basename(projectPath)),
      type: String(manifest.type || "feature-page"),
      target: String(manifest.target || workshopTargetForType(manifest.type || "feature-page")),
      version: String(manifest.version || "0.1.0"),
      path: projectPath,
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : "",
      status: String(manifest.status || "draft")
    };
  }

  function exportWorkshopPackage(payload = {}) {
    const projectId = payload.id || payload.projectId || payload.folderName;
    const directory = findWorkshopProjectDirectory(projectId);
    if (!directory) throw new Error("未找到工程目录。");
    const manifestPath = path.join(directory, "meodesk-extension.manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error("工程缺少 meodesk-extension.manifest.json。");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entryPath = extensionEntryPath(directory, manifest.entry);
    if (!entryPath) throw new Error("入口文件不存在，暂时不能生成 .meow。");
    const project = {
      id: String(manifest.id || path.basename(directory)),
      name: String(manifest.name || path.basename(directory)),
      type: String(manifest.type || "feature-page"),
      target: String(manifest.target || workshopTargetForType(manifest.type || "feature-page")),
      version: String(manifest.version || "0.1.0"),
      path: directory,
      manifestPath,
      versionsDir: path.join(directory, "versions")
    };
    const publishDraft = normalizeWorkshopPublishDraft(payload.publish || payload.publishDraft || {}, project, manifest);
    const packageManifest = {
      ...manifest,
      name: publishDraft.title || manifest.name || project.name,
      summary: publishDraft.summary || manifest.summary || "",
      version: publishDraft.version || manifest.version || project.version
    };
    const packageProject = {
      ...project,
      name: String(packageManifest.name || project.name),
      version: String(packageManifest.version || project.version)
    };
    writeWorkshopProjectDocs(directory, project, manifest);
    const exportRoot = path.join(meodeskHomePath("exports"), "meow", safeFilePart(project.id || project.name, "meow-package"));
    ensureDirectory(exportRoot);
    const packagePath = path.join(exportRoot, workshopPackageFileName(packageProject, packageProject.version));
    const packagedAt = new Date().toISOString();
    const packageObject = {
      schema: MEOW_PACKAGE_SCHEMA_ID,
      kind: "meodesk-extension-package",
      packagedAt,
      exportedAt: packagedAt,
      package: {
        id: project.id,
        name: packageProject.name,
        type: project.type,
        target: project.target,
        version: packageProject.version,
        runtime: String(manifest.runtime || workshopRuntimeForType(project.type)),
        entry: String(manifest.entry || "index.html"),
        summary: publishDraft.summary,
        changelog: publishDraft.changelog,
        sourcePath: directory,
        installMode: "unpack-to-extensions",
        publish: publishDraft
      },
      manifest: packageManifest,
      files: collectMeowPackageFiles(directory)
    };
    fs.writeFileSync(packagePath, `${JSON.stringify(packageObject, null, 2)}\n`, "utf8");
    invalidateAgentInterfaceCache();
    return {
      ok: true,
      packagePath,
      package: packageObject.package,
      packagedAt: packageObject.packagedAt,
      exportedAt: packageObject.exportedAt,
      status: String(manifest.status || "draft"),
      manifestPath,
      path: directory
    };
  }

  function installMeowPackage(packagePath, targetPath, options = {}) {
    const raw = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const packageObject = normalizeMeowPackageObject(raw);
    const manifest = packageObject.manifest;
    const folderName = safeWorkshopFolderName(manifest.id || packageObject.package?.id || manifest.name || packageObject.package?.name || path.basename(packagePath, ".meow"));
    const officialInstallRoot = meodeskHomePath("extensions");
    const officialDestinationPath = path.join(officialInstallRoot, folderName);
    const testInstallRoot = meodeskHomePath("install-tests");
    const destinationPath = targetPath ? path.resolve(targetPath) : (options.testInstall ? path.join(testInstallRoot, folderName) : officialDestinationPath);
    const allowedInstallRoot = path.resolve(options.testInstall ? testInstallRoot : officialInstallRoot);
    const resolvedDestination = path.resolve(destinationPath);
    const relativeToAllowedRoot = path.relative(allowedInstallRoot, resolvedDestination);
    if (relativeToAllowedRoot.startsWith("..") || path.isAbsolute(relativeToAllowedRoot)) {
      throw new Error(options.testInstall
        ? "测试安装目录不在 Meodesk Home install-tests 内。"
        : "安装目录不在 Meodesk Home extensions 内。");
    }
    const existingProject = workshopExistingProjectSummary(officialDestinationPath);
    const installMode = existingProject ? "update-required" : "new-install";
    const project = packageProjectSnapshot(packageObject);
    project.path = destinationPath;
    project.manifestPath = path.join(destinationPath, "meodesk-extension.manifest.json");
    project.versionsDir = path.join(destinationPath, "versions");
    if (options.dryRun) {
      return {
        ok: true,
        dryRun: true,
        testInstall: Boolean(options.testInstall),
        project,
        existingProject,
        installMode,
        packagePath,
        status: String(manifest.status || "draft")
      };
    }
    if (fs.existsSync(destinationPath)) {
      if (options.testInstall) {
        fs.rmSync(resolvedDestination, { recursive: true, force: true });
      } else {
        throw new Error("目标工程已存在，请先改名或删除后再安装。");
      }
    }
    ensureDirectory(destinationPath);
    writeMeowPackageFiles(destinationPath, packageObject);
    const manifestPath = path.join(destinationPath, "meodesk-extension.manifest.json");
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    project.manifestPath = manifestPath;
    project.versionsDir = path.join(destinationPath, "versions");
    ensureDirectory(project.versionsDir);
    writeWorkshopProjectDocs(destinationPath, project, manifest);
    invalidateAgentInterfaceCache();
    return {
      ok: true,
      dryRun: false,
      testInstall: Boolean(options.testInstall),
      project: {
        id: String(manifest.id || packageObject.package?.id || folderName),
        name: String(manifest.name || packageObject.package?.name || folderName),
        type: String(manifest.type || packageObject.package?.type || "feature-page"),
        target: String(manifest.target || packageObject.package?.target || workshopTargetForType(manifest.type || packageObject.package?.type || "feature-page")),
        version: String(manifest.version || packageObject.package?.version || "0.1.0"),
        path: destinationPath,
        manifestPath,
        versionsDir: path.join(destinationPath, "versions")
      },
      existingProject,
      installMode,
      installedAt: new Date().toISOString(),
      packagePath,
      status: String(manifest.status || "draft")
    };
  }

  async function importWorkshopPackage(payload = {}) {
    let packagePath = String(payload.packagePath || payload.path || "").trim();
    if (!packagePath) {
      const result = await showOpenDialog({
        title: "安装 .meow 成品包",
        properties: ["openFile"],
        filters: [{ name: "Meow Package", extensions: ["meow"] }]
      });
      if (result.canceled || !result.filePaths?.length) {
        return { ok: false, canceled: true };
      }
      packagePath = result.filePaths[0];
    }
    if (!fs.existsSync(packagePath)) throw new Error("找不到 .meow 文件。");
    const packageObject = normalizeMeowPackageObject(JSON.parse(fs.readFileSync(packagePath, "utf8")));
    const imported = installMeowPackage(
      packagePath,
      String(payload.targetPath || payload.destinationPath || "").trim() || null,
      {
        dryRun: payload.dryRun === true,
        testInstall: payload.testInstall === true
      }
    );
    return {
      ok: true,
      dryRun: imported.dryRun === true,
      testInstall: imported.testInstall === true,
      packagePath,
      package: packageObject.package,
      project: imported.project,
      existingProject: imported.existingProject,
      installMode: imported.installMode,
      installedAt: imported.installedAt,
      status: imported.status
    };
  }

  function fileModifiedAt(filePath) {
    if (!filePath) return 0;
    try {
      return fs.statSync(filePath).mtimeMs || 0;
    } catch {
      return 0;
    }
  }

  function latestModifiedAt(...values) {
    return values.reduce((latest, value) => Math.max(latest, Number(value) || fileModifiedAt(value)), 0);
  }

  function workshopExtensionVersionRecord({ key, basePath, manifestPath, manifest, entryPath, current = false }) {
    const version = String(manifest?.version || key || "").trim();
    return {
      key: String(key || version || "current"),
      version,
      label: version ? `v${version}` : String(key || "current"),
      current: Boolean(current),
      path: basePath,
      manifestPath,
      entry: String(manifest?.entry || ""),
      entryPath,
      status: String(manifest?.status || "draft"),
      summary: String(manifest?.summary || ""),
      runtime: String(manifest?.runtime || (manifest?.type === "sidebar-widget" ? "html" : "")),
      sidebarWidget: manifest?.sidebarWidget && typeof manifest.sidebarWidget === "object" ? manifest.sidebarWidget : {},
      ui: manifest?.ui && typeof manifest.ui === "object" ? manifest.ui : {},
      modifiedAt: latestModifiedAt(basePath, manifestPath, entryPath)
    };
  }

  function scanWorkshopExtensionVersions(directory, manifest, manifestPath, entryPath) {
    const records = [];
    if (manifest) {
      records.push(workshopExtensionVersionRecord({
        key: "current",
        basePath: directory,
        manifestPath,
        manifest,
        entryPath,
        current: true
      }));
    }
    const versionsPath = path.join(directory, "versions");
    if (fs.existsSync(versionsPath)) {
      for (const entry of fs.readdirSync(versionsPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const versionPath = path.join(versionsPath, entry.name);
        const versionManifestPath = path.join(versionPath, "meodesk-extension.manifest.json");
        if (!fs.existsSync(versionManifestPath)) continue;
        try {
          const versionManifest = JSON.parse(fs.readFileSync(versionManifestPath, "utf8"));
          const versionEntryPath = extensionEntryPath(versionPath, versionManifest.entry);
          records.push(workshopExtensionVersionRecord({
            key: entry.name,
            basePath: versionPath,
            manifestPath: versionManifestPath,
            manifest: versionManifest,
            entryPath: versionEntryPath,
            current: false
          }));
        } catch {
          // Broken version snapshots should not hide the current working version.
        }
      }
    }
    const seen = new Set();
    return records
      .filter((record) => {
        const key = record.key || record.version || record.path;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        if (a.current) return -1;
        if (b.current) return 1;
        return (b.modifiedAt || 0) - (a.modifiedAt || 0);
      });
  }

  function scanWorkshopExtensions(extensionsPath) {
    if (!fs.existsSync(extensionsPath)) return [];
    return fs.readdirSync(extensionsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const directory = path.join(extensionsPath, entry.name);
        const manifestPath = path.join(directory, "meodesk-extension.manifest.json");
        const projectFilePath = path.join(directory, "MEODESK_PROJECT.md");
        let manifest = null;
        let error = "";
        let stats = null;
        try {
          stats = fs.statSync(directory);
          if (!fs.existsSync(manifestPath)) throw new Error("缺少 meodesk-extension.manifest.json");
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        } catch (parseError) {
          error = parseError.message || String(parseError);
        }
        const entryPath = manifest ? extensionEntryPath(directory, manifest.entry) : "";
        const versions = scanWorkshopExtensionVersions(directory, manifest, manifestPath, entryPath);
        const modifiedAt = latestModifiedAt(
          stats?.mtimeMs || 0,
          manifestPath,
          entryPath,
          ...versions.map((version) => version.modifiedAt || 0)
        );
        return {
          id: safeFilePart(manifest?.id || entry.name, entry.name),
          folderName: entry.name,
          name: String(manifest?.name || entry.name).trim() || entry.name,
          type: String(manifest?.type || "unknown"),
          target: String(manifest?.target || ""),
          status: String(manifest?.status || (error ? "error" : "draft")),
          version: String(manifest?.version || ""),
          summary: String(manifest?.summary || ""),
          entry: String(manifest?.entry || ""),
          runtime: String(manifest?.runtime || (manifest?.type === "sidebar-widget" ? "html" : "")),
          sidebarWidget: manifest?.sidebarWidget && typeof manifest.sidebarWidget === "object" ? manifest.sidebarWidget : {},
          ui: manifest?.ui && typeof manifest.ui === "object" ? manifest.ui : {},
          projectFilePath: fs.existsSync(projectFilePath) ? projectFilePath : "",
          projectPath: directory,
          versions,
          activeVersion: String(manifest?.version || ""),
          path: directory,
          manifestPath,
          entryPath,
          modifiedAt,
          createdAt: stats?.birthtimeMs || 0,
          manifest,
          error
        };
      })
      .sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
  }



  return {
    createWorkshopProject,
    exportWorkshopPackage,
    importWorkshopPackage,
    markWorkshopProjectReady,
    scanWorkshopExtensions,
    workshopRuntimeForType,
    workshopTargetForType
  };
}

module.exports = { createWorkshopService };

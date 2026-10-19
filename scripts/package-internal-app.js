const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const outRoot = path.join(root, "out");
const packageRoot = path.join(outRoot, "meowdesk-internal-unpacked");
const appRoot = path.join(packageRoot, "resources", "app");
const rendererDist = path.join(root, "dist", "renderer-app");
const runtimeDependencies = ["js-yaml", "node-pty"];

function assertInside(base, target) {
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${base}: ${target}`);
  }
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required package source: ${source}`);
  }
  fs.cpSync(source, target, { recursive: true });
}

function readPackage(name) {
  const packagePath = path.join(root, "node_modules", ...name.split("/"), "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Missing runtime dependency package.json: ${name}`);
  }
  return {
    packagePath,
    dir: path.dirname(packagePath),
    manifest: JSON.parse(fs.readFileSync(packagePath, "utf8"))
  };
}

function dependencyNames(manifest) {
  return Object.keys({
    ...(manifest.dependencies || {}),
    ...(manifest.optionalDependencies || {})
  });
}

function copyRuntimeDependency(name, copied = new Set()) {
  if (copied.has(name)) return copied;
  const dependency = readPackage(name);
  copied.add(name);
  const target = path.join(appRoot, "node_modules", ...name.split("/"));
  copyDirectory(dependency.dir, target);
  for (const childName of dependencyNames(dependency.manifest)) {
    copyRuntimeDependency(childName, copied);
  }
  return copied;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  assertInside(outRoot, packageRoot);
  if (!fs.existsSync(path.join(rendererDist, "index.html"))) {
    throw new Error("Renderer build is missing. Run npm run build:renderer first.");
  }

  fs.mkdirSync(outRoot, { recursive: true });
  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(appRoot, { recursive: true });

  copyDirectory(path.join(root, "src"), path.join(appRoot, "src"));
  copyDirectory(path.join(root, "assets"), path.join(appRoot, "assets"));
  copyDirectory(rendererDist, path.join(appRoot, "dist", "renderer-app"));
  fs.copyFileSync(path.join(root, "config.yaml"), path.join(appRoot, "config.yaml"));

  const copiedDependencies = new Set();
  for (const name of runtimeDependencies) {
    copyRuntimeDependency(name, copiedDependencies);
  }

  writeJson(path.join(appRoot, "package.json"), {
    name: packageJson.name,
    version: packageJson.version,
    private: true,
    main: "src/main.js",
    dependencies: Object.fromEntries([...copiedDependencies].map((name) => [
      name,
      packageJson.dependencies?.[name] || readPackage(name).manifest.version
    ])),
    meowdeskPackage: {
      type: "internal-unpacked",
      source: "scripts/package-internal-app.js"
    }
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    type: "internal-unpacked",
    package: {
      name: packageJson.name,
      version: packageJson.version,
      main: "src/main.js"
    },
    paths: {
      packageRoot,
      appRoot,
      rendererEntry: path.join(appRoot, "dist", "renderer-app", "index.html")
    },
    runtimeDependencies: [...copiedDependencies].sort()
  };
  writeJson(path.join(packageRoot, "meowdesk-internal-package.json"), manifest);
  console.log(JSON.stringify({
    ok: true,
    packageRoot,
    appRoot,
    runtimeDependencies: manifest.runtimeDependencies
  }));
}

main();

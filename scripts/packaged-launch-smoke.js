const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageRoot = path.join(root, "out", "meowdesk-internal-unpacked");
const appRoot = path.join(packageRoot, "resources", "app");
const reportDir = path.join(root, "docs", "analysis");
const reportJsonPath = path.join(reportDir, "meodesk-packaged-launch-smoke.json");
const reportMdPath = path.join(reportDir, "meodesk-packaged-launch-smoke.md");
const scenario = process.env.MEOWDESK_PACKAGED_SMOKE_SCENARIO || "next-route-hash";
const timeoutMs = Number(process.env.MEOWDESK_PACKAGED_SMOKE_TIMEOUT_MS) || 30000;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
  if (result.signal) {
    throw new Error(`${command} ${args.join(" ")} terminated by ${result.signal}`);
  }
}

function runNpmScript(scriptName) {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`]);
    return;
  }
  run("npm", ["run", scriptName]);
}

function ensurePackage() {
  if (/^(1|true|yes)$/i.test(process.env.MEOWDESK_SKIP_INTERNAL_PACKAGE || "")) return;
  runNpmScript("package:internal");
}

function parseSmokeJson(stdout) {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && parsed.ok === true) return parsed;
    } catch {
      // Ignore non-JSON log lines.
    }
  }
  return null;
}

function writeReport(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportMdPath, [
    "# Meowdesk Packaged Launch Smoke",
    "",
    `> Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- ok: ${report.ok}`,
    `- scenario: \`${report.scenario}\``,
    `- packageRoot: \`${report.packageRoot}\``,
    `- appRoot: \`${report.appRoot}\``,
    `- userDataDir: \`${report.userDataDir}\``,
    `- rendererKind: ${report.result?.rendererKind || "-"}`,
    `- rendererPath: \`${report.result?.rendererPath || ""}\``,
    "",
    "This smoke launches the internal unpacked package with an isolated userData directory. It is not an installer, signing, or public distribution test.",
    ""
  ].join("\n"), "utf8");
}

async function launchSmoke() {
  if (!fs.existsSync(path.join(appRoot, "src", "main.js"))) {
    throw new Error(`Internal app package is missing: ${appRoot}`);
  }
  if (!fs.existsSync(path.join(appRoot, "dist", "renderer-app", "index.html"))) {
    throw new Error(`Packaged renderer entry is missing: ${appRoot}`);
  }

  const electronBin = require("electron");
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "meowdesk-packaged-smoke-"));
  const screenshotPath = path.join(root, "tmp", "packaged-launch-smoke", `${scenario}.png`);
  const childEnv = {
    ...process.env,
    MEOWDESK_RENDERER: "next",
    MEOWDESK_RENDERER_SMOKE: "1",
    MEOWDESK_RENDERER_SMOKE_SCENARIO: scenario,
    MEOWDESK_RENDERER_SMOKE_SCREENSHOT: screenshotPath,
    MEOWDESK_RENDERER_SMOKE_TIMEOUT_MS: String(Math.max(10000, timeoutMs - 5000)),
    MEOWDESK_RENDERER_SMOKE_AGENT_COMMAND: process.execPath,
    MEOWDESK_USER_DATA_DIR: userDataDir
  };

  return await new Promise((resolve, reject) => {
    const child = spawn(electronBin, [appRoot], {
      cwd: packageRoot,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Packaged launch smoke timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const result = parseSmokeJson(stdout);
      if (code !== 0 || !result) {
        reject(new Error(`Packaged launch smoke failed: code=${code} signal=${signal || ""}\n${stderr || stdout}`));
        return;
      }
      resolve({
        generatedAt: new Date().toISOString(),
        ok: true,
        scenario,
        packageRoot,
        appRoot,
        userDataDir,
        screenshotPath,
        result
      });
    });
  });
}

async function main() {
  ensurePackage();
  const report = await launchSmoke();
  writeReport(report);
  console.log(JSON.stringify({
    ok: true,
    scenario: report.scenario,
    packageRoot: report.packageRoot,
    report: path.relative(root, reportMdPath)
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

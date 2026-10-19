const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const skipBuild = /^(1|true|yes)$/i.test(process.env.MEOWDESK_SKIP_RENDERER_BUILD || "");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.signal) {
    console.error(`Command terminated by signal ${result.signal}`);
    process.exit(1);
  }
}

function runNpmScript(scriptName) {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`]);
    return;
  }
  run("npm", ["run", scriptName]);
}

if (!skipBuild) {
  runNpmScript("build:renderer");
}

run(process.execPath, [path.join("scripts", "renderer-smoke.js"), ...process.argv.slice(2)]);

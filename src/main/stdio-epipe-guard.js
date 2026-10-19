let installedGuard = null;

function isBrokenPipeError(error) {
  if (!error) return false;
  const code = String(error.code || error.errno || "").toUpperCase();
  if (code === "EPIPE") return true;
  const message = String(error.message || "");
  return /\bEPIPE\b/.test(message) && /broken pipe/i.test(message);
}

function isConsoleBrokenPipeError(error) {
  if (!isBrokenPipeError(error)) return false;
  const stack = String(error.stack || "");
  return stack.includes("node:internal/console") || stack.includes("node:console");
}

function installStdioBrokenPipeGuard(options = {}) {
  if (installedGuard && !options.forceNew) return installedGuard;

  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const guardedStreams = new Set([stdout, stderr].filter(Boolean));
  const brokenStreams = new WeakSet();
  const originalWrites = new WeakMap();

  const markBroken = (stream) => {
    if (stream && typeof stream === "object") {
      brokenStreams.add(stream);
    }
  };

  const isGuardedStream = (stream) => guardedStreams.has(stream);

  const shouldIgnoreUncaughtException = (error) => {
    return isConsoleBrokenPipeError(error);
  };

  const installStreamGuard = (stream) => {
    if (!stream || typeof stream !== "object") return;

    if (typeof stream.on === "function") {
      stream.on("error", (error) => {
        if (isBrokenPipeError(error)) {
          markBroken(stream);
          return;
        }
        throw error;
      });
    }

    if (typeof stream.write !== "function" || originalWrites.has(stream)) return;
    const originalWrite = stream.write;
    originalWrites.set(stream, originalWrite);
    stream.write = function guardedStdioWrite(...args) {
      const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      if (brokenStreams.has(stream)) {
        if (callback) process.nextTick(callback);
        return false;
      }
      try {
        return originalWrite.apply(this, args);
      } catch (error) {
        if (isBrokenPipeError(error)) {
          markBroken(stream);
          if (callback) process.nextTick(callback);
          return false;
        }
        throw error;
      }
    };
  };

  for (const stream of guardedStreams) {
    installStreamGuard(stream);
  }

  installedGuard = {
    isBrokenPipeError,
    isConsoleBrokenPipeError,
    isGuardedStream,
    isStreamBroken: (stream) => Boolean(stream && brokenStreams.has(stream)),
    shouldIgnoreUncaughtException
  };
  return installedGuard;
}

module.exports = {
  installStdioBrokenPipeGuard,
  isBrokenPipeError,
  isConsoleBrokenPipeError
};

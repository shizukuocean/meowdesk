const assert = require("assert");
const { EventEmitter } = require("events");
const {
  installStdioBrokenPipeGuard,
  isBrokenPipeError,
  isConsoleBrokenPipeError
} = require("../src/main/stdio-epipe-guard");

function createStream(writeImpl) {
  const stream = new EventEmitter();
  stream.write = writeImpl;
  return stream;
}

function makeError(code, message, stack = "") {
  const error = new Error(message);
  error.code = code;
  if (stack) error.stack = stack;
  return error;
}

async function main() {
  assert.strictEqual(isBrokenPipeError(makeError("EPIPE", "broken pipe")), true);
  assert.strictEqual(isBrokenPipeError(makeError("ENOENT", "missing")), false);
  assert.strictEqual(
    isConsoleBrokenPipeError(makeError("EPIPE", "broken pipe", "Error\n    at console.warn (node:internal/console/constructor:383:26)")),
    true
  );
  assert.strictEqual(
    isConsoleBrokenPipeError(makeError("EPIPE", "broken pipe", "Error\n    at writeNetworkFrame (app/network.js:10:1)")),
    false
  );

  let writes = 0;
  const brokenOnWrite = createStream(() => {
    writes += 1;
    throw makeError("EPIPE", "broken pipe");
  });
  const healthy = createStream(() => {
    writes += 1;
    return true;
  });
  const guard = installStdioBrokenPipeGuard({
    forceNew: true,
    stdout: brokenOnWrite,
    stderr: healthy
  });

  assert.strictEqual(brokenOnWrite.write("first"), false);
  assert.strictEqual(guard.isStreamBroken(brokenOnWrite), true);
  assert.strictEqual(brokenOnWrite.write("second"), false);
  assert.strictEqual(writes, 1, "broken stream should become a no-op after the first EPIPE");

  let callbackCalled = false;
  brokenOnWrite.write("third", () => {
    callbackCalled = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(callbackCalled, true, "callbacks on an already-broken stream should still settle");

  const nonPipe = createStream(() => {
    throw makeError("ENOENT", "not a pipe");
  });
  installStdioBrokenPipeGuard({
    forceNew: true,
    stdout: nonPipe,
    stderr: healthy
  });
  assert.throws(() => nonPipe.write("boom"), /not a pipe/);

  const asyncBroken = createStream(() => true);
  const asyncGuard = installStdioBrokenPipeGuard({
    forceNew: true,
    stdout: asyncBroken,
    stderr: healthy
  });
  asyncBroken.emit("error", makeError("EPIPE", "broken pipe"));
  assert.strictEqual(asyncGuard.isStreamBroken(asyncBroken), true);
  assert.strictEqual(asyncBroken.write("ignored"), false);

  console.log("stdio epipe guard contract OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

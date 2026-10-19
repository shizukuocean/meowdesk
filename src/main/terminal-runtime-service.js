const OWNERSHIP_FIELDS = [
  "runtimeId",
  "sessionId",
  "surfaceId",
  "conversationId",
  "agentId",
  "sourceId",
  "projectId"
];

function optionalOwnershipValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function ownershipScopeFromOptions(sessionId, tool, options = {}) {
  const nested = options.ownership && typeof options.ownership === "object" ? options.ownership : {};
  const ownership = {};
  for (const field of OWNERSHIP_FIELDS) {
    const value = optionalOwnershipValue(nested[field]) || optionalOwnershipValue(options[field]);
    if (value) ownership[field] = value;
  }
  if (!ownership.sessionId) ownership.sessionId = String(sessionId || "");
  if (!ownership.agentId && tool?.id) ownership.agentId = String(tool.id);
  return ownership;
}

function createTerminalRuntimeService({
  pty,
  BrowserWindow,
  resolveToolCwd,
  prepareAgentRuntime,
  meodeskRuntimeEnv,
  withWorkshopRuntimeArgs,
  withWslRuntimeArgs,
  launchCommandSpec,
  packagedAgentResourceBlockReason,
  normalizeTerminalSpawnDimension,
  sendTerminalEvent,
  recordTerminalSourceAdapterInput,
  startTerminalSourceAdapter,
  stopTerminalSourceAdapter,
  isQuitting
}) {
  const terminals = new Map();
  const terminalRuntimeMetadata = new Map();

  function sessionIsQuitting() {
    return typeof isQuitting === "function" ? isQuitting() : Boolean(isQuitting);
  }

  function has(id) {
    return terminals.has(id);
  }

  function killTerminalById(id) {
    const terminal = terminals.get(id);
    if (!terminal) {
      const hadMetadata = terminalRuntimeMetadata.delete(id);
      if (hadMetadata) stopTerminalSourceAdapter(id);
      return { ok: true, active: false, killed: false, cleanedMetadata: hadMetadata };
    }
    terminals.delete(id);
    terminalRuntimeMetadata.delete(id);
    stopTerminalSourceAdapter(id);
    let killed = true;
    try {
      terminal.kill();
    } catch {
      killed = false;
      // The process may already be gone while Electron is closing.
    }
    return { ok: true, active: false, killed };
  }

  function killAllTerminals() {
    let count = 0;
    const ids = new Set([...terminalRuntimeMetadata.keys(), ...terminals.keys()]);
    for (const id of ids) {
      const result = killTerminalById(id);
      if (result?.killed || result?.cleanedMetadata) count += 1;
    }
    return { ok: true, active: false, count };
  }

  function runtimeDescriptors() {
    return [...terminalRuntimeMetadata.entries()].map(([sessionKey, metadata]) => ({
      id: metadata.ownership.runtimeId || sessionKey,
      runtimeKey: sessionKey,
      sessionKey,
      toolId: metadata.tool?.id,
      owner: "agent-runtime-manager",
      status: terminals.has(sessionKey) ? "running" : "exited",
      attachStatus: terminals.has(sessionKey) ? "reattachable" : "unavailable",
      cwd: metadata.cwd,
      startedAt: metadata.startedAt,
      ...metadata.ownership
    }));
  }

  function spawnTerminal(win, sessionId, tool, options = {}) {
    let replaceResult = null;
    if (terminals.has(sessionId)) {
      if (!tool?.replaceExisting) {
        return { ok: true, active: true, reused: true, sessionId };
      }
      replaceResult = killTerminalById(sessionId);
    }

    const cwd = resolveToolCwd(tool);
    const runtime = prepareAgentRuntime(sessionId, tool, cwd, options);
    const env = {
      ...process.env,
      ...(tool.env || {}),
      ...meodeskRuntimeEnv(runtime),
      TERM: "xterm-256color",
      COLORTERM: "truecolor"
    };
    delete env.NO_COLOR;
    delete env.NODE_DISABLE_COLORS;
    const rawArgs = (tool.args || []).filter((arg) => arg !== undefined && arg !== null).map(String);
    const workshopArgs = withWorkshopRuntimeArgs(tool.command, rawArgs, runtime);
    const runtimeArgs = withWslRuntimeArgs(tool.command, workshopArgs, runtime);
    const launch = launchCommandSpec(tool.command, runtimeArgs, cwd);
    if (!launch.resolved) {
      throw new Error([
        `Failed to start ${tool.name || tool.id}.`,
        "未在 PATH、系统环境变量或常见 CLI 安装目录中找到启动命令。",
        "如果这个 Agent 是通过 npm 全局安装，请确认安装完成后重新启动 Meowdesk；也可以在设置里填写 CLI 的完整路径。",
        `Command: ${tool.command}`,
        `Args: ${runtimeArgs.join(" ") || "(none)"}`,
        `CWD: ${cwd}`
      ].join("\n"));
    }
    const blockedReason = packagedAgentResourceBlockReason(tool.command, launch.resolved);
    if (blockedReason) {
      throw new Error([
        `Failed to start ${tool.name || tool.id}.`,
        blockedReason,
        `Command: ${tool.command}`,
        `Resolved: ${launch.resolved || "(not found)"}`,
        `CWD: ${cwd}`
      ].join("\n"));
    }
    const initialCols = normalizeTerminalSpawnDimension(options.cols, 100, 20, 240);
    const initialRows = normalizeTerminalSpawnDimension(options.rows, 30, 8, 80);
    let shell;
    const smokeWindowsPtyOptions = process.platform === "win32" && process.env.MEOWDESK_RENDERER_SMOKE === "1"
      ? { useConptyDll: true }
      : {};
    try {
      shell = pty.spawn(launch.command, launch.args, {
        name: "xterm-256color",
        cols: initialCols,
        rows: initialRows,
        cwd,
        env,
        ...smokeWindowsPtyOptions
      });
    } catch (error) {
      const message = [
        `Failed to start ${tool.name || tool.id}.`,
        `Command: ${tool.command}`,
        `Resolved: ${launch.resolved || "(not found)"}`,
        `Launch: ${launch.command} ${launch.args.join(" ") || ""}`.trim(),
        `Args: ${runtimeArgs.join(" ") || "(none)"}`,
        `CWD: ${cwd}`,
        `Error: ${error.message || error}`
      ].join("\n");
      throw new Error(message);
    }

    terminals.set(sessionId, shell);
    const ownership = ownershipScopeFromOptions(sessionId, tool, options);
    terminalRuntimeMetadata.set(sessionId, {
      win,
      tool,
      cwd,
      startedAt: Date.now(),
      ownership
    });

    try {
      if (options.sourceAdapter === true) {
        const metadata = terminalRuntimeMetadata.get(sessionId);
        startTerminalSourceAdapter(metadata.win, sessionId, metadata.tool, metadata.cwd, metadata.startedAt, metadata.ownership);
      }
      shell.onData((data) => {
        if (sessionIsQuitting()) return;
        const metadata = terminalRuntimeMetadata.get(sessionId);
        sendTerminalEvent(win, "terminal:data", {
          ...(metadata?.ownership || ownership),
          id: sessionId,
          toolId: tool.id,
          data
        });
      });
      shell.onExit(({ exitCode }) => {
        const metadata = terminalRuntimeMetadata.get(sessionId);
        terminals.delete(sessionId);
        terminalRuntimeMetadata.delete(sessionId);
        stopTerminalSourceAdapter(sessionId);
        if (sessionIsQuitting()) return;
        sendTerminalEvent(win, "terminal:exit", {
          ...(metadata?.ownership || ownership),
          id: sessionId,
          toolId: tool.id,
          exitCode
        });
      });
    } catch (error) {
      terminals.delete(sessionId);
      terminalRuntimeMetadata.delete(sessionId);
      stopTerminalSourceAdapter(sessionId);
      try {
        shell.kill();
      } catch {
        // Ignore cleanup errors after a partially wired terminal spawn.
      }
      throw error;
    }

    return {
      ok: true,
      active: true,
      sessionId,
      runtimeId: ownership.runtimeId || sessionId,
      replaced: Boolean(replaceResult?.killed)
    };
  }

  function setSourceAdapter(event, payload) {
    const input = payload && typeof payload === "object" ? payload : {};
    const id = String(input.id || "");
    const enabled = input.enabled === true;
    if (!id) throw new Error("Missing terminal session id.");
    if (!terminals.has(id)) return { ok: true, active: false };
    if (!enabled) {
      stopTerminalSourceAdapter(id);
      return { ok: true, active: false };
    }
    const metadata = terminalRuntimeMetadata.get(id);
    if (!metadata) return { ok: true, active: false };
    const win = metadata.win && !metadata.win.isDestroyed()
      ? metadata.win
      : BrowserWindow.fromWebContents(event.sender);
    startTerminalSourceAdapter(win, id, metadata.tool, metadata.cwd, metadata.startedAt, metadata.ownership);
    return { ok: true, active: true };
  }

  function write(id, data) {
    const terminal = terminals.get(id);
    if (!terminal) return;
    if (typeof recordTerminalSourceAdapterInput === "function") {
      recordTerminalSourceAdapterInput(id, data);
    }
    try {
      terminal.write(data);
    } catch {
      // Ignore late input while a process is exiting.
    }
  }

  function resize(id, cols, rows) {
    const terminal = terminals.get(id);
    if (!terminal) return;
    try {
      terminal.resize(cols, rows);
    } catch {
      // Ignore late resize calls while a pane or window is being torn down.
    }
  }

  return {
    has,
    runtimeDescriptors,
    spawnTerminal,
    killTerminalById,
    killAllTerminals,
    setSourceAdapter,
    write,
    resize
  };
}

module.exports = {
  createTerminalRuntimeService
};

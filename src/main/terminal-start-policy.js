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

function ownershipScopeFromInput(input) {
  const nested = input?.ownership && typeof input.ownership === "object" ? input.ownership : {};
  const ownership = {};
  for (const field of OWNERSHIP_FIELDS) {
    const value = optionalOwnershipValue(nested[field]) || optionalOwnershipValue(input?.[field]);
    if (value) ownership[field] = value;
  }
  return ownership;
}

function createTerminalStartHandler({
  BrowserWindow,
  loadConfig,
  normalizeTerminalSessionTool,
  spawnTerminal
}) {
  if (!BrowserWindow || typeof BrowserWindow.fromWebContents !== "function") {
    throw new Error("createTerminalStartHandler requires BrowserWindow.");
  }
  if (typeof loadConfig !== "function") throw new Error("createTerminalStartHandler requires loadConfig.");
  if (typeof normalizeTerminalSessionTool !== "function") throw new Error("createTerminalStartHandler requires normalizeTerminalSessionTool.");
  if (typeof spawnTerminal !== "function") throw new Error("createTerminalStartHandler requires spawnTerminal.");

  return function handleTerminalStart(event, payload) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const config = loadConfig();
    const toolId = typeof payload === "string" ? payload : payload?.toolId;
    const sessionId = typeof payload === "string" ? payload : payload?.sessionId;
    const baseTool = (config.tools || []).find((item) => item.id === toolId);
    if (!baseTool) throw new Error(`Unknown tool: ${toolId}`);
    if (!sessionId) throw new Error("Missing terminal session id.");
    const input = payload && typeof payload === "object" ? payload : {};
    const tool = normalizeTerminalSessionTool(baseTool, input.toolOverride || null);
    const ownership = ownershipScopeFromInput(input);
    spawnTerminal(win, sessionId, tool, {
      workshop: input.workshop,
      cols: input.cols,
      rows: input.rows,
      sourceAdapter: input.sourceAdapter === true,
      ownership
    });
    return true;
  };
}

module.exports = {
  createTerminalStartHandler
};

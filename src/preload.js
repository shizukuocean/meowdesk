const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workbench", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  getStorageInfo: () => ipcRenderer.invoke("storage:getInfo"),
  readStorage: (key) => ipcRenderer.invoke("storage:read", key),
  writeStorage: (key, value) => ipcRenderer.invoke("storage:write", { key, value }),
  deleteStorage: (key) => ipcRenderer.invoke("storage:delete", key),
  pickObsidianVault: () => ipcRenderer.invoke("obsidian:pickVault"),
  listObsidianFiles: (vaultPath) => ipcRenderer.invoke("obsidian:listFiles", vaultPath),
  readObsidianFile: (filePath) => ipcRenderer.invoke("obsidian:readFile", filePath),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
  writeClipboardText: (text) => ipcRenderer.invoke("clipboard:writeText", text),
  readClipboardText: () => ipcRenderer.invoke("clipboard:readText"),
  getAgentInterfaceInfo: (payload) => ipcRenderer.invoke("agentInterface:getInfo", payload),
  createWorkshopProject: (payload) => ipcRenderer.invoke("workshop:createProject", payload),
  markWorkshopProjectReady: (payload) => ipcRenderer.invoke("workshop:markProjectReady", payload),
  exportMeowPackage: (payload) => ipcRenderer.invoke("workshop:exportMeowPackage", payload),
  importMeowPackage: (payload) => ipcRenderer.invoke("workshop:importMeowPackage", payload),
  mirrorConversation: (payload) => ipcRenderer.invoke("conversations:mirror", payload),
  deleteConversationMirror: (payload) => ipcRenderer.invoke("conversations:deleteMirror", payload),
  onConversationsChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("conversations:changed", listener);
    return () => ipcRenderer.removeListener("conversations:changed", listener);
  },
  getAgentPresets: () => ipcRenderer.invoke("tools:getAgentPresets"),
  testToolCommand: (payload) => ipcRenderer.invoke("tools:testCommand", payload),
  addUserTool: (payload) => ipcRenderer.invoke("tools:addUserTool", payload),
  deleteUserTool: (toolId) => ipcRenderer.invoke("tools:deleteUserTool", toolId),
  listPets: () => ipcRenderer.invoke("pets:list"),
  installPet: (slug) => ipcRenderer.invoke("pets:install", slug),
  deletePet: (slug) => ipcRenderer.invoke("pets:delete", slug),
  listAgentRuntimes: () => ipcRenderer.invoke("agentRuntime:list"),
  startTerminal: (payload) => ipcRenderer.invoke("terminal:start", payload),
  setTerminalSourceAdapter: (payload) => ipcRenderer.invoke("terminal:setSourceAdapter", payload),
  writeTerminal: (id, data) => ipcRenderer.send("terminal:write", { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send("terminal:resize", { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.send("terminal:kill", id),
  onTerminalData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  }
});

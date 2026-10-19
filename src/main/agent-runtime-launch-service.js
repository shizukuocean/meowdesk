"use strict";

function commandLooksLikeClaude(command, args = []) {
  const text = [command, ...args].join(" ").toLowerCase();
  return /(^|[\\/\s])claude(?:\.cmd|\.exe)?(?:\s|$)/.test(text);
}

function commandLooksLikeHermes(command, args = []) {
  const text = String(command || "").toLowerCase();
  return /(^|[\\/\s])hermes(?:\.cmd|\.exe)?(?:\s|$)/.test(text);
}

function shellCommandLooksLikeHermes(command) {
  return /(^|[\s;&|])(?:[\w./~-]+\/)?hermes(?:\.cmd|\.exe)?(?=\s|$)/i.test(String(command || ""));
}

function withHermesSkillArgs(args, skillDir, mapPath = (value) => value) {
  const skillPath = mapPath(skillDir);
  if (!skillPath) return args;
  if (args.some((arg) => String(arg) === skillPath)) return args;
  return ["--skills", skillPath, ...args];
}

function withHermesSkillShellCommand(command, skillDir) {
  const text = String(command || "");
  if (!skillDir || !shellCommandLooksLikeHermes(text)) return text;
  const skillPath = windowsPathToWslPath(skillDir);
  if (!skillPath || text.includes(skillPath)) return text;
  return text.replace(
    /(^|[\s;&|])((?:[\w./~-]+\/)?hermes(?:\.cmd|\.exe)?)(?=\s|$)/i,
    (_match, prefix, executable) => `${prefix}${executable} --skills ${shellQuote(skillPath)}`
  );
}

function withWorkshopRuntimeArgs(command, args, runtime) {
  if (!runtime?.workshop?.enabled) return args;
  if (commandLooksLikeClaude(command, args)) {
    const hasExplicitSystemPrompt = args.includes("--system-prompt") || args.includes("--system-prompt-file");
    const promptFile = runtime.workshop.systemPromptFile;
    const nextArgs = [...args];
    if (!hasExplicitSystemPrompt && promptFile && !nextArgs.includes(promptFile)) {
      nextArgs.unshift("--append-system-prompt-file", promptFile);
    }
    return nextArgs;
  }
  if (commandLooksLikeHermes(command, args)) return withHermesSkillArgs(args, runtime.workshop.sessionSkillDir);
  return args;
}

function meodeskRuntimeEnv(runtime, toolEnv = {}) {
  const env = {
    MEODESK: "1",
    MEODESK_PROTOCOL_VERSION: runtime.protocolVersion,
    MEODESK_AGENT_ID: runtime.agentId,
    MEODESK_AGENT_NAME: runtime.agentName,
    MEODESK_AGENT_KIND: runtime.agentKind,
    MEODESK_PANE_ID: runtime.paneId,
    MEODESK_INTERFACE_DIR: runtime.interfaceDir,
    MEODESK_CONTEXT_FILE: runtime.contextFile,
    MEODESK_RUNTIME_FILE: runtime.runtimeFile,
    MEODESK_INBOX_DIR: runtime.inboxDir,
    MEODESK_PROPOSALS_DIR: runtime.proposalsDir,
    MEODESK_CONVERSATIONS_DIR: runtime.conversationsDir,
    MEODESK_EXTENSIONS_DIR: runtime.extensionsDir,
    MEODESK_NODES_DIR: runtime.nodesDir,
    MEODESK_SKILLS_DIR: runtime.skillsDir,
    MEODESK_BUNDLED_SKILLS_DIR: runtime.bundledSkillsDir,
    MEODESK_TASK_SCHEMA: runtime.schemas.task,
    MEODESK_CONVERSATION_SCHEMA: runtime.schemas.conversation,
    MEODESK_AGENT_NODE_CARD_SCHEMA: runtime.schemas.agentNodeCard,
    MEODESK_FEATURE_PROPOSAL_SCHEMA: runtime.schemas.featureProposal,
    MEODESK_EXTENSION_MANIFEST_SCHEMA: runtime.schemas.extensionManifest,
    MEODESK_MEOW_PACKAGE_SCHEMA: runtime.schemas.meowPackage,
    MEODESK_MEOW_PACKAGE_SPEC: runtime.schemas.meowPackageSpec,
    MEODESK_TASK_PROTOCOL: runtime.protocols.task,
    MEODESK_CONVERSATION_PROTOCOL: runtime.protocols.conversation,
    MEODESK_PET_PROTOCOL: runtime.protocols.pet,
    MEODESK_WORKSHOP_SESSION_SKILL: runtime.workshop?.sessionSkillDir || "",
    MEODESK_WORKSHOP_SYSTEM_PROMPT_FILE: runtime.workshop?.systemPromptFile || "",
    MEODESK_WORKSHOP_RULES_FILE: runtime.workshop?.rulesFile || "",
    MEODESK_WORKSHOP_TYPE: runtime.workshop?.type || "",
    MEODESK_WORKSHOP_LABEL: runtime.workshop?.label || "",
    MEODESK_WORKSHOP_TARGET: runtime.workshop?.target || "",
    MEODESK_WORKSHOP_PROJECT_ID: runtime.workshop?.projectId || "",
    MEODESK_WORKSHOP_PROJECT_NAME: runtime.workshop?.projectName || "",
    MEODESK_WORKSHOP_PROJECT_PATH: runtime.workshop?.projectPath || "",
    MEODESK_WORKSHOP_MANIFEST_PATH: runtime.workshop?.manifestPath || "",
    MEODESK_WORKSHOP_ENTRY_PATH: runtime.workshop?.entryPath || "",
    MEODESK_WORKSHOP_ENTRY: runtime.workshop?.entry || "",
    MEODESK_WORKSHOP_STATUS: runtime.workshop?.status || "",
    MEODESK_WORKSHOP_VERSION: runtime.workshop?.version || "",
    MEODESK_WORKSHOP_RUNTIME: runtime.workshop?.runtime || ""
  };
  return Object.fromEntries(
    Object.entries({ ...toolEnv, ...env })
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function windowsPathToWslPath(value) {
  const text = String(value || "");
  const match = text.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) return text.replace(/\\/g, "/");
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "'\\''")}'`;
}

function wslRuntimeEnv(runtime) {
  return {
    MEODESK: "1",
    MEODESK_PROTOCOL_VERSION: runtime.protocolVersion,
    MEODESK_AGENT_ID: runtime.agentId,
    MEODESK_AGENT_NAME: runtime.agentName,
    MEODESK_AGENT_KIND: runtime.agentKind,
    MEODESK_PANE_ID: runtime.paneId,
    MEODESK_INTERFACE_DIR: windowsPathToWslPath(runtime.interfaceDir),
    MEODESK_CONTEXT_FILE: windowsPathToWslPath(runtime.contextFile),
    MEODESK_RUNTIME_FILE: windowsPathToWslPath(runtime.runtimeFile),
    MEODESK_INBOX_DIR: windowsPathToWslPath(runtime.inboxDir),
    MEODESK_PROPOSALS_DIR: windowsPathToWslPath(runtime.proposalsDir),
    MEODESK_CONVERSATIONS_DIR: windowsPathToWslPath(runtime.conversationsDir),
    MEODESK_EXTENSIONS_DIR: windowsPathToWslPath(runtime.extensionsDir),
    MEODESK_NODES_DIR: windowsPathToWslPath(runtime.nodesDir),
    MEODESK_SKILLS_DIR: windowsPathToWslPath(runtime.skillsDir),
    MEODESK_BUNDLED_SKILLS_DIR: windowsPathToWslPath(runtime.bundledSkillsDir),
    MEODESK_TASK_SCHEMA: windowsPathToWslPath(runtime.schemas.task),
    MEODESK_CONVERSATION_SCHEMA: windowsPathToWslPath(runtime.schemas.conversation),
    MEODESK_AGENT_NODE_CARD_SCHEMA: windowsPathToWslPath(runtime.schemas.agentNodeCard),
    MEODESK_FEATURE_PROPOSAL_SCHEMA: windowsPathToWslPath(runtime.schemas.featureProposal),
    MEODESK_EXTENSION_MANIFEST_SCHEMA: windowsPathToWslPath(runtime.schemas.extensionManifest),
    MEODESK_MEOW_PACKAGE_SCHEMA: windowsPathToWslPath(runtime.schemas.meowPackage),
    MEODESK_MEOW_PACKAGE_SPEC: windowsPathToWslPath(runtime.schemas.meowPackageSpec),
    MEODESK_TASK_PROTOCOL: runtime.protocols.task,
    MEODESK_CONVERSATION_PROTOCOL: runtime.protocols.conversation,
    MEODESK_PET_PROTOCOL: runtime.protocols.pet,
    MEODESK_WORKSHOP_SESSION_SKILL: runtime.workshop?.sessionSkillDir ? windowsPathToWslPath(runtime.workshop.sessionSkillDir) : "",
    MEODESK_WORKSHOP_SYSTEM_PROMPT_FILE: runtime.workshop?.systemPromptFile ? windowsPathToWslPath(runtime.workshop.systemPromptFile) : "",
    MEODESK_WORKSHOP_RULES_FILE: runtime.workshop?.rulesFile ? windowsPathToWslPath(runtime.workshop.rulesFile) : "",
    MEODESK_WORKSHOP_TYPE: runtime.workshop?.type || "",
    MEODESK_WORKSHOP_LABEL: runtime.workshop?.label || "",
    MEODESK_WORKSHOP_TARGET: runtime.workshop?.target || "",
    MEODESK_WORKSHOP_PROJECT_ID: runtime.workshop?.projectId || "",
    MEODESK_WORKSHOP_PROJECT_NAME: runtime.workshop?.projectName || "",
    MEODESK_WORKSHOP_PROJECT_PATH: runtime.workshop?.projectPath ? windowsPathToWslPath(runtime.workshop.projectPath) : "",
    MEODESK_WORKSHOP_MANIFEST_PATH: runtime.workshop?.manifestPath ? windowsPathToWslPath(runtime.workshop.manifestPath) : "",
    MEODESK_WORKSHOP_ENTRY_PATH: runtime.workshop?.entryPath ? windowsPathToWslPath(runtime.workshop.entryPath) : "",
    MEODESK_WORKSHOP_ENTRY: runtime.workshop?.entry || "",
    MEODESK_WORKSHOP_STATUS: runtime.workshop?.status || "",
    MEODESK_WORKSHOP_VERSION: runtime.workshop?.version || "",
    MEODESK_WORKSHOP_RUNTIME: runtime.workshop?.runtime || ""
  };
}

function withWslRuntimeArgs(command, args, runtime) {
  const executable = String(command || "").toLowerCase();
  if (!/(^|\\|\/)wsl(\.exe)?$/.test(executable)) return args;
  const shellIndex = args.findIndex((arg, index) => String(arg).toLowerCase() === "bash" && args[index + 1] === "-lc");
  if (shellIndex < 0 || shellIndex + 2 >= args.length) return args;
  const originalCommand = String(args[shellIndex + 2] || "");
  const workshopCommand = withHermesSkillShellCommand(originalCommand, runtime.workshop?.sessionSkillDir);
  const exports = Object.entries(wslRuntimeEnv(runtime))
    .map(([key, value]) => `export ${key}=${shellQuote(value)};`)
    .join(" ");
  const nextArgs = [...args];
  nextArgs[shellIndex + 2] = `${exports} ${workshopCommand}`;
  return nextArgs;
}

module.exports = {
  commandLooksLikeClaude,
  commandLooksLikeHermes,
  meodeskRuntimeEnv,
  shellQuote,
  withHermesSkillArgs,
  withHermesSkillShellCommand,
  withWorkshopRuntimeArgs,
  withWslRuntimeArgs,
  windowsPathToWslPath
};

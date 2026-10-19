import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspaceRendererNormalizeUserText } from "./meow-viewer-parser";
import type { WorkspaceRendererProfile } from "./meow-viewer-contract";
import { meowViewerCommandsForProfile } from "./meow-viewer-commands";

type MeowViewerComposerSurface = "workspace" | "studio";

type MeowViewerComposerProps = {
  surface: MeowViewerComposerSurface;
  profile: WorkspaceRendererProfile;
  targetName: string;
  running: boolean;
  canSend?: boolean;
  permissionSlot?: ReactNode;
  className?: string;
  onSendText: (text: string) => void;
};

function surfaceAttr(surface: MeowViewerComposerSurface, name: string, value: string | boolean = true) {
  const prefix = surface === "studio" ? "data-studio-meow-viewer" : "data-r2-output-renderer";
  return { [`${prefix}-${name}`]: value };
}

export function MeowViewerComposer({
  surface,
  profile,
  targetName,
  running,
  canSend,
  permissionSlot,
  className = "",
  onSendText
}: MeowViewerComposerProps) {
  const [inputValue, setInputValue] = useState("");
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  const commandToggleRef = useRef<HTMLButtonElement>(null);
  const commands = meowViewerCommandsForProfile(profile);
  const sendEnabled = running && Boolean(inputValue.trim()) && (canSend ?? true);

  useEffect(() => {
    if (!commandMenuOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (commandMenuRef.current?.contains(target) || commandToggleRef.current?.contains(target)) return;
      setCommandMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [commandMenuOpen]);

  const sendText = (value: string) => {
    const text = workspaceRendererNormalizeUserText(value);
    if (!text || !running) return;
    onSendText(text);
  };

  const handleSend = () => {
    sendText(inputValue);
    setInputValue("");
  };

  const handleCommandSend = (command: string) => {
    sendText(command);
    setCommandMenuOpen(false);
    setInputValue("");
  };

  return (
    <form
      className={`meowdesk-output-renderer-composer ${className}`.trim()}
      {...surfaceAttr(surface, "composer")}
      onSubmit={(event) => {
        event.preventDefault();
        handleSend();
      }}
    >
      {permissionSlot}
      <textarea
        value={inputValue}
        rows={1}
        disabled={!running}
        placeholder={running ? `发送给 ${targetName}` : `${targetName} 未运行`}
        {...surfaceAttr(surface, "input")}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          handleSend();
        }}
      />
      <Button
        ref={commandToggleRef}
        type="button"
        variant="outline"
        size="icon"
        disabled={!running}
        title="Agent 命令"
        aria-label="Agent 命令"
        {...surfaceAttr(surface, "command-toggle")}
        onClick={() => setCommandMenuOpen((current) => !current)}
      >
        <Terminal size={14} aria-hidden="true" />
      </Button>
      {commandMenuOpen ? (
        <div
          ref={commandMenuRef}
          className={`meowdesk-output-renderer-command-menu ${surface === "studio" ? "meowdesk-studio-meow-viewer-command-menu" : ""}`.trim()}
          {...surfaceAttr(surface, "command-menu")}
        >
          <div className="meowdesk-output-renderer-command-head">
            <strong>{profile === "claude" ? "Claude 命令" : profile === "hermes" ? "Hermes 命令" : "Agent 命令"}</strong>
            <span>点击发送到当前 CLI</span>
          </div>
          {commands.map((item) => (
            <button
              key={item.command}
              type="button"
              className="meowdesk-output-renderer-command-item"
              onClick={() => handleCommandSend(item.command)}
              {...surfaceAttr(surface, "command", item.command)}
            >
              <code>{item.command}</code>
              <span>
                <strong>{item.label}</strong>
                <b>{item.description}</b>
              </span>
              <em>发送</em>
            </button>
          ))}
        </div>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="icon"
        disabled={!sendEnabled}
        title="发送"
        aria-label="发送"
        {...surfaceAttr(surface, "send")}
      >
        <Send size={15} aria-hidden="true" />
      </Button>
    </form>
  );
}

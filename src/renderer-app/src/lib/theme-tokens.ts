export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";
export type ThemeDensity = "compact" | "default" | "comfortable";
export type ThemeFontScale = "small" | "default" | "large";

export type ThemeSemanticColorToken =
  | "background"
  | "surface"
  | "surfaceRaised"
  | "border"
  | "text"
  | "textMuted"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "agentMessage"
  | "userMessage"
  | "toolOutput"
  | "codeBlock";

export type ThemePreset = {
  id: string;
  name: string;
  mode: ThemeMode;
  accentColor: string;
  density: ThemeDensity;
  fontScale: ThemeFontScale;
  colors: Partial<Record<ThemeSemanticColorToken, string>>;
};

export const defaultThemePreset: ThemePreset = {
  id: "meowdesk-default",
  name: "Meowdesk Default",
  mode: "dark",
  accentColor: "#7dd3fc",
  density: "default",
  fontScale: "default",
  colors: {}
};

export const THEME_MODE_STORAGE_KEY = "meowdesk.theme";
export const THEME_PRESET_STORAGE_KEY = "meowdesk.themePreset.v1";

export function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "system" ? value : "dark";
}

export function normalizeResolvedThemeMode(value: unknown): ResolvedThemeMode {
  return value === "light" ? "light" : "dark";
}

export function resolveThemeMode(mode: ThemeMode, systemDark = true): ResolvedThemeMode {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

export function normalizeThemeDensity(value: unknown): ThemeDensity {
  return value === "compact" || value === "comfortable" ? value : "default";
}

export function normalizeThemeFontScale(value: unknown): ThemeFontScale {
  return value === "small" || value === "large" ? value : "default";
}

export function normalizeThemePreset(value: unknown): ThemePreset {
  if (!value || typeof value !== "object") return defaultThemePreset;
  const record = value as Record<string, unknown>;
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id : defaultThemePreset.id,
    name: typeof record.name === "string" && record.name.trim() ? record.name : defaultThemePreset.name,
    mode: normalizeThemeMode(record.mode),
    accentColor: typeof record.accentColor === "string" && record.accentColor.trim()
      ? record.accentColor
      : defaultThemePreset.accentColor,
    density: normalizeThemeDensity(record.density),
    fontScale: normalizeThemeFontScale(record.fontScale),
    colors: record.colors && typeof record.colors === "object"
      ? record.colors as Partial<Record<ThemeSemanticColorToken, string>>
      : {}
  };
}

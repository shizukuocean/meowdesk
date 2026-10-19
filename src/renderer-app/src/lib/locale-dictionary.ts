export type LocaleCode = "zh-CN" | "en-US";

export type LocaleDictionary = {
  locale: LocaleCode;
  labels: Record<string, string>;
};

export const defaultLocale: LocaleCode = "zh-CN";
export const LOCALE_STORAGE_KEY = "meowdesk.locale";

export const localeDictionaries: Record<LocaleCode, LocaleDictionary> = {
  "zh-CN": {
    locale: "zh-CN",
    labels: {
      "route.lobby": "大厅",
      "route.workspace": "工作区",
      "route.studio": "工坊",
      "route.conversations": "对话管理",
      "action.reattach": "接回聊天",
      "action.keepRuntime": "保留后台会话"
    }
  },
  "en-US": {
    locale: "en-US",
    labels: {
      "route.lobby": "Meow Lobby",
      "route.workspace": "Meow Room",
      "route.studio": "Meow Studio",
      "route.conversations": "Conversations",
      "action.reattach": "Reattach chat",
      "action.keepRuntime": "Keep runtime"
    }
  }
};

export function normalizeLocaleCode(value: unknown): LocaleCode {
  return value === "en-US" ? "en-US" : defaultLocale;
}

export function localeLabel(locale: LocaleCode, key: string) {
  const normalized = normalizeLocaleCode(locale);
  return localeDictionaries[normalized]?.labels[key] || localeDictionaries[defaultLocale].labels[key] || key;
}

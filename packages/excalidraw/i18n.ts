import { isDevEnv } from "@excalidraw/common";

import type { NestedKeyOf } from "@excalidraw/common/utility-types";

import { useAtomValue, editorJotaiStore, atom } from "./editor-jotai";
import rawEnLocale from "./locales/en.json";
import percentages from "./locales/percentages.json";

/**
 * Detect the loaded locale object (flat JSON root), not an ESM module wrapper.
 * If we see these keys, we must not peel `default` — that would follow a real
 * locale namespace key named `default` and break lookups like `codeBlock.*`.
 */
const hasLocaleRootKeys = (mod: unknown): boolean => {
  if (!mod || typeof mod !== "object" || Array.isArray(mod)) {
    return false;
  }
  const record = mod as Record<string, unknown>;
  return (
    "labels" in record ||
    "codeBlock" in record ||
    "buttons" in record ||
    "toolBar" in record ||
    "alerts" in record
  );
};

/**
 * True when `mod` is an ESM module object whose `default` is (or wraps) the flat
 * locale JSON — not the locale object itself.
 */
const isEsmJsonModuleShell = (mod: unknown): mod is { default: object } => {
  if (!mod || typeof mod !== "object" || Array.isArray(mod)) {
    return false;
  }
  const record = mod as Record<string, unknown>;
  if (hasLocaleRootKeys(record)) {
    return false;
  }
  if (!("default" in record) || record.default === undefined) {
    return false;
  }
  if (
    typeof record.default !== "object" ||
    record.default === null ||
    Array.isArray(record.default)
  ) {
    return false;
  }
  const inner = record.default as Record<string, unknown>;
  if (hasLocaleRootKeys(inner)) {
    return true;
  }
  // Double-wrapped: { default: { default: locale } }
  return "default" in inner;
};

const unwrapJsonLocaleModule = <T>(mod: T): T => {
  let cur: unknown = mod;
  while (isEsmJsonModuleShell(cur)) {
    cur = (cur as { default: unknown }).default;
  }
  return cur as T;
};

const fallbackLangData = unwrapJsonLocaleModule(rawEnLocale);

const COMPLETION_THRESHOLD = 85;

export interface Language {
  code: string;
  label: string;
  rtl?: boolean;
}

export type TranslationKeys = NestedKeyOf<typeof fallbackLangData>;

export const defaultLang = { code: "en", label: "English" };

export const languages: Language[] = [
  defaultLang,
  ...[
    { code: "ar-SA", label: "العربية", rtl: true },
    { code: "bg-BG", label: "Български" },
    { code: "ca-ES", label: "Català" },
    { code: "cs-CZ", label: "Česky" },
    { code: "de-DE", label: "Deutsch" },
    { code: "el-GR", label: "Ελληνικά" },
    { code: "es-ES", label: "Español" },
    { code: "eu-ES", label: "Euskara" },
    { code: "fa-IR", label: "فارسی", rtl: true },
    { code: "fi-FI", label: "Suomi" },
    { code: "fr-FR", label: "Français" },
    { code: "gl-ES", label: "Galego" },
    { code: "he-IL", label: "עברית", rtl: true },
    { code: "hi-IN", label: "हिन्दी" },
    { code: "hu-HU", label: "Magyar" },
    { code: "id-ID", label: "Bahasa Indonesia" },
    { code: "it-IT", label: "Italiano" },
    { code: "ja-JP", label: "日本語" },
    { code: "kab-KAB", label: "Taqbaylit" },
    { code: "kk-KZ", label: "Қазақ тілі" },
    { code: "ko-KR", label: "한국어" },
    { code: "ku-TR", label: "Kurdî" },
    { code: "lt-LT", label: "Lietuvių" },
    { code: "lv-LV", label: "Latviešu" },
    { code: "my-MM", label: "Burmese" },
    { code: "nb-NO", label: "Norsk bokmål" },
    { code: "nl-NL", label: "Nederlands" },
    { code: "nn-NO", label: "Norsk nynorsk" },
    { code: "oc-FR", label: "Occitan" },
    { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
    { code: "pl-PL", label: "Polski" },
    { code: "pt-BR", label: "Português Brasileiro" },
    { code: "pt-PT", label: "Português" },
    { code: "ro-RO", label: "Română" },
    { code: "ru-RU", label: "Русский" },
    { code: "sk-SK", label: "Slovenčina" },
    { code: "sv-SE", label: "Svenska" },
    { code: "sl-SI", label: "Slovenščina" },
    { code: "tr-TR", label: "Türkçe" },
    { code: "uk-UA", label: "Українська" },
    { code: "zh-CN", label: "简体中文" },
    { code: "zh-TW", label: "繁體中文" },
    { code: "vi-VN", label: "Tiếng Việt" },
    { code: "mr-IN", label: "मराठी" },
  ]
    .filter(
      (lang) =>
        (percentages as Record<string, number>)[lang.code] >=
        COMPLETION_THRESHOLD,
    )
    .sort((left, right) => (left.label > right.label ? 1 : -1)),
];

const TEST_LANG_CODE = "__test__";
if (isDevEnv()) {
  languages.unshift(
    { code: TEST_LANG_CODE, label: "test language" },
    {
      code: `${TEST_LANG_CODE}.rtl`,
      label: "\u{202a}test language (rtl)\u{202c}",
      rtl: true,
    },
  );
}

let currentLang: Language = defaultLang;
let currentLangData: typeof fallbackLangData = fallbackLangData;

export const setLanguage = async (lang: Language) => {
  currentLang = lang;
  document.documentElement.dir = currentLang.rtl ? "rtl" : "ltr";
  document.documentElement.lang = currentLang.code;

  if (lang.code.startsWith(TEST_LANG_CODE)) {
    currentLangData = {} as typeof fallbackLangData;
  } else {
    try {
      const mod = await import(`./locales/${currentLang.code}.json`);
      currentLangData = unwrapJsonLocaleModule(mod) as typeof fallbackLangData;
    } catch (error: any) {
      console.error(`Failed to load language ${lang.code}:`, error.message);
      currentLangData = fallbackLangData;
    }
  }

  editorJotaiStore.set(editorLangCodeAtom, lang.code);
};

export const getLanguage = () => currentLang;

const findPartsForData = (data: any, parts: string[]) => {
  let node = unwrapJsonLocaleModule(data);
  for (let index = 0; index < parts.length; ++index) {
    const part = parts[index];
    if (node === undefined || node === null || typeof node !== "object") {
      return undefined;
    }
    if ((node as Record<string, unknown>)[part] === undefined) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "string") {
    return undefined;
  }
  return node;
};

export const t = (
  path: NestedKeyOf<typeof fallbackLangData>,
  replacement?: { [key: string]: string | number } | null,
  fallback?: string,
) => {
  if (currentLang.code.startsWith(TEST_LANG_CODE)) {
    const name = replacement
      ? `${path}(${JSON.stringify(replacement).slice(1, -1)})`
      : path;
    return `\u{202a}[[${name}]]\u{202c}`;
  }

  const parts = path.split(".");
  let translation =
    findPartsForData(currentLangData, parts) ||
    findPartsForData(fallbackLangData, parts) ||
    fallback;
  if (translation === undefined) {
    // Never throw: missing keys should not crash the editor (dev or prod).
    console.warn(`Can't find translation for ${path}`);
    return "";
  }

  if (replacement) {
    for (const key in replacement) {
      translation = translation.replace(`{{${key}}}`, String(replacement[key]));
    }
  }
  return translation;
};

/** @private atom used solely to rerender components using `useI18n` hook */
const editorLangCodeAtom = atom(defaultLang.code);

// Should be used in components that fall under these cases:
// - component is rendered as an <Excalidraw> child
// - component is rendered internally by <Excalidraw>, but the component
//   is memoized w/o being updated on `langCode`, `AppState`, or `UIAppState`
export const useI18n = () => {
  const langCode = useAtomValue(editorLangCodeAtom);
  return { t, langCode };
};

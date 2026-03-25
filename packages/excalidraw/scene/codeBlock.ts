import hljs from "highlight.js";

import { isEmbeddableElement } from "@excalidraw/element";

import type {
  ExcalidrawEmbeddableElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getDataURL } from "../data/blob";

import type { BinaryFileData, BinaryFiles } from "../types";

type CodeBlockStyle = {
  fontSize: number;
  language: string;
  wrap: boolean;
  lineNumbers: boolean;
  highlightSpec: string;
  highlightColor: "red" | "yellow" | "blue" | "green";
  highlightStyle: "outline" | "glow" | "filled";
  theme: "light" | "dark";
};

const DEFAULT_STYLE: CodeBlockStyle = {
  fontSize: 16,
  language: "typescript",
  wrap: false,
  lineNumbers: false,
  highlightSpec: "",
  highlightColor: "yellow",
  highlightStyle: "outline",
  theme: "light",
};

const CODE_BLOCK_PADDING_X = 6;
const CODE_BLOCK_PADDING_Y = 4;
const CODE_BLOCK_LINE_HEIGHT = 1.55;

const normalizeCodeLanguage = (language?: string | null) => {
  if (!language || typeof language !== "string") {
    return DEFAULT_STYLE.language;
  }

  const nextLanguage = language.trim().toLowerCase();
  if (!nextLanguage) {
    return DEFAULT_STYLE.language;
  }

  const aliasMap: Record<string, string> = {
    "c++": "cpp",
    cc: "cpp",
    cxx: "cpp",
    rs: "rust",
  };

  const normalizedLanguage = aliasMap[nextLanguage] || nextLanguage;

  return hljs.getLanguage(normalizedLanguage)
    ? normalizedLanguage
    : "plaintext";
};

const normalizeStyle = (
  style?: Partial<CodeBlockStyle> | null,
): CodeBlockStyle => ({
  fontSize:
    typeof style?.fontSize === "number" && Number.isFinite(style.fontSize)
      ? Math.min(Math.max(Math.round(style.fontSize), 12), 32)
      : DEFAULT_STYLE.fontSize,
  language: normalizeCodeLanguage(style?.language),
  wrap: typeof style?.wrap === "boolean" ? style.wrap : DEFAULT_STYLE.wrap,
  lineNumbers:
    typeof style?.lineNumbers === "boolean"
      ? style.lineNumbers
      : DEFAULT_STYLE.lineNumbers,
  highlightSpec:
    typeof style?.highlightSpec === "string" ? style.highlightSpec.trim() : "",
  highlightColor:
    style?.highlightColor === "red" ||
    style?.highlightColor === "yellow" ||
    style?.highlightColor === "blue" ||
    style?.highlightColor === "green"
      ? style.highlightColor
      : DEFAULT_STYLE.highlightColor,
  highlightStyle:
    style?.highlightStyle === "outline" ||
    style?.highlightStyle === "glow" ||
    style?.highlightStyle === "filled"
      ? style.highlightStyle
      : DEFAULT_STYLE.highlightStyle,
  theme: style?.theme === "light" ? "light" : DEFAULT_STYLE.theme,
});

const getCodeBlockData = (
  element: NonDeletedExcalidrawElement,
): {
  code: string;
  style: CodeBlockStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!isEmbeddableElement(element)) {
    return null;
  }

  const customData = element.customData as
    | {
        codeBlockType?: string;
        codeBlockSource?: string;
        codeBlockStyle?: Partial<CodeBlockStyle> | null;
        intrinsicWidth?: number;
        intrinsicHeight?: number;
      }
    | undefined;

  if (
    customData?.codeBlockType !== "code" ||
    typeof customData.codeBlockSource !== "string"
  ) {
    return null;
  }

  return {
    code: customData.codeBlockSource,
    style: normalizeStyle(customData.codeBlockStyle),
    intrinsicWidth:
      typeof customData.intrinsicWidth === "number"
        ? customData.intrinsicWidth
        : undefined,
    intrinsicHeight:
      typeof customData.intrinsicHeight === "number"
        ? customData.intrinsicHeight
        : undefined,
  };
};

const getCodeBlockLineCount = (code: string) =>
  Math.max(1, code.split(/\r?\n/).length);

const getCodeBlockLineNumberGutterWidth = (
  lineCount: number,
  fontSize: number,
) => Math.ceil(String(Math.max(1, lineCount)).length * fontSize * 0.62 + 16);

const getCodeBlockLineHeightPx = (fontSize: number) =>
  fontSize * CODE_BLOCK_LINE_HEIGHT;

const createLineNumbersText = (lineCount: number) =>
  Array.from(
    { length: Math.max(1, lineCount) },
    (_, index) => `${index + 1}`,
  ).join("\n");

const parseCodeBlockHighlightSpec = (
  spec: string | null | undefined,
): { startLine: number; endLine: number }[] => {
  if (!spec?.trim()) {
    return [];
  }

  const segments = spec
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^\d+$/.test(token)) {
        const line = parseInt(token, 10);
        return { startLine: line, endLine: line };
      }

      const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) {
        return null;
      }

      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      return {
        startLine: Math.min(start, end),
        endLine: Math.max(start, end),
      };
    })
    .filter(
      (segment): segment is { startLine: number; endLine: number } =>
        !!segment && segment.startLine > 0 && segment.endLine > 0,
    )
    .sort((a, b) => a.startLine - b.startLine);

  return segments.reduce<{ startLine: number; endLine: number }[]>(
    (acc, segment) => {
      const prev = acc[acc.length - 1];

      if (!prev || segment.startLine > prev.endLine + 1) {
        acc.push(segment);
        return acc;
      }

      prev.endLine = Math.max(prev.endLine, segment.endLine);
      return acc;
    },
    [],
  );
};

const getCodeBlockHighlightTokens = (
  color: CodeBlockStyle["highlightColor"],
  theme: CodeBlockStyle["theme"],
) => {
  const palette = {
    red:
      theme === "dark"
        ? {
            border: "#f87171",
            fill: "rgba(248, 113, 113, 0.16)",
            glow: "rgba(248, 113, 113, 0.35)",
          }
        : {
            border: "#dc2626",
            fill: "rgba(220, 38, 38, 0.12)",
            glow: "rgba(220, 38, 38, 0.25)",
          },
    yellow:
      theme === "dark"
        ? {
            border: "#facc15",
            fill: "rgba(250, 204, 21, 0.16)",
            glow: "rgba(250, 204, 21, 0.32)",
          }
        : {
            border: "#ca8a04",
            fill: "rgba(202, 138, 4, 0.14)",
            glow: "rgba(202, 138, 4, 0.24)",
          },
    blue:
      theme === "dark"
        ? {
            border: "#60a5fa",
            fill: "rgba(96, 165, 250, 0.16)",
            glow: "rgba(96, 165, 250, 0.32)",
          }
        : {
            border: "#2563eb",
            fill: "rgba(37, 99, 235, 0.12)",
            glow: "rgba(37, 99, 235, 0.22)",
          },
    green:
      theme === "dark"
        ? {
            border: "#4ade80",
            fill: "rgba(74, 222, 128, 0.16)",
            glow: "rgba(74, 222, 128, 0.3)",
          }
        : {
            border: "#16a34a",
            fill: "rgba(22, 163, 74, 0.12)",
            glow: "rgba(22, 163, 74, 0.22)",
          },
  } as const;

  return palette[color];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const highlightCode = (code: string, language: string) => {
  const normalizedLanguage = normalizeCodeLanguage(language);

  if (normalizedLanguage === "plaintext") {
    return escapeHtml(code);
  }

  try {
    return hljs.highlight(code, {
      language: normalizedLanguage,
      ignoreIllegals: true,
    }).value;
  } catch {
    return escapeHtml(code);
  }
};

const getThemeTokens = (theme: CodeBlockStyle["theme"]) =>
  theme === "light"
    ? {
        background: "#f8fafc",
        border: "rgba(15, 23, 42, 0.1)",
        foreground: "#0f172a",
        muted: "#64748b",
        keyword: "#7c3aed",
        string: "#047857",
        number: "#c2410c",
        title: "#2563eb",
        comment: "#94a3b8",
        variable: "#be123c",
      }
    : {
        background: "#0f172a",
        border: "rgba(148, 163, 184, 0.2)",
        foreground: "#e2e8f0",
        muted: "#94a3b8",
        keyword: "#c084fc",
        string: "#86efac",
        number: "#fdba74",
        title: "#93c5fd",
        comment: "#64748b",
        variable: "#fda4af",
      };

const createExportStyleBlock = (style: CodeBlockStyle, lineCount: number) => {
  const themeTokens = getThemeTokens(style.theme);
  const highlightTokens = getCodeBlockHighlightTokens(
    style.highlightColor,
    style.theme,
  );

  return `
    .code-block-export {
      display: ${style.lineNumbers ? "grid" : "block"};
      grid-template-columns: ${
        style.lineNumbers
          ? `${getCodeBlockLineNumberGutterWidth(
              lineCount,
              style.fontSize,
            )}px auto`
          : "auto"
      };
      width: fit-content;
      color: ${themeTokens.foreground};
      box-sizing: border-box;
      font-size: ${style.fontSize}px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      line-height: ${CODE_BLOCK_LINE_HEIGHT};
      tab-size: 2;
      position: relative;
    }
    .code-block-export__overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }
    .code-block-export__highlight {
      position: absolute;
      left: 0;
      right: 0;
      border-radius: 6px;
    }
    .code-block-export__gutter {
      margin: 0;
      padding: ${CODE_BLOCK_PADDING_Y}px 8px ${CODE_BLOCK_PADDING_Y}px 0;
      box-sizing: border-box;
      text-align: right;
      color: ${themeTokens.muted};
      border-right: 1px solid ${themeTokens.border};
      white-space: pre;
      font-variant-numeric: tabular-nums;
      position: relative;
      z-index: 1;
    }
    .code-block-export__content {
      margin: 0;
      padding: ${CODE_BLOCK_PADDING_Y}px ${CODE_BLOCK_PADDING_X}px;
      border-radius: 0;
      border: 0;
      background: transparent;
      color: ${themeTokens.foreground};
      box-sizing: border-box;
      white-space: ${style.wrap ? "pre-wrap" : "pre"};
      overflow-wrap: ${style.wrap ? "anywhere" : "normal"};
      word-break: ${style.wrap ? "break-word" : "normal"};
      position: relative;
      z-index: 1;
    }
    .code-block-export code,
    .code-block-export .hljs {
      font-family: inherit;
      color: inherit;
      background: transparent;
      padding: 0;
      display: block;
      white-space: inherit;
      line-height: inherit;
    }
    .code-block-export__highlight--outline {
      border: 1.5px solid ${highlightTokens.border};
      background: transparent;
      box-shadow: none;
    }
    .code-block-export__highlight--glow {
      border: 1.5px solid ${highlightTokens.border};
      background: ${highlightTokens.fill};
      box-shadow: 0 0 0 1px ${highlightTokens.fill} inset, 0 0 14px ${
    highlightTokens.glow
  };
    }
    .code-block-export__highlight--filled {
      border: 1.5px solid ${highlightTokens.border};
      background: ${highlightTokens.fill};
      box-shadow: none;
    }
    .code-block-export .hljs-comment,
    .code-block-export .hljs-quote {
      color: ${themeTokens.comment};
    }
    .code-block-export .hljs-keyword,
    .code-block-export .hljs-selector-tag,
    .code-block-export .hljs-literal,
    .code-block-export .hljs-type {
      color: ${themeTokens.keyword};
    }
    .code-block-export .hljs-string,
    .code-block-export .hljs-regexp,
    .code-block-export .hljs-addition,
    .code-block-export .hljs-attribute,
    .code-block-export .hljs-meta .hljs-string {
      color: ${themeTokens.string};
    }
    .code-block-export .hljs-number,
    .code-block-export .hljs-symbol,
    .code-block-export .hljs-bullet {
      color: ${themeTokens.number};
    }
    .code-block-export .hljs-title,
    .code-block-export .hljs-section,
    .code-block-export .hljs-title.class_,
    .code-block-export .hljs-title.function_ {
      color: ${themeTokens.title};
    }
    .code-block-export .hljs-variable,
    .code-block-export .hljs-template-variable,
    .code-block-export .hljs-property {
      color: ${themeTokens.variable};
    }
    .code-block-export .hljs-operator,
    .code-block-export .hljs-punctuation {
      color: ${themeTokens.foreground};
    }
    .code-block-export .hljs-subst {
      color: ${themeTokens.muted};
    }
  `;
};

const createCodeBlockSvg = (
  code: string,
  markup: string,
  width: number,
  height: number,
  style: CodeBlockStyle,
) => {
  const styleBlock = createExportStyleBlock(style, getCodeBlockLineCount(code));
  const segments = parseCodeBlockHighlightSpec(style.highlightSpec);
  const lineHeight = getCodeBlockLineHeightPx(style.fontSize);
  const overlay =
    segments.length > 0
      ? `<div class="code-block-export__overlay">${segments
          .map((segment) => {
            const top =
              CODE_BLOCK_PADDING_Y + (segment.startLine - 1) * lineHeight;
            const segmentHeight =
              (segment.endLine - segment.startLine + 1) * lineHeight;

            return `<div class="code-block-export__highlight code-block-export__highlight--${style.highlightStyle}" style="top:${top}px;height:${segmentHeight}px;"></div>`;
          })
          .join("")}</div>`
      : "";
  const gutter = style.lineNumbers
    ? `<pre class="code-block-export__gutter">${createLineNumbersText(
        getCodeBlockLineCount(code),
      )}</pre>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;box-sizing:border-box;">
      <style>${styleBlock}</style>
      <div class="code-block-export">${overlay}${gutter}<pre class="code-block-export__content"><code class="hljs">${markup}</code></pre></div>
    </div>
  </foreignObject>
</svg>`;
};

const createCodeBlockFileForExport = async (
  element: ExcalidrawEmbeddableElement,
) => {
  const codeBlockData = getCodeBlockData(element);
  if (!codeBlockData) {
    return null;
  }

  const svg = createCodeBlockSvg(
    codeBlockData.code,
    highlightCode(codeBlockData.code, codeBlockData.style.language),
    codeBlockData.intrinsicWidth || element.width,
    codeBlockData.intrinsicHeight || element.height,
    codeBlockData.style,
  );
  const file = new Blob([svg], {
    type: "image/svg+xml",
  });
  const fileId = `code-export-${element.id}` as FileId;
  const dataURL = await getDataURL(file);

  const fileData: BinaryFileData = {
    id: fileId,
    mimeType: "image/svg+xml",
    dataURL,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };

  const imageElement = {
    ...element,
    type: "image" as const,
    fileId,
    status: "saved" as const,
    scale: [1, 1] as [number, number],
    crop: null,
    link: null,
    strokeColor: "transparent",
  };

  return { fileData, imageElement };
};

export const replaceCodeBlockEmbeddablesForExport = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
) => {
  const nextFiles: BinaryFiles = { ...(files || {}) };
  const nextElements = await Promise.all(
    elements.map(async (element) => {
      if (!isEmbeddableElement(element)) {
        return element;
      }

      const exported = await createCodeBlockFileForExport(element);
      if (!exported) {
        return element;
      }

      nextFiles[exported.fileData.id] = exported.fileData;
      return exported.imageElement;
    }),
  );

  return {
    elements: nextElements as readonly NonDeletedExcalidrawElement[],
    files: nextFiles,
  };
};

import hljs from "highlight.js";

import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";

const DEFAULT_CODE_BLOCK_FONT_SIZE = 16;
const CODE_BLOCK_PADDING_X = 6;
const CODE_BLOCK_PADDING_Y = 4;
const CODE_BLOCK_LINE_HEIGHT = 1.55;
const CODE_BLOCK_MIN_WIDTH = 24;
const CODE_BLOCK_MIN_HEIGHT = 24;
const CODE_BLOCK_CACHE_LIMIT = 200;

export const DEFAULT_CODE_BLOCK = `function greet(name: string) {
  return \`Hello, \${name}\`;
}`;

export type CodeBlockStyle = {
  fontSize: number;
  language: string;
  wrap: boolean;
  lineNumbers: boolean;
  highlightSpec: string;
  highlightColor: "red" | "yellow" | "blue" | "green";
  highlightStyle: "outline" | "glow" | "filled";
  highlightCustomBorderColor?: string;
  highlightCustomBackground?: string;
  highlightBorderWidth: number;
  highlightBorderRadius: number;
  theme: "light" | "dark";
};

export type CodeBlockHighlightSegment = {
  startLine: number;
  endLine: number;
};

type CodeBlockThemeTokens = {
  background: string;
  border: string;
  foreground: string;
  muted: string;
  keyword: string;
  string: string;
  number: string;
  title: string;
  comment: string;
  variable: string;
};

export const DEFAULT_CODE_BLOCK_STYLE: CodeBlockStyle = {
  fontSize: DEFAULT_CODE_BLOCK_FONT_SIZE,
  language: "typescript",
  wrap: false,
  lineNumbers: false,
  highlightSpec: "",
  highlightColor: "yellow",
  highlightStyle: "outline",
  highlightCustomBorderColor: undefined,
  highlightCustomBackground: undefined,
  highlightBorderWidth: 1.5,
  highlightBorderRadius: 6,
  theme: "light",
};

const measurementCache = new Map<
  string,
  {
    width: number;
    height: number;
    markup: string;
    style: CodeBlockStyle;
    language: string;
  }
>();

const touchCacheEntry = <T>(cache: Map<string, T>, key: string, value: T) => {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);

  if (cache.size > CODE_BLOCK_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
};

const getCachedEntry = <T>(cache: Map<string, T>, key: string) => {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  touchCacheEntry(cache, key, cached);
  return cached;
};

const getCodeBlockCacheKey = (
  code: string,
  style: CodeBlockStyle,
  variant: string,
) =>
  [
    variant,
    code,
    style.language,
    style.fontSize,
    style.wrap ? "1" : "0",
    style.lineNumbers ? "1" : "0",
    style.highlightSpec,
    style.highlightColor,
    style.highlightStyle,
    style.highlightCustomBorderColor || "",
    style.highlightCustomBackground || "",
    style.highlightBorderWidth,
    style.highlightBorderRadius,
    style.theme,
  ].join("::");

const normalizeCodeLanguage = (language?: string | null) => {
  if (!language || typeof language !== "string") {
    return DEFAULT_CODE_BLOCK_STYLE.language;
  }

  const nextLanguage = language.trim().toLowerCase();
  if (!nextLanguage) {
    return DEFAULT_CODE_BLOCK_STYLE.language;
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

export const normalizeCodeBlockStyle = (
  style?: Partial<CodeBlockStyle> | null,
): CodeBlockStyle => ({
  fontSize:
    typeof style?.fontSize === "number" && Number.isFinite(style.fontSize)
      ? Math.min(Math.max(Math.round(style.fontSize), 12), 32)
      : DEFAULT_CODE_BLOCK_STYLE.fontSize,
  language: normalizeCodeLanguage(style?.language),
  wrap: typeof style?.wrap === "boolean" ? style.wrap : false,
  lineNumbers:
    typeof style?.lineNumbers === "boolean" ? style.lineNumbers : false,
  highlightSpec:
    typeof style?.highlightSpec === "string" ? style.highlightSpec.trim() : "",
  highlightColor:
    style?.highlightColor === "red" ||
    style?.highlightColor === "yellow" ||
    style?.highlightColor === "blue" ||
    style?.highlightColor === "green"
      ? style.highlightColor
      : DEFAULT_CODE_BLOCK_STYLE.highlightColor,
  highlightStyle:
    style?.highlightStyle === "outline" ||
    style?.highlightStyle === "glow" ||
    style?.highlightStyle === "filled"
      ? style.highlightStyle
      : DEFAULT_CODE_BLOCK_STYLE.highlightStyle,
  highlightCustomBorderColor:
    typeof style?.highlightCustomBorderColor === "string" &&
    style.highlightCustomBorderColor.trim() &&
    style.highlightCustomBorderColor.trim().toLowerCase() !== "transparent"
      ? style.highlightCustomBorderColor.trim()
      : undefined,
  highlightCustomBackground:
    typeof style?.highlightCustomBackground === "string" &&
    style.highlightCustomBackground.trim() &&
    style.highlightCustomBackground.trim().toLowerCase() !== "transparent"
      ? style.highlightCustomBackground.trim()
      : undefined,
  highlightBorderWidth:
    typeof style?.highlightBorderWidth === "number" &&
    Number.isFinite(style.highlightBorderWidth)
      ? Math.min(Math.max(style.highlightBorderWidth, 1), 8)
      : DEFAULT_CODE_BLOCK_STYLE.highlightBorderWidth,
  highlightBorderRadius:
    typeof style?.highlightBorderRadius === "number" &&
    Number.isFinite(style.highlightBorderRadius)
      ? Math.min(Math.max(style.highlightBorderRadius, 0), 24)
      : DEFAULT_CODE_BLOCK_STYLE.highlightBorderRadius,
  theme: style?.theme === "light" ? "light" : DEFAULT_CODE_BLOCK_STYLE.theme,
});

export const getCodeBlockThemeTokens = (
  theme: CodeBlockStyle["theme"],
): CodeBlockThemeTokens =>
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
    return {
      language: normalizedLanguage,
      markup: escapeHtml(code),
    };
  }

  try {
    return {
      language: normalizedLanguage,
      markup: hljs.highlight(code, {
        language: normalizedLanguage,
        ignoreIllegals: true,
      }).value,
    };
  } catch {
    return {
      language: "plaintext",
      markup: escapeHtml(code),
    };
  }
};

export const renderCodeBlockMarkup = (
  code: string,
  style?: Partial<CodeBlockStyle> | null,
) => {
  const normalizedStyle = normalizeCodeBlockStyle(style);
  return highlightCode(code, normalizedStyle.language);
};

export const getCodeBlockLineCount = (code: string) =>
  Math.max(1, code.split(/\r?\n/).length);

export const getCodeBlockLineNumberGutterWidth = (
  lineCount: number,
  fontSize: number,
) => Math.ceil(String(Math.max(1, lineCount)).length * fontSize * 0.62 + 16);

export const getCodeBlockLineHeightPx = (fontSize: number) =>
  fontSize * CODE_BLOCK_LINE_HEIGHT;

export const parseCodeBlockHighlightSpec = (
  spec: string | null | undefined,
): CodeBlockHighlightSegment[] => {
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
      (segment): segment is CodeBlockHighlightSegment =>
        !!segment && segment.startLine > 0 && segment.endLine > 0,
    )
    .sort((a, b) => a.startLine - b.startLine);

  return segments.reduce<CodeBlockHighlightSegment[]>((acc, segment) => {
    const prev = acc[acc.length - 1];

    if (!prev || segment.startLine > prev.endLine + 1) {
      acc.push(segment);
      return acc;
    }

    prev.endLine = Math.max(prev.endLine, segment.endLine);
    return acc;
  }, []);
};

export const isCodeBlockLineHighlighted = (
  lineNumber: number,
  segments: readonly CodeBlockHighlightSegment[],
) =>
  segments.some(
    (segment) =>
      lineNumber >= segment.startLine && lineNumber <= segment.endLine,
  );

export const getCodeBlockHighlightTokens = (
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

export const getCodeBlockHighlightOverlayStyle = (
  style: CodeBlockStyle,
  theme: CodeBlockStyle["theme"],
) => {
  const tokens = getCodeBlockHighlightTokens(style.highlightColor, theme);
  const borderColor = style.highlightCustomBorderColor || tokens.border;
  const fillColor = style.highlightCustomBackground || tokens.fill;
  const borderWidth = style.highlightBorderWidth;
  const borderRadius = style.highlightBorderRadius;

  if (style.highlightStyle === "filled") {
    return {
      border: `${borderWidth}px solid ${borderColor}`,
      background: fillColor,
      boxShadow: "none",
      borderRadius: `${borderRadius}px`,
    };
  }

  if (style.highlightStyle === "glow") {
    return {
      border: `${borderWidth}px solid ${borderColor}`,
      background: fillColor,
      boxShadow: `0 0 0 1px ${fillColor} inset, 0 0 14px ${tokens.glow}`,
      borderRadius: `${borderRadius}px`,
    };
  }

  return {
    border: `${borderWidth}px solid ${borderColor}`,
    background: "transparent",
    boxShadow: "none",
    borderRadius: `${borderRadius}px`,
  };
};

const createLineNumbersText = (lineCount: number) =>
  Array.from(
    { length: Math.max(1, lineCount) },
    (_, index) => `${index + 1}`,
  ).join("\n");

const estimateCodeBlockDimensions = (code: string, style: CodeBlockStyle) => {
  const lines = code.split(/\r?\n/);
  const lineCount = getCodeBlockLineCount(code);
  const longestLineLength = lines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  );
  const lineHeight = getCodeBlockLineHeightPx(style.fontSize);
  const gutterWidth = style.lineNumbers
    ? getCodeBlockLineNumberGutterWidth(lineCount, style.fontSize)
    : 0;
  const width = Math.max(
    CODE_BLOCK_MIN_WIDTH,
    CODE_BLOCK_PADDING_X * 2 +
      longestLineLength * style.fontSize * 0.62 +
      gutterWidth,
  );

  return {
    width: Math.ceil(width),
    height: Math.ceil(
      Math.max(
        CODE_BLOCK_MIN_HEIGHT,
        CODE_BLOCK_PADDING_Y * 2 + lines.length * lineHeight,
      ),
    ),
  };
};

const createMeasurementContainer = (
  code: string,
  highlightedMarkup: string,
  style: CodeBlockStyle,
) => {
  const themeTokens = getCodeBlockThemeTokens(style.theme);
  const container = window.document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "-10000px";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  container.style.width = "fit-content";
  container.style.boxSizing = "border-box";

  const wrapper = window.document.createElement("div");
  wrapper.style.display = style.lineNumbers ? "grid" : "block";
  wrapper.style.gridTemplateColumns = style.lineNumbers
    ? `${getCodeBlockLineNumberGutterWidth(
        getCodeBlockLineCount(code),
        style.fontSize,
      )}px auto`
    : "auto";
  wrapper.style.alignItems = "start";
  wrapper.style.width = "fit-content";
  wrapper.style.boxSizing = "border-box";

  if (style.lineNumbers) {
    const gutter = window.document.createElement("pre");
    gutter.style.margin = "0";
    gutter.style.padding = `${CODE_BLOCK_PADDING_Y}px 8px ${CODE_BLOCK_PADDING_Y}px 0`;
    gutter.style.boxSizing = "border-box";
    gutter.style.fontSize = `${style.fontSize}px`;
    gutter.style.fontFamily =
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
    gutter.style.lineHeight = `${CODE_BLOCK_LINE_HEIGHT}`;
    gutter.style.fontVariantNumeric = "tabular-nums";
    gutter.style.textAlign = "right";
    gutter.style.color = themeTokens.muted;
    gutter.style.borderRight = `1px solid ${themeTokens.border}`;
    gutter.style.whiteSpace = "pre";
    gutter.textContent = createLineNumbersText(getCodeBlockLineCount(code));
    wrapper.appendChild(gutter);
  }

  const pre = window.document.createElement("pre");
  pre.style.margin = "0";
  pre.style.padding = `${CODE_BLOCK_PADDING_Y}px ${CODE_BLOCK_PADDING_X}px`;
  pre.style.background = "transparent";
  pre.style.color = themeTokens.foreground;
  pre.style.boxSizing = "border-box";
  pre.style.fontSize = `${style.fontSize}px`;
  pre.style.fontFamily =
    '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
  pre.style.lineHeight = `${CODE_BLOCK_LINE_HEIGHT}`;
  pre.style.tabSize = "2";
  pre.style.whiteSpace = style.wrap ? "pre-wrap" : "pre";
  pre.style.overflowWrap = style.wrap ? "anywhere" : "normal";
  pre.style.wordBreak = style.wrap ? "break-word" : "normal";

  const codeNode = window.document.createElement("code");
  codeNode.style.display = "block";
  codeNode.style.whiteSpace = "inherit";
  codeNode.style.lineHeight = "inherit";
  codeNode.innerHTML = highlightedMarkup;
  pre.appendChild(codeNode);
  wrapper.appendChild(pre);
  container.appendChild(wrapper);

  return container;
};

const getMeasuredCodeBlock = (
  code: string,
  style?: Partial<CodeBlockStyle> | null,
) => {
  const normalizedCode = code.replace(/\r\n/g, "\n");
  const normalizedStyle = normalizeCodeBlockStyle(style);
  const cacheKey = getCodeBlockCacheKey(
    normalizedCode,
    normalizedStyle,
    "measure",
  );
  const cachedMeasurement = getCachedEntry(measurementCache, cacheKey);

  if (cachedMeasurement) {
    return cachedMeasurement;
  }

  const { language, markup } = renderCodeBlockMarkup(
    normalizedCode,
    normalizedStyle,
  );

  if (typeof window === "undefined" || !window.document?.body) {
    const estimatedSize = estimateCodeBlockDimensions(
      normalizedCode,
      normalizedStyle,
    );
    const estimatedMeasurement = {
      ...estimatedSize,
      markup,
      style: normalizedStyle,
      language,
    };
    touchCacheEntry(measurementCache, cacheKey, estimatedMeasurement);
    return estimatedMeasurement;
  }

  const container = createMeasurementContainer(
    normalizedCode,
    markup,
    normalizedStyle,
  );
  window.document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  window.document.body.removeChild(container);

  const nextMeasurement = {
    width: Math.ceil(
      Math.max(CODE_BLOCK_MIN_WIDTH, rect.width || CODE_BLOCK_MIN_WIDTH),
    ),
    height: Math.ceil(
      Math.max(CODE_BLOCK_MIN_HEIGHT, rect.height || CODE_BLOCK_MIN_HEIGHT),
    ),
    markup,
    style: normalizedStyle,
    language,
  };

  touchCacheEntry(measurementCache, cacheKey, nextMeasurement);

  return nextMeasurement;
};

export const measureCodeBlockDimensions = (
  code: string,
  style?: Partial<CodeBlockStyle> | null,
) => getMeasuredCodeBlock(code, style);

const createExportStyleBlock = (style: CodeBlockStyle, lineCount: number) => {
  const themeTokens = getCodeBlockThemeTokens(style.theme);
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
      position: relative;
      z-index: 1;
      font-variant-numeric: tabular-nums;
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

export const createCodeBlockAsset = async (
  code: string,
  style?: Partial<CodeBlockStyle> | null,
): Promise<{
  fileData: BinaryFileData;
  width: number;
  height: number;
  style: CodeBlockStyle;
}> => {
  const measured = getMeasuredCodeBlock(code, style);
  const svg = createCodeBlockSvg(
    code,
    measured.markup,
    measured.width,
    measured.height,
    measured.style,
  );
  const file = new File([svg], "code-block.svg", {
    type: "image/svg+xml",
  });
  const fileId = await generateIdFromFile(file);
  const dataURL = await getDataURL(file);

  return {
    fileData: {
      id: fileId,
      mimeType: "image/svg+xml",
      dataURL,
      created: Date.now(),
      lastRetrieved: Date.now(),
    },
    width: measured.width,
    height: measured.height,
    style: measured.style,
  };
};

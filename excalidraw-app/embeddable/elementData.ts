import { THEME } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { normalizeCodeBlockStyle } from "../code/codeBlock";

import { normalizeMathFormulaStyle } from "../math/formula";

import type { CodeBlockStyle } from "../code/codeBlock";
import type { MathFormulaStyle } from "../math/formula";

export const resolveMathFormulaColorFromSidebar = (
  color: string | null | undefined,
  editorTheme: "light" | "dark",
) => {
  const normalized = (color || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return editorTheme === THEME.DARK ? "#e8ecff" : "#1d1d3a";
  }
  return color!;
};

export const resolveCodeBlockHighlightColorFromSidebar = (
  color: string | null | undefined,
): CodeBlockStyle["highlightColor"] => {
  const normalized = (color || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return "yellow";
  }
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) {
    return "yellow";
  }
  const hex = hexMatch[1];
  const [r, g, b] =
    hex.length === 3
      ? hex.split("").map((value) => parseInt(value + value, 16))
      : [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max - min < 18) {
    return "yellow";
  }
  if (r >= g && r >= b) {
    return "red";
  }
  if (g >= r && g >= b) {
    return "green";
  }
  return "blue";
};

export const getMathFormulaElementData = (
  element: NonDeletedExcalidrawElement | null,
): {
  source: string;
  style: MathFormulaStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | {
        formulaType?: string;
        formulaSource?: string;
        formulaStyle?: Partial<MathFormulaStyle> | null;
        intrinsicWidth?: number;
        intrinsicHeight?: number;
      }
    | undefined;

  if (
    customData?.formulaType !== "math" ||
    typeof customData.formulaSource !== "string"
  ) {
    return null;
  }

  return {
    source: customData.formulaSource,
    style: normalizeMathFormulaStyle(customData.formulaStyle),
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

export const getCodeBlockElementData = (
  element: NonDeletedExcalidrawElement | null,
): {
  source: string;
  style: CodeBlockStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!element) {
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
    source: customData.codeBlockSource,
    style: normalizeCodeBlockStyle(customData.codeBlockStyle),
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

import katex from "katex";

import { isEmbeddableElement } from "@excalidraw/element";

import type {
  ExcalidrawEmbeddableElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getDataURL } from "../data/blob";

import type { BinaryFileData, BinaryFiles } from "../types";

type MathFormulaStyle = {
  fontSize: number;
  color: string;
  displayMode: boolean;
  renderStyle: "clean";
};

const DEFAULT_STYLE: MathFormulaStyle = {
  fontSize: 28,
  color: "#1d1d3a",
  displayMode: true,
  renderStyle: "clean",
};

const FORMULA_PADDING_X = 16;
const FORMULA_PADDING_Y = 12;

const normalizeStyle = (
  style?: Partial<MathFormulaStyle> | null,
): MathFormulaStyle => ({
  fontSize:
    typeof style?.fontSize === "number" && Number.isFinite(style.fontSize)
      ? Math.min(Math.max(Math.round(style.fontSize), 16), 96)
      : DEFAULT_STYLE.fontSize,
  color:
    typeof style?.color === "string" && style.color.trim()
      ? style.color.trim()
      : DEFAULT_STYLE.color,
  displayMode:
    typeof style?.displayMode === "boolean"
      ? style.displayMode
      : DEFAULT_STYLE.displayMode,
  renderStyle: DEFAULT_STYLE.renderStyle,
});

const getMathFormulaData = (
  element: NonDeletedExcalidrawElement,
): {
  formula: string;
  style: MathFormulaStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!isEmbeddableElement(element)) {
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
    formula: customData.formulaSource,
    style: normalizeStyle(customData.formulaStyle),
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

const hashFormula = (formula: string) => {
  let hash = 0;

  for (let index = 0; index < formula.length; index++) {
    hash = (hash * 31 + formula.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const getRenderMetadata = (formula: string, style: MathFormulaStyle) => {
  const seed = hashFormula(
    `${formula}|${style.fontSize}|${style.color}|${style.displayMode}`,
  );

  return {
    rotationDeg: 0,
    noteFill: "transparent",
    noteStroke: "transparent",
    textShadow: "none",
    fontFamily: "KaTeX_Main, KaTeX_Math, serif",
    seed,
  };
};

const createFormulaSvg = (
  formula: string,
  style: MathFormulaStyle,
  width: number,
  height: number,
) => {
  const markup = katex.renderToString(formula, {
    displayMode: style.displayMode,
    output: "mathml",
    throwOnError: false,
    strict: "ignore",
  });
  const renderMetadata = getRenderMetadata(formula, style);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      style="
        width:${width}px;
        height:${height}px;
        display:flex;
        align-items:center;
        justify-content:${style.displayMode ? "center" : "flex-start"};
        padding:${FORMULA_PADDING_Y}px ${FORMULA_PADDING_X}px;
        box-sizing:border-box;
        overflow:hidden;
        background:transparent;
        color:${style.color};
        font-size:${style.fontSize}px;
        line-height:1.2;
        font-family:${renderMetadata.fontFamily};
        text-shadow:${renderMetadata.textShadow};
        transform:rotate(${renderMetadata.rotationDeg}deg);
        transform-origin:center center;
      "
    >
      ${markup}
    </div>
  </foreignObject>
</svg>`;
};

const createMathFormulaFileForExport = async (
  element: ExcalidrawEmbeddableElement,
) => {
  const mathData = getMathFormulaData(element);
  if (!mathData) {
    return null;
  }

  const baseWidth = mathData.intrinsicWidth || element.width;
  const baseHeight = mathData.intrinsicHeight || element.height;
  const scale = Math.min(
    element.width / baseWidth,
    element.height / baseHeight,
  );

  const style = normalizeStyle({
    ...mathData.style,
    fontSize: mathData.style.fontSize * (Number.isFinite(scale) ? scale : 1),
  });

  const svg = createFormulaSvg(
    mathData.formula,
    style,
    element.width,
    element.height,
  );
  const file = new Blob([svg], {
    type: "image/svg+xml",
  });
  const fileId = `math-export-${element.id}` as FileId;
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

export const replaceMathFormulaEmbeddablesForExport = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
) => {
  const nextFiles: BinaryFiles = { ...(files || {}) };
  const nextElements = await Promise.all(
    elements.map(async (element) => {
      if (!isEmbeddableElement(element)) {
        return element;
      }

      const exported = await createMathFormulaFileForExport(element);
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

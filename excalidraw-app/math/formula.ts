import "katex/dist/katex.min.css";
import katex from "katex";

import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";

const DEFAULT_FORMULA_FONT_SIZE = 28;
const FORMULA_PADDING_X = 16;
const FORMULA_PADDING_Y = 12;
const FORMULA_MAX_WIDTH = 720;
const DEFAULT_FORMULA_COLOR = "#1d1d3a";
const FORMULA_MEASUREMENT_SLACK = 6;

export const DEFAULT_MATH_FORMULA = "\\frac{a}{b}=c";

export type MathFormulaStyle = {
  fontSize: number;
  color: string;
  displayMode: boolean;
  renderStyle: "clean";
};

export const DEFAULT_MATH_FORMULA_STYLE: MathFormulaStyle = {
  fontSize: DEFAULT_FORMULA_FONT_SIZE,
  color: DEFAULT_FORMULA_COLOR,
  displayMode: true,
  renderStyle: "clean",
};

export const normalizeMathFormulaStyle = (
  style?: Partial<MathFormulaStyle> | null,
): MathFormulaStyle => ({
  fontSize:
    typeof style?.fontSize === "number" && Number.isFinite(style.fontSize)
      ? Math.min(Math.max(Math.round(style.fontSize), 16), 96)
      : DEFAULT_MATH_FORMULA_STYLE.fontSize,
  color:
    typeof style?.color === "string" && style.color.trim()
      ? style.color.trim()
      : DEFAULT_MATH_FORMULA_STYLE.color,
  displayMode:
    typeof style?.displayMode === "boolean"
      ? style.displayMode
      : DEFAULT_MATH_FORMULA_STYLE.displayMode,
  renderStyle: DEFAULT_MATH_FORMULA_STYLE.renderStyle,
});

const renderMathFormula = (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
  output: "htmlAndMathml" | "mathml" = "htmlAndMathml",
) => {
  const normalizedStyle = normalizeMathFormulaStyle(style);

  return katex.renderToString(formula, {
    displayMode: normalizedStyle.displayMode,
    output,
    throwOnError: false,
    strict: "ignore",
  });
};

export const renderMathFormulaMarkup = (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
) => renderMathFormula(formula, style, "htmlAndMathml");

export const renderMathFormulaExportMarkup = (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
) => renderMathFormula(formula, style, "mathml");

const hashFormula = (formula: string) => {
  let hash = 0;

  for (let index = 0; index < formula.length; index++) {
    hash = (hash * 31 + formula.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

export const getMathFormulaRenderMetadata = (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
) => {
  const normalizedStyle = normalizeMathFormulaStyle(style);
  const seed = hashFormula(
    `${formula}|${normalizedStyle.fontSize}|${normalizedStyle.color}|${normalizedStyle.displayMode}`,
  );

  return {
    rotationDeg: 0,
    outerPadding: 0,
    noteFill: "transparent",
    noteStroke: "transparent",
    textShadow: "none",
    fontFamily: "KaTeX_Main, KaTeX_Math, serif",
    seed,
  };
};

export const getMathFormulaEmbeddableLink = (id: string) =>
  `math://formula/${id}`;

const createMeasurementContainer = (
  markup: string,
  style: MathFormulaStyle,
) => {
  const container = window.document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "-10000px";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  container.style.display = style.displayMode ? "inline-block" : "inline-flex";
  container.style.alignItems = "center";
  container.style.padding = `${FORMULA_PADDING_Y}px ${FORMULA_PADDING_X}px`;
  container.style.boxSizing = "border-box";
  container.style.fontSize = `${style.fontSize}px`;
  container.style.lineHeight = "1.2";
  container.style.color = style.color;
  container.style.background = "transparent";
  container.innerHTML = markup;

  return container;
};

const formulaLengthFallback = (markup: string, fontSize: number) => {
  const plainText = markup.replace(/<[^>]+>/g, "").trim();
  return Math.max(
    plainText.length * Math.max(fontSize * 0.36, 10),
    fontSize * 2,
  );
};

const measureFormula = (
  formula: string,
  markup: string,
  style: MathFormulaStyle,
) => {
  const container = createMeasurementContainer(markup, style);
  window.document.body.appendChild(container);

  const rect = container.getBoundingClientRect();
  window.document.body.removeChild(container);
  const renderMetadata = getMathFormulaRenderMetadata(formula, style);

  const width = Math.max(
    Math.ceil(rect.width) || 0,
    FORMULA_PADDING_X * 2 + formulaLengthFallback(markup, style.fontSize),
  );
  const height = Math.max(
    (Math.ceil(rect.height) || 0) + FORMULA_MEASUREMENT_SLACK,
    FORMULA_PADDING_Y * 2 + style.fontSize,
  );

  if (width <= FORMULA_MAX_WIDTH) {
    return {
      width: width + renderMetadata.outerPadding * 2,
      height: height + renderMetadata.outerPadding * 2,
    };
  }

  const scale = FORMULA_MAX_WIDTH / width;
  return {
    width: Math.ceil(width * scale) + renderMetadata.outerPadding * 2,
    height: Math.ceil(height * scale) + renderMetadata.outerPadding * 2,
  };
};

export const measureMathFormulaDimensions = (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
) => {
  const normalizedFormula = formula.trim();

  if (!normalizedFormula) {
    throw new Error("Formula cannot be empty.");
  }

  const normalizedStyle = normalizeMathFormulaStyle(style);
  const markup = renderMathFormulaMarkup(normalizedFormula, normalizedStyle);
  const { width, height } = measureFormula(
    normalizedFormula,
    markup,
    normalizedStyle,
  );

  return {
    width,
    height,
    style: normalizedStyle,
    markup,
  };
};

const createFormulaSvg = (
  formula: string,
  markup: string,
  width: number,
  height: number,
  style: MathFormulaStyle,
) => {
  const renderMetadata = getMathFormulaRenderMetadata(formula, style);
  const contentX = renderMetadata.outerPadding;
  const contentY = renderMetadata.outerPadding;
  const contentWidth = width - renderMetadata.outerPadding * 2;
  const contentHeight = height - renderMetadata.outerPadding * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="${contentX}" y="${contentY}" width="${contentWidth}" height="${contentHeight}">
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      style="
        width:${contentWidth}px;
        height:${contentHeight}px;
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

export const createMathFormulaAsset = async (
  formula: string,
  style?: Partial<MathFormulaStyle> | null,
): Promise<{
  fileData: BinaryFileData;
  width: number;
  height: number;
  style: MathFormulaStyle;
}> => {
  const normalizedFormula = formula.trim();

  if (!normalizedFormula) {
    throw new Error("Formula cannot be empty.");
  }

  const normalizedStyle = normalizeMathFormulaStyle(style);
  const markup = renderMathFormulaExportMarkup(
    normalizedFormula,
    normalizedStyle,
  );
  const { width, height } = measureFormula(
    normalizedFormula,
    markup,
    normalizedStyle,
  );
  const svg = createFormulaSvg(
    normalizedFormula,
    markup,
    width,
    height,
    normalizedStyle,
  );
  const file = new File([svg], "math-formula.svg", {
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
    width,
    height,
    style: normalizedStyle,
  };
};

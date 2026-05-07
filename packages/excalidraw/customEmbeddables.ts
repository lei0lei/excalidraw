import { isEmbeddableElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const isMathFormulaEmbeddable = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return false;
  }

  const customData = element.customData as
    | {
        formulaType?: string;
      }
    | undefined;

  return (
    element.link?.startsWith("math://formula/") === true ||
    customData?.formulaType === "math"
  );
};

export const isCodeBlockEmbeddable = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return false;
  }

  const customData = element.customData as
    | {
        codeBlockType?: string;
      }
    | undefined;

  return customData?.codeBlockType === "code";
};

export const getMathFormulaFontSize = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return null;
  }

  const customData = element.customData as
    | {
        formulaType?: string;
        formulaStyle?: {
          fontSize?: number;
        };
      }
    | undefined;

  if (customData?.formulaType !== "math") {
    return null;
  }

  const fontSize = customData.formulaStyle?.fontSize;
  return typeof fontSize === "number" && Number.isFinite(fontSize)
    ? fontSize
    : null;
};

export const getMathFormulaStyle = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return null;
  }

  const customData = element.customData as
    | {
        formulaType?: string;
        formulaStyle?: {
          fontSize?: number;
          color?: string;
        };
      }
    | undefined;

  if (customData?.formulaType !== "math") {
    return null;
  }

  return customData.formulaStyle || {};
};

export const getCodeBlockFontSize = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return null;
  }

  const customData = element.customData as
    | {
        codeBlockType?: string;
        codeBlockStyle?: {
          fontSize?: number;
        };
      }
    | undefined;

  if (customData?.codeBlockType !== "code") {
    return null;
  }

  const fontSize = customData.codeBlockStyle?.fontSize;
  return typeof fontSize === "number" && Number.isFinite(fontSize)
    ? fontSize
    : null;
};

export const getCodeBlockStyle = (element: ExcalidrawElement) => {
  if (!isEmbeddableElement(element)) {
    return null;
  }

  const customData = element.customData as
    | {
        codeBlockType?: string;
        codeBlockStyle?: {
          fontSize?: number;
          highlightStyle?: string;
          highlightSpec?: string;
          highlightCustomBorderColor?: string;
          highlightCustomBackground?: string;
          highlightBorderWidth?: number;
          highlightBorderRadius?: number;
        };
      }
    | undefined;

  if (customData?.codeBlockType !== "code") {
    return null;
  }

  return customData.codeBlockStyle || {};
};

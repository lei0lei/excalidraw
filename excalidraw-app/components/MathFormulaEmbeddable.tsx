import { useMemo } from "react";

import type {
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  getMathFormulaRenderMetadata,
  normalizeMathFormulaStyle,
  renderMathFormulaMarkup,
  type MathFormulaStyle,
} from "../math/formula";

import "./MathFormulaEmbeddable.scss";

type MathFormulaEmbeddableProps = {
  element: NonDeleted<ExcalidrawEmbeddableElement>;
  formula: string;
  style?: Partial<MathFormulaStyle> | null;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
};

export const MathFormulaEmbeddable = ({
  element,
  formula,
  style,
  intrinsicWidth,
  intrinsicHeight,
}: MathFormulaEmbeddableProps) => {
  const normalizedStyle = useMemo(
    () => normalizeMathFormulaStyle(style),
    [style],
  );
  const previewMarkup = useMemo(
    () => renderMathFormulaMarkup(formula, normalizedStyle),
    [formula, normalizedStyle],
  );
  const metadata = useMemo(
    () => getMathFormulaRenderMetadata(formula, normalizedStyle),
    [formula, normalizedStyle],
  );

  const width = Math.max(element.width, 1);
  const height = Math.max(element.height, 1);
  const baseWidth = intrinsicWidth || width;
  const baseHeight = intrinsicHeight || height;
  const scale = Math.min(width / baseWidth, height / baseHeight);

  return (
    <div className="MathFormulaEmbeddable" role="presentation">
      <div
        className="MathFormulaEmbeddable__inner"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          color: normalizedStyle.color,
          fontSize: normalizedStyle.fontSize,
          fontFamily: metadata.fontFamily,
          textShadow: metadata.textShadow,
          justifyContent: normalizedStyle.displayMode ? "center" : "flex-start",
        }}
      >
        <div
          className="MathFormulaEmbeddable__content"
          dangerouslySetInnerHTML={{ __html: previewMarkup }}
        />
      </div>
    </div>
  );
};

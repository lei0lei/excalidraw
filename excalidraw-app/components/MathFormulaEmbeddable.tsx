import { useLayoutEffect, useMemo, useRef, useState } from "react";

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

const CONTENT_PADDING_X = 10;
const CONTENT_PADDING_Y = 6;

type MathFormulaEmbeddableProps = {
  element: NonDeleted<ExcalidrawEmbeddableElement>;
  formula: string;
  style?: Partial<MathFormulaStyle> | null;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  onAutoResize?: (size: { width: number; height: number }) => void;
};

export const MathFormulaEmbeddable = ({
  element,
  formula,
  style,
  intrinsicWidth,
  intrinsicHeight,
  onAutoResize,
}: MathFormulaEmbeddableProps) => {
  const formulaRef = useRef<HTMLDivElement | null>(null);
  const [measuredSize, setMeasuredSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
  const baseWidth = Math.max(intrinsicWidth || 0, measuredSize?.width || 0, 1);
  const baseHeight = Math.max(
    intrinsicHeight || 0,
    measuredSize?.height || 0,
    1,
  );
  const scale = Math.min(width / baseWidth, height / baseHeight);

  useLayoutEffect(() => {
    const formulaNode = formulaRef.current;

    if (!formulaNode) {
      return;
    }

    let animationFrameId = 0;

    const measure = () => {
      const naturalWidth =
        formulaNode.scrollWidth || formulaNode.offsetWidth || 0;
      const naturalHeight =
        formulaNode.scrollHeight || formulaNode.offsetHeight || 0;
      const nextWidth = Math.ceil(
        Math.max(naturalWidth, 1) + CONTENT_PADDING_X * 2,
      );
      const nextHeight = Math.ceil(
        Math.max(naturalHeight, 1) + CONTENT_PADDING_Y * 2,
      );

      setMeasuredSize((prev) => {
        if (prev?.width === nextWidth && prev?.height === nextHeight) {
          return prev;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    animationFrameId = window.requestAnimationFrame(measure);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [formula, normalizedStyle]);

  useLayoutEffect(() => {
    if (!measuredSize || !onAutoResize) {
      return;
    }

    if (
      Math.abs(measuredSize.width - (intrinsicWidth || 0)) < 2 &&
      Math.abs(measuredSize.height - (intrinsicHeight || 0)) < 2
    ) {
      return;
    }

    onAutoResize(measuredSize);
  }, [intrinsicHeight, intrinsicWidth, measuredSize, onAutoResize]);

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
        }}
      >
        <div
          className="MathFormulaEmbeddable__content"
          style={{
            justifyContent: normalizedStyle.displayMode
              ? "center"
              : "flex-start",
          }}
        >
          <div
            ref={formulaRef}
            className="MathFormulaEmbeddable__formula"
            dangerouslySetInnerHTML={{ __html: previewMarkup }}
          />
        </div>
      </div>
    </div>
  );
};

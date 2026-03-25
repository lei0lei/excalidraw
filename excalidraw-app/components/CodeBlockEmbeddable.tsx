import { useLayoutEffect, useMemo } from "react";

import type {
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import {
  getCodeBlockHighlightOverlayStyle,
  getCodeBlockLineHeightPx,
  getCodeBlockLineCount,
  getCodeBlockLineNumberGutterWidth,
  getCodeBlockThemeTokens,
  isCodeBlockLineHighlighted,
  measureCodeBlockDimensions,
  parseCodeBlockHighlightSpec,
  renderCodeBlockMarkup,
  type CodeBlockStyle,
} from "../code/codeBlock";

import "./CodeBlockEmbeddable.scss";

import type { CSSProperties } from "react";

type CodeBlockEmbeddableProps = {
  element: NonDeleted<ExcalidrawEmbeddableElement>;
  code: string;
  style?: Partial<CodeBlockStyle> | null;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  editorTheme?: "light" | "dark";
  onAutoResize?: (size: { width: number; height: number }) => void;
};

export const CodeBlockEmbeddable = ({
  element,
  code,
  style,
  intrinsicWidth,
  intrinsicHeight,
  editorTheme = "light",
  onAutoResize,
}: CodeBlockEmbeddableProps) => {
  const measured = useMemo(
    () => measureCodeBlockDimensions(code, style),
    [code, style],
  );
  const highlighted = useMemo(
    () => renderCodeBlockMarkup(code, measured.style),
    [code, measured.style],
  );
  const themeTokens = useMemo(
    () => getCodeBlockThemeTokens(editorTheme),
    [editorTheme],
  );
  const lineCount = useMemo(() => getCodeBlockLineCount(code), [code]);
  const lineNumberWidth = useMemo(
    () => getCodeBlockLineNumberGutterWidth(lineCount, measured.style.fontSize),
    [lineCount, measured.style.fontSize],
  );
  const highlightSegments = useMemo(
    () => parseCodeBlockHighlightSpec(measured.style.highlightSpec),
    [measured.style.highlightSpec],
  );
  const lineHeight = useMemo(
    () => getCodeBlockLineHeightPx(measured.style.fontSize),
    [measured.style.fontSize],
  );
  const highlightOverlayStyle = useMemo(
    () => getCodeBlockHighlightOverlayStyle(measured.style, editorTheme),
    [editorTheme, measured.style],
  );
  const naturalWidth = Math.max(
    measured.width || intrinsicWidth || element.width,
    1,
  );
  const naturalHeight = Math.max(
    measured.height || intrinsicHeight || element.height,
    1,
  );
  const width = Math.max(element.width, 1);
  const height = naturalHeight;

  useLayoutEffect(() => {
    if (!onAutoResize) {
      return;
    }

    if (
      Math.abs(height - element.height) < 1 &&
      Math.abs(naturalWidth - (intrinsicWidth || 0)) < 1 &&
      Math.abs(naturalHeight - (intrinsicHeight || 0)) < 1
    ) {
      return;
    }

    onAutoResize({ width: naturalWidth, height: naturalHeight });
  }, [
    element.height,
    element.width,
    height,
    intrinsicHeight,
    intrinsicWidth,
    naturalHeight,
    naturalWidth,
    onAutoResize,
    width,
  ]);

  return (
    <div
      className="CodeBlockEmbeddable"
      role="presentation"
      style={
        {
          "--code-block-bg": themeTokens.background,
          "--code-block-border": themeTokens.border,
          "--code-block-fg": themeTokens.foreground,
          "--code-block-muted": themeTokens.muted,
          "--code-block-keyword": themeTokens.keyword,
          "--code-block-string": themeTokens.string,
          "--code-block-number": themeTokens.number,
          "--code-block-title": themeTokens.title,
          "--code-block-comment": themeTokens.comment,
          "--code-block-variable": themeTokens.variable,
          "--code-block-separator": themeTokens.border,
        } as CSSProperties
      }
    >
      <div
        className={`CodeBlockEmbeddable__content ${
          measured.style.lineNumbers
            ? "CodeBlockEmbeddable__content--numbers"
            : ""
        }`}
        style={{
          width: `${width}px`,
          minHeight: `${height}px`,
          fontSize: `${measured.style.fontSize}px`,
          gridTemplateColumns: measured.style.lineNumbers
            ? `${lineNumberWidth}px max-content`
            : "max-content",
        }}
      >
        {highlightSegments.length > 0 && (
          <div className="CodeBlockEmbeddable__overlay" aria-hidden="true">
            {highlightSegments.map((segment) => (
              <div
                key={`${segment.startLine}-${segment.endLine}`}
                className="CodeBlockEmbeddable__highlight"
                style={{
                  top: `${4 + (segment.startLine - 1) * lineHeight}px`,
                  height: `${
                    (segment.endLine - segment.startLine + 1) * lineHeight
                  }px`,
                  ...highlightOverlayStyle,
                }}
              />
            ))}
          </div>
        )}
        {measured.style.lineNumbers && (
          <div className="CodeBlockEmbeddable__gutter" aria-hidden="true">
            {Array.from({ length: lineCount }, (_, index) => {
              const lineNumber = index + 1;
              const isHighlighted = isCodeBlockLineHighlighted(
                lineNumber,
                highlightSegments,
              );

              return (
                <div
                  key={lineNumber}
                  className={`CodeBlockEmbeddable__gutterLine ${
                    isHighlighted
                      ? "CodeBlockEmbeddable__gutterLine--highlighted"
                      : ""
                  }`}
                >
                  {lineNumber}
                </div>
              );
            })}
          </div>
        )}
        <pre
          className={`CodeBlockEmbeddable__pre ${
            measured.style.wrap ? "CodeBlockEmbeddable__pre--wrap" : ""
          }`}
        >
          <code
            className="hljs"
            dangerouslySetInnerHTML={{ __html: highlighted.markup }}
          />
        </pre>
      </div>
    </div>
  );
};

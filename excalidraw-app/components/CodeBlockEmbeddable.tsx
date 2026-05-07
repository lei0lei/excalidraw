import { useLayoutEffect, useMemo, useRef } from "react";

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
  const strokePad = 2 * Math.max(0, element.strokeWidth ?? 0);
  const naturalWidth = Math.max(
    measured.width || intrinsicWidth || Math.max(1, element.width - strokePad),
    1,
  );
  const naturalHeight = Math.max(
    measured.height ||
      intrinsicHeight ||
      Math.max(1, element.height - strokePad),
    1,
  );
  const height = naturalHeight;
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!onAutoResize) {
      return;
    }

    let contentWidth = naturalWidth;
    const root = rootRef.current;
    const content = contentRef.current;
    if (root && content) {
      const available = root.clientWidth;
      const needed = content.scrollWidth;
      if (needed > available + 1) {
        contentWidth = Math.max(
          contentWidth,
          naturalWidth + (needed - available) + 2,
        );
      }
    }

    const targetOuterW = contentWidth + strokePad;
    const targetOuterH = naturalHeight + strokePad;

    if (
      Math.abs(contentWidth - (intrinsicWidth || 0)) < 1 &&
      Math.abs(naturalHeight - (intrinsicHeight || 0)) < 1 &&
      Math.abs(element.width - targetOuterW) < 1 &&
      Math.abs(element.height - targetOuterH) < 1
    ) {
      return;
    }

    onAutoResize({ width: contentWidth, height: naturalHeight });
  }, [
    code,
    element.height,
    element.width,
    element.strokeWidth,
    height,
    highlighted.markup,
    intrinsicHeight,
    intrinsicWidth,
    naturalHeight,
    naturalWidth,
    onAutoResize,
    strokePad,
  ]);

  return (
    <div
      ref={rootRef}
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
        ref={contentRef}
        className={`CodeBlockEmbeddable__content ${
          measured.style.lineNumbers
            ? "CodeBlockEmbeddable__content--numbers"
            : ""
        }`}
        style={{
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

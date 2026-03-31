import { KEYS } from "@excalidraw/common";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
import { t } from "@excalidraw/excalidraw/i18n";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  DEFAULT_CODE_BLOCK,
  getCodeBlockHighlightOverlayStyle,
  getCodeBlockLineHeightPx,
  getCodeBlockLineCount,
  getCodeBlockLineNumberGutterWidth,
  getCodeBlockThemeTokens,
  isCodeBlockLineHighlighted,
  normalizeCodeBlockStyle,
  parseCodeBlockHighlightSpec,
  renderCodeBlockMarkup,
  type CodeBlockStyle,
} from "../code/codeBlock";

import "./CodeBlockDialog.scss";

const FONT_SIZE_PRESETS = [
  { label: "S", value: 13 },
  { label: "M", value: 16 },
  { label: "L", value: 20 },
  { label: "XL", value: 24 },
];

const HIGHLIGHT_COLOR_OPTIONS: Array<CodeBlockStyle["highlightColor"]> = [
  "red",
  "yellow",
  "blue",
  "green",
];

const HIGHLIGHT_STYLE_OPTIONS: Array<CodeBlockStyle["highlightStyle"]> = [
  "outline",
  "glow",
  "filled",
];

const LANGUAGE_OPTIONS = [
  "plaintext",
  "typescript",
  "javascript",
  "cpp",
  "rust",
  "python",
  "json",
  "bash",
  "html",
  "css",
  "markdown",
  "yaml",
  "sql",
];

type CodeBlockDialogProps = {
  initialValue?: string;
  initialStyle?: Partial<CodeBlockStyle> | null;
  mode?: "insert" | "edit";
  onClose: () => void;
  onSubmit: (code: string, style: CodeBlockStyle) => Promise<void>;
};

export const CodeBlockDialog = ({
  initialValue = DEFAULT_CODE_BLOCK,
  initialStyle,
  mode = "insert",
  onClose,
  onSubmit,
}: CodeBlockDialogProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [code, setCode] = useState(initialValue);
  const [style, setStyle] = useState<CodeBlockStyle>(() =>
    normalizeCodeBlockStyle(initialStyle),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setCode(initialValue);
    setStyle(normalizeCodeBlockStyle(initialStyle));
    setSubmitError("");
  }, [initialStyle, initialValue]);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const preview = useMemo(
    () => renderCodeBlockMarkup(code || DEFAULT_CODE_BLOCK, style),
    [code, style],
  );
  const themeTokens = useMemo(
    () => getCodeBlockThemeTokens(style.theme),
    [style.theme],
  );
  const lineCount = useMemo(
    () => getCodeBlockLineCount(code || DEFAULT_CODE_BLOCK),
    [code],
  );
  const lineNumberWidth = useMemo(
    () => getCodeBlockLineNumberGutterWidth(lineCount, style.fontSize),
    [lineCount, style.fontSize],
  );
  const highlightSegments = useMemo(
    () => parseCodeBlockHighlightSpec(style.highlightSpec),
    [style.highlightSpec],
  );
  const highlightOverlayStyle = useMemo(
    () => getCodeBlockHighlightOverlayStyle(style, style.theme),
    [style],
  );
  const lineHeight = useMemo(
    () => getCodeBlockLineHeightPx(style.fontSize),
    [style.fontSize],
  );

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!code.trim()) {
      setSubmitError(t("codeBlock.errors.empty"));
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await onSubmit(code.replace(/\r\n/g, "\n"), style);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("codeBlock.errors.saveFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === KEYS.ENTER) {
      event.preventDefault();
      void handleSubmit();
      return;
    }

    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog
      size="regular"
      className="CodeBlockDialog__dialog"
      title={
        mode === "edit" ? t("codeBlock.titleEdit") : t("codeBlock.titleNew")
      }
      onCloseRequest={onClose}
      autofocus={false}
      closeOnClickOutside={true}
    >
      <form
        className="CodeBlockDialog"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="CodeBlockDialog__toolbar">
          <div className="CodeBlockDialog__toolbarGroup">
            <span className="CodeBlockDialog__toolbarHint">
              {t("labels.language")}
            </span>
            <select
              className="CodeBlockDialog__select"
              value={style.language}
              onChange={(event) =>
                setStyle((prev) => ({
                  ...prev,
                  language: event.target.value,
                }))
              }
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>

          <div className="CodeBlockDialog__toolbarGroup">
            <span className="CodeBlockDialog__toolbarHint">
              {t("codeBlock.size")}
            </span>
            <div className="CodeBlockDialog__sizeOptions">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="CodeBlockDialog__styleChip"
                  data-active={style.fontSize === preset.value}
                  onClick={() =>
                    setStyle((prev) => ({ ...prev, fontSize: preset.value }))
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="CodeBlockDialog__toggleGroup">
            <label
              className="CodeBlockDialog__toggle"
              title={t("codeBlock.wrapLongLines")}
            >
              <input
                type="checkbox"
                checked={style.wrap}
                onChange={(event) =>
                  setStyle((prev) => ({ ...prev, wrap: event.target.checked }))
                }
              />
              <span>{t("codeBlock.wrap")}</span>
            </label>

            <label
              className="CodeBlockDialog__toggle"
              title={t("codeBlock.showLineNumbers")}
            >
              <input
                type="checkbox"
                checked={style.lineNumbers}
                onChange={(event) =>
                  setStyle((prev) => ({
                    ...prev,
                    lineNumbers: event.target.checked,
                  }))
                }
              />
              <span>{t("codeBlock.lineNumbers")}</span>
            </label>
          </div>
        </div>

        <div className="CodeBlockDialog__highlights">
          <div className="CodeBlockDialog__highlightsHeader">
            {t("codeBlock.highlights")}
          </div>
          <div className="CodeBlockDialog__highlightsControls">
            <input
              className="CodeBlockDialog__textInput"
              type="text"
              placeholder={t("codeBlock.highlightPlaceholder")}
              value={style.highlightSpec}
              onChange={(event) =>
                setStyle((prev) => ({
                  ...prev,
                  highlightSpec: event.target.value,
                }))
              }
            />

            <div className="CodeBlockDialog__sizeOptions">
              {HIGHLIGHT_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="CodeBlockDialog__styleChip"
                  data-active={style.highlightColor === color}
                  onClick={() =>
                    setStyle((prev) => ({ ...prev, highlightColor: color }))
                  }
                >
                  {color}
                </button>
              ))}
            </div>

            <div className="CodeBlockDialog__sizeOptions">
              {HIGHLIGHT_STYLE_OPTIONS.map((variant) => (
                <button
                  key={variant}
                  type="button"
                  className="CodeBlockDialog__styleChip"
                  data-active={style.highlightStyle === variant}
                  onClick={() =>
                    setStyle((prev) => ({
                      ...prev,
                      highlightStyle: variant,
                    }))
                  }
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="CodeBlockDialog__surface">
          <div className="CodeBlockDialog__panel">
            <textarea
              ref={textareaRef}
              className="CodeBlockDialog__textarea"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (submitError) {
                  setSubmitError("");
                }
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              rows={12}
              placeholder={DEFAULT_CODE_BLOCK}
            />
          </div>

          <div className="CodeBlockDialog__panel CodeBlockDialog__panel--preview">
            <div
              className="CodeBlockDialog__preview"
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
                  fontSize: `${style.fontSize}px`,
                } as CSSProperties
              }
            >
              <div
                className={`CodeBlockDialog__previewContent ${
                  style.wrap ? "CodeBlockDialog__previewContent--wrap" : ""
                } ${
                  style.lineNumbers
                    ? "CodeBlockDialog__previewContent--numbers"
                    : ""
                }`}
                style={{
                  gridTemplateColumns: style.lineNumbers
                    ? `${lineNumberWidth}px max-content`
                    : "max-content",
                }}
              >
                {highlightSegments.length > 0 && (
                  <div
                    className="CodeBlockDialog__previewOverlay"
                    aria-hidden="true"
                  >
                    {highlightSegments.map((segment) => (
                      <div
                        key={`${segment.startLine}-${segment.endLine}`}
                        className="CodeBlockDialog__previewHighlight"
                        style={{
                          top: `${4 + (segment.startLine - 1) * lineHeight}px`,
                          height: `${
                            (segment.endLine - segment.startLine + 1) *
                            lineHeight
                          }px`,
                          ...highlightOverlayStyle,
                        }}
                      />
                    ))}
                  </div>
                )}
                {style.lineNumbers && (
                  <div
                    className="CodeBlockDialog__previewGutter"
                    aria-hidden="true"
                  >
                    {Array.from({ length: lineCount }, (_, index) => {
                      const lineNumber = index + 1;
                      const isHighlighted = isCodeBlockLineHighlighted(
                        lineNumber,
                        highlightSegments,
                      );

                      return (
                        <div
                          key={lineNumber}
                          className={`CodeBlockDialog__previewGutterLine ${
                            isHighlighted
                              ? "CodeBlockDialog__previewGutterLine--highlighted"
                              : ""
                          }`}
                        >
                          {lineNumber}
                        </div>
                      );
                    })}
                  </div>
                )}
                <pre className="CodeBlockDialog__previewPre">
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={{ __html: preview.markup }}
                  />
                </pre>
              </div>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="CodeBlockDialog__error">{submitError}</div>
        )}

        <div className="CodeBlockDialog__actions">
          <div className="CodeBlockDialog__hint">
            {t("codeBlock.shortcutHint")}
          </div>
          <DialogActionButton
            label={t("buttons.cancel")}
            onClick={onClose}
            disabled={isSubmitting}
            style={{ marginRight: 10 }}
          />
          <DialogActionButton
            label={
              mode === "edit" ? t("codeBlock.update") : t("codeBlock.insert")
            }
            type="submit"
            actionType="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Dialog>
  );
};

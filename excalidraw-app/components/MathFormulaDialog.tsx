import { KEYS } from "@excalidraw/common";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { CloseIcon, checkIcon } from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  DEFAULT_MATH_FORMULA,
  getMathFormulaRenderMetadata,
  getMathFormulaParseError,
  normalizeMathFormulaStyle,
  renderMathFormulaMarkup,
  type MathFormulaStyle,
} from "../math/formula";

import "./MathFormulaDialog.scss";

const findMathPlaceholderRange = (value: string, cursorIndex: number) => {
  const placeholders = Array.from(value.matchAll(/\{\}/g)).map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + 2,
  }));

  if (!placeholders.length) {
    return null;
  }

  const nextPlaceholder =
    placeholders.find(({ start }) => start >= cursorIndex) || placeholders[0];

  return {
    start: nextPlaceholder.start + 1,
    end: nextPlaceholder.end - 1,
  };
};

type MathFormulaDialogProps = {
  initialValue?: string;
  initialStyle?: Partial<MathFormulaStyle> | null;
  mode?: "insert" | "edit";
  onClose: () => void;
  onSubmit: (formula: string, style: MathFormulaStyle) => Promise<void>;
};

export const MathFormulaDialog = ({
  initialValue = DEFAULT_MATH_FORMULA,
  initialStyle,
  mode = "insert",
  onClose,
  onSubmit,
}: MathFormulaDialogProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [formula, setFormula] = useState(initialValue);
  const [style, setStyle] = useState<MathFormulaStyle>(() =>
    normalizeMathFormulaStyle(initialStyle),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setFormula(initialValue);
    setStyle(normalizeMathFormulaStyle(initialStyle));
    setSubmitError("");
  }, [initialStyle, initialValue]);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const normalizedFormula = formula.trim();
  const previewMarkup = useMemo(
    () =>
      renderMathFormulaMarkup(normalizedFormula || DEFAULT_MATH_FORMULA, style),
    [normalizedFormula, style],
  );
  const previewMetadata = useMemo(
    () =>
      getMathFormulaRenderMetadata(
        normalizedFormula || DEFAULT_MATH_FORMULA,
        style,
      ),
    [normalizedFormula, style],
  );
  const parseError = useMemo(
    () => getMathFormulaParseError(normalizedFormula),
    [normalizedFormula],
  );
  const parseErrorPositionHint = useMemo(() => {
    if (typeof parseError?.position !== "number") {
      return "";
    }
    return t("mathFormula.parseErrorAt", {
      position: String(parseError.position),
    });
  }, [parseError]);
  const statusMessage = submitError || parseError?.message || "";

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!normalizedFormula) {
      setSubmitError(t("mathFormula.errors.empty"));
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await onSubmit(normalizedFormula, style);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("mathFormula.errors.saveFailed"),
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

    if (event.key === KEYS.TAB) {
      event.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const cursorIndex = event.shiftKey
        ? Math.max(0, textarea.selectionStart - 1)
        : textarea.selectionStart;
      const range = findMathPlaceholderRange(formula, cursorIndex);
      if (!range) {
        return;
      }
      textarea.setSelectionRange(range.start, range.end);
      return;
    }

    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      onClose();
    }
  };

  const primaryActionLabel =
    mode === "edit" ? t("mathFormula.update") : t("mathFormula.insert");

  return (
    <Dialog
      size="regular"
      className="MathFormulaDialog__dialog"
      title=""
      onCloseRequest={onClose}
      autofocus={false}
      closeOnClickOutside={true}
    >
      <form
        className="MathFormulaDialog"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="MathFormulaDialog__toolbar">
          <label
            className="MathFormulaDialog__toggle"
            title={t("mathFormula.displayMode")}
          >
            <input
              type="checkbox"
              checked={style.displayMode}
              onChange={(event) =>
                setStyle((prev) => ({
                  ...prev,
                  displayMode: event.target.checked,
                }))
              }
            />
            <span>{t("mathFormula.block")}</span>
          </label>
          <div className="MathFormulaDialog__toolbarActions">
            <button
              type="button"
              className="MathFormulaDialog__iconButton"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label={t("buttons.cancel")}
              title={t("buttons.cancel")}
            >
              {CloseIcon}
            </button>
            <button
              type="submit"
              className="MathFormulaDialog__iconButton MathFormulaDialog__iconButton--primary"
              disabled={isSubmitting}
              aria-label={primaryActionLabel}
              title={primaryActionLabel}
            >
              {checkIcon}
            </button>
          </div>
        </div>

        <div className="MathFormulaDialog__surface">
          <div className="MathFormulaDialog__panel MathFormulaDialog__panel--editor">
            <div className="MathFormulaDialog__panelLabel">
              {t("mathFormula.source")}
            </div>
            <textarea
              id="math-formula-input"
              ref={textareaRef}
              className="MathFormulaDialog__textarea"
              value={formula}
              onChange={(event) => {
                setFormula(event.target.value);
                if (submitError) {
                  setSubmitError("");
                }
              }}
              onKeyDown={handleKeyDown}
              rows={4}
              spellCheck={false}
              placeholder={DEFAULT_MATH_FORMULA}
            />
          </div>
          <div className="MathFormulaDialog__panel MathFormulaDialog__panel--preview">
            <div className="MathFormulaDialog__panelLabel">
              {t("mathFormula.preview")}
            </div>
            <div className="MathFormulaDialog__previewSurface">
              <div
                className="MathFormulaDialog__previewContent"
                style={{
                  color: style.color,
                  fontSize: style.fontSize,
                  fontFamily: previewMetadata.fontFamily,
                  textShadow: previewMetadata.textShadow,
                  justifyContent: style.displayMode ? "center" : "flex-start",
                }}
                dangerouslySetInnerHTML={{ __html: previewMarkup }}
              />
            </div>
          </div>
        </div>

        <div
          className="MathFormulaDialog__statusRow"
          role={statusMessage ? "status" : undefined}
          aria-live="polite"
        >
          {statusMessage && (
            <div className="MathFormulaDialog__error">
              <div>{statusMessage}</div>
              {!submitError && parseErrorPositionHint && (
                <div>{parseErrorPositionHint}</div>
              )}
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
};

import { KEYS } from "@excalidraw/common";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
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
  normalizeMathFormulaStyle,
  renderMathFormulaMarkup,
  type MathFormulaStyle,
} from "../math/formula";

import "./MathFormulaDialog.scss";

const FONT_SIZE_PRESETS = [
  { label: "S", value: 20 },
  { label: "M", value: 28 },
  { label: "L", value: 36 },
  { label: "XL", value: 48 },
];

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

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!normalizedFormula) {
      setSubmitError("Formula cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await onSubmit(normalizedFormula, style);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save formula.",
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

  const primaryActionLabel = mode === "edit" ? "Update" : "Insert";

  return (
    <Dialog
      size="regular"
      className="MathFormulaDialog__dialog"
      title={mode === "edit" ? "Equation" : "New equation"}
      onCloseRequest={onClose}
      autofocus={false}
      closeOnClickOutside={true}
    >
      <form
        className="MathFormulaDialog"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="MathFormulaDialog__toolbar">
          <div className="MathFormulaDialog__toolbarGroup">
            <span className="MathFormulaDialog__toolbarHint">Size</span>
            <div className="MathFormulaDialog__sizeOptions">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="MathFormulaDialog__styleChip"
                  data-active={style.fontSize === preset.value}
                  onClick={() =>
                    setStyle((prev) => ({ ...prev, fontSize: preset.value }))
                  }
                  title={`Font size ${preset.label}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="MathFormulaDialog__toggle" title="Display mode">
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
            <span>Block</span>
          </label>
        </div>

        <div className="MathFormulaDialog__surface">
          <div className="MathFormulaDialog__panel MathFormulaDialog__panel--editor">
            <div className="MathFormulaDialog__panelLabel">Source</div>
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
            <div className="MathFormulaDialog__panelLabel">Preview</div>
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

        {submitError && (
          <div className="MathFormulaDialog__error">{submitError}</div>
        )}

        <div className="MathFormulaDialog__actions">
          <div className="MathFormulaDialog__hint">Ctrl/Cmd + Enter</div>
          <DialogActionButton
            label={t("buttons.cancel")}
            onClick={onClose}
            disabled={isSubmitting}
            style={{ marginRight: 10 }}
          />
          <DialogActionButton
            label={primaryActionLabel}
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

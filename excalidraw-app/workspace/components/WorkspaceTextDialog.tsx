import { t } from "@excalidraw/excalidraw/i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";

type WorkspaceTextDialogProps = {
  open: boolean;
  title: string;
  initialValue: string;
  submitLabel: string;
  inputLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
};

export const WorkspaceTextDialog = ({
  open,
  title,
  initialValue,
  submitLabel,
  inputLabel,
  onClose,
  onSubmit,
}: WorkspaceTextDialogProps) => {
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue(initialValue);
    setIsSubmitting(false);
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open, initialValue]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(value);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="workspace-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="workspace-modal" role="dialog" aria-modal="true">
        <h2 className="workspace-modal__title">{title}</h2>
        <form className="workspace-modal__form" onSubmit={handleSubmit}>
          <label className="workspace-modal__label">
            {inputLabel ? (
              <span className="workspace-modal__label-text">{inputLabel}</span>
            ) : null}
            <input
              ref={inputRef}
              className="workspace-modal__input"
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="workspace-modal__actions">
            <button
              type="button"
              className="workspace-modal__button workspace-modal__button--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("buttons.cancel")}
            </button>
            <button
              type="submit"
              className="workspace-modal__button workspace-modal__button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import { useEffect, useId, useRef, useState } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import type { BackendId } from "../types";

type WorkspaceBackendMenuProps = {
  theme: "light" | "dark";
  selectedBackend: BackendId;
  onChangeBackend: (next: BackendId) => void;
};

const BACKEND_IDS: BackendId[] = ["google-drive", "local"];

const backendLabel = (id: BackendId) =>
  id === "google-drive"
    ? t("workspace.googleDrive", null, "Google Drive")
    : t("workspace.localDirectory", null, "Local directory");

export const WorkspaceBackendMenu = ({
  theme,
  selectedBackend,
  onChangeBackend,
}: WorkspaceBackendMenuProps) => {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const node = wrapRef.current;
      if (!node || !open) {
        return;
      }
      if (event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const currentLabel = backendLabel(selectedBackend);

  const pick = (next: BackendId) => {
    onChangeBackend(next);
    setOpen(false);
  };

  return (
    <div className="workspace-backend-menu" ref={wrapRef}>
      <button
        type="button"
        className="workspace-backend-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        aria-label={t("workspace.storageBackend")}
        title={t("workspace.storageBackend")}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="workspace-backend-menu__trigger-label">
          {currentLabel}
        </span>
        <span className="workspace-backend-menu__trigger-chevron" aria-hidden>
          <svg
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1.25L5 4.75L9 1.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className={`workspace-settings__panel workspace-settings__panel--${theme} workspace-backend-menu__panel`}
          role="menu"
        >
          <ul className="workspace-settings__list">
            {BACKEND_IDS.map((optId) => {
              const active = selectedBackend === optId;
              return (
                <li key={optId} className="workspace-settings__list-item">
                  <button
                    type="button"
                    className={
                      active
                        ? "workspace-settings__list-row workspace-settings__list-row--export workspace-backend-menu__option workspace-backend-menu__option--active"
                        : "workspace-settings__list-row workspace-settings__list-row--export workspace-backend-menu__option"
                    }
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => pick(optId)}
                  >
                    {backendLabel(optId)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

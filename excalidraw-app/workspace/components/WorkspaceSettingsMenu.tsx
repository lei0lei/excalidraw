import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import {
  getWorkspaceAutosaveMinutes,
  setWorkspaceAutosaveMinutes,
  WORKSPACE_AUTOSAVE_CHANGED_EVENT,
  WORKSPACE_AUTOSAVE_MAX_MINUTES,
  WORKSPACE_AUTOSAVE_MIN_MINUTES,
} from "../workspaceAutosaveSettings";

type WorkspaceSettingsMenuProps = {
  theme: "light" | "dark";
  exportDisabled: boolean;
  exportBusy: boolean;
  onExport: () => void | Promise<void>;
};

const clampMinutes = (n: number) =>
  Math.min(
    WORKSPACE_AUTOSAVE_MAX_MINUTES,
    Math.max(WORKSPACE_AUTOSAVE_MIN_MINUTES, Math.round(n)),
  );

export const WorkspaceSettingsMenu = ({
  theme,
  exportDisabled,
  exportBusy,
  onExport,
}: WorkspaceSettingsMenuProps) => {
  const panelId = useId();
  const autosaveMinutesInputId = useId();
  const [open, setOpen] = useState(false);
  const [minutesDraft, setMinutesDraft] = useState(() =>
    String(getWorkspaceAutosaveMinutes()),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const syncMinutesFromStorage = useCallback(() => {
    const v = getWorkspaceAutosaveMinutes();
    setMinutesDraft(String(v));
  }, []);

  useEffect(() => {
    const sync = () => syncMinutesFromStorage();
    window.addEventListener(WORKSPACE_AUTOSAVE_CHANGED_EVENT, sync);
    return () =>
      window.removeEventListener(WORKSPACE_AUTOSAVE_CHANGED_EVENT, sync);
  }, [syncMinutesFromStorage]);

  useEffect(() => {
    if (open) {
      syncMinutesFromStorage();
    }
  }, [open, syncMinutesFromStorage]);

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

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const onMinutesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value.replace(/\D/g, "");
      setMinutesDraft(raw);
      if (raw === "") {
        return;
      }
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n)) {
        return;
      }
      setWorkspaceAutosaveMinutes(clampMinutes(n));
      setMinutesDraft(String(getWorkspaceAutosaveMinutes()));
    },
    [],
  );

  const onMinutesBlur = useCallback(() => {
    if (minutesDraft === "") {
      setWorkspaceAutosaveMinutes(0);
      setMinutesDraft("0");
      return;
    }
    const n = Number.parseInt(minutesDraft, 10);
    const next = Number.isFinite(n)
      ? clampMinutes(n)
      : getWorkspaceAutosaveMinutes();
    setWorkspaceAutosaveMinutes(next);
    setMinutesDraft(String(getWorkspaceAutosaveMinutes()));
  }, [minutesDraft]);

  const handleExportClick = useCallback(async () => {
    await onExport();
    setOpen(false);
  }, [onExport]);

  return (
    <div className="workspace-settings" ref={wrapRef}>
      <button
        type="button"
        className="workspace-topbar__icon-button workspace-settings__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("workspace.settingsMenu")}
        title={t("workspace.settingsMenu")}
        onClick={toggle}
      >
        <span
          className="workspace-inline-icon workspace-settings__icon"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="1.75"
              fill="none"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className={`workspace-settings__panel workspace-settings__panel--${theme}`}
          role="menu"
        >
          <ul className="workspace-settings__list">
            <li className="workspace-settings__list-item">
              <button
                type="button"
                className="workspace-settings__list-row workspace-settings__list-row--export"
                role="menuitem"
                disabled={exportDisabled || exportBusy}
                onClick={() => {
                  void handleExportClick();
                }}
              >
                {exportBusy
                  ? t("workspace.exporting", null, "Exporting…")
                  : t("workspace.settingsExportLabel", null, "Export")}
              </button>
            </li>
            <li className="workspace-settings__list-item">
              <div className="workspace-settings__list-row workspace-settings__list-row--autosave">
                <label
                  className="workspace-settings__autosave-label"
                  htmlFor={autosaveMinutesInputId}
                >
                  {t("workspace.settingsAutoSaveLabel", null, "Autosave")}
                </label>
                <div className="workspace-settings__autosave-control">
                  <input
                    id={autosaveMinutesInputId}
                    className="workspace-settings__minutes-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4}
                    value={minutesDraft}
                    onChange={onMinutesChange}
                    onBlur={onMinutesBlur}
                  />
                  <span
                    className="workspace-settings__minutes-unit"
                    aria-hidden
                  >
                    {t("workspace.autoSaveUnit", null, "min")}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
};

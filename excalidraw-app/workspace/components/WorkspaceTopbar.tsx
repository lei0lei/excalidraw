import { t } from "@excalidraw/excalidraw/i18n";

import { WorkspaceBackendMenu } from "./WorkspaceBackendMenu";
import { WorkspaceSettingsMenu } from "./WorkspaceSettingsMenu";

import type { BackendId, WorkspaceErrorState } from "../types";

type WorkspaceTopbarProps = {
  theme: "light" | "dark";
  selectedBackend: BackendId;
  onChangeBackend: (next: BackendId) => void;
  onBackToEditor: () => void;
  onConnectDrive: () => void;
  onChooseRootFolder: () => void;
  canConnectDrive: boolean;
  canChooseRoot: boolean;
  isDriveConnected: boolean;
  isLocalSupported: boolean;
  errorState: WorkspaceErrorState;
  onDismissError: () => void;
  onRetryError: () => void;
  exportDisabled: boolean;
  exportBusy: boolean;
  onExportWorkspace: () => void | Promise<void>;
};

export const WorkspaceTopbar = ({
  theme,
  selectedBackend,
  onChangeBackend,
  onBackToEditor,
  onConnectDrive,
  onChooseRootFolder,
  canConnectDrive,
  canChooseRoot,
  isDriveConnected,
  isLocalSupported,
  errorState,
  onDismissError,
  onRetryError,
  exportDisabled,
  exportBusy,
  onExportWorkspace,
}: WorkspaceTopbarProps) => {
  const statusTitle =
    selectedBackend === "google-drive"
      ? isDriveConnected
        ? t("workspace.googleDriveConnected")
        : t("workspace.googleDriveNotConnected")
      : isLocalSupported
      ? t("workspace.localDirectoryAvailable")
      : t("workspace.localDirectoryUnavailable");

  const dotClassName =
    selectedBackend === "google-drive"
      ? isDriveConnected
        ? "workspace-status-dot--connected"
        : "workspace-status-dot--disconnected"
      : isLocalSupported
      ? "workspace-status-dot--connected"
      : "workspace-status-dot--disconnected";

  return (
    <>
      <header className="workspace-topbar">
        <button
          type="button"
          className="workspace-topbar__icon-button workspace-topbar__icon-button--back"
          onClick={onBackToEditor}
          aria-label={t("workspace.backToEditor")}
          title={t("workspace.backToEditor")}
        >
          ←
        </button>
        <WorkspaceBackendMenu
          theme={theme}
          selectedBackend={selectedBackend}
          onChangeBackend={onChangeBackend}
        />
        <span
          className={`workspace-status-dot workspace-topbar__status-dot ${dotClassName}`}
          title={statusTitle}
        />
        <button
          type="button"
          className="workspace-topbar__icon-button"
          onClick={onConnectDrive}
          disabled={!canConnectDrive}
          aria-label={t("workspace.connectGoogleDrive")}
          title={t("workspace.connectGoogleDrive")}
        >
          ⛓
        </button>
        <button
          type="button"
          className="workspace-topbar__icon-button"
          onClick={onChooseRootFolder}
          disabled={!canChooseRoot}
          aria-label={t("workspace.chooseFolder")}
          title={t("workspace.chooseFolder")}
        >
          📁
        </button>
        <span className="workspace-topbar__spacer" aria-hidden />
        <WorkspaceSettingsMenu
          theme={theme}
          exportDisabled={exportDisabled}
          exportBusy={exportBusy}
          onExport={onExportWorkspace}
        />
      </header>

      {errorState ? (
        <div className="workspace-error-banner" role="alert">
          <span className="workspace-error-banner__message">
            {errorState.message}
          </span>
          {errorState.action ? (
            <button
              type="button"
              className="workspace-error-banner__retry"
              onClick={onRetryError}
            >
              {errorState.action === "reconnect"
                ? t("workspace.reconnect")
                : t("workspace.retry")}
            </button>
          ) : null}
          <button
            type="button"
            className="workspace-error-banner__dismiss"
            onClick={onDismissError}
            aria-label={t("workspace.dismissError")}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
};

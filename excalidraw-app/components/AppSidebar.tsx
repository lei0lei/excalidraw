import { DefaultSidebar } from "@excalidraw/excalidraw";
import {
  LoadIcon,
  downloadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";

import "./AppSidebar.scss";

export const AppSidebar = ({
  onOpenWorkspace,
  onInstallPWA,
  showInstallPWA = false,
}: {
  onOpenWorkspace: () => void;
  onInstallPWA?: () => void;
  showInstallPWA?: boolean;
}) => {
  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <button
          type="button"
          className="excalidraw-button sidebar-tab-trigger app-sidebar-workspace-trigger"
          title="Open workspace"
          aria-label="Open workspace"
          onClick={onOpenWorkspace}
        >
          {LoadIcon}
        </button>
        {showInstallPWA && onInstallPWA && (
          <button
            type="button"
            className="excalidraw-button sidebar-tab-trigger app-sidebar-install-trigger"
            title={t("labels.installPWA")}
            aria-label={t("labels.installPWA")}
            onClick={onInstallPWA}
          >
            {downloadIcon}
          </button>
        )}
      </DefaultSidebar.TabTriggers>
    </DefaultSidebar>
  );
};

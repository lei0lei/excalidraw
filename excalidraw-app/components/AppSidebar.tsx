import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import {
  LoadIcon,
  downloadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";

import { UmlClassSidebar } from "./UmlClassSidebar";
import { UmlDiagramSidebar } from "./UmlDiagramSidebar";

import "./AppSidebar.scss";

import type { UmlClassTemplateData } from "../templates/umlClass";
import type { UmlDiagramTemplateData } from "../templates/umlDiagram";

const UML_TAB_ID = "uml-template";
const UmlTemplateIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4.75h12a1.25 1.25 0 0 1 1.25 1.25v12A1.25 1.25 0 0 1 18 19.25H6A1.25 1.25 0 0 1 4.75 18V6A1.25 1.25 0 0 1 6 4.75Z" />
      <path d="M7.75 9h8.5M7.75 12h8.5M7.75 15h5.5" />
    </g>
  </svg>
);

export const AppSidebar = ({
  onOpenWorkspace,
  onInstallPWA,
  showInstallPWA = false,
  umlTemplateData,
  onChangeUmlTemplate,
  umlDiagramTemplateData,
  onChangeUmlDiagramTemplate,
}: {
  onOpenWorkspace: () => void;
  onInstallPWA?: () => void;
  showInstallPWA?: boolean;
  umlTemplateData?: UmlClassTemplateData | null;
  onChangeUmlTemplate?: (data: UmlClassTemplateData) => void;
  umlDiagramTemplateData?: UmlDiagramTemplateData | null;
  onChangeUmlDiagramTemplate?: (data: UmlDiagramTemplateData) => void;
}) => {
  const shouldShowUmlEditor =
    (umlTemplateData && onChangeUmlTemplate) ||
    (umlDiagramTemplateData && onChangeUmlDiagramTemplate);

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
        {shouldShowUmlEditor && (
          <Sidebar.TabTrigger tab={UML_TAB_ID} title="Template editor">
            {UmlTemplateIcon}
          </Sidebar.TabTrigger>
        )}
      </DefaultSidebar.TabTriggers>
      {shouldShowUmlEditor && (
        <Sidebar.Tab tab={UML_TAB_ID}>
          {umlTemplateData && onChangeUmlTemplate ? (
            <UmlClassSidebar
              data={umlTemplateData}
              onChange={onChangeUmlTemplate}
            />
          ) : umlDiagramTemplateData && onChangeUmlDiagramTemplate ? (
            <UmlDiagramSidebar
              data={umlDiagramTemplateData}
              onChange={onChangeUmlDiagramTemplate}
            />
          ) : null}
        </Sidebar.Tab>
      )}
    </DefaultSidebar>
  );
};

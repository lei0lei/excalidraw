import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import {
  LoadIcon,
  downloadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { t } from "@excalidraw/excalidraw/i18n";

import { ChartGraphicSidebar } from "./ChartGraphicSidebar";
import { UmlClassSidebar } from "./UmlClassSidebar";
import { UmlDiagramSidebar } from "./UmlDiagramSidebar";

import "./AppSidebar.scss";

import type {
  BarChartTemplateData,
  ChartGraphicPreset,
  UmlClassTemplateData,
  UmlDiagramTemplateData,
} from "../templates";

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
  chartGraphicPreset,
  barChartTemplateData,
  onBarChartTemplateChange,
  barChartTemplateRootId,
}: {
  onOpenWorkspace: () => void;
  onInstallPWA?: () => void;
  showInstallPWA?: boolean;
  umlTemplateData?: UmlClassTemplateData | null;
  onChangeUmlTemplate?: (data: UmlClassTemplateData) => void;
  umlDiagramTemplateData?: UmlDiagramTemplateData | null;
  onChangeUmlDiagramTemplate?: (data: UmlDiagramTemplateData) => void;
  chartGraphicPreset?: ChartGraphicPreset | null;
  barChartTemplateData?: BarChartTemplateData | null;
  onBarChartTemplateChange?: (data: BarChartTemplateData) => void;
  barChartTemplateRootId?: string | null;
}) => {
  const shouldShowTemplateEditor =
    (umlTemplateData && onChangeUmlTemplate) ||
    (umlDiagramTemplateData && onChangeUmlDiagramTemplate) ||
    chartGraphicPreset != null;

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
        {shouldShowTemplateEditor && (
          <Sidebar.TabTrigger tab={UML_TAB_ID} title="Template editor">
            {UmlTemplateIcon}
          </Sidebar.TabTrigger>
        )}
      </DefaultSidebar.TabTriggers>
      {shouldShowTemplateEditor && (
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
          ) : chartGraphicPreset ? (
            <ChartGraphicSidebar
              preset={chartGraphicPreset}
              barChartData={barChartTemplateData}
              onBarChartChange={onBarChartTemplateChange}
              barChartTemplateRootId={barChartTemplateRootId}
            />
          ) : null}
        </Sidebar.Tab>
      )}
    </DefaultSidebar>
  );
};

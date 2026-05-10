import { useI18n } from "@excalidraw/excalidraw";

import "./ChartGraphicSidebar.scss";

import { BarChartTemplateSidebar } from "./BarChartTemplateSidebar";

import type { BarChartTemplateData, ChartGraphicPreset } from "../templates";

type ChartGraphicSidebarProps = {
  preset: ChartGraphicPreset;
  barChartData?: BarChartTemplateData | null;
  onBarChartChange?: (data: BarChartTemplateData) => void;
  barChartTemplateRootId?: string | null;
};

export const ChartGraphicSidebar = ({
  preset,
  barChartData,
  onBarChartChange,
  barChartTemplateRootId = null,
}: ChartGraphicSidebarProps) => {
  const { t } = useI18n();

  if (preset === "bar-chart" && barChartData && onBarChartChange) {
    return (
      <BarChartTemplateSidebar
        data={barChartData}
        onChange={onBarChartChange}
        templateInstanceId={barChartTemplateRootId}
      />
    );
  }

  return (
    <div className="ChartGraphicSidebar">
      <div className="ChartGraphicSidebar__content">
        <div className="ChartGraphicSidebar__preset">{preset}</div>
        <p className="ChartGraphicSidebar__hint">
          {t(
            "labels.chartTemplateSidebarPlaceholder",
            null,
            "Chart options will appear here. For now you can edit the sketch directly on canvas.",
          )}
        </p>
      </div>
    </div>
  );
};

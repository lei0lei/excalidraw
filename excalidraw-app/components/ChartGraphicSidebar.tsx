import { useI18n } from "@excalidraw/excalidraw";

import "./ChartGraphicSidebar.scss";

import { BarChartTemplateSidebar } from "./BarChartTemplateSidebar";
import { LineChartTemplateSidebar } from "./LineChartTemplateSidebar";
import { PieChartTemplateSidebar } from "./PieChartTemplateSidebar";

import type {
  BarChartTemplateData,
  ChartGraphicPreset,
  LineChartTemplateData,
  PieChartTemplateData,
} from "../templates";

type ChartGraphicSidebarProps = {
  preset: ChartGraphicPreset;
  barChartData?: BarChartTemplateData | null;
  onBarChartChange?: (data: BarChartTemplateData) => void;
  lineChartData?: LineChartTemplateData | null;
  onLineChartChange?: (data: LineChartTemplateData) => void;
  pieChartData?: PieChartTemplateData | null;
  onPieChartChange?: (data: PieChartTemplateData) => void;
  chartTemplateRootId?: string | null;
};

export const ChartGraphicSidebar = ({
  preset,
  barChartData,
  onBarChartChange,
  lineChartData,
  onLineChartChange,
  pieChartData,
  onPieChartChange,
  chartTemplateRootId = null,
}: ChartGraphicSidebarProps) => {
  const { t } = useI18n();

  if (preset === "bar-chart" && barChartData && onBarChartChange) {
    return (
      <BarChartTemplateSidebar
        data={barChartData}
        onChange={onBarChartChange}
        templateInstanceId={chartTemplateRootId}
      />
    );
  }

  if (preset === "line-chart" && lineChartData && onLineChartChange) {
    return (
      <LineChartTemplateSidebar
        data={lineChartData}
        onChange={onLineChartChange}
        templateInstanceId={chartTemplateRootId}
      />
    );
  }

  if (preset === "pie-chart" && pieChartData && onPieChartChange) {
    return (
      <PieChartTemplateSidebar
        data={pieChartData}
        onChange={onPieChartChange}
        templateInstanceId={chartTemplateRootId}
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

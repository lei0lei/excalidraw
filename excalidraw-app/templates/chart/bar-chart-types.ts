import type { FillStyle } from "@excalidraw/element/types";

/** One bar category in the editable histogram sketch. */
export type BarChartItemData = {
  id: string;
  /** Category name along the baseline. */
  label: string;
  backgroundColor: string;
  strokeColor: string;
  /** Relative height 0–1 within the plot. */
  value: number;
  fillStyle: FillStyle;
};

/** Editable histogram / bar-chart widget (canvas + grouped items). */
export type BarChartTemplateData = {
  title: string;
  /**
   * When false, the outer chart frame stroke width is forced to 0.
   * When true, stroke width / style / colour come from the chart root rectangle
   * (main properties sidebar), like any other shape.
   */
  frameBorderEnabled: boolean;
  /** Horizontal axis title text. */
  xAxisLabel: string;
  /** Vertical axis title text. */
  yAxisLabel: string;
  showAxisTicks: boolean;
  legendVisible: boolean;
  items: BarChartItemData[];
};

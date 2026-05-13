/** One sample / category along the X axis. */
export type LineChartItemData = {
  id: string;
  label: string;
  /** Normalized Y height in the plot (0–1). */
  value: number;
};

/** Editable line-chart widget (canvas + grouped items). */
export type LineChartTemplateData = {
  title: string;
  frameBorderEnabled: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  showAxisTicks: boolean;
  legendVisible: boolean;
  items: LineChartItemData[];
};

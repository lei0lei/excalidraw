import type { BarChartItemData } from "./bar-chart-types";

/** One pie segment (same colour / fill fields as a bar row). */
export type PieChartItemData = BarChartItemData;

/** Editable pie-chart widget (canvas + grouped items). */
export type PieChartTemplateData = {
  title: string;
  frameBorderEnabled: boolean;
  legendVisible: boolean;
  items: PieChartItemData[];
};

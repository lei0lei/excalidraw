import { FONT_FAMILY, randomId } from "@excalidraw/common";
import {
  newElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type { AppState } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  BAR_CHART_FRAME_H,
  BAR_CHART_FRAME_W,
  buildInitialBarChartElements,
  createDefaultBarChartTemplateData,
} from "./bar-chart-template";
import {
  buildInitialLineChartElements,
  createDefaultLineChartTemplateData,
} from "./line-chart-template";
import {
  buildInitialPieChartElements,
  createDefaultPieChartTemplateData,
} from "./pie-chart-template";
import {
  tagChartGraphicElements,
  type ChartGraphicPreset,
} from "./chart-graphic-metadata";

export type { ChartGraphicPreset } from "./chart-graphic-metadata";

const STROKE = "#374151";
const MUTED = "#9ca3af";
const CHART_FONT = FONT_FAMILY.Helvetica;

const FRAME_W = 360;
const FRAME_H = 260;

const plotLeft = 52;
const plotTop = 44;
const plotW = FRAME_W - plotLeft - 28;
const plotH = FRAME_H - plotTop - 48;

export const createChartGraphic = (
  centerX: number,
  centerY: number,
  preset: ChartGraphicPreset,
  appState?: AppState | null,
): NonDeletedExcalidrawElement[] => {
  const groupIds = [randomId()];

  if (preset === "bar-chart") {
    const left = centerX - BAR_CHART_FRAME_W / 2;
    const top = centerY - BAR_CHART_FRAME_H / 2;
    const barData = createDefaultBarChartTemplateData();
    const rawElements = buildInitialBarChartElements({
      frameX: left,
      frameY: top,
      groupIds,
      data: barData,
      appState,
    });
    return tagChartGraphicElements(rawElements, preset, {
      barChartTemplateData: barData,
    });
  }

  if (preset === "line-chart") {
    const left = centerX - BAR_CHART_FRAME_W / 2;
    const top = centerY - BAR_CHART_FRAME_H / 2;
    const lineData = createDefaultLineChartTemplateData();
    const rawElements = buildInitialLineChartElements({
      frameX: left,
      frameY: top,
      groupIds,
      data: lineData,
      appState,
    });
    return tagChartGraphicElements(rawElements, preset, {
      lineChartTemplateData: lineData,
    });
  }

  if (preset === "pie-chart") {
    const left = centerX - BAR_CHART_FRAME_W / 2;
    const top = centerY - BAR_CHART_FRAME_H / 2;
    const pieData = createDefaultPieChartTemplateData();
    const rawElements = buildInitialPieChartElements({
      frameX: left,
      frameY: top,
      groupIds,
      data: pieData,
      appState,
    });
    return tagChartGraphicElements(rawElements, preset, {
      pieChartTemplateData: pieData,
    });
  }

  const left = centerX - FRAME_W / 2;
  const top = centerY - FRAME_H / 2;

  const rawElements = ((): NonDeletedExcalidrawElement[] => {
    switch (preset) {
      case "matrix-2x2":
      default:
        return createMatrix2x2(left, top, groupIds);
    }
  })();

  return tagChartGraphicElements(rawElements, preset);
};

const frame = (
  x: number,
  y: number,
  groupIds: string[],
): NonDeletedExcalidrawElement =>
  newElement({
    type: "rectangle",
    x,
    y,
    width: FRAME_W,
    height: FRAME_H,
    strokeColor: STROKE,
    backgroundColor: "#f9fafb",
    fillStyle: "solid",
    strokeWidth: 1.5,
    roundness: { type: 3, value: 10 },
    roughness: 0,
    groupIds,
  });

type LineGeom = {
  x: number;
  y: number;
  width: number;
  height: number;
  points: ReadonlyArray<readonly [number, number]>;
};

const axisLine = (
  geom: LineGeom & {
    groupIds: string[];
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
  },
): NonDeletedExcalidrawElement => {
  const { groupIds, strokeColor, strokeWidth, strokeStyle, ...rest } = geom;
  return newLinearElement({
    type: "line",
    ...rest,
    strokeColor: strokeColor ?? STROKE,
    strokeWidth: strokeWidth ?? 1.5,
    strokeStyle: strokeStyle ?? "solid",
    roughness: 0,
    groupIds,
    points: rest.points as any,
  });
};

function createMatrix2x2(
  left: number,
  top: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] {
  const els: NonDeletedExcalidrawElement[] = [];
  els.push(frame(left, top, groupIds));

  els.push(
    newTextElement({
      x: left + FRAME_W / 2,
      y: top + 18,
      text: "2×2 Matrix",
      fontSize: 18,
      fontFamily: CHART_FONT,
      textAlign: "center",
      strokeColor: "#111827",
      groupIds,
    }),
  );

  const mx = left + plotLeft;
  const my = top + plotTop + 12;
  const mw = plotW;
  const mh = plotH - 16;

  els.push(
    axisLine({
      x: mx + mw / 2,
      y: my,
      width: 0,
      height: mh,
      points: [
        [0, 0],
        [0, mh],
      ],
      strokeColor: STROKE,
      strokeWidth: 1.5,
      strokeStyle: "dashed",
      groupIds,
    }),
  );
  els.push(
    axisLine({
      x: mx,
      y: my + mh / 2,
      width: mw,
      height: 0,
      points: [
        [0, 0],
        [mw, 0],
      ],
      strokeColor: STROKE,
      strokeWidth: 1.5,
      strokeStyle: "dashed",
      groupIds,
    }),
  );

  const labels: [string, number, number][] = [
    ["High / Quick", mw * 0.22, mh * 0.22],
    ["High / Slow", mw * 0.72, mh * 0.22],
    ["Low / Quick", mw * 0.22, mh * 0.62],
    ["Low / Slow", mw * 0.72, mh * 0.62],
  ];

  for (const [text, lx, ly] of labels) {
    els.push(
      newTextElement({
        x: mx + lx,
        y: my + ly,
        text,
        fontSize: 13,
        fontFamily: CHART_FONT,
        textAlign: "center",
        strokeColor: "#374151",
        groupIds,
      }),
    );
  }

  els.push(
    newTextElement({
      x: mx + 12,
      y: my - 6,
      text: "↑ Impact",
      fontSize: 11,
      fontFamily: CHART_FONT,
      textAlign: "left",
      strokeColor: MUTED,
      groupIds,
    }),
  );

  els.push(
    newTextElement({
      x: mx + mw / 2,
      y: my + mh + 22,
      text: "Effort →",
      fontSize: 11,
      fontFamily: CHART_FONT,
      textAlign: "center",
      strokeColor: MUTED,
      groupIds,
    }),
  );

  return els;
}

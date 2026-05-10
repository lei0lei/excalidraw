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
  tagChartGraphicElements,
  type ChartGraphicPreset,
} from "./chart-graphic-metadata";

export type { ChartGraphicPreset } from "./chart-graphic-metadata";

const STROKE = "#374151";
const MUTED = "#9ca3af";
const ACCENT = "#6366f1";
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

  const left = centerX - FRAME_W / 2;
  const top = centerY - FRAME_H / 2;

  const rawElements = ((): NonDeletedExcalidrawElement[] => {
    switch (preset) {
      case "line-chart":
        return createLineChart(left, top, groupIds);
      case "pie-chart":
        return createPieChart(left, top, groupIds);
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

function createLineChart(
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
      text: "Line chart",
      fontSize: 18,
      fontFamily: CHART_FONT,
      textAlign: "center",
      strokeColor: "#111827",
      groupIds,
    }),
  );

  const bx0 = left + plotLeft;
  const by0 = top + plotTop;

  els.push(
    axisLine({
      x: bx0,
      y: by0 + plotH,
      width: plotW,
      height: 0,
      points: [
        [0, 0],
        [plotW, 0],
      ],
      groupIds,
    }),
  );
  els.push(
    axisLine({
      x: bx0,
      y: by0,
      width: 0,
      height: plotH,
      points: [
        [0, 0],
        [0, plotH],
      ],
      groupIds,
    }),
  );

  const normX = (t: number) => t * plotW;
  const normY = (v: number) => (1 - v) * plotH;
  const pts: [number, number][] = [
    [0, 0.75],
    [0.2, 0.45],
    [0.4, 0.55],
    [0.55, 0.25],
    [0.72, 0.4],
    [1, 0.3],
  ].map(([tx, ty]) => [normX(tx), normY(ty)]);

  els.push(
    newLinearElement({
      type: "line",
      x: bx0,
      y: by0,
      width: plotW,
      height: plotH,
      points: pts as any,
      strokeColor: ACCENT,
      strokeWidth: 2.5,
      roughness: 0,
      groupIds,
    }),
  );

  for (const [px, py] of pts) {
    els.push(
      newElement({
        type: "ellipse",
        x: bx0 + px - 4,
        y: by0 + py - 4,
        width: 8,
        height: 8,
        strokeColor: ACCENT,
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeWidth: 1.5,
        roughness: 0,
        groupIds,
      }),
    );
  }

  return els;
}

function createPieChart(
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
      text: "Pie chart",
      fontSize: 18,
      fontFamily: CHART_FONT,
      textAlign: "center",
      strokeColor: "#111827",
      groupIds,
    }),
  );

  const cx = left + FRAME_W / 2;
  const cy = top + FRAME_H / 2 + 6;
  const r = 72;

  els.push(
    newElement({
      type: "ellipse",
      x: cx - r,
      y: cy - r,
      width: r * 2,
      height: r * 2,
      strokeColor: STROKE,
      backgroundColor: "#eef2ff",
      fillStyle: "solid",
      strokeWidth: 1.5,
      roughness: 0,
      groupIds,
    }),
  );

  const angles = [0, 65, 150, 240, 310].map((deg) => (deg * Math.PI) / 180);
  for (const a of angles) {
    els.push(
      axisLine({
        x: cx,
        y: cy,
        width: r * Math.cos(a),
        height: r * Math.sin(a),
        points: [
          [0, 0],
          [r * Math.cos(a), r * Math.sin(a)],
        ],
        strokeColor: MUTED,
        strokeWidth: 1.25,
        groupIds,
      }),
    );
  }

  els.push(
    newTextElement({
      x: cx,
      y: cy + r + 28,
      text: "Segments editable as shapes",
      fontSize: 12,
      fontFamily: CHART_FONT,
      textAlign: "center",
      strokeColor: "#6b7280",
      groupIds,
    }),
  );

  return els;
}

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

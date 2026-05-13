import {
  DEFAULT_FONT_FAMILY,
  isTransparent,
  randomId,
} from "@excalidraw/common";
import {
  newArrowElement,
  newElement,
  newElementWith,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawLineElement,
  ExcalidrawRectangleElement,
  FontFamilyValues,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

import {
  BAR_CHART_FRAME_H,
  BAR_CHART_FRAME_W,
  buildAxisRenderContext,
  mergeFrameStrokeWidth,
  pickBarChartTextFontFamily,
  plotMetrics,
} from "./bar-chart-template";
import {
  buildChartGraphicRootCustomData,
  CHART_GRAPHIC_TEMPLATE_TYPE,
  CHART_GRAPHIC_TEMPLATE_VERSION,
  type ChartGraphicTemplateCustomDataChild,
  type ChartGraphicTemplateCustomDataRoot,
} from "./chart-graphic-metadata";

import type {
  LineChartItemData,
  LineChartTemplateData,
} from "./line-chart-types";

const DEFAULT_INSERT_FRAME_STROKE = "#374151";
const DEFAULT_FRAME_STROKE_WIDTH = 1.5;
const DEFAULT_SERIES_STROKE = "#6366f1";
const SERIES_STROKE_WIDTH = 2.75;
const INNER_CHART_STROKE_STYLE = "solid" as const;
const CATEGORY_ROW = 40;
const TICK = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const textRoughnessFor = (roughness: number) =>
  roughness <= 1 ? roughness : 1;

const lineChildData = (
  rootId: string,
): ChartGraphicTemplateCustomDataChild => ({
  templateType: CHART_GRAPHIC_TEMPLATE_TYPE,
  templateVersion: CHART_GRAPHIC_TEMPLATE_VERSION,
  templateRole: "child",
  templateRootId: rootId,
});

const seriesChildData = (
  rootId: string,
): ChartGraphicTemplateCustomDataChild => ({
  ...lineChildData(rootId),
  lineChartPart: "series",
});

export const createDefaultLineChartTemplateData = (): LineChartTemplateData => {
  const values = [0.75, 0.45, 0.55, 0.25, 0.4, 0.3];
  const items = values.map((value, index) =>
    normalizeLineChartItem({
      id: randomId(),
      label: `Point ${index + 1}`,
      value,
    }),
  );
  return {
    title: "Line chart",
    frameBorderEnabled: false,
    xAxisLabel: "X",
    yAxisLabel: "Y",
    showAxisTicks: true,
    legendVisible: true,
    items,
  };
};

export const normalizeLineChartItem = (
  input: Partial<LineChartItemData>,
): LineChartItemData => ({
  id: typeof input.id === "string" && input.id.trim() ? input.id : randomId(),
  label: typeof input.label === "string" ? input.label : "",
  value: clamp(
    typeof input.value === "number" && Number.isFinite(input.value)
      ? input.value
      : 0.5,
    0,
    1,
  ),
});

export const normalizeLineChartTemplateData = (
  data: Partial<LineChartTemplateData> | undefined | null,
): LineChartTemplateData => {
  const defaults = createDefaultLineChartTemplateData();
  let items =
    Array.isArray(data?.items) && data.items.length
      ? data.items.map((item) => normalizeLineChartItem(item ?? {}))
      : defaults.items.slice();

  if (items.length > 40) {
    items = items.slice(0, 40);
  }
  if (items.length === 0) {
    items = defaults.items.slice(0, 1);
  }

  return {
    title: typeof data?.title === "string" ? data.title : defaults.title,
    frameBorderEnabled:
      typeof data?.frameBorderEnabled === "boolean"
        ? data.frameBorderEnabled
        : defaults.frameBorderEnabled,
    xAxisLabel:
      typeof data?.xAxisLabel === "string"
        ? data.xAxisLabel
        : defaults.xAxisLabel,
    yAxisLabel:
      typeof data?.yAxisLabel === "string"
        ? data.yAxisLabel
        : defaults.yAxisLabel,
    showAxisTicks:
      typeof data?.showAxisTicks === "boolean"
        ? data.showAxisTicks
        : defaults.showAxisTicks,
    legendVisible:
      typeof data?.legendVisible === "boolean"
        ? data.legendVisible
        : defaults.legendVisible,
    items,
  };
};

const buildLineChartChildElementsUnsafe = (
  frameX: number,
  frameY: number,
  groupIds: readonly string[],
  normalized: LineChartTemplateData,
  axisCtx: ReturnType<typeof buildAxisRenderContext>,
  textFontFamily: FontFamilyValues,
  frameId: string | null,
  seriesStroke: string,
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  const childFrameId = frameId;
  const roughness = axisCtx.rootRoughness;
  const textR = textRoughnessFor(roughness);
  const { bx0, by0, plotW, plotH, legendLeft, legendTop } = plotMetrics(
    frameX,
    frameY,
    normalized.legendVisible,
  );
  const axisInk = axisCtx.axisStrokeColor;
  const axisHead = axisCtx.axisArrowhead;
  const titleInk = "#111827";

  els.push(
    newTextElement({
      x: frameX + BAR_CHART_FRAME_W / 2,
      y: frameY + 22,
      text: normalized.title,
      originalText: normalized.title,
      fontSize: 18,
      fontFamily: textFontFamily,
      textAlign: "center",
      strokeColor: titleInk,
      roughness: textR,
      frameId: childFrameId,
      groupIds: [...groupIds],
    }),
  );

  const n = normalized.items.length;
  const xFrac = (i: number) => (n <= 1 ? 0.5 : i / (n - 1));
  /** Plot-local offsets from (bx0, by0); used for markers / labels. */
  const pts: [number, number][] = normalized.items.map((it, i) => {
    const tx = xFrac(i) * plotW;
    const ty = (1 - clamp(it.value, 0, 1)) * plotH;
    return [tx, ty];
  });

  /** Excalidraw linear elements expect points[0] === [0,0] and width/height = point AABB. */
  let linePlotPts = pts;
  if (linePlotPts.length === 1) {
    const p = linePlotPts[0]!;
    linePlotPts = [p, [p[0] + 1e-6, p[1]]];
  }
  const originX = linePlotPts[0]![0];
  const originY = linePlotPts[0]![1];
  const normLinePts: [number, number][] = linePlotPts.map(([px, py]) => [
    px - originX,
    py - originY,
  ]);
  let minNX = 0;
  let minNY = 0;
  let maxNX = 0;
  let maxNY = 0;
  for (const [px, py] of normLinePts) {
    minNX = Math.min(minNX, px);
    minNY = Math.min(minNY, py);
    maxNX = Math.max(maxNX, px);
    maxNY = Math.max(maxNY, py);
  }
  const lineW = Math.max(maxNX - minNX, 1e-6);
  const lineH = Math.max(maxNY - minNY, 1e-6);

  if (normalized.showAxisTicks) {
    const yLevels = [0, 0.25, 0.5, 0.75, 1];
    for (const frac of yLevels) {
      const yy = by0 + plotH * (1 - frac);
      els.push(
        newLinearElement({
          type: "line",
          x: bx0 - TICK,
          y: yy,
          width: TICK,
          height: 0,
          strokeColor: axisInk,
          strokeWidth: 1.25,
          strokeStyle: INNER_CHART_STROKE_STYLE,
          roughness,
          points: [
            [0, 0],
            [TICK, 0],
          ] as any,
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
      els.push(
        newTextElement({
          x: bx0 - 12,
          y: yy,
          text: `${Math.round(frac * 100)}`,
          originalText: `${Math.round(frac * 100)}`,
          fontSize: 10,
          fontFamily: textFontFamily,
          textAlign: "right",
          verticalAlign: "middle",
          strokeColor: "#6b7280",
          roughness: textR,
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
    }
    for (let i = 0; i < n; i++) {
      const cx = bx0 + xFrac(i) * plotW;
      els.push(
        newLinearElement({
          type: "line",
          x: cx,
          y: by0 + plotH,
          width: 0,
          height: TICK,
          strokeColor: axisInk,
          strokeWidth: 1.25,
          strokeStyle: INNER_CHART_STROKE_STYLE,
          roughness,
          points: [
            [0, 0],
            [0, TICK],
          ] as any,
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
    }
  }

  if (axisHead) {
    els.push(
      newArrowElement({
        type: "arrow",
        x: bx0,
        y: by0 + plotH,
        width: plotW,
        height: 0,
        strokeColor: axisInk,
        strokeWidth: 1.75,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        roughness,
        points: [
          [0, 0],
          [plotW, 0],
        ] as any,
        startArrowhead: null,
        endArrowhead: axisHead,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  } else {
    els.push(
      newLinearElement({
        type: "line",
        x: bx0,
        y: by0 + plotH,
        width: plotW,
        height: 0,
        strokeColor: axisInk,
        strokeWidth: 1.75,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        roughness,
        points: [
          [0, 0],
          [plotW, 0],
        ] as any,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  if (axisHead) {
    els.push(
      newArrowElement({
        type: "arrow",
        x: bx0,
        y: by0,
        width: 0,
        height: plotH,
        strokeColor: axisInk,
        strokeWidth: 1.75,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        roughness,
        points: [
          [0, 0],
          [0, plotH],
        ] as any,
        startArrowhead: axisHead,
        endArrowhead: null,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  } else {
    els.push(
      newLinearElement({
        type: "line",
        x: bx0,
        y: by0,
        width: 0,
        height: plotH,
        strokeColor: axisInk,
        strokeWidth: 1.75,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        roughness,
        points: [
          [0, 0],
          [0, plotH],
        ] as any,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  els.push(
    newLinearElement({
      type: "line",
      x: bx0 + originX,
      y: by0 + originY,
      width: lineW,
      height: lineH,
      points: normLinePts as any,
      strokeColor: seriesStroke,
      strokeWidth: SERIES_STROKE_WIDTH,
      strokeStyle: INNER_CHART_STROKE_STYLE,
      roughness: 0,
      roundness: null,
      frameId: childFrameId,
      groupIds: [...groupIds],
    }),
  );

  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i]!;
    els.push(
      newElement({
        type: "ellipse",
        x: bx0 + px - 4,
        y: by0 + py - 4,
        width: 8,
        height: 8,
        strokeColor: seriesStroke,
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeStyle: INNER_CHART_STROKE_STYLE,
        strokeWidth: 1.5,
        roughness: 0,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  for (let i = 0; i < n; i++) {
    const item = normalized.items[i]!;
    const [px, py] = pts[i]!;
    const pct = `${Math.round(item.value * 100)}`;
    els.push(
      newTextElement({
        x: bx0 + px,
        y: by0 + py - 14,
        text: pct,
        originalText: pct,
        fontSize: 11,
        fontFamily: textFontFamily,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#374151",
        roughness: textR,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  for (let i = 0; i < n; i++) {
    const item = normalized.items[i]!;
    const cx = bx0 + xFrac(i) * plotW;
    els.push(
      newTextElement({
        x: cx,
        y: by0 + plotH + 12,
        text: item.label,
        originalText: item.label,
        fontSize: 13,
        fontFamily: textFontFamily,
        textAlign: "center",
        strokeColor: "#374151",
        roughness: textR,
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  els.push(
    newTextElement({
      x: bx0 + plotW / 2,
      y: by0 + plotH + CATEGORY_ROW - 14,
      text: normalized.xAxisLabel,
      originalText: normalized.xAxisLabel,
      fontSize: 12,
      fontFamily: textFontFamily,
      textAlign: "center",
      strokeColor: "#6b7280",
      roughness: textR,
      frameId: childFrameId,
      groupIds: [...groupIds],
    }),
  );

  els.push(
    newTextElement({
      x: frameX + 22,
      y: frameY + 52 + plotH / 2,
      text: normalized.yAxisLabel,
      originalText: normalized.yAxisLabel,
      fontSize: 12,
      fontFamily: textFontFamily,
      textAlign: "center",
      strokeColor: "#6b7280",
      angle: (-Math.PI / 2) as Radians,
      roughness: textR,
      frameId: childFrameId,
      groupIds: [...groupIds],
    }),
  );

  if (normalized.legendVisible) {
    let ly = legendTop + 12;
    for (const item of normalized.items) {
      els.push(
        newElement({
          type: "ellipse",
          x: legendLeft,
          y: ly,
          width: 10,
          height: 10,
          strokeColor: seriesStroke,
          backgroundColor: seriesStroke,
          fillStyle: "solid",
          strokeStyle: INNER_CHART_STROKE_STYLE,
          strokeWidth: 1,
          roughness: 0,
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
      els.push(
        newTextElement({
          x: legendLeft + 16,
          y: ly + 5,
          text: item.label,
          originalText: item.label,
          fontSize: 12,
          fontFamily: textFontFamily,
          textAlign: "left",
          verticalAlign: "middle",
          strokeColor: "#374151",
          roughness: textR,
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
      ly += 20;
    }
  }

  return els;
};

export function buildLineChartTaggedChildren(params: {
  frameX: number;
  frameY: number;
  groupIds: readonly string[];
  rootId: string;
  data: LineChartTemplateData;
  axisCtx: ReturnType<typeof buildAxisRenderContext>;
  textFontFamily: FontFamilyValues;
  frameId: string | null;
  seriesStroke: string;
}): NonDeletedExcalidrawElement[] {
  const normalized = normalizeLineChartTemplateData(params.data);
  const raw = buildLineChartChildElementsUnsafe(
    params.frameX,
    params.frameY,
    params.groupIds,
    normalized,
    params.axisCtx,
    params.textFontFamily,
    params.frameId,
    params.seriesStroke,
  );
  return raw.map((el) => {
    const isSeries =
      el.type === "line" &&
      "strokeWidth" in el &&
      (el as ExcalidrawLineElement).strokeWidth === SERIES_STROKE_WIDTH;
    const cd = isSeries
      ? seriesChildData(params.rootId)
      : lineChildData(params.rootId);
    return newElementWith(el, { customData: cd });
  });
}

export const buildInitialLineChartElements = (params: {
  frameX: number;
  frameY: number;
  groupIds: string[];
  data: LineChartTemplateData;
  appState?: AppState | null;
}): NonDeletedExcalidrawElement[] => {
  const normalized = normalizeLineChartTemplateData(params.data);
  const textFontFamily =
    params.appState?.currentItemFontFamily ?? DEFAULT_FONT_FAMILY;
  const strokeW = mergeFrameStrokeWidth(
    DEFAULT_FRAME_STROKE_WIDTH,
    normalized.frameBorderEnabled,
  );
  const frameStrokeColor = normalized.frameBorderEnabled
    ? DEFAULT_INSERT_FRAME_STROKE
    : "transparent";
  const frame = newElement({
    type: "rectangle",
    x: params.frameX,
    y: params.frameY,
    width: BAR_CHART_FRAME_W,
    height: BAR_CHART_FRAME_H,
    strokeColor: frameStrokeColor,
    strokeWidth: strokeW,
    strokeStyle: "solid",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roundness: { type: 3, value: 12 },
    roughness: 0,
    groupIds: params.groupIds,
  });

  const rootId = frame.id;
  const axisCtx = buildAxisRenderContext({ root: frame });
  const children = buildLineChartTaggedChildren({
    frameX: params.frameX,
    frameY: params.frameY,
    groupIds: params.groupIds,
    rootId,
    data: normalized,
    axisCtx,
    textFontFamily,
    frameId: frame.frameId ?? null,
    seriesStroke: DEFAULT_SERIES_STROKE,
  });

  return [frame, ...children];
};

export function readLineChartTemplateDataFromRoot(
  root: {
    readonly id: string;
    isDeleted?: boolean;
    customData?: unknown;
  } | null,
): LineChartTemplateData | null {
  if (!root || root.isDeleted) {
    return null;
  }
  const cd = root.customData as ChartGraphicTemplateCustomDataRoot | undefined;
  if (
    !cd ||
    cd.templateType !== CHART_GRAPHIC_TEMPLATE_TYPE ||
    cd.templateRole !== "root" ||
    cd.chartPreset !== "line-chart"
  ) {
    return null;
  }
  const raw = cd.lineChartTemplateData;
  if (raw) {
    return normalizeLineChartTemplateData(raw);
  }
  return normalizeLineChartTemplateData(createDefaultLineChartTemplateData());
}

export const serializeLineChartTemplateDataForSync = (
  data: LineChartTemplateData | null,
): string => {
  if (!data) {
    return "";
  }
  const n = normalizeLineChartTemplateData(data);
  return [
    n.title,
    n.frameBorderEnabled ? "1" : "0",
    n.xAxisLabel,
    n.yAxisLabel,
    n.showAxisTicks ? "1" : "0",
    n.legendVisible ? "1" : "0",
    n.items.map((it) => `${it.id}~${it.label}~${it.value}`).join("|"),
  ].join("##");
};

export const areLineChartTemplateDataEqual = (
  left: LineChartTemplateData | null,
  right: LineChartTemplateData | null,
) =>
  serializeLineChartTemplateDataForSync(left) ===
  serializeLineChartTemplateDataForSync(right);

const pickSeriesStrokeFromScene = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  groupId: string,
): string => {
  for (const el of elements) {
    if (el.isDeleted || el.id === rootId) {
      continue;
    }
    if (!el.groupIds?.includes(groupId)) {
      continue;
    }
    const cd = el.customData as ChartGraphicTemplateCustomDataChild | undefined;
    if (
      cd?.templateType === CHART_GRAPHIC_TEMPLATE_TYPE &&
      cd.templateRole === "child" &&
      cd.lineChartPart === "series" &&
      el.type === "line" &&
      "strokeColor" in el
    ) {
      return (el as ExcalidrawLineElement).strokeColor;
    }
  }
  return DEFAULT_SERIES_STROKE;
};

export function updateLineChartTemplateInScene(
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: LineChartTemplateData,
  appState: AppState | null,
): ExcalidrawElement[] {
  const normalized = normalizeLineChartTemplateData(data);
  const root = elements.find((e) => e.id === rootId);
  if (!root || root.isDeleted) {
    return [...elements];
  }

  const gid = root.groupIds?.[0];
  if (!gid) {
    return [...elements];
  }

  const textFontFamily = pickBarChartTextFontFamily(
    elements,
    rootId,
    gid,
    appState,
  );

  const withoutChildren = elements.filter(
    (e) => !(e.groupIds?.includes(gid) && e.id !== rootId),
  );

  const prevCd = root.customData as
    | ChartGraphicTemplateCustomDataRoot
    | undefined;
  let strokeColorCache = prevCd?.lineChartFrameStrokeColorCache;

  const prevRect = root as ExcalidrawRectangleElement;

  let nextStrokeColor = prevRect.strokeColor;
  if (!normalized.frameBorderEnabled) {
    if (!isTransparent(prevRect.strokeColor)) {
      strokeColorCache = prevRect.strokeColor;
    }
    nextStrokeColor = "transparent";
  } else if (isTransparent(prevRect.strokeColor) && strokeColorCache) {
    nextStrokeColor = strokeColorCache;
  }

  const nextStrokeWidth = mergeFrameStrokeWidth(
    prevRect.strokeWidth,
    normalized.frameBorderEnabled,
  );

  const axisRoot =
    normalized.frameBorderEnabled &&
    isTransparent(prevRect.strokeColor) &&
    strokeColorCache
      ? newElementWith(root, { strokeColor: strokeColorCache })
      : root;
  const axisCtx = buildAxisRenderContext({ root: axisRoot });

  const seriesStroke = pickSeriesStrokeFromScene(elements, rootId, gid);

  const nextRoot = newElementWith(
    root,
    {
      width: BAR_CHART_FRAME_W,
      height: BAR_CHART_FRAME_H,
      strokeColor: nextStrokeColor,
      strokeWidth: nextStrokeWidth,
      customData: buildChartGraphicRootCustomData({
        rootId: root.id,
        preset: "line-chart",
        lineChartTemplateData: normalized,
        lineChartFrameStrokeColorCache: strokeColorCache ?? null,
      }),
    },
    true,
  );

  const children = buildLineChartTaggedChildren({
    frameX: nextRoot.x,
    frameY: nextRoot.y,
    groupIds: nextRoot.groupIds,
    rootId: nextRoot.id,
    data: normalized,
    axisCtx,
    textFontFamily,
    frameId: nextRoot.frameId ?? null,
    seriesStroke,
  });

  const ri = withoutChildren.findIndex((e) => e.id === rootId);
  if (ri < 0) {
    return [...elements];
  }

  return [
    ...withoutChildren.slice(0, ri),
    nextRoot,
    ...children,
    ...withoutChildren.slice(ri + 1),
  ];
}

import {
  DEFAULT_FONT_FAMILY,
  isTransparent,
  randomId,
} from "@excalidraw/common";
import {
  isTextElement,
  newArrowElement,
  newElement,
  newElementWith,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type { FillStyle } from "@excalidraw/element/types";
import type {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  FontFamilyValues,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  buildChartGraphicRootCustomData,
  CHART_GRAPHIC_TEMPLATE_TYPE,
  CHART_GRAPHIC_TEMPLATE_VERSION,
  type ChartGraphicTemplateCustomDataChild,
  type ChartGraphicTemplateCustomDataRoot,
} from "./chart-graphic-metadata";

import type { BarChartItemData, BarChartTemplateData } from "./bar-chart-types";

/** Outer frame dimensions for the bar chart template widget. */
export const BAR_CHART_FRAME_W = 400;
export const BAR_CHART_FRAME_H = 280;

const LEFT_PAD = 72;
const TOP_PAD = 52;
const BOTTOM_AXIS_PAD = 30;
const RIGHT_PAD = 16;
const LEGEND_WIDTH = 86;
const CATEGORY_ROW = 40;

/** Prefer an existing chart text’s font; then the editor’s current default; then app default. */
export const pickBarChartTextFontFamily = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  groupId: string,
  appState: AppState | null | undefined,
): FontFamilyValues => {
  for (const el of elements) {
    if (el.isDeleted || el.id === rootId) {
      continue;
    }
    if (!el.groupIds?.includes(groupId)) {
      continue;
    }
    if (isTextElement(el)) {
      return el.fontFamily;
    }
  }
  return appState?.currentItemFontFamily ?? DEFAULT_FONT_FAMILY;
};

export const BAR_CHART_DEFAULT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#06b6d4",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const wrapFillStyle = (value: unknown): FillStyle =>
  value === "hachure" ||
  value === "cross-hatch" ||
  value === "solid" ||
  value === "zigzag"
    ? value
    : "solid";

export const createDefaultBarChartTemplateData = (): BarChartTemplateData => {
  const heightPattern = [0.35, 0.62, 0.28, 0.72, 0.45];

  const items = heightPattern.map((value, index) =>
    normalizeBarChartItem(
      {
        id: randomId(),
        label: `Item ${index + 1}`,
        backgroundColor:
          BAR_CHART_DEFAULT_COLORS[index % BAR_CHART_DEFAULT_COLORS.length]!,
        strokeColor:
          BAR_CHART_DEFAULT_COLORS[index % BAR_CHART_DEFAULT_COLORS.length]!,
        value,
        fillStyle: "hachure",
      },
      "hachure",
    ),
  );

  return {
    title: "Histogram",
    frameBorderEnabled: false,
    xAxisLabel: "X",
    yAxisLabel: "Y",
    showAxisTicks: true,
    legendVisible: true,
    items,
  };
};

export const normalizeBarChartItem = (
  input: Partial<BarChartItemData>,
  fallbackFill: FillStyle,
): BarChartItemData => ({
  id: typeof input.id === "string" && input.id.trim() ? input.id : randomId(),
  label: typeof input.label === "string" ? input.label : "",
  backgroundColor:
    typeof input.backgroundColor === "string" && input.backgroundColor
      ? input.backgroundColor
      : BAR_CHART_DEFAULT_COLORS[0]!,
  strokeColor:
    typeof input.strokeColor === "string" && input.strokeColor
      ? input.strokeColor
      : BAR_CHART_DEFAULT_COLORS[0]!,
  value: clamp(
    typeof input.value === "number" && Number.isFinite(input.value)
      ? input.value
      : 0.35,
    0,
    1,
  ),
  fillStyle: wrapFillStyle(input.fillStyle ?? fallbackFill),
});

type LegacyBarFields = {
  fillStyle?: FillStyle;
  coversCanvas?: boolean;
  frameBorderVisible?: boolean;
  barSpacing?: number;
  showXAxisArrow?: boolean;
  showYAxisArrow?: boolean;
};

export const normalizeBarChartTemplateData = (
  data: (Partial<BarChartTemplateData> & LegacyBarFields) | undefined | null,
): BarChartTemplateData => {
  const defaults = createDefaultBarChartTemplateData();
  const legacyItemFill = wrapFillStyle(
    (data as { fillStyle?: FillStyle } | null)?.fillStyle ?? "hachure",
  );
  const legacy = data as LegacyBarFields | null;

  let items =
    Array.isArray(data?.items) && data.items.length
      ? data.items.map((item) =>
          normalizeBarChartItem(item ?? {}, legacyItemFill),
        )
      : defaults.items.slice();

  if (items.length > 40) {
    items = items.slice(0, 40);
  }
  if (items.length === 0) {
    items = defaults.items.slice(0, 1);
  }

  const title = typeof data?.title === "string" ? data.title : defaults.title;

  let frameBorderEnabled: boolean;
  if (typeof data?.frameBorderEnabled === "boolean") {
    frameBorderEnabled = data.frameBorderEnabled;
  } else if (
    data &&
    "frameStrokeStyle" in data &&
    (data as { frameStrokeStyle?: string }).frameStrokeStyle === "none"
  ) {
    frameBorderEnabled = false;
  } else if (typeof legacy?.frameBorderVisible === "boolean") {
    frameBorderEnabled = legacy.frameBorderVisible;
  } else {
    frameBorderEnabled = defaults.frameBorderEnabled;
  }

  const xAxisLabel =
    typeof data?.xAxisLabel === "string"
      ? data.xAxisLabel
      : defaults.xAxisLabel;
  const yAxisLabel =
    typeof data?.yAxisLabel === "string"
      ? data?.yAxisLabel
      : defaults.yAxisLabel;

  const showAxisTicks =
    typeof data?.showAxisTicks === "boolean"
      ? data.showAxisTicks
      : defaults.showAxisTicks;
  const legendVisible =
    typeof data?.legendVisible === "boolean"
      ? data.legendVisible
      : defaults.legendVisible;

  return {
    title,
    frameBorderEnabled,
    xAxisLabel,
    yAxisLabel,
    showAxisTicks,
    legendVisible,
    items,
  };
};

const childCustomData = (
  rootId: string,
): ChartGraphicTemplateCustomDataChild => ({
  templateType: CHART_GRAPHIC_TEMPLATE_TYPE,
  templateVersion: CHART_GRAPHIC_TEMPLATE_VERSION,
  templateRole: "child",
  templateRootId: rootId,
});

const textRoughnessFor = (roughness: number) =>
  roughness <= 1 ? roughness : 1;

const plotMetrics = (
  frameX: number,
  frameY: number,
  legendVisible: boolean,
) => {
  const legendSlot = legendVisible ? LEGEND_WIDTH : 0;
  const bx0 = frameX + LEFT_PAD;
  const by0 = frameY + TOP_PAD;
  const plotW =
    BAR_CHART_FRAME_W -
    LEFT_PAD -
    RIGHT_PAD -
    legendSlot -
    (legendVisible ? 6 : 0);
  const plotH =
    BAR_CHART_FRAME_H -
    TOP_PAD -
    BOTTOM_AXIS_PAD -
    CATEGORY_ROW -
    (legendVisible ? 6 : 0);

  const legendLeft = bx0 + plotW + (legendVisible ? 18 : 0);
  const legendTop = frameY + TOP_PAD;

  return { bx0, by0, plotW, plotH, legendLeft, legendTop };
};

const measureBarLayouts = (
  items: readonly BarChartItemData[],
  plotW: number,
): { gap: number; barW: number } => {
  /** Fixed layout curve equivalent to former medium spacing / default bar width sliders. */
  const barSpacing = 50;
  const barWidth = 50;
  const n = Math.max(1, items.length);
  const tGap = clamp(barSpacing, 0, 100) / 100;
  const tW = clamp(barWidth, 0, 100) / 100;

  const slot = plotW / n;
  const gapMin = clamp(slot * 0.04, 2, 14);
  const gapMax = clamp(slot * 0.48, 10, Math.min(56, slot * 0.92));
  let gap = gapMin + (gapMax - gapMin) * tGap;

  let maxBarW = (plotW - gap * (n + 1)) / n;
  if (maxBarW < 4) {
    gap = Math.max(2, (plotW - 4 * n) / (n + 1));
    maxBarW = (plotW - gap * (n + 1)) / n;
    maxBarW = Math.max(4, maxBarW);
  } else {
    maxBarW = Math.max(4, maxBarW);
  }

  const wLo = Math.max(4, maxBarW * 0.2);
  const wHi = maxBarW;
  let barW = wLo + (wHi - wLo) * tW;

  const total = gap * (n + 1) + barW * n;
  if (total > plotW) {
    barW = Math.max(4, (plotW - gap * (n + 1)) / n);
  }

  return { gap, barW };
};

const DEFAULT_INSERT_FRAME_STROKE = "#374151";
const DEFAULT_FRAME_STROKE_WIDTH = 1.5;
const DEFAULT_INSERT_ROUGHNESS = 2;

const mergeFrameStrokeWidth = (
  prevWidth: number,
  frameBorderEnabled: boolean,
): number => {
  if (!frameBorderEnabled) {
    return 0;
  }
  if (prevWidth <= 0) {
    return DEFAULT_FRAME_STROKE_WIDTH;
  }
  return prevWidth;
};

export type BarChartAxisRenderContext = {
  rootRoughness: number;
  axisStrokeColor: string;
  /** Fixed default arrowhead on both axes (not tied to the main sidebar arrow tool). */
  axisArrowhead: Arrowhead;
};

/** Default axis arrowhead; matches Excalidraw’s typical arrow appearance. */
const DEFAULT_AXIS_ARROWHEAD: Arrowhead = "arrow";

export function buildAxisRenderContext(params: {
  root: ExcalidrawElement | null | undefined;
}): BarChartAxisRenderContext {
  const r = params.root;
  if (r && r.type === "rectangle" && !r.isDeleted) {
    const rect = r as ExcalidrawRectangleElement;
    const axisStrokeColor = isTransparent(rect.strokeColor)
      ? DEFAULT_INSERT_FRAME_STROKE
      : rect.strokeColor;
    return {
      rootRoughness: rect.roughness,
      axisStrokeColor,
      axisArrowhead: DEFAULT_AXIS_ARROWHEAD,
    };
  }
  return {
    rootRoughness: DEFAULT_INSERT_ROUGHNESS,
    axisStrokeColor: DEFAULT_INSERT_FRAME_STROKE,
    axisArrowhead: DEFAULT_AXIS_ARROWHEAD,
  };
}

/** Histogram internals always use solid strokes; frame stroke style is only on the root rectangle (left sidebar). */
const INNER_CHART_STROKE_STYLE = "solid" as const;

const buildBarChartChildElementsUnsafe = (
  frameX: number,
  frameY: number,
  groupIds: readonly string[],
  normalized: BarChartTemplateData,
  axisCtx: BarChartAxisRenderContext,
  textFontFamily: FontFamilyValues,
  frameId: string | null,
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
  const TICK = 6;

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

  const { gap, barW } = measureBarLayouts(normalized.items, plotW);
  const n = normalized.items.length;

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
      const cx = bx0 + gap + i * (barW + gap) + barW / 2;
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

  for (let i = 0; i < n; i++) {
    const item = normalized.items[i]!;
    const barH = Math.max(4, plotH * clamp(item.value, 0.02, 1));
    const x = bx0 + gap + i * (barW + gap);
    const barY = by0 + plotH - barH;
    els.push(
      newElement({
        type: "rectangle",
        x,
        y: barY,
        width: barW,
        height: barH,
        strokeColor: item.strokeColor,
        backgroundColor: item.backgroundColor,
        fillStyle: item.fillStyle,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        strokeWidth: 1,
        roughness,
        roundness: { type: 3, value: 6 },
        frameId: childFrameId,
        groupIds: [...groupIds],
      }),
    );
  }

  for (let i = 0; i < n; i++) {
    const item = normalized.items[i]!;
    const cx = bx0 + gap + i * (barW + gap) + barW / 2;
    const barH = Math.max(4, plotH * clamp(item.value, 0.02, 1));
    const barY = by0 + plotH - barH;
    const pct = `${Math.round(item.value * 100)}%`;
    const valY = barY - 4;
    els.push(
      newTextElement({
        x: cx,
        y: valY,
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
    const cx = bx0 + gap + i * (barW + gap) + barW / 2;
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
      y: frameY + TOP_PAD + plotH / 2,
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
          type: "rectangle",
          x: legendLeft,
          y: ly,
          width: 12,
          height: 12,
          strokeColor: item.strokeColor,
          backgroundColor: item.backgroundColor,
          fillStyle: item.fillStyle,
          strokeStyle: INNER_CHART_STROKE_STYLE,
          strokeWidth: 1,
          roughness,
          roundness: { type: 3, value: 2 },
          frameId: childFrameId,
          groupIds: [...groupIds],
        }),
      );
      els.push(
        newTextElement({
          x: legendLeft + 18,
          y: ly + 6,
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

export function buildBarChartTaggedChildren(params: {
  frameX: number;
  frameY: number;
  groupIds: readonly string[];
  rootId: string;
  data: BarChartTemplateData;
  axisCtx: BarChartAxisRenderContext;
  textFontFamily: FontFamilyValues;
  frameId: string | null;
}): NonDeletedExcalidrawElement[] {
  const normalized = normalizeBarChartTemplateData(params.data);
  const raw = buildBarChartChildElementsUnsafe(
    params.frameX,
    params.frameY,
    params.groupIds,
    normalized,
    params.axisCtx,
    params.textFontFamily,
    params.frameId,
  );
  return raw.map((el) =>
    newElementWith(el, { customData: childCustomData(params.rootId) }),
  );
}

export const buildInitialBarChartElements = (params: {
  frameX: number;
  frameY: number;
  groupIds: string[];
  data: BarChartTemplateData;
  appState?: AppState | null;
}): NonDeletedExcalidrawElement[] => {
  const normalized = normalizeBarChartTemplateData(params.data);
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
    /** Architect / “整齐” sloppiness for new charts (matches main toolbar default style). */
    roughness: 0,
    groupIds: params.groupIds,
  });

  const rootId = frame.id;
  const axisCtx = buildAxisRenderContext({
    root: frame,
  });
  const children = buildBarChartTaggedChildren({
    frameX: params.frameX,
    frameY: params.frameY,
    groupIds: params.groupIds,
    rootId,
    data: normalized,
    axisCtx,
    textFontFamily,
    frameId: frame.frameId ?? null,
  });

  return [frame, ...children];
};

export function readBarChartTemplateDataFromRoot(
  root: {
    readonly id: string;
    isDeleted?: boolean;
    customData?: unknown;
  } | null,
): BarChartTemplateData | null {
  if (!root || root.isDeleted) {
    return null;
  }
  const cd = root.customData as ChartGraphicTemplateCustomDataRoot | undefined;
  if (
    !cd ||
    cd.templateType !== CHART_GRAPHIC_TEMPLATE_TYPE ||
    cd.templateRole !== "root" ||
    cd.chartPreset !== "bar-chart"
  ) {
    return null;
  }
  const raw = cd.barChartTemplateData;

  if (raw) {
    return normalizeBarChartTemplateData(raw);
  }
  return normalizeBarChartTemplateData(createDefaultBarChartTemplateData());
}

export const serializeBarChartTemplateDataForSync = (
  data: BarChartTemplateData | null,
): string => {
  if (!data) {
    return "";
  }
  const n = normalizeBarChartTemplateData(data);
  return [
    n.title,
    n.frameBorderEnabled ? "1" : "0",
    n.xAxisLabel,
    n.yAxisLabel,
    n.showAxisTicks ? "1" : "0",
    n.legendVisible ? "1" : "0",
    n.items
      .map(
        (it) =>
          `${it.id}~${it.label}~${it.backgroundColor}~${it.strokeColor}~${it.value}~${it.fillStyle}`,
      )
      .join("|"),
  ].join("##");
};

export const areBarChartTemplateDataEqual = (
  left: BarChartTemplateData | null,
  right: BarChartTemplateData | null,
) =>
  serializeBarChartTemplateDataForSync(left) ===
  serializeBarChartTemplateDataForSync(right);

export function updateBarChartTemplateInScene(
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: BarChartTemplateData,
  appState: AppState | null,
): ExcalidrawElement[] {
  const normalized = normalizeBarChartTemplateData(data);
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
  let strokeColorCache = prevCd?.barChartFrameStrokeColorCache;

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

  const nextRoot = newElementWith(
    root,
    {
      width: BAR_CHART_FRAME_W,
      height: BAR_CHART_FRAME_H,
      strokeColor: nextStrokeColor,
      strokeWidth: nextStrokeWidth,
      customData: buildChartGraphicRootCustomData({
        rootId: root.id,
        preset: "bar-chart",
        barChartTemplateData: normalized,
        barChartFrameStrokeColorCache: strokeColorCache ?? null,
      }),
    },
    true,
  );

  const children = buildBarChartTaggedChildren({
    frameX: nextRoot.x,
    frameY: nextRoot.y,
    groupIds: nextRoot.groupIds,
    rootId: nextRoot.id,
    data: normalized,
    axisCtx,
    textFontFamily,
    frameId: nextRoot.frameId ?? null,
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

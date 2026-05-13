import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_FONT_FAMILY,
  isColorDark,
  isTransparent,
  randomId,
} from "@excalidraw/common";
import {
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

import {
  BAR_CHART_DEFAULT_COLORS,
  BAR_CHART_FRAME_H,
  BAR_CHART_FRAME_W,
  mergeFrameStrokeWidth,
  normalizeBarChartItem,
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

import type { PieChartItemData, PieChartTemplateData } from "./pie-chart-types";

const DEFAULT_INSERT_FRAME_STROKE = "#374151";
const DEFAULT_FRAME_STROKE_WIDTH = 1.5;
const INNER_CHART_STROKE_STYLE = "solid" as const;
const PIE_RADIUS_FACTOR = 0.42;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const textRoughnessFor = (roughness: number) =>
  roughness <= 1 ? roughness : 1;

const childCustomData = (
  rootId: string,
): ChartGraphicTemplateCustomDataChild => ({
  templateType: CHART_GRAPHIC_TEMPLATE_TYPE,
  templateVersion: CHART_GRAPHIC_TEMPLATE_VERSION,
  templateRole: "child",
  templateRootId: rootId,
});

const sliceChildData = (
  rootId: string,
  itemId: string,
): ChartGraphicTemplateCustomDataChild => ({
  ...childCustomData(rootId),
  pieChartPart: "slice",
  pieSliceItemId: itemId,
});

/** Angles in radians; 0 = east, increasing counter‑clockwise (math convention). */
const buildWedgePoints = (
  startAngle: number,
  sweep: number,
  radius: number,
): [number, number][] => {
  const steps = Math.max(2, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * 36));
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + sweep * t;
    pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
  }
  pts.push([0, 0]);
  return pts;
};

const valueFractions = (items: readonly PieChartItemData[]): number[] => {
  const raw = items.map((it) =>
    clamp(
      typeof it.value === "number" && Number.isFinite(it.value) ? it.value : 0,
      0,
      1e9,
    ),
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const n = Math.max(1, items.length);
    return items.map(() => 1 / n);
  }
  return raw.map((v) => v / sum);
};

export const createDefaultPieChartTemplateData = (): PieChartTemplateData => {
  const fr = [0.35, 0.25, 0.22, 0.18];
  const items = fr.map((value, index) =>
    normalizeBarChartItem(
      {
        id: randomId(),
        label: `Segment ${index + 1}`,
        backgroundColor:
          BAR_CHART_DEFAULT_COLORS[index % BAR_CHART_DEFAULT_COLORS.length]!,
        strokeColor:
          BAR_CHART_DEFAULT_COLORS[index % BAR_CHART_DEFAULT_COLORS.length]!,
        value,
        fillStyle: "solid",
      },
      "solid",
    ),
  );
  return {
    title: "Pie chart",
    frameBorderEnabled: false,
    legendVisible: true,
    items,
  };
};

export const normalizePieChartTemplateData = (
  data: Partial<PieChartTemplateData> | undefined | null,
): PieChartTemplateData => {
  const defaults = createDefaultPieChartTemplateData();
  let items =
    Array.isArray(data?.items) && data.items.length
      ? data.items.map((item) => normalizeBarChartItem(item ?? {}, "solid"))
      : defaults.items.slice();

  if (items.length > 24) {
    items = items.slice(0, 24);
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
    legendVisible:
      typeof data?.legendVisible === "boolean"
        ? data.legendVisible
        : defaults.legendVisible,
    items,
  };
};

const buildPieChartChildElementsUnsafe = (
  frameX: number,
  frameY: number,
  groupIds: readonly string[],
  normalized: PieChartTemplateData,
  textFontFamily: FontFamilyValues,
  frameId: string | null,
  rootRoughness: number,
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  const textR = textRoughnessFor(rootRoughness);
  const { bx0, by0, plotW, plotH, legendLeft, legendTop } = plotMetrics(
    frameX,
    frameY,
    normalized.legendVisible,
  );
  const titleInk = "#111827";
  const cx = bx0 + plotW / 2;
  const cy = by0 + plotH / 2;
  const radius = Math.min(plotW, plotH) * PIE_RADIUS_FACTOR;
  const fracs = valueFractions(normalized.items);

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
      frameId,
      groupIds: [...groupIds],
    }),
  );

  let cum = 0;
  for (let i = 0; i < normalized.items.length; i++) {
    const item = normalized.items[i]!;
    const frac = fracs[i]!;
    if (frac <= 0) {
      cum += frac;
      continue;
    }
    const startAngle = -Math.PI / 2 + 2 * Math.PI * cum;
    const sweep = 2 * Math.PI * frac;
    cum += frac;
    const pts = buildWedgePoints(startAngle, sweep, radius);

    els.push(
      newLinearElement({
        type: "line",
        polygon: true,
        x: cx,
        y: cy,
        width: radius * 2,
        height: radius * 2,
        points: pts as any,
        strokeColor: item.strokeColor,
        backgroundColor: item.backgroundColor,
        fillStyle: item.fillStyle,
        strokeWidth: 1.25,
        strokeStyle: INNER_CHART_STROKE_STYLE,
        roughness: 0,
        roundness: null,
        frameId,
        groupIds: [...groupIds],
      }),
    );

    const midAngle = startAngle + sweep / 2;
    const labelRadius = radius * 0.58;
    const tx = cx + Math.cos(midAngle) * labelRadius;
    const ty = cy + Math.sin(midAngle) * labelRadius;
    const labelText = `${Math.round(frac * 100)}%`;
    const fillForContrast = item.backgroundColor || item.strokeColor || "#ccc";
    const labelInk = isColorDark(
      fillForContrast,
      COLOR_OUTLINE_CONTRAST_THRESHOLD,
    )
      ? "#f9fafb"
      : "#111827";

    els.push(
      newTextElement({
        x: tx,
        y: ty,
        text: labelText,
        originalText: labelText,
        fontSize: frac < 0.08 ? 10 : 12,
        fontFamily: textFontFamily,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: labelInk,
        roughness: textR,
        frameId,
        groupIds: [...groupIds],
      }),
    );
  }

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
          strokeColor: item.strokeColor,
          backgroundColor: item.backgroundColor,
          fillStyle: item.fillStyle,
          strokeStyle: INNER_CHART_STROKE_STYLE,
          strokeWidth: 1,
          roughness: 0,
          frameId,
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
          frameId,
          groupIds: [...groupIds],
        }),
      );
      ly += 20;
    }
  }

  return els;
};

export function buildPieChartTaggedChildren(params: {
  frameX: number;
  frameY: number;
  groupIds: readonly string[];
  rootId: string;
  data: PieChartTemplateData;
  textFontFamily: FontFamilyValues;
  frameId: string | null;
  rootRoughness: number;
}): NonDeletedExcalidrawElement[] {
  const normalized = normalizePieChartTemplateData(params.data);
  const raw = buildPieChartChildElementsUnsafe(
    params.frameX,
    params.frameY,
    params.groupIds,
    normalized,
    params.textFontFamily,
    params.frameId,
    params.rootRoughness,
  );

  const fracs = valueFractions(normalized.items);
  const sliceIds: string[] = [];
  for (let i = 0; i < normalized.items.length; i++) {
    if (fracs[i]! > 0) {
      sliceIds.push(normalized.items[i]!.id);
    }
  }

  let s = 0;
  return raw.map((el) => {
    if (
      el.type === "line" &&
      (el as ExcalidrawLineElement).polygon === true &&
      s < sliceIds.length
    ) {
      const id = sliceIds[s]!;
      s += 1;
      return newElementWith(el, {
        customData: sliceChildData(params.rootId, id),
      });
    }
    return newElementWith(el, { customData: childCustomData(params.rootId) });
  });
}

export const buildInitialPieChartElements = (params: {
  frameX: number;
  frameY: number;
  groupIds: string[];
  data: PieChartTemplateData;
  appState?: AppState | null;
}): NonDeletedExcalidrawElement[] => {
  const normalized = normalizePieChartTemplateData(params.data);
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
  const children = buildPieChartTaggedChildren({
    frameX: params.frameX,
    frameY: params.frameY,
    groupIds: params.groupIds,
    rootId,
    data: normalized,
    textFontFamily,
    frameId: frame.frameId ?? null,
    rootRoughness: frame.roughness,
  });

  return [frame, ...children];
};

export function readPieChartTemplateDataFromRoot(
  root: {
    readonly id: string;
    isDeleted?: boolean;
    customData?: unknown;
  } | null,
): PieChartTemplateData | null {
  if (!root || root.isDeleted) {
    return null;
  }
  const cd = root.customData as ChartGraphicTemplateCustomDataRoot | undefined;
  if (
    !cd ||
    cd.templateType !== CHART_GRAPHIC_TEMPLATE_TYPE ||
    cd.templateRole !== "root" ||
    cd.chartPreset !== "pie-chart"
  ) {
    return null;
  }
  const raw = cd.pieChartTemplateData;
  if (raw) {
    return normalizePieChartTemplateData(raw);
  }
  return normalizePieChartTemplateData(createDefaultPieChartTemplateData());
}

export const serializePieChartTemplateDataForSync = (
  data: PieChartTemplateData | null,
): string => {
  if (!data) {
    return "";
  }
  const n = normalizePieChartTemplateData(data);
  return [
    n.title,
    n.frameBorderEnabled ? "1" : "0",
    n.legendVisible ? "1" : "0",
    n.items
      .map(
        (it) =>
          `${it.id}~${it.label}~${it.backgroundColor}~${it.strokeColor}~${it.value}~${it.fillStyle}`,
      )
      .join("|"),
  ].join("##");
};

export const arePieChartTemplateDataEqual = (
  left: PieChartTemplateData | null,
  right: PieChartTemplateData | null,
) =>
  serializePieChartTemplateDataForSync(left) ===
  serializePieChartTemplateDataForSync(right);

export function updatePieChartTemplateInScene(
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: PieChartTemplateData,
  appState: AppState | null,
): ExcalidrawElement[] {
  const normalized = normalizePieChartTemplateData(data);
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
  let strokeColorCache = prevCd?.pieChartFrameStrokeColorCache;

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

  const nextRoot = newElementWith(
    root,
    {
      width: BAR_CHART_FRAME_W,
      height: BAR_CHART_FRAME_H,
      strokeColor: nextStrokeColor,
      strokeWidth: nextStrokeWidth,
      customData: buildChartGraphicRootCustomData({
        rootId: root.id,
        preset: "pie-chart",
        pieChartTemplateData: normalized,
        pieChartFrameStrokeColorCache: strokeColorCache ?? null,
      }),
    },
    true,
  );

  const children = buildPieChartTaggedChildren({
    frameX: nextRoot.x,
    frameY: nextRoot.y,
    groupIds: nextRoot.groupIds,
    rootId: nextRoot.id,
    data: normalized,
    textFontFamily,
    frameId: nextRoot.frameId ?? null,
    rootRoughness: nextRoot.roughness,
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

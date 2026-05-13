import { isTransparent } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { elementSharesAnyGroupId } from "../shared/templateInstanceGroups";

import type { BarChartTemplateData } from "./bar-chart-types";
import type { LineChartTemplateData } from "./line-chart-types";
import type { PieChartTemplateData } from "./pie-chart-types";

/** Insertable chart sketch presets (aligned with chart-graphic builders). */
export type ChartGraphicPreset =
  | "bar-chart"
  | "line-chart"
  | "pie-chart"
  | "matrix-2x2";

export const CHART_GRAPHIC_TEMPLATE_TYPE = "chart-graphic-template" as const;
export const CHART_GRAPHIC_TEMPLATE_VERSION = 1 as const;

export type ChartGraphicTemplateCustomDataRoot = {
  templateType: typeof CHART_GRAPHIC_TEMPLATE_TYPE;
  templateVersion: typeof CHART_GRAPHIC_TEMPLATE_VERSION;
  templateRole: "root";
  templateRootId: string;
  chartPreset: ChartGraphicPreset;
  barChartTemplateData?: BarChartTemplateData;
  /** Preserves chart frame stroke colour when the frame border master switch is off (stroke is forced transparent). */
  barChartFrameStrokeColorCache?: string;
  lineChartTemplateData?: LineChartTemplateData;
  lineChartFrameStrokeColorCache?: string;
  pieChartTemplateData?: PieChartTemplateData;
  pieChartFrameStrokeColorCache?: string;
};

export type ChartGraphicTemplateCustomDataChild = {
  templateType: typeof CHART_GRAPHIC_TEMPLATE_TYPE;
  templateVersion: typeof CHART_GRAPHIC_TEMPLATE_VERSION;
  templateRole: "child";
  templateRootId: string;
  /** Identifies the main series polyline for stroke sync across rebuilds. */
  lineChartPart?: "series";
  /** Identifies a pie slice for fill/stroke sync across rebuilds. */
  pieChartPart?: "slice";
  pieSliceItemId?: string;
};

export type ChartGraphicTemplateCustomData =
  | ChartGraphicTemplateCustomDataRoot
  | ChartGraphicTemplateCustomDataChild;

type ElementsById = Map<string, ExcalidrawElement>;
type AppStateSelection = AppState["selectedElementIds"];

const findElementByIdFromMap = <T extends ExcalidrawElement>(
  elementsById: ElementsById,
  id: string,
): T | null => (elementsById.get(id) as T | undefined) ?? null;

const getTemplateCustomData = (
  element: ExcalidrawElement | null | undefined,
): ChartGraphicTemplateCustomData | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | ChartGraphicTemplateCustomData
    | undefined;

  if (customData?.templateType !== CHART_GRAPHIC_TEMPLATE_TYPE) {
    return null;
  }

  return customData;
};

export const getChartGraphicTemplateRootId = (
  element: ExcalidrawElement | null | undefined,
): string | null => {
  const customData = getTemplateCustomData(element);
  if (!customData) {
    return null;
  }

  if (customData.templateRole === "root") {
    return element?.id ?? null;
  }

  return customData.templateRootId || element?.id || null;
};

export const getChartGraphicPresetFromElement = (
  element: ExcalidrawElement | null | undefined,
): ChartGraphicPreset | null => {
  const customData = getTemplateCustomData(element);
  if (!customData || customData.templateRole !== "root") {
    return null;
  }

  return customData.chartPreset ?? null;
};

const isChartGraphicTemplateRootElement = (
  element: ExcalidrawElement | null | undefined,
): boolean => {
  const customData = getTemplateCustomData(element);
  return !!customData && customData.templateRole === "root";
};

const findChartGraphicRootIdBySharedGroupIds = (
  element: NonDeletedExcalidrawElement,
  elementsById: ElementsById,
): string | null => {
  const gids = element.groupIds ?? [];
  if (!gids.length) {
    return null;
  }

  let found: string | null = null;
  for (const [, candidate] of elementsById) {
    if (candidate.isDeleted) {
      continue;
    }
    if (!isChartGraphicTemplateRootElement(candidate)) {
      continue;
    }
    const cg = candidate.groupIds ?? [];
    if (!cg.length) {
      continue;
    }
    if (gids.some((id) => cg.includes(id))) {
      if (found && found !== candidate.id) {
        return null;
      }
      found = candidate.id;
    }
  }

  return found;
};

const resolveChartGraphicTemplateRootIdFromSelection = (
  element: NonDeletedExcalidrawElement,
  elementsById: ElementsById,
): string | null => {
  if (isChartGraphicTemplateRootElement(element)) {
    return element.id;
  }

  const directRootId = getChartGraphicTemplateRootId(element);
  if (directRootId) {
    const root = findElementByIdFromMap(elementsById, directRootId);
    if (root && !root.isDeleted && isChartGraphicTemplateRootElement(root)) {
      const elementGids = element.groupIds ?? [];
      if (
        elementGids.length === 0 ||
        elementSharesAnyGroupId(element, root.groupIds)
      ) {
        return directRootId;
      }
    }
  }

  const groupRootId = element.groupIds?.[0];
  if (typeof groupRootId === "string") {
    const candidate = findElementByIdFromMap<NonDeletedExcalidrawElement>(
      elementsById,
      groupRootId,
    );
    if (
      candidate &&
      !candidate.isDeleted &&
      isChartGraphicTemplateRootElement(candidate)
    ) {
      return groupRootId;
    }
  }

  return findChartGraphicRootIdBySharedGroupIds(element, elementsById);
};

export const resolveSelectedChartGraphicRootWithMap = (
  elementsById: ElementsById,
  selectedElementIds: AppStateSelection | null | undefined,
): NonDeletedExcalidrawElement | null => {
  if (!selectedElementIds) {
    return null;
  }

  const selectedIds = Object.keys(selectedElementIds).filter(
    (elementId) => selectedElementIds[elementId],
  );

  if (!selectedIds.length) {
    return null;
  }

  const selectedElements = selectedIds
    .map((elementId) =>
      findElementByIdFromMap<NonDeletedExcalidrawElement>(
        elementsById,
        elementId,
      ),
    )
    .filter((el): el is NonDeletedExcalidrawElement => !!el && !el.isDeleted);

  if (!selectedElements.length) {
    return null;
  }

  const rootIds = new Set<string>();

  for (const element of selectedElements) {
    const rootId = resolveChartGraphicTemplateRootIdFromSelection(
      element,
      elementsById,
    );
    if (rootId) {
      rootIds.add(rootId);
    }
  }

  if (rootIds.size !== 1) {
    return null;
  }

  const [resolvedRootId] = [...rootIds];
  const rootElement = findElementByIdFromMap<NonDeletedExcalidrawElement>(
    elementsById,
    resolvedRootId,
  );

  return rootElement && !rootElement.isDeleted ? rootElement : null;
};

export const buildChartGraphicRootCustomData = (args: {
  rootId: string;
  preset: ChartGraphicPreset;
  barChartTemplateData?: BarChartTemplateData | null;
  barChartFrameStrokeColorCache?: string | null;
  lineChartTemplateData?: LineChartTemplateData | null;
  lineChartFrameStrokeColorCache?: string | null;
  pieChartTemplateData?: PieChartTemplateData | null;
  pieChartFrameStrokeColorCache?: string | null;
}): ChartGraphicTemplateCustomDataRoot => {
  const base: ChartGraphicTemplateCustomDataRoot = {
    templateType: CHART_GRAPHIC_TEMPLATE_TYPE,
    templateVersion: CHART_GRAPHIC_TEMPLATE_VERSION,
    templateRole: "root",
    templateRootId: args.rootId,
    chartPreset: args.preset,
  };
  if (args.preset === "bar-chart" && args.barChartTemplateData != null) {
    const out: ChartGraphicTemplateCustomDataRoot = {
      ...base,
      barChartTemplateData: args.barChartTemplateData,
    };
    if (
      typeof args.barChartFrameStrokeColorCache === "string" &&
      args.barChartFrameStrokeColorCache.length > 0
    ) {
      out.barChartFrameStrokeColorCache = args.barChartFrameStrokeColorCache;
    }
    return out;
  }
  if (args.preset === "line-chart" && args.lineChartTemplateData != null) {
    const out: ChartGraphicTemplateCustomDataRoot = {
      ...base,
      lineChartTemplateData: args.lineChartTemplateData,
    };
    if (
      typeof args.lineChartFrameStrokeColorCache === "string" &&
      args.lineChartFrameStrokeColorCache.length > 0
    ) {
      out.lineChartFrameStrokeColorCache = args.lineChartFrameStrokeColorCache;
    }
    return out;
  }
  if (args.preset === "pie-chart" && args.pieChartTemplateData != null) {
    const out: ChartGraphicTemplateCustomDataRoot = {
      ...base,
      pieChartTemplateData: args.pieChartTemplateData,
    };
    if (
      typeof args.pieChartFrameStrokeColorCache === "string" &&
      args.pieChartFrameStrokeColorCache.length > 0
    ) {
      out.pieChartFrameStrokeColorCache = args.pieChartFrameStrokeColorCache;
    }
    return out;
  }
  return base;
};

/** Tags the frame (first element) as root and all other siblings as chart-template children. */
export const tagChartGraphicElements = (
  elements: NonDeletedExcalidrawElement[],
  preset: ChartGraphicPreset,
  options?: {
    barChartTemplateData?: BarChartTemplateData;
    lineChartTemplateData?: LineChartTemplateData;
    pieChartTemplateData?: PieChartTemplateData;
  },
): NonDeletedExcalidrawElement[] => {
  if (!elements.length) {
    return elements;
  }

  const rootId = elements[0]!.id;
  return elements.map((el, index) => {
    const customData: ChartGraphicTemplateCustomData =
      index === 0
        ? buildChartGraphicRootCustomData({
            rootId,
            preset,
            ...(preset === "bar-chart"
              ? {
                  barChartTemplateData:
                    options?.barChartTemplateData ?? undefined,
                }
              : {}),
            ...(preset === "line-chart"
              ? {
                  lineChartTemplateData:
                    options?.lineChartTemplateData ?? undefined,
                }
              : {}),
            ...(preset === "pie-chart"
              ? {
                  pieChartTemplateData:
                    options?.pieChartTemplateData ?? undefined,
                }
              : {}),
          })
        : {
            templateType: CHART_GRAPHIC_TEMPLATE_TYPE,
            templateVersion: CHART_GRAPHIC_TEMPLATE_VERSION,
            templateRole: "child",
            templateRootId: rootId,
          };
    return newElementWith(el, { customData });
  });
};

/**
 * Bar-chart template **children** (axes, bars, labels drawing, etc.) must stay `strokeStyle: solid`.
 * The main sidebar’s stroke style applies to whatever is selected; grouped bar-chart edits would
 * otherwise change inner lines and bar outlines. Reset non-root template children after each change.
 */
export const sanitizeBarChartTemplateInnerStrokeStyles = (
  elements: readonly ExcalidrawElement[],
): { next: ExcalidrawElement[]; didChange: boolean } => {
  const chartTemplateRootIds = new Set<string>();
  for (const el of elements) {
    const cd = getTemplateCustomData(el);
    if (
      cd &&
      cd.templateRole === "root" &&
      (cd.chartPreset === "bar-chart" ||
        cd.chartPreset === "line-chart" ||
        cd.chartPreset === "pie-chart")
    ) {
      chartTemplateRootIds.add(el.id);
    }
  }

  if (chartTemplateRootIds.size === 0) {
    return { next: elements as ExcalidrawElement[], didChange: false };
  }

  let didChange = false;
  const next = elements.map((el) => {
    const cd = getTemplateCustomData(el);
    if (
      !cd ||
      cd.templateRole !== "child" ||
      !chartTemplateRootIds.has(cd.templateRootId)
    ) {
      return el;
    }
    if (!("strokeStyle" in el) || el.strokeStyle === "solid") {
      return el;
    }
    didChange = true;
    return newElementWith(el, { strokeStyle: "solid" });
  });

  return { next, didChange };
};

/**
 * When the template has “frame border” off, the root must stay visually strokeless.
 * Main-sidebar stroke colour / width still applies to the selected rectangle — undo that here
 * and persist the chosen colour in {@link ChartGraphicTemplateCustomDataRoot.barChartFrameStrokeColorCache}
 * for when the user turns the frame border on again.
 */
export const sanitizeBarChartRootWhenFrameBorderDisabled = (
  elements: readonly ExcalidrawElement[],
): { next: ExcalidrawElement[]; didChange: boolean } => {
  let didChange = false;
  const next = elements.map((el) => {
    const cd = getTemplateCustomData(el);
    if (
      !cd ||
      cd.templateRole !== "root" ||
      (cd.chartPreset !== "bar-chart" &&
        cd.chartPreset !== "line-chart" &&
        cd.chartPreset !== "pie-chart") ||
      (cd.chartPreset === "bar-chart" &&
        (!cd.barChartTemplateData ||
          cd.barChartTemplateData.frameBorderEnabled !== false)) ||
      (cd.chartPreset === "line-chart" &&
        (!cd.lineChartTemplateData ||
          cd.lineChartTemplateData.frameBorderEnabled !== false)) ||
      (cd.chartPreset === "pie-chart" &&
        (!cd.pieChartTemplateData ||
          cd.pieChartTemplateData.frameBorderEnabled !== false))
    ) {
      return el;
    }
    if (el.type !== "rectangle" || el.isDeleted) {
      return el;
    }

    const rect = el as ExcalidrawRectangleElement;
    const rootCd = cd as ChartGraphicTemplateCustomDataRoot;
    const preset = rootCd.chartPreset;

    let strokeCache =
      preset === "bar-chart"
        ? rootCd.barChartFrameStrokeColorCache
        : preset === "line-chart"
        ? rootCd.lineChartFrameStrokeColorCache
        : rootCd.pieChartFrameStrokeColorCache;
    if (!isTransparent(rect.strokeColor)) {
      strokeCache = rect.strokeColor;
    }

    const prevCache =
      preset === "bar-chart"
        ? rootCd.barChartFrameStrokeColorCache
        : preset === "line-chart"
        ? rootCd.lineChartFrameStrokeColorCache
        : rootCd.pieChartFrameStrokeColorCache;

    const mustHideStroke =
      rect.strokeWidth !== 0 || !isTransparent(rect.strokeColor);
    const cacheDirty = strokeCache !== prevCache;

    if (!mustHideStroke && !cacheDirty) {
      return el;
    }

    didChange = true;
    const customData =
      preset === "bar-chart"
        ? buildChartGraphicRootCustomData({
            rootId: el.id,
            preset: "bar-chart",
            barChartTemplateData: rootCd.barChartTemplateData!,
            barChartFrameStrokeColorCache: strokeCache ?? null,
          })
        : preset === "line-chart"
        ? buildChartGraphicRootCustomData({
            rootId: el.id,
            preset: "line-chart",
            lineChartTemplateData: rootCd.lineChartTemplateData!,
            lineChartFrameStrokeColorCache: strokeCache ?? null,
          })
        : buildChartGraphicRootCustomData({
            rootId: el.id,
            preset: "pie-chart",
            pieChartTemplateData: rootCd.pieChartTemplateData!,
            pieChartFrameStrokeColorCache: strokeCache ?? null,
          });

    if (!mustHideStroke) {
      return newElementWith(el, { customData }, true);
    }

    return newElementWith(
      el,
      {
        strokeWidth: 0,
        strokeColor: "transparent",
        customData,
      },
      true,
    );
  });

  return { next, didChange };
};

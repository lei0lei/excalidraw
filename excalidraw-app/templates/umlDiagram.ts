import {
  DEFAULT_FONT_FAMILY,
  getFontString,
  getLineHeight,
  randomId,
} from "@excalidraw/common";
import {
  measureText,
  newArrowElement,
  newElement,
  newElementWith,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export const UML_DIAGRAM_TEMPLATE_TYPE = "uml-diagram";
const UML_DIAGRAM_TEMPLATE_VERSION = 1;

export type UmlDiagramTemplatePreset =
  | "actor"
  | "use-case"
  | "package"
  | "note"
  | "component"
  | "association"
  | "inheritance"
  | "aggregation"
  | "composition"
  | "dependency"
  | "sequence-lifeline";

export type UmlDiagramTemplateData = {
  preset: UmlDiagramTemplatePreset;
  label: string;
  body?: string;
};

type UmlDiagramTemplateRole = "root" | "label" | "body" | "decoration";

type UmlDiagramChildElementIds = Partial<
  Record<
    | "labelTextId"
    | "bodyTextId"
    | "decoration1Id"
    | "decoration2Id"
    | "decoration3Id"
    | "decoration4Id",
    string
  >
>;

type UmlDiagramTemplateCustomData = {
  templateType?: string;
  templateVersion?: number;
  templateRole?: UmlDiagramTemplateRole;
  templateRootId?: string;
  templateData?: UmlDiagramTemplateData;
  childElementIds?: UmlDiagramChildElementIds;
};

type AppStateSelection = Record<string, boolean>;

type TextMetrics = {
  width: number;
  height: number;
  lineHeight: number;
};

type ElementsById = ReadonlyMap<string, ExcalidrawElement>;

const STROKE_COLOR = "#111827";
const TEXT_COLOR = "#1f2937";
const UML_DIAGRAM_HORIZONTAL_PADDING = 72;
const UML_DIAGRAM_VERTICAL_PADDING = 52;
const UML_DIAGRAM_NOTE_HORIZONTAL_PADDING = 56;
const UML_DIAGRAM_NOTE_VERTICAL_PADDING = 72;
const EDITABLE_UML_DIAGRAM_PRESETS = new Set<UmlDiagramTemplatePreset>([
  "actor",
  "use-case",
  "package",
  "note",
  "component",
  "association",
  "inheritance",
  "aggregation",
  "composition",
  "dependency",
  "sequence-lifeline",
]);

const getDefaultDataForPreset = (
  preset: UmlDiagramTemplatePreset,
): UmlDiagramTemplateData => {
  switch (preset) {
    case "actor":
      return { preset, label: "Actor" };
    case "use-case":
      return { preset, label: "Use Case" };
    case "package":
      return { preset, label: "PackageName" };
    case "note":
      return { preset, label: "Note", body: "Description" };
    case "component":
      return { preset, label: "Component" };
    case "association":
      return { preset, label: "association" };
    case "inheritance":
      return { preset, label: "inherits" };
    case "aggregation":
      return { preset, label: "aggregation" };
    case "composition":
      return { preset, label: "composition" };
    case "dependency":
      return { preset, label: "depends on" };
    case "sequence-lifeline":
    default:
      return { preset: "sequence-lifeline", label: "Participant" };
  }
};

export const isEditableUmlDiagramTemplatePreset = (
  preset: UmlDiagramTemplatePreset,
) => EDITABLE_UML_DIAGRAM_PRESETS.has(preset);

export const normalizeUmlDiagramTemplateData = (
  data?: Partial<UmlDiagramTemplateData> | null,
  presetOverride?: UmlDiagramTemplatePreset,
): UmlDiagramTemplateData => {
  const preset = presetOverride || data?.preset || "note";
  const defaults = getDefaultDataForPreset(preset);

  return {
    preset,
    label:
      typeof data?.label === "string" && data.label.trim()
        ? data.label.trim()
        : defaults.label,
    body: typeof data?.body === "string" ? data.body : defaults.body ?? "",
  };
};

const getTemplateCustomData = (
  element: ExcalidrawElement | null | undefined,
): UmlDiagramTemplateCustomData | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | UmlDiagramTemplateCustomData
    | undefined;

  if (customData?.templateType !== UML_DIAGRAM_TEMPLATE_TYPE) {
    return null;
  }

  return customData;
};

export const getUmlDiagramTemplateRootId = (
  element: ExcalidrawElement | null | undefined,
) => {
  const customData = getTemplateCustomData(element);
  if (!customData) {
    return null;
  }

  return customData.templateRootId || element?.id || null;
};

export const getUmlDiagramTemplateData = (
  element: ExcalidrawElement | null | undefined,
): UmlDiagramTemplateData | null => {
  const customData = getTemplateCustomData(element);
  if (!customData?.templateData) {
    return null;
  }

  return normalizeUmlDiagramTemplateData(customData.templateData);
};

const buildRootCustomData = (
  rootId: string,
  data: UmlDiagramTemplateData,
  childElementIds: UmlDiagramChildElementIds = {},
): UmlDiagramTemplateCustomData => ({
  templateType: UML_DIAGRAM_TEMPLATE_TYPE,
  templateVersion: UML_DIAGRAM_TEMPLATE_VERSION,
  templateRole: "root",
  templateRootId: rootId,
  templateData: data,
  childElementIds,
});

const buildChildCustomData = (
  rootId: string,
  role: UmlDiagramTemplateRole,
): UmlDiagramTemplateCustomData => ({
  templateType: UML_DIAGRAM_TEMPLATE_TYPE,
  templateVersion: UML_DIAGRAM_TEMPLATE_VERSION,
  templateRole: role,
  templateRootId: rootId,
});

const getTextMetrics = (text: string, fontSize: number): TextMetrics => {
  const normalizedText = text || " ";
  const lineHeight = getLineHeight(DEFAULT_FONT_FAMILY);
  const metrics = measureText(
    normalizedText,
    getFontString({ fontFamily: DEFAULT_FONT_FAMILY, fontSize }),
    lineHeight,
  );

  return {
    width: Math.max(Math.ceil(metrics.width), 1),
    height: Math.max(Math.ceil(metrics.height), 1),
    lineHeight,
  };
};

const getPackageLayout = (labelMetrics: TextMetrics) => {
  const width = Math.max(
    230,
    labelMetrics.width + UML_DIAGRAM_HORIZONTAL_PADDING,
  );
  const height = Math.max(
    96,
    labelMetrics.height + UML_DIAGRAM_VERTICAL_PADDING,
  );
  return {
    width,
    height,
    labelY: 24 + (height - labelMetrics.height) / 2,
  };
};

const getComponentLayout = (labelMetrics: TextMetrics) => {
  const width = Math.max(
    220,
    labelMetrics.width + UML_DIAGRAM_HORIZONTAL_PADDING,
  );
  const height = Math.max(84, labelMetrics.height + 36);
  const portsTop = Math.max(14, height / 2 - 20);

  return {
    width,
    height,
    portsTop,
  };
};

const getSequenceLayout = (labelMetrics: TextMetrics) => {
  const width = Math.max(
    140,
    labelMetrics.width + UML_DIAGRAM_HORIZONTAL_PADDING - 8,
  );
  const headerHeight = Math.max(42, labelMetrics.height + 20);

  return {
    width,
    headerHeight,
    lineHeight: 150,
  };
};

const createTextElementWithId = (
  id: string,
  element: NonDeleted<ExcalidrawTextElement>,
): NonDeleted<ExcalidrawTextElement> => ({
  ...element,
  id,
});

const createLinearElementWithId = (
  id: string,
  element: NonDeleted<ExcalidrawLinearElement>,
): NonDeleted<ExcalidrawLinearElement> => ({
  ...element,
  id,
});
const createOrUpdateTextElement = (
  existing: ExcalidrawTextElement | null,
  opts: {
    id?: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    textAlign: "left" | "center";
    groupIds: string[];
    customData: UmlDiagramTemplateCustomData;
  },
): NonDeleted<ExcalidrawTextElement> => {
  const nextElement = newTextElement({
    x: opts.x,
    y: opts.y,
    text: opts.text,
    originalText: opts.text,
    fontSize: opts.fontSize,
    fontFamily: DEFAULT_FONT_FAMILY,
    textAlign: opts.textAlign,
    verticalAlign: "top",
    groupIds: opts.groupIds,
    strokeColor: TEXT_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    customData: opts.customData,
  });

  if (!existing) {
    return opts.id
      ? createTextElementWithId(opts.id, nextElement)
      : nextElement;
  }

  return newElementWith(existing, {
    x: nextElement.x,
    y: nextElement.y,
    text: nextElement.text,
    originalText: nextElement.originalText,
    width: nextElement.width,
    height: nextElement.height,
    fontSize: nextElement.fontSize,
    fontFamily: nextElement.fontFamily,
    textAlign: nextElement.textAlign,
    verticalAlign: nextElement.verticalAlign,
    lineHeight: nextElement.lineHeight,
    groupIds: opts.groupIds,
    link: null,
    customData: opts.customData,
  });
};

const createOrUpdateShape = (
  existing: ExcalidrawElement | null,
  opts: {
    id?: string;
    type: "rectangle" | "ellipse";
    x: number;
    y: number;
    width: number;
    height: number;
    groupIds: string[];
    customData: UmlDiagramTemplateCustomData;
    roundness?: null;
  },
): NonDeletedExcalidrawElement => {
  const nextElement = newElement({
    type: opts.type,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    groupIds: opts.groupIds,
    strokeColor: STROKE_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: opts.roundness ?? null,
    customData: opts.customData,
  });

  if (!existing) {
    return opts.id ? { ...nextElement, id: opts.id } : nextElement;
  }

  return newElementWith(existing, {
    x: nextElement.x,
    y: nextElement.y,
    width: nextElement.width,
    height: nextElement.height,
    groupIds: opts.groupIds,
    link: null,
    customData: opts.customData,
  }) as NonDeletedExcalidrawElement;
};

const createOrUpdateLine = (
  existing: ExcalidrawLinearElement | null,
  opts: {
    id?: string;
    type: "line" | "arrow";
    x: number;
    y: number;
    width: number;
    height: number;
    points: readonly [number, number][];
    groupIds: string[];
    customData: UmlDiagramTemplateCustomData;
    strokeStyle?: "solid" | "dashed" | "dotted";
    startArrowhead?: ExcalidrawLinearElement["startArrowhead"];
    endArrowhead?: ExcalidrawLinearElement["endArrowhead"];
  },
): NonDeleted<ExcalidrawLinearElement> => {
  const nextElement =
    opts.type === "arrow"
      ? newArrowElement({
          type: "arrow",
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: opts.height,
          points: opts.points as any,
          groupIds: opts.groupIds,
          strokeColor: STROKE_COLOR,
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1.5,
          strokeStyle: opts.strokeStyle || "solid",
          roughness: 0,
          opacity: 100,
          startArrowhead: opts.startArrowhead || null,
          endArrowhead: opts.endArrowhead || null,
          customData: opts.customData,
        })
      : newLinearElement({
          type: "line",
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: opts.height,
          points: opts.points as any,
          groupIds: opts.groupIds,
          strokeColor: STROKE_COLOR,
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1.5,
          strokeStyle: opts.strokeStyle || "solid",
          roughness: 0,
          opacity: 100,
          customData: opts.customData,
        });

  if (!existing) {
    return opts.id
      ? createLinearElementWithId(opts.id, nextElement)
      : nextElement;
  }

  return newElementWith(existing, {
    x: nextElement.x,
    y: nextElement.y,
    width: nextElement.width,
    height: nextElement.height,
    points: nextElement.points,
    groupIds: opts.groupIds,
    strokeStyle: nextElement.strokeStyle,
    startArrowhead: nextElement.startArrowhead,
    endArrowhead: nextElement.endArrowhead,
    link: null,
    customData: opts.customData,
  }) as NonDeleted<ExcalidrawLinearElement>;
};

const buildElementsById = (
  elements: readonly ExcalidrawElement[],
): ElementsById => new Map(elements.map((element) => [element.id, element]));

const findElementByIdFromMap = <T extends ExcalidrawElement>(
  elementsById: ElementsById,
  id: string | undefined,
): T | null => {
  if (!id) {
    return null;
  }

  return (elementsById.get(id) as T | undefined) || null;
};

const getChildElementIds = (
  rootCustomData: UmlDiagramTemplateCustomData,
): UmlDiagramChildElementIds => ({
  ...rootCustomData.childElementIds,
  labelTextId: rootCustomData.childElementIds?.labelTextId || randomId(),
  bodyTextId: rootCustomData.childElementIds?.bodyTextId || randomId(),
});

export const getUmlDiagramTemplateLayoutSignature = (
  root: ExcalidrawElement | null | undefined,
  elementsById?: ElementsById,
) => {
  const rootCustomData = getTemplateCustomData(root);

  if (!root || !rootCustomData || rootCustomData.templateRole !== "root") {
    return null;
  }

  const resolvedElementsById =
    elementsById || new Map<string, ExcalidrawElement>([[root.id, root]]);
  const childElementIds = getChildElementIds(rootCustomData);
  const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
    resolvedElementsById,
    childElementIds.labelTextId,
  );
  const bodyElement = findElementByIdFromMap<ExcalidrawTextElement>(
    resolvedElementsById,
    childElementIds.bodyTextId,
  );
  const data = normalizeUmlDiagramTemplateData(rootCustomData.templateData);

  return [
    root.id,
    data.preset,
    root.width,
    root.height,
    labelElement?.fontSize || 0,
    bodyElement?.fontSize || 0,
    data.label,
    data.body || "",
  ].join("::");
};

const getRelationLineConfig = (preset: UmlDiagramTemplatePreset) => {
  switch (preset) {
    case "inheritance":
      return {
        type: "arrow" as const,
        endArrowhead: "triangle_outline" as const,
      };
    case "aggregation":
      return {
        type: "arrow" as const,
        startArrowhead: "diamond_outline" as const,
      };
    case "composition":
      return {
        type: "arrow" as const,
        startArrowhead: "diamond" as const,
      };
    case "dependency":
      return {
        type: "arrow" as const,
        endArrowhead: "arrow" as const,
        strokeStyle: "dashed" as const,
      };
    case "association":
    default:
      return {
        type: "line" as const,
      };
  }
};

const getRelationLabelPosition = (root: ExcalidrawLinearElement) => ({
  x: root.x + root.width / 2,
  y: root.y + root.height / 2 - 28,
});
const createActorTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
    decoration1Id: randomId(),
    decoration2Id: randomId(),
    decoration3Id: randomId(),
    decoration4Id: randomId(),
  };

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "ellipse",
    x: x + 42,
    y,
    width: 36,
    height: 36,
    groupIds,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const body = createOrUpdateLine(null, {
    id: childElementIds.decoration1Id,
    type: "line",
    x: x + 60,
    y: y + 36,
    width: 0,
    height: 50,
    points: [
      [0, 0],
      [0, 50],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const arms = createOrUpdateLine(null, {
    id: childElementIds.decoration2Id,
    type: "line",
    x: x + 30,
    y: y + 52,
    width: 60,
    height: 0,
    points: [
      [0, 0],
      [60, 0],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const leftLeg = createOrUpdateLine(null, {
    id: childElementIds.decoration3Id,
    type: "line",
    x: x + 34,
    y: y + 86,
    width: 26,
    height: 32,
    points: [
      [26, 0],
      [0, 32],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const rightLeg = createOrUpdateLine(null, {
    id: childElementIds.decoration4Id,
    type: "line",
    x: x + 60,
    y: y + 86,
    width: 26,
    height: 32,
    points: [
      [0, 0],
      [26, 32],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + 60,
    y: y + 132,
    text: data.label,
    fontSize: 18,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });

  return [root, body, arms, leftLeg, rightLeg, label];
};

const createUseCaseTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
  };
  const labelMetrics = getTextMetrics(data.label, 20);
  const width = Math.max(
    220,
    labelMetrics.width + UML_DIAGRAM_HORIZONTAL_PADDING,
  );
  const height = Math.max(110, labelMetrics.height + 44);

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "ellipse",
    x,
    y,
    width,
    height,
    groupIds,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + width / 2,
    y: y + (height - labelMetrics.height) / 2,
    text: data.label,
    fontSize: 20,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });

  return [root, label];
};

const createPackageTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
    decoration1Id: randomId(),
    decoration2Id: randomId(),
  };
  const labelMetrics = getTextMetrics(data.label, 18);
  const layout = getPackageLayout(labelMetrics);

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "rectangle",
    x,
    y: y + 24,
    width: layout.width,
    height: layout.height,
    groupIds,
    roundness: null,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const tab = createOrUpdateShape(null, {
    id: childElementIds.decoration1Id,
    type: "rectangle",
    x,
    y,
    width: 86,
    height: 26,
    groupIds,
    roundness: null,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const keyword = createOrUpdateTextElement(null, {
    id: childElementIds.decoration2Id,
    x: x + 12,
    y: y + 4,
    text: "package",
    fontSize: 15,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + layout.width / 2,
    y: y + layout.labelY,
    text: data.label,
    fontSize: 18,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });

  return [root, tab, keyword, label];
};

const createNoteTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
    bodyTextId: randomId(),
    decoration1Id: randomId(),
    decoration2Id: randomId(),
    decoration3Id: randomId(),
  };
  const labelMetrics = getTextMetrics(data.label, 18);
  const bodyMetrics = getTextMetrics(data.body || "", 16);
  const width = Math.max(
    190,
    Math.max(labelMetrics.width, bodyMetrics.width) +
      UML_DIAGRAM_NOTE_HORIZONTAL_PADDING,
  );
  const height = Math.max(
    130,
    labelMetrics.height +
      bodyMetrics.height +
      UML_DIAGRAM_NOTE_VERTICAL_PADDING,
  );
  const foldWidth = 38;
  const foldHeight = 34;

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "rectangle",
    x,
    y,
    width,
    height,
    groupIds,
    roundness: null,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const foldTop = createOrUpdateLine(null, {
    id: childElementIds.decoration1Id,
    type: "line",
    x: x + width - foldWidth,
    y,
    width: foldWidth,
    height: 0,
    points: [
      [0, 0],
      [foldWidth, 0],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const foldRight = createOrUpdateLine(null, {
    id: childElementIds.decoration2Id,
    type: "line",
    x: x + width,
    y,
    width: 0,
    height: foldHeight,
    points: [
      [0, 0],
      [0, foldHeight],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const foldDiagonal = createOrUpdateLine(null, {
    id: childElementIds.decoration3Id,
    type: "line",
    x: x + width - foldWidth,
    y,
    width: foldWidth,
    height: foldHeight,
    points: [
      [0, 0],
      [foldWidth, foldHeight],
    ],
    groupIds,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + 18,
    y: y + 18,
    text: data.label,
    fontSize: 18,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });
  const body = createOrUpdateTextElement(null, {
    id: childElementIds.bodyTextId,
    x: x + 18,
    y: y + 18 + labelMetrics.height + 16,
    text: data.body || "",
    fontSize: 16,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "body"),
  });

  return [root, foldTop, foldRight, foldDiagonal, label, body];
};
const createComponentTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
    decoration1Id: randomId(),
    decoration2Id: randomId(),
  };
  const labelMetrics = getTextMetrics(data.label, 20);
  const layout = getComponentLayout(labelMetrics);

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "rectangle",
    x,
    y,
    width: layout.width,
    height: layout.height,
    groupIds,
    roundness: null,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const port1 = createOrUpdateShape(null, {
    id: childElementIds.decoration1Id,
    type: "rectangle",
    x: x + 14,
    y: y + layout.portsTop,
    width: 22,
    height: 14,
    groupIds,
    roundness: null,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const port2 = createOrUpdateShape(null, {
    id: childElementIds.decoration2Id,
    type: "rectangle",
    x: x + 14,
    y: y + layout.portsTop + 26,
    width: 22,
    height: 14,
    groupIds,
    roundness: null,
    customData: buildChildCustomData(rootId, "decoration"),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + layout.width / 2,
    y: y + (layout.height - labelMetrics.height) / 2,
    text: data.label,
    fontSize: 20,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });

  return [root, port1, port2, label];
};

const createRelationTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
  };
  const lineConfig = getRelationLineConfig(data.preset);
  const root = createOrUpdateLine(null, {
    id: rootId,
    type: lineConfig.type,
    x,
    y,
    width: 220,
    height: 0,
    points: [
      [0, 0],
      [220, 0],
    ],
    groupIds,
    strokeStyle: lineConfig.strokeStyle,
    startArrowhead: lineConfig.startArrowhead,
    endArrowhead: lineConfig.endArrowhead,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + 110,
    y: y - 28,
    text: data.label,
    fontSize: 16,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });

  return [root, label];
};

const createSequenceLifelineTemplate = (
  x: number,
  y: number,
  data: UmlDiagramTemplateData,
): NonDeletedExcalidrawElement[] => {
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlDiagramChildElementIds = {
    labelTextId: randomId(),
    decoration1Id: randomId(),
  };
  const labelMetrics = getTextMetrics(data.label, 18);
  const layout = getSequenceLayout(labelMetrics);

  const root = createOrUpdateShape(null, {
    id: rootId,
    type: "rectangle",
    x,
    y,
    width: layout.width,
    height: layout.headerHeight,
    groupIds,
    roundness: null,
    customData: buildRootCustomData(rootId, data, childElementIds),
  });
  const label = createOrUpdateTextElement(null, {
    id: childElementIds.labelTextId,
    x: x + layout.width / 2,
    y: y + (layout.headerHeight - labelMetrics.height) / 2,
    text: data.label,
    fontSize: 18,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "label"),
  });
  const lifeline = createOrUpdateLine(null, {
    id: childElementIds.decoration1Id,
    type: "line",
    x: x + layout.width / 2,
    y: y + layout.headerHeight,
    width: 0,
    height: layout.lineHeight,
    points: [
      [0, 0],
      [0, layout.lineHeight],
    ],
    groupIds,
    strokeStyle: "dashed",
    customData: buildChildCustomData(rootId, "decoration"),
  });

  return [root, label, lifeline];
};

export const createUmlDiagramTemplate = (
  x: number,
  y: number,
  preset: UmlDiagramTemplatePreset,
): NonDeletedExcalidrawElement[] => {
  const data = getDefaultDataForPreset(preset);

  switch (preset) {
    case "actor":
      return createActorTemplate(x, y, data);
    case "use-case":
      return createUseCaseTemplate(x, y, data);
    case "package":
      return createPackageTemplate(x, y, data);
    case "note":
      return createNoteTemplate(x, y, data);
    case "component":
      return createComponentTemplate(x, y, data);
    case "association":
    case "inheritance":
    case "aggregation":
    case "composition":
    case "dependency":
      return createRelationTemplate(x, y, data);
    case "sequence-lifeline":
    default:
      return createSequenceLifelineTemplate(x, y, data);
  }
};
export const updateUmlDiagramTemplateInSceneWithMap = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: Partial<UmlDiagramTemplateData> | null | undefined,
  elementsById: ElementsById,
): ExcalidrawElement[] => {
  const root = findElementByIdFromMap<ExcalidrawElement>(elementsById, rootId);
  const rootCustomData = getTemplateCustomData(root);

  if (!root || !rootCustomData || rootCustomData.templateRole !== "root") {
    return [...elements];
  }

  const currentData = normalizeUmlDiagramTemplateData(
    rootCustomData.templateData,
  );
  const nextData = normalizeUmlDiagramTemplateData(data, currentData.preset);
  const groupIds = root.groupIds?.length ? [...root.groupIds] : [rootId];
  const childElementIds = {
    ...rootCustomData.childElementIds,
    labelTextId: rootCustomData.childElementIds?.labelTextId || randomId(),
    bodyTextId: rootCustomData.childElementIds?.bodyTextId || randomId(),
    decoration1Id: rootCustomData.childElementIds?.decoration1Id || randomId(),
    decoration2Id: rootCustomData.childElementIds?.decoration2Id || randomId(),
    decoration3Id: rootCustomData.childElementIds?.decoration3Id || randomId(),
    decoration4Id: rootCustomData.childElementIds?.decoration4Id || randomId(),
  } as UmlDiagramChildElementIds;
  const replacementMap = new Map<string, ExcalidrawElement>();

  if (currentData.preset === "actor") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 18;
    const nextRoot = newElementWith(root, {
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const label = createOrUpdateTextElement(labelElement, {
      x: root.x + root.width / 2,
      y: root.y + 132,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(label.id, label);
  }

  if (currentData.preset === "use-case") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 20;
    const labelMetrics = getTextMetrics(nextData.label, labelFontSize);
    const nextWidth = Math.max(
      220,
      labelMetrics.width + UML_DIAGRAM_HORIZONTAL_PADDING,
    );
    const nextHeight = Math.max(110, labelMetrics.height + 44);
    const nextRoot = newElementWith(root, {
      width: nextWidth,
      height: nextHeight,
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const label = createOrUpdateTextElement(labelElement, {
      x: root.x + nextWidth / 2,
      y: root.y + (nextHeight - labelMetrics.height) / 2,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(label.id, label);
  }

  if (currentData.preset === "package") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 18;
    const labelMetrics = getTextMetrics(nextData.label, labelFontSize);
    const layout = getPackageLayout(labelMetrics);
    const tabElement = findElementByIdFromMap<ExcalidrawElement>(
      elementsById,
      childElementIds.decoration1Id,
    );
    const keywordElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.decoration2Id,
    );
    const nextRoot = newElementWith(root, {
      width: layout.width,
      height: layout.height,
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const tab = createOrUpdateShape(tabElement, {
      id: childElementIds.decoration1Id,
      type: "rectangle",
      x: root.x,
      y: root.y - 24,
      width: 86,
      height: 26,
      groupIds,
      roundness: null,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const keyword = createOrUpdateTextElement(keywordElement, {
      id: childElementIds.decoration2Id,
      x: root.x + 12,
      y: root.y - 20,
      text: "package",
      fontSize: 15,
      textAlign: "left",
      groupIds,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const label = createOrUpdateTextElement(labelElement, {
      x: root.x + layout.width / 2,
      y: root.y - 24 + layout.labelY,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(tab.id, tab);
    replacementMap.set(keyword.id, keyword);
    replacementMap.set(label.id, label);
  }

  if (currentData.preset === "note") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const bodyElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.bodyTextId,
    );
    const labelFontSize = labelElement?.fontSize || 18;
    const bodyFontSize = bodyElement?.fontSize || 16;
    const labelMetrics = getTextMetrics(nextData.label, labelFontSize);
    const bodyMetrics = getTextMetrics(nextData.body || "", bodyFontSize);
    const nextWidth = Math.max(
      190,
      Math.max(labelMetrics.width, bodyMetrics.width) +
        UML_DIAGRAM_NOTE_HORIZONTAL_PADDING,
    );
    const nextHeight = Math.max(
      130,
      labelMetrics.height +
        bodyMetrics.height +
        UML_DIAGRAM_NOTE_VERTICAL_PADDING,
    );
    const foldWidth = 38;
    const foldHeight = 34;
    const foldTop = findElementByIdFromMap<ExcalidrawLinearElement>(
      elementsById,
      childElementIds.decoration1Id,
    );
    const foldRight = findElementByIdFromMap<ExcalidrawLinearElement>(
      elementsById,
      childElementIds.decoration2Id,
    );
    const foldDiagonal = findElementByIdFromMap<ExcalidrawLinearElement>(
      elementsById,
      childElementIds.decoration3Id,
    );

    const nextRoot = newElementWith(root, {
      width: nextWidth,
      height: nextHeight,
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const nextLabel = createOrUpdateTextElement(labelElement, {
      x: root.x + 18,
      y: root.y + 18,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "left",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    const nextBody = createOrUpdateTextElement(bodyElement, {
      x: root.x + 18,
      y: root.y + 18 + labelMetrics.height + 16,
      text: nextData.body || "",
      fontSize: bodyFontSize,
      textAlign: "left",
      groupIds,
      customData: buildChildCustomData(rootId, "body"),
    });
    const nextFoldTop = createOrUpdateLine(foldTop, {
      id: childElementIds.decoration1Id,
      type: "line",
      x: root.x + nextWidth - foldWidth,
      y: root.y,
      width: foldWidth,
      height: 0,
      points: [
        [0, 0],
        [foldWidth, 0],
      ],
      groupIds,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const nextFoldRight = createOrUpdateLine(foldRight, {
      id: childElementIds.decoration2Id,
      type: "line",
      x: root.x + nextWidth,
      y: root.y,
      width: 0,
      height: foldHeight,
      points: [
        [0, 0],
        [0, foldHeight],
      ],
      groupIds,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const nextFoldDiagonal = createOrUpdateLine(foldDiagonal, {
      id: childElementIds.decoration3Id,
      type: "line",
      x: root.x + nextWidth - foldWidth,
      y: root.y,
      width: foldWidth,
      height: foldHeight,
      points: [
        [0, 0],
        [foldWidth, foldHeight],
      ],
      groupIds,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(nextLabel.id, nextLabel);
    replacementMap.set(nextBody.id, nextBody);
    replacementMap.set(nextFoldTop.id, nextFoldTop);
    replacementMap.set(nextFoldRight.id, nextFoldRight);
    replacementMap.set(nextFoldDiagonal.id, nextFoldDiagonal);
  }
  if (currentData.preset === "component") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 20;
    const labelMetrics = getTextMetrics(nextData.label, labelFontSize);
    const layout = getComponentLayout(labelMetrics);
    const port1 = findElementByIdFromMap<ExcalidrawElement>(
      elementsById,
      childElementIds.decoration1Id,
    );
    const port2 = findElementByIdFromMap<ExcalidrawElement>(
      elementsById,
      childElementIds.decoration2Id,
    );
    const nextRoot = newElementWith(root, {
      width: layout.width,
      height: layout.height,
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const nextPort1 = createOrUpdateShape(port1, {
      id: childElementIds.decoration1Id,
      type: "rectangle",
      x: root.x + 14,
      y: root.y + layout.portsTop,
      width: 22,
      height: 14,
      groupIds,
      roundness: null,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const nextPort2 = createOrUpdateShape(port2, {
      id: childElementIds.decoration2Id,
      type: "rectangle",
      x: root.x + 14,
      y: root.y + layout.portsTop + 26,
      width: 22,
      height: 14,
      groupIds,
      roundness: null,
      customData: buildChildCustomData(rootId, "decoration"),
    });
    const label = createOrUpdateTextElement(labelElement, {
      x: root.x + layout.width / 2,
      y: root.y + (layout.height - labelMetrics.height) / 2,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(nextPort1.id, nextPort1);
    replacementMap.set(nextPort2.id, nextPort2);
    replacementMap.set(label.id, label);
  }

  if (
    currentData.preset === "association" ||
    currentData.preset === "inheritance" ||
    currentData.preset === "aggregation" ||
    currentData.preset === "composition" ||
    currentData.preset === "dependency"
  ) {
    const nextRoot = newElementWith(root, {
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 16;
    const relationRoot = nextRoot as ExcalidrawLinearElement;
    const labelPosition = getRelationLabelPosition(relationRoot);
    const label = createOrUpdateTextElement(labelElement, {
      x: labelPosition.x,
      y: labelPosition.y,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(label.id, label);
  }

  if (currentData.preset === "sequence-lifeline") {
    const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
      elementsById,
      childElementIds.labelTextId,
    );
    const labelFontSize = labelElement?.fontSize || 18;
    const labelMetrics = getTextMetrics(nextData.label, labelFontSize);
    const layout = getSequenceLayout(labelMetrics);
    const lifelineElement = findElementByIdFromMap<ExcalidrawLinearElement>(
      elementsById,
      childElementIds.decoration1Id,
    );
    const nextRoot = newElementWith(root, {
      width: layout.width,
      height: layout.headerHeight,
      groupIds,
      customData: buildRootCustomData(rootId, nextData, childElementIds),
    });
    const label = createOrUpdateTextElement(labelElement, {
      x: root.x + layout.width / 2,
      y: root.y + (layout.headerHeight - labelMetrics.height) / 2,
      text: nextData.label,
      fontSize: labelFontSize,
      textAlign: "center",
      groupIds,
      customData: buildChildCustomData(rootId, "label"),
    });
    const lifeline = createOrUpdateLine(lifelineElement, {
      id: childElementIds.decoration1Id,
      type: "line",
      x: root.x + layout.width / 2,
      y: root.y + layout.headerHeight,
      width: 0,
      height: layout.lineHeight,
      points: [
        [0, 0],
        [0, layout.lineHeight],
      ],
      groupIds,
      strokeStyle: "dashed",
      customData: buildChildCustomData(rootId, "decoration"),
    });
    replacementMap.set(rootId, nextRoot);
    replacementMap.set(label.id, label);
    replacementMap.set(lifeline.id, lifeline);
  }

  const nextElements = elements.map(
    (element) => replacementMap.get(element.id) || element,
  );

  replacementMap.forEach((element, id) => {
    if (!elementsById.has(id)) {
      nextElements.push(element);
    }
  });

  return nextElements;
};

export const updateUmlDiagramTemplateInScene = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: Partial<UmlDiagramTemplateData> | null | undefined,
): ExcalidrawElement[] =>
  updateUmlDiagramTemplateInSceneWithMap(
    elements,
    rootId,
    data,
    buildElementsById(elements),
  );

export const syncUmlDiagramTemplateLayoutInSceneWithMap = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  elementsById: ElementsById,
): ExcalidrawElement[] => {
  const root = findElementByIdFromMap<ExcalidrawElement>(elementsById, rootId);
  const rootCustomData = getTemplateCustomData(root);

  if (!root || !rootCustomData || rootCustomData.templateRole !== "root") {
    return elements as ExcalidrawElement[];
  }

  const data = normalizeUmlDiagramTemplateData(rootCustomData.templateData);
  const childElementIds = getChildElementIds(rootCustomData);
  const labelElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.labelTextId,
  );
  const bodyElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.bodyTextId,
  );

  let needsRelayout = false;

  if (data.preset === "use-case") {
    const labelMetrics = getTextMetrics(
      data.label,
      labelElement?.fontSize || 20,
    );
    const nextWidth = Math.max(220, labelMetrics.width + 56);
    const nextHeight = Math.max(110, labelMetrics.height + 44);
    needsRelayout =
      Math.abs(root.width - nextWidth) > 1 ||
      Math.abs(root.height - nextHeight) > 1 ||
      Math.abs(
        (labelElement?.y || 0) -
          (root.y + (nextHeight - labelMetrics.height) / 2),
      ) > 1;
  } else if (data.preset === "package") {
    const labelMetrics = getTextMetrics(
      data.label,
      labelElement?.fontSize || 18,
    );
    const layout = getPackageLayout(labelMetrics);
    needsRelayout =
      Math.abs(root.width - layout.width) > 1 ||
      Math.abs(root.height - layout.height) > 1 ||
      Math.abs(
        (labelElement?.x || 0) +
          (labelElement?.width || 0) / 2 -
          (root.x + layout.width / 2),
      ) > 1;
  } else if (data.preset === "note") {
    const labelMetrics = getTextMetrics(
      data.label,
      labelElement?.fontSize || 18,
    );
    const bodyMetrics = getTextMetrics(
      data.body || "",
      bodyElement?.fontSize || 16,
    );
    const nextWidth = Math.max(
      190,
      Math.max(labelMetrics.width, bodyMetrics.width) + 48,
    );
    const nextHeight = Math.max(
      130,
      labelMetrics.height + bodyMetrics.height + 72,
    );
    needsRelayout =
      Math.abs(root.width - nextWidth) > 1 ||
      Math.abs(root.height - nextHeight) > 1;
  } else if (data.preset === "component") {
    const labelMetrics = getTextMetrics(
      data.label,
      labelElement?.fontSize || 20,
    );
    const layout = getComponentLayout(labelMetrics);
    needsRelayout =
      Math.abs(root.width - layout.width) > 1 ||
      Math.abs(root.height - layout.height) > 1;
  } else if (data.preset === "sequence-lifeline") {
    const labelMetrics = getTextMetrics(
      data.label,
      labelElement?.fontSize || 18,
    );
    const layout = getSequenceLayout(labelMetrics);
    needsRelayout =
      Math.abs(root.width - layout.width) > 1 ||
      Math.abs(root.height - layout.headerHeight) > 1;
  }

  if (!needsRelayout) {
    return elements as ExcalidrawElement[];
  }

  return updateUmlDiagramTemplateInSceneWithMap(
    elements,
    rootId,
    data,
    elementsById,
  );
};

export const syncUmlDiagramTemplateLayoutInScene = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
): ExcalidrawElement[] =>
  syncUmlDiagramTemplateLayoutInSceneWithMap(
    elements,
    rootId,
    buildElementsById(elements),
  );

export const resolveSelectedUmlDiagramTemplateRootWithMap = (
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
    .filter(
      (element): element is NonDeletedExcalidrawElement =>
        !!element && !element.isDeleted,
    );

  if (!selectedElements.length) {
    return null;
  }

  const rootIds = new Set<string>();

  for (const element of selectedElements) {
    const rootId = getUmlDiagramTemplateRootId(element);
    if (!rootId) {
      return null;
    }
    rootIds.add(rootId);
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

export const resolveSelectedUmlDiagramTemplateRoot = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: AppStateSelection | null | undefined,
): NonDeletedExcalidrawElement | null =>
  resolveSelectedUmlDiagramTemplateRootWithMap(
    buildElementsById(elements),
    selectedElementIds,
  );

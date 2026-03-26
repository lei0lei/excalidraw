import {
  DEFAULT_FONT_FAMILY,
  getFontString,
  getLineHeight,
  randomId,
} from "@excalidraw/common";
import {
  measureText,
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

export const UML_CLASS_TEMPLATE_TYPE = "uml-class";
export type UmlClassTemplatePreset =
  | "class"
  | "interface"
  | "abstract-class"
  | "enum";
const UML_CLASS_TEMPLATE_VERSION = 1;
const UML_CLASS_MIN_WIDTH = 240;
const UML_CLASS_TITLE_FONT_SIZE = 20;
const UML_CLASS_BODY_FONT_SIZE = 16;
const UML_CLASS_PADDING_X = 18;
const UML_CLASS_PADDING_Y = 14;
const UML_CLASS_SECTION_GAP = 10;
const UML_CLASS_MIN_SECTION_HEIGHT = 28;
const UML_CLASS_SAFE_BORDER_PADDING = 18;
const UML_CLASS_DIVIDER_INSET = 1;

type UmlClassTemplateRole =
  | "root"
  | "title"
  | "attributes"
  | "methods"
  | "divider-attributes"
  | "divider-methods";

export type UmlClassTemplateMember = {
  id: string;
  text: string;
};

export type UmlClassTemplateData = {
  name: string;
  stereotype?: string;
  attributes: UmlClassTemplateMember[];
  methods: UmlClassTemplateMember[];
};

type UmlClassChildElementIds = {
  titleTextId: string;
  attributesTextId: string;
  methodsTextId: string;
  dividerAttributesId: string;
  dividerMethodsId: string;
};

type UmlClassTemplateCustomData = {
  templateType?: string;
  templateVersion?: number;
  templateRole?: UmlClassTemplateRole;
  templateRootId?: string;
  templateData?: UmlClassTemplateData;
  childElementIds?: Partial<UmlClassChildElementIds>;
};

type LayoutTextBlock = {
  text: string;
  width: number;
  height: number;
  lineHeight: number;
};

type UmlClassLayout = {
  width: number;
  height: number;
  title: LayoutTextBlock;
  attributes: LayoutTextBlock;
  methods: LayoutTextBlock;
  dividerAttributesY: number;
  dividerMethodsY: number;
  titleY: number;
  attributesY: number;
  methodsY: number;
};

type UmlClassLayoutFontSizes = {
  title: number;
  attributes: number;
  methods: number;
};

type ElementsById = ReadonlyMap<string, ExcalidrawElement>;

export const createDefaultUmlClassTemplateData = (
  preset: UmlClassTemplatePreset = "class",
): UmlClassTemplateData => {
  switch (preset) {
    case "interface":
      return {
        name: "IService",
        stereotype: "interface",
        attributes: [],
        methods: [
          {
            id: randomId(),
            text: "execute(): Promise<void>",
          },
        ],
      };
    case "abstract-class":
      return {
        name: "BaseService",
        stereotype: "abstract",
        attributes: [
          {
            id: randomId(),
            text: "repository: Repository",
          },
        ],
        methods: [
          {
            id: randomId(),
            text: "run(): void",
          },
          {
            id: randomId(),
            text: "validate(): boolean",
          },
        ],
      };
    case "enum":
      return {
        name: "Status",
        stereotype: "enum",
        attributes: [
          {
            id: randomId(),
            text: "Pending",
          },
          {
            id: randomId(),
            text: "Running",
          },
          {
            id: randomId(),
            text: "Done",
          },
        ],
        methods: [],
      };
    case "class":
    default:
      return {
        name: "ClassName",
        attributes: [
          {
            id: randomId(),
            text: "name: string",
          },
        ],
        methods: [
          {
            id: randomId(),
            text: "method(): void",
          },
        ],
      };
  }
};

export const DEFAULT_UML_CLASS_TEMPLATE_DATA = (): UmlClassTemplateData =>
  createDefaultUmlClassTemplateData("class");

const normalizeMembers = (
  members: UmlClassTemplateMember[] | undefined,
): UmlClassTemplateMember[] =>
  (members || [])
    .map((member) => ({
      id: member?.id || randomId(),
      text: typeof member?.text === "string" ? member.text : "",
    }))
    .filter((member) => member.text.trim().length > 0);

export const normalizeUmlClassTemplateData = (
  data?: Partial<UmlClassTemplateData> | null,
): UmlClassTemplateData => ({
  name:
    typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : "ClassName",
  stereotype:
    typeof data?.stereotype === "string" && data.stereotype.trim()
      ? data.stereotype.trim()
      : "",
  attributes: normalizeMembers(data?.attributes as UmlClassTemplateMember[]),
  methods: normalizeMembers(data?.methods as UmlClassTemplateMember[]),
});

const formatMembers = (members: UmlClassTemplateMember[]) =>
  members.map((member) => member.text).join("\n");

const buildTitleText = (data: UmlClassTemplateData) =>
  data.stereotype ? `<<${data.stereotype}>>\n${data.name}` : data.name;

const getTextMetrics = (text: string, fontSize: number) => {
  const fontFamily = DEFAULT_FONT_FAMILY;
  const lineHeight = getLineHeight(fontFamily);
  const normalizedText = text || " ";
  const metrics = measureText(
    normalizedText,
    getFontString({ fontFamily, fontSize }),
    lineHeight,
  );

  return {
    text,
    width: Math.max(Math.ceil(metrics.width), 1),
    height: Math.max(Math.ceil(metrics.height), UML_CLASS_MIN_SECTION_HEIGHT),
    lineHeight,
  };
};

const computeLayout = (
  data: UmlClassTemplateData,
  forcedWidth?: number,
  fontSizes: UmlClassLayoutFontSizes = {
    title: UML_CLASS_TITLE_FONT_SIZE,
    attributes: UML_CLASS_BODY_FONT_SIZE,
    methods: UML_CLASS_BODY_FONT_SIZE,
  },
): UmlClassLayout => {
  const title = getTextMetrics(buildTitleText(data), fontSizes.title);
  const attributes = getTextMetrics(
    formatMembers(data.attributes),
    fontSizes.attributes,
  );
  const methods = getTextMetrics(
    formatMembers(data.methods),
    fontSizes.methods,
  );

  const naturalWidth = Math.max(
    UML_CLASS_MIN_WIDTH,
    title.width + UML_CLASS_PADDING_X * 2 + UML_CLASS_SAFE_BORDER_PADDING,
    attributes.width + UML_CLASS_PADDING_X * 2 + UML_CLASS_SAFE_BORDER_PADDING,
    methods.width + UML_CLASS_PADDING_X * 2 + UML_CLASS_SAFE_BORDER_PADDING,
  );
  const width = Math.max(forcedWidth || 0, naturalWidth);

  const titleY = UML_CLASS_PADDING_Y;
  const dividerAttributesY = titleY + title.height + UML_CLASS_SECTION_GAP;
  const attributesY = dividerAttributesY + UML_CLASS_SECTION_GAP;
  const dividerMethodsY =
    attributesY + attributes.height + UML_CLASS_SECTION_GAP;
  const methodsY = dividerMethodsY + UML_CLASS_SECTION_GAP;
  const height = methodsY + methods.height + UML_CLASS_PADDING_Y;

  return {
    width,
    height,
    title,
    attributes,
    methods,
    dividerAttributesY,
    dividerMethodsY,
    titleY,
    attributesY,
    methodsY,
  };
};

const getLayoutFontSizes = (
  titleElement: ExcalidrawTextElement | null,
  attributesElement: ExcalidrawTextElement | null,
  methodsElement: ExcalidrawTextElement | null,
): UmlClassLayoutFontSizes => ({
  title: titleElement?.fontSize || UML_CLASS_TITLE_FONT_SIZE,
  attributes: attributesElement?.fontSize || UML_CLASS_BODY_FONT_SIZE,
  methods: methodsElement?.fontSize || UML_CLASS_BODY_FONT_SIZE,
});

const getTemplateCustomData = (
  element: ExcalidrawElement | null | undefined,
): UmlClassTemplateCustomData | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | UmlClassTemplateCustomData
    | undefined;
  if (customData?.templateType !== UML_CLASS_TEMPLATE_TYPE) {
    return null;
  }

  return customData;
};

export const isUmlClassTemplateElement = (
  element: ExcalidrawElement | null | undefined,
) => !!getTemplateCustomData(element);

export const getUmlClassTemplateRootId = (
  element: ExcalidrawElement | null | undefined,
) => {
  const customData = getTemplateCustomData(element);
  if (!customData) {
    return null;
  }

  return customData.templateRootId || element?.id || null;
};

export const getUmlClassTemplateData = (
  element: ExcalidrawElement | null | undefined,
): UmlClassTemplateData | null => {
  const customData = getTemplateCustomData(element);
  if (!customData) {
    return null;
  }

  return normalizeUmlClassTemplateData(customData.templateData);
};

const buildRootCustomData = (
  rootId: string,
  data: UmlClassTemplateData,
  childElementIds: UmlClassChildElementIds,
): UmlClassTemplateCustomData => ({
  templateType: UML_CLASS_TEMPLATE_TYPE,
  templateVersion: UML_CLASS_TEMPLATE_VERSION,
  templateRole: "root",
  templateRootId: rootId,
  templateData: data,
  childElementIds,
});

const buildChildCustomData = (
  rootId: string,
  role: UmlClassTemplateRole,
): UmlClassTemplateCustomData => ({
  templateType: UML_CLASS_TEMPLATE_TYPE,
  templateVersion: UML_CLASS_TEMPLATE_VERSION,
  templateRole: role,
  templateRootId: rootId,
});

const createTextElementWithId = (
  id: string,
  element: NonDeleted<ExcalidrawTextElement>,
): NonDeleted<ExcalidrawTextElement> => ({
  ...element,
  id,
});

const createLineElementWithId = (
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
    customData: UmlClassTemplateCustomData;
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
    strokeColor: "#1f2937",
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
    strokeColor: existing.strokeColor,
    backgroundColor: existing.backgroundColor,
    fillStyle: existing.fillStyle,
    strokeWidth: existing.strokeWidth,
    roughness: existing.roughness,
    opacity: existing.opacity,
    groupIds: opts.groupIds,
    link: null,
    customData: opts.customData,
  });
};

const createOrUpdateDivider = (
  existing: ExcalidrawLinearElement | null,
  opts: {
    id?: string;
    x: number;
    y: number;
    width: number;
    groupIds: string[];
    customData: UmlClassTemplateCustomData;
  },
): NonDeleted<ExcalidrawLinearElement> => {
  const nextElement = newLinearElement({
    type: "line",
    x: opts.x,
    y: opts.y,
    width: Math.max(opts.width - UML_CLASS_DIVIDER_INSET * 2, 0),
    height: 0,
    points: [
      [0, 0] as any,
      [Math.max(opts.width - UML_CLASS_DIVIDER_INSET * 2, 0), 0] as any,
    ],
    groupIds: opts.groupIds,
    strokeColor: "#334155",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    customData: opts.customData,
  });

  if (!existing) {
    return opts.id
      ? createLineElementWithId(opts.id, nextElement)
      : nextElement;
  }

  return newElementWith(existing, {
    x: nextElement.x,
    y: nextElement.y,
    width: nextElement.width,
    height: nextElement.height,
    points: nextElement.points,
    strokeColor: existing.strokeColor,
    backgroundColor: existing.backgroundColor,
    fillStyle: existing.fillStyle,
    strokeWidth: existing.strokeWidth,
    strokeStyle: existing.strokeStyle,
    roughness: existing.roughness,
    opacity: existing.opacity,
    groupIds: opts.groupIds,
    link: null,
    customData: opts.customData,
  });
};

export const createUmlClassTemplate = (
  x: number,
  y: number,
  data?: Partial<UmlClassTemplateData> | null,
): NonDeletedExcalidrawElement[] => {
  const normalizedData = normalizeUmlClassTemplateData(data);
  const layout = computeLayout(normalizedData);
  const rootId = randomId();
  const groupIds = [rootId];
  const childElementIds: UmlClassChildElementIds = {
    titleTextId: randomId(),
    attributesTextId: randomId(),
    methodsTextId: randomId(),
    dividerAttributesId: randomId(),
    dividerMethodsId: randomId(),
  };

  const root = newElement({
    type: "rectangle",
    x,
    y,
    width: layout.width,
    height: layout.height,
    strokeColor: "#111827",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: null,
    groupIds,
    customData: buildRootCustomData(rootId, normalizedData, childElementIds),
  });

  const rootElement = { ...root, id: rootId };

  const titleText = createOrUpdateTextElement(null, {
    id: childElementIds.titleTextId,
    x: x + layout.width / 2,
    y: y + layout.titleY,
    text: buildTitleText(normalizedData),
    fontSize: UML_CLASS_TITLE_FONT_SIZE,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "title"),
  });

  const attributesText = createOrUpdateTextElement(null, {
    id: childElementIds.attributesTextId,
    x: x + UML_CLASS_PADDING_X,
    y: y + layout.attributesY,
    text: formatMembers(normalizedData.attributes),
    fontSize: UML_CLASS_BODY_FONT_SIZE,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "attributes"),
  });

  const methodsText = createOrUpdateTextElement(null, {
    id: childElementIds.methodsTextId,
    x: x + UML_CLASS_PADDING_X,
    y: y + layout.methodsY,
    text: formatMembers(normalizedData.methods),
    fontSize: UML_CLASS_BODY_FONT_SIZE,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "methods"),
  });

  const dividerAttributes = createOrUpdateDivider(null, {
    id: childElementIds.dividerAttributesId,
    x: x + UML_CLASS_DIVIDER_INSET,
    y: y + layout.dividerAttributesY,
    width: layout.width,
    groupIds,
    customData: buildChildCustomData(rootId, "divider-attributes"),
  });

  const dividerMethods = createOrUpdateDivider(null, {
    id: childElementIds.dividerMethodsId,
    x: x + UML_CLASS_DIVIDER_INSET,
    y: y + layout.dividerMethodsY,
    width: layout.width,
    groupIds,
    customData: buildChildCustomData(rootId, "divider-methods"),
  });

  return [
    rootElement,
    dividerAttributes,
    dividerMethods,
    titleText,
    attributesText,
    methodsText,
  ];
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
  rootCustomData: UmlClassTemplateCustomData,
): UmlClassChildElementIds => ({
  titleTextId: rootCustomData.childElementIds?.titleTextId || randomId(),
  attributesTextId:
    rootCustomData.childElementIds?.attributesTextId || randomId(),
  methodsTextId: rootCustomData.childElementIds?.methodsTextId || randomId(),
  dividerAttributesId:
    rootCustomData.childElementIds?.dividerAttributesId || randomId(),
  dividerMethodsId:
    rootCustomData.childElementIds?.dividerMethodsId || randomId(),
});

const serializeMembersForSignature = (members: UmlClassTemplateMember[]) =>
  members.map((member) => member.text).join("\n");

export const getUmlClassTemplateLayoutSignature = (
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
  const titleElement = findElementByIdFromMap<ExcalidrawTextElement>(
    resolvedElementsById,
    childElementIds.titleTextId,
  );
  const attributesElement = findElementByIdFromMap<ExcalidrawTextElement>(
    resolvedElementsById,
    childElementIds.attributesTextId,
  );
  const methodsElement = findElementByIdFromMap<ExcalidrawTextElement>(
    resolvedElementsById,
    childElementIds.methodsTextId,
  );
  const data = normalizeUmlClassTemplateData(rootCustomData.templateData);

  return [
    root.id,
    root.width,
    root.height,
    titleElement?.fontSize || UML_CLASS_TITLE_FONT_SIZE,
    attributesElement?.fontSize || UML_CLASS_BODY_FONT_SIZE,
    methodsElement?.fontSize || UML_CLASS_BODY_FONT_SIZE,
    data.name,
    data.stereotype || "",
    serializeMembersForSignature(data.attributes),
    serializeMembersForSignature(data.methods),
  ].join("::");
};

export const updateUmlClassTemplateInSceneWithMap = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: Partial<UmlClassTemplateData> | null | undefined,
  elementsById: ElementsById,
): ExcalidrawElement[] => {
  const root = findElementByIdFromMap<ExcalidrawElement>(elementsById, rootId);
  const rootCustomData = getTemplateCustomData(root);

  if (!root || !rootCustomData || rootCustomData.templateRole !== "root") {
    return [...elements];
  }

  const normalizedData = normalizeUmlClassTemplateData(data);
  const childElementIds = getChildElementIds(rootCustomData);
  const groupIds = root.groupIds?.length ? [...root.groupIds] : [rootId];
  const titleElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.titleTextId,
  );
  const attributesElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.attributesTextId,
  );
  const methodsElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.methodsTextId,
  );
  const dividerAttributesElement =
    findElementByIdFromMap<ExcalidrawLinearElement>(
      elementsById,
      childElementIds.dividerAttributesId,
    );
  const dividerMethodsElement = findElementByIdFromMap<ExcalidrawLinearElement>(
    elementsById,
    childElementIds.dividerMethodsId,
  );
  const layoutFontSizes = getLayoutFontSizes(
    titleElement,
    attributesElement,
    methodsElement,
  );
  const layout = computeLayout(normalizedData, undefined, layoutFontSizes);

  const nextRoot = newElementWith(root, {
    width: layout.width,
    height: layout.height,
    groupIds,
    customData: buildRootCustomData(rootId, normalizedData, childElementIds),
  });

  const nextTitle = createOrUpdateTextElement(titleElement, {
    x: root.x + layout.width / 2,
    y: root.y + layout.titleY,
    text: buildTitleText(normalizedData),
    fontSize: layoutFontSizes.title,
    textAlign: "center",
    groupIds,
    customData: buildChildCustomData(rootId, "title"),
  });

  const nextAttributes = createOrUpdateTextElement(attributesElement, {
    x: root.x + UML_CLASS_PADDING_X,
    y: root.y + layout.attributesY,
    text: formatMembers(normalizedData.attributes),
    fontSize: layoutFontSizes.attributes,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "attributes"),
  });

  const nextMethods = createOrUpdateTextElement(methodsElement, {
    x: root.x + UML_CLASS_PADDING_X,
    y: root.y + layout.methodsY,
    text: formatMembers(normalizedData.methods),
    fontSize: layoutFontSizes.methods,
    textAlign: "left",
    groupIds,
    customData: buildChildCustomData(rootId, "methods"),
  });

  const nextDividerAttributes = createOrUpdateDivider(
    dividerAttributesElement,
    {
      x: root.x + UML_CLASS_DIVIDER_INSET,
      y: root.y + layout.dividerAttributesY,
      width: layout.width,
      groupIds,
      customData: buildChildCustomData(rootId, "divider-attributes"),
    },
  );

  const nextDividerMethods = createOrUpdateDivider(dividerMethodsElement, {
    x: root.x + UML_CLASS_DIVIDER_INSET,
    y: root.y + layout.dividerMethodsY,
    width: layout.width,
    groupIds,
    customData: buildChildCustomData(rootId, "divider-methods"),
  });

  const replacementMap = new Map<string, ExcalidrawElement>([
    [rootId, nextRoot],
    [childElementIds.titleTextId, nextTitle],
    [childElementIds.attributesTextId, nextAttributes],
    [childElementIds.methodsTextId, nextMethods],
    [childElementIds.dividerAttributesId, nextDividerAttributes],
    [childElementIds.dividerMethodsId, nextDividerMethods],
  ]);

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

export const updateUmlClassTemplateInScene = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  data: Partial<UmlClassTemplateData> | null | undefined,
): ExcalidrawElement[] =>
  updateUmlClassTemplateInSceneWithMap(
    elements,
    rootId,
    data,
    buildElementsById(elements),
  );

export const syncUmlClassTemplateLayoutInSceneWithMap = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
  elementsById: ElementsById,
): ExcalidrawElement[] => {
  const root = findElementByIdFromMap<ExcalidrawElement>(elementsById, rootId);
  const rootCustomData = getTemplateCustomData(root);

  if (!root || !rootCustomData || rootCustomData.templateRole !== "root") {
    return elements as ExcalidrawElement[];
  }

  const data = normalizeUmlClassTemplateData(rootCustomData.templateData);
  const childElementIds = getChildElementIds(rootCustomData);

  const titleElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.titleTextId,
  );
  const attributesElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.attributesTextId,
  );
  const methodsElement = findElementByIdFromMap<ExcalidrawTextElement>(
    elementsById,
    childElementIds.methodsTextId,
  );
  const layoutFontSizes = getLayoutFontSizes(
    titleElement,
    attributesElement,
    methodsElement,
  );
  const layout = computeLayout(data, undefined, layoutFontSizes);

  const needsRelayout =
    Math.abs(root.height - layout.height) > 1 ||
    Math.abs(root.width - layout.width) > 1 ||
    Math.abs((titleElement?.y || 0) - (root.y + layout.titleY)) > 1 ||
    Math.abs((attributesElement?.y || 0) - (root.y + layout.attributesY)) > 1 ||
    Math.abs((methodsElement?.y || 0) - (root.y + layout.methodsY)) > 1;

  if (!needsRelayout) {
    return elements as ExcalidrawElement[];
  }

  return updateUmlClassTemplateInSceneWithMap(
    elements,
    rootId,
    data,
    elementsById,
  );
};

type AppStateSelection = Record<string, boolean>;

export const syncUmlClassTemplateLayoutInScene = (
  elements: readonly ExcalidrawElement[],
  rootId: string,
): ExcalidrawElement[] =>
  syncUmlClassTemplateLayoutInSceneWithMap(
    elements,
    rootId,
    buildElementsById(elements),
  );

export const resolveSelectedUmlClassTemplateRootWithMap = (
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
    const rootIdForElement = getUmlClassTemplateRootId(element);
    if (!rootIdForElement) {
      return null;
    }
    rootIds.add(rootIdForElement);
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

export const resolveSelectedUmlClassTemplateRoot = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: AppStateSelection | null | undefined,
): NonDeletedExcalidrawElement | null =>
  resolveSelectedUmlClassTemplateRootWithMap(
    buildElementsById(elements),
    selectedElementIds,
  );

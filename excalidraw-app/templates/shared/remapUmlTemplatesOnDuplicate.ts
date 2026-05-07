import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const UML_CLASS = "uml-class";
const UML_DIAGRAM = "uml-diagram";

type TemplateCustomData = {
  templateType?: string;
  templateRole?: string;
  templateRootId?: string;
  childElementIds?: Record<string, string | undefined>;
  templateData?: { preset?: string };
  [key: string]: unknown;
};

const readTemplateCustomData = (
  element: ExcalidrawElement,
): TemplateCustomData | null => {
  const cd = element.customData as TemplateCustomData | undefined;
  const tt = cd?.templateType;
  if (tt !== UML_CLASS && tt !== UML_DIAGRAM) {
    return null;
  }
  return cd ?? null;
};

const getDiagramDecorationKeys = (preset: string): string[] => {
  switch (preset) {
    case "actor":
      return [
        "decoration1Id",
        "decoration2Id",
        "decoration3Id",
        "decoration4Id",
      ];
    case "package":
      return ["decoration1Id", "decoration2Id"];
    case "note":
      return ["decoration1Id", "decoration2Id", "decoration3Id"];
    case "component":
      return ["decoration1Id", "decoration2Id"];
    case "sequence-lifeline":
      return ["decoration1Id"];
    default:
      return [];
  }
};

const unionFindClusterIds = (
  inserted: ExcalidrawElement[],
): ExcalidrawElement[][] => {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id);
    if (p === undefined || p === id) {
      return id;
    }
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent.set(ra, rb);
    }
  };

  for (const e of inserted) {
    parent.set(e.id, e.id);
  }
  const list = [...inserted];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const ag = a.groupIds ?? [];
      const bg = b.groupIds ?? [];
      if (ag.some((g) => bg.includes(g))) {
        union(a.id, b.id);
      }
    }
  }

  const buckets = new Map<string, ExcalidrawElement[]>();
  for (const e of inserted) {
    const r = find(e.id);
    if (!buckets.has(r)) {
      buckets.set(r, []);
    }
    buckets.get(r)!.push(e);
  }
  return [...buckets.values()];
};

/**
 * After duplicate / paste, UML elements keep stale `templateRootId` and `childElementIds`.
 * Rewrites customData for each new instance so scenes stay consistent even if ungrouped later.
 */
export const remapUmlTemplatesOnDuplicate = (
  nextElements: readonly ExcalidrawElement[],
  prevElements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => {
  const prevIds = new Set(prevElements.map((e) => e.id));
  const inserted = nextElements.filter((e) => !prevIds.has(e.id));
  if (inserted.length === 0) {
    return nextElements as ExcalidrawElement[];
  }

  const updates = new Map<string, ExcalidrawElement>();

  for (const cluster of unionFindClusterIds(inserted)) {
    const umlInCluster = cluster.filter((e) => readTemplateCustomData(e));
    if (umlInCluster.length === 0) {
      continue;
    }

    const roots = umlInCluster.filter((e) => {
      const cd = readTemplateCustomData(e);
      return cd?.templateRole === "root";
    });
    if (roots.length !== 1) {
      continue;
    }

    const root = roots[0];
    const rootCd = readTemplateCustomData(root);
    if (!rootCd) {
      continue;
    }

    const templateType = rootCd.templateType;
    const newRootId = root.id;

    if (templateType === UML_CLASS) {
      const byRole = new Map<string, ExcalidrawElement>();
      for (const el of umlInCluster) {
        const cd = readTemplateCustomData(el);
        if (!cd || cd.templateRole === "root" || !cd.templateRole) {
          continue;
        }
        byRole.set(cd.templateRole, el);
      }

      const childElementIds = {
        titleTextId: byRole.get("title")?.id,
        attributesTextId: byRole.get("attributes")?.id,
        methodsTextId: byRole.get("methods")?.id,
        dividerAttributesId: byRole.get("divider-attributes")?.id,
        dividerMethodsId: byRole.get("divider-methods")?.id,
      };

      if (!Object.values(childElementIds).every(Boolean)) {
        continue;
      }

      updates.set(
        root.id,
        newElementWith(root, {
          customData: {
            ...rootCd,
            templateRootId: newRootId,
            childElementIds,
          } as ExcalidrawElement["customData"],
        }),
      );

      for (const el of umlInCluster) {
        if (el.id === root.id) {
          continue;
        }
        const cd = readTemplateCustomData(el);
        if (!cd) {
          continue;
        }
        updates.set(
          el.id,
          newElementWith(el, {
            customData: {
              ...cd,
              templateRootId: newRootId,
            } as ExcalidrawElement["customData"],
          }),
        );
      }
      continue;
    }

    if (templateType === UML_DIAGRAM) {
      const preset = rootCd.templateData?.preset ?? "";
      const label = umlInCluster.find((e) => {
        const cd = readTemplateCustomData(e);
        return cd?.templateRole === "label";
      });
      const body =
        preset === "note"
          ? umlInCluster.find((e) => {
              const cd = readTemplateCustomData(e);
              return cd?.templateRole === "body";
            })
          : undefined;

      if (preset === "note" && !body) {
        continue;
      }

      const decorations = umlInCluster
        .filter((e) => {
          const cd = readTemplateCustomData(e);
          return cd?.templateRole === "decoration";
        })
        .sort((a, b) => a.id.localeCompare(b.id));

      const decoKeys = getDiagramDecorationKeys(preset);
      if (decoKeys.length !== decorations.length) {
        continue;
      }

      const childElementIds: Record<string, string> = {};

      if (!label) {
        continue;
      }
      childElementIds.labelTextId = label.id;

      if (body) {
        childElementIds.bodyTextId = body.id;
      }
      for (let i = 0; i < decoKeys.length; i++) {
        childElementIds[decoKeys[i]] = decorations[i].id;
      }

      updates.set(
        root.id,
        newElementWith(root, {
          customData: {
            ...rootCd,
            templateRootId: newRootId,
            childElementIds,
          } as ExcalidrawElement["customData"],
        }),
      );

      for (const el of umlInCluster) {
        if (el.id === root.id) {
          continue;
        }
        const cd = readTemplateCustomData(el);
        if (!cd) {
          continue;
        }
        updates.set(
          el.id,
          newElementWith(el, {
            customData: {
              ...cd,
              templateRootId: newRootId,
            } as ExcalidrawElement["customData"],
          }),
        );
      }
    }
  }

  if (updates.size === 0) {
    return nextElements as ExcalidrawElement[];
  }

  return nextElements.map((el) => updates.get(el.id) ?? el);
};

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Applies `replacementMap` to `elements`, then appends elements whose ids are new to the scene.
 *
 * Intentionally does **not** delete “orphan” template children: aggressive filtering by resolved
 * slot ids can remove valid decorations/borders when stored ids and the live scene diverge.
 */
export function applyTemplateSceneUpdate(options: {
  elements: readonly ExcalidrawElement[];
  elementsById: ReadonlyMap<string, ExcalidrawElement>;
  replacementMap: Map<string, ExcalidrawElement>;
}): ExcalidrawElement[] {
  const { elements, elementsById, replacementMap } = options;

  const nextElements = elements.map(
    (element) => replacementMap.get(element.id) || element,
  );

  replacementMap.forEach((element, id) => {
    if (!elementsById.has(id)) {
      nextElements.push(element);
    }
  });

  return nextElements;
}

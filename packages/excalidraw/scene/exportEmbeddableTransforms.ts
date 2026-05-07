import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { BinaryFiles } from "../types";

export type ExportEmbeddableTransform = (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
) => Promise<{
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
}>;

const transforms: ExportEmbeddableTransform[] = [];

/**
 * Register an async preprocessor run before canvas/SVG export.
 * Transforms run in registration order (first registered runs first).
 * Intended for app-specific embeddable → image substitution.
 */
export const registerExportEmbeddableTransform = (
  transform: ExportEmbeddableTransform,
) => {
  transforms.push(transform);
};

/** @internal testing */
export const _resetExportEmbeddableTransformsForTests = () => {
  transforms.length = 0;
};

export const applyExportEmbeddableTransforms = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
): Promise<{
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
}> => {
  let nextElements: readonly NonDeletedExcalidrawElement[] = elements;
  let nextFiles: BinaryFiles = { ...(files || {}) };

  for (const transform of transforms) {
    const result = await transform(nextElements, nextFiles);
    nextElements = result.elements;
    nextFiles = result.files;
  }

  return { elements: nextElements, files: nextFiles };
};

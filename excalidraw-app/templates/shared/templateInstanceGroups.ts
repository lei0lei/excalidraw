import type { ExcalidrawElement } from "@excalidraw/element/types";

/** True when `element` shares at least one Excalidraw group id with `otherGroupIds`. */
export const elementSharesAnyGroupId = (
  element: Pick<ExcalidrawElement, "groupIds">,
  otherGroupIds: readonly string[] | null | undefined,
): boolean => {
  const og = otherGroupIds ?? [];
  if (!og.length) {
    return false;
  }
  return element.groupIds?.some((g) => og.includes(g)) ?? false;
};

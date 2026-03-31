import { useMemo } from "react";

import type { WorkspaceFileNode } from "../types";

const WORKSPACE_PREVIEW_CARD_MIN_WIDTH = 224;
const WORKSPACE_PREVIEW_CARD_HEIGHT = 248;
const WORKSPACE_PREVIEW_GRID_GAP = 16;
const WORKSPACE_PREVIEW_OVERSCAN_ROWS = 2;
const INITIAL_THUMBNAIL_BATCH_SIZE = 12;

export const useWorkspaceGridVirtualization = ({
  previewItems,
  currentExcalidrawFiles,
  selectedFileId,
  previewScrollTop,
  previewViewportHeight,
  previewViewportWidth,
}: {
  previewItems: Array<{ kind: "folder" | "file"; file?: WorkspaceFileNode }>;
  currentExcalidrawFiles: WorkspaceFileNode[];
  selectedFileId: string | null;
  previewScrollTop: number;
  previewViewportHeight: number;
  previewViewportWidth: number;
}) => {
  const previewColumnCount = Math.max(
    1,
    Math.floor(
      (previewViewportWidth + WORKSPACE_PREVIEW_GRID_GAP) /
        (WORKSPACE_PREVIEW_CARD_MIN_WIDTH + WORKSPACE_PREVIEW_GRID_GAP),
    ),
  );
  const previewRowCount = Math.ceil(previewItems.length / previewColumnCount);
  const previewRowHeight =
    WORKSPACE_PREVIEW_CARD_HEIGHT + WORKSPACE_PREVIEW_GRID_GAP;
  const previewStartRow = Math.max(
    0,
    Math.floor(previewScrollTop / Math.max(previewRowHeight, 1)) -
      WORKSPACE_PREVIEW_OVERSCAN_ROWS,
  );
  const previewEndRow = Math.min(
    previewRowCount,
    Math.ceil(
      (previewScrollTop +
        Math.max(previewViewportHeight, WORKSPACE_PREVIEW_CARD_HEIGHT)) /
        Math.max(previewRowHeight, 1),
    ) + WORKSPACE_PREVIEW_OVERSCAN_ROWS,
  );

  const visibleThumbnailFileIdList = useMemo(() => {
    const next = new Set<string>();

    previewItems
      .slice(
        previewStartRow * previewColumnCount,
        previewEndRow * previewColumnCount,
      )
      .forEach((item) => {
        if (item.kind === "file" && item.file) {
          next.add(item.file.id);
        }
      });

    if (selectedFileId) {
      next.add(selectedFileId);
    }

    currentExcalidrawFiles
      .slice(0, INITIAL_THUMBNAIL_BATCH_SIZE)
      .forEach((file) => next.add(file.id));

    return [...next];
  }, [
    currentExcalidrawFiles,
    previewColumnCount,
    previewEndRow,
    previewItems,
    previewStartRow,
    selectedFileId,
  ]);

  const visibleThumbnailFileIds = useMemo(
    () => new Set(visibleThumbnailFileIdList),
    [visibleThumbnailFileIdList],
  );

  return {
    previewColumnCount,
    visibleThumbnailFileIds,
  };
};

import { t } from "@excalidraw/excalidraw/i18n";
import { useMemo } from "react";

import type {
  WorkspaceFileNode,
  WorkspaceFolderNode,
  WorkspaceThumbnailState,
} from "../types";

const WORKSPACE_PREVIEW_CARD_MIN_WIDTH = 224;
const WORKSPACE_PREVIEW_CARD_HEIGHT = 248;
const WORKSPACE_PREVIEW_GRID_GAP = 16;
const WORKSPACE_PREVIEW_OVERSCAN_ROWS = 2;

type WorkspaceGridProps = {
  rootFolder: WorkspaceFolderNode | null;
  selectedFolderId: string | null;
  currentChildFolders: WorkspaceFolderNode[];
  currentExcalidrawFiles: WorkspaceFileNode[];
  loadingFolderIds: Set<string>;
  previewScrollTop: number;
  previewViewportHeight: number;
  previewViewportWidth: number;
  setPreviewScrollRef: (node: HTMLDivElement | null) => void;
  onPreviewScroll: (value: number) => void;
  openingFolderId: string | null;
  openingFileId: string | null;
  selectedFileId: string | null;
  thumbnailsByFileId: Record<string, WorkspaceThumbnailState>;
  onOpenFolder: (folder: WorkspaceFolderNode) => Promise<void>;
  onSelectFile: (file: WorkspaceFileNode) => void;
  onOpenFile: (file: WorkspaceFileNode) => Promise<void>;
};

export const WorkspaceGrid = ({
  rootFolder,
  selectedFolderId,
  currentChildFolders,
  currentExcalidrawFiles,
  loadingFolderIds,
  previewScrollTop,
  previewViewportHeight,
  previewViewportWidth,
  setPreviewScrollRef,
  onPreviewScroll,
  openingFolderId,
  openingFileId,
  selectedFileId,
  thumbnailsByFileId,
  onOpenFolder,
  onSelectFile,
  onOpenFile,
}: WorkspaceGridProps) => {
  const previewItems = useMemo(
    () => [
      ...currentChildFolders.map((folder) => ({
        key: `folder:${folder.id}`,
        kind: "folder" as const,
        folder,
      })),
      ...currentExcalidrawFiles.map((file) => ({
        key: `file:${file.id}`,
        kind: "file" as const,
        file,
      })),
    ],
    [currentChildFolders, currentExcalidrawFiles],
  );
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
  const previewVisibleItems = previewItems.slice(
    previewStartRow * previewColumnCount,
    previewEndRow * previewColumnCount,
  );

  return (
    <div
      ref={setPreviewScrollRef}
      className="workspace-preview-scroll"
      onScroll={(event) => onPreviewScroll(event.currentTarget.scrollTop)}
    >
      {!rootFolder || !selectedFolderId ? (
        <div className="workspace-placeholder">
          {t("workspace.gridPlaceholder")}
        </div>
      ) : loadingFolderIds.has(selectedFolderId) ? (
        <div className="workspace-placeholder">
          {t("workspace.loadingFolderContent")}
        </div>
      ) : currentChildFolders.length > 0 ||
        currentExcalidrawFiles.length > 0 ? (
        <div
          className="workspace-files-grid workspace-files-grid--virtual"
          style={{
            gridTemplateColumns: `repeat(${previewColumnCount}, minmax(0, 1fr))`,
          }}
        >
          <div
            className="workspace-files-grid__spacer"
            style={{
              height: `${Math.max(
                previewRowCount * previewRowHeight - WORKSPACE_PREVIEW_GRID_GAP,
                0,
              )}px`,
            }}
          >
            {previewVisibleItems.map((item, index) => {
              const itemIndex = previewStartRow * previewColumnCount + index;
              const rowIndex = Math.floor(itemIndex / previewColumnCount);
              const columnIndex = itemIndex % previewColumnCount;
              return (
                <div
                  key={item.key}
                  className="workspace-files-grid__item"
                  style={{
                    top: `${rowIndex * previewRowHeight}px`,
                    left: `calc(${columnIndex} * ((100% - ${
                      (previewColumnCount - 1) * WORKSPACE_PREVIEW_GRID_GAP
                    }px) / ${previewColumnCount} + ${WORKSPACE_PREVIEW_GRID_GAP}px))`,
                    width: `calc((100% - ${
                      (previewColumnCount - 1) * WORKSPACE_PREVIEW_GRID_GAP
                    }px) / ${previewColumnCount})`,
                  }}
                >
                  {item.kind === "folder" ? (
                    <div className="workspace-file-card workspace-file-card--folder">
                      <div className="workspace-file-card__preview-toolbar">
                        <button
                          type="button"
                          className="workspace-file-card__open"
                          onClick={() => void onOpenFolder(item.folder)}
                          disabled={openingFolderId === item.folder.id}
                        >
                          {openingFolderId === item.folder.id
                            ? "..."
                            : t("workspace.open")}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="workspace-file-card__select"
                        onClick={() => void onOpenFolder(item.folder)}
                      >
                        <div className="workspace-file-card__preview workspace-file-card__preview--folder" />
                        <div className="workspace-file-card__body">
                          <div className="workspace-file-card__name">
                            {item.folder.name}
                          </div>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`workspace-file-card ${
                        selectedFileId === item.file.id
                          ? "workspace-file-card--selected"
                          : ""
                      }`}
                    >
                      <div className="workspace-file-card__preview-toolbar">
                        <button
                          type="button"
                          className="workspace-file-card__open"
                          onClick={() => void onOpenFile(item.file)}
                          disabled={openingFileId === item.file.id}
                        >
                          {openingFileId === item.file.id
                            ? "..."
                            : t("workspace.open")}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="workspace-file-card__select"
                        onClick={() => onSelectFile(item.file)}
                        onDoubleClick={() => void onOpenFile(item.file)}
                      >
                        <div className="workspace-file-card__preview">
                          {thumbnailsByFileId[item.file.id]?.svg ? (
                            <div
                              className="workspace-file-card__preview-svg"
                              dangerouslySetInnerHTML={{
                                __html: thumbnailsByFileId[item.file.id]
                                  .svg as string,
                              }}
                            />
                          ) : (
                            <span className="workspace-file-card__preview-label">
                              {t("workspace.previewPending")}
                            </span>
                          )}
                        </div>
                        <div className="workspace-file-card__body">
                          <div className="workspace-file-card__name">
                            {item.file.name}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="workspace-placeholder">
          {t("workspace.emptyFolder")}
        </div>
      )}
    </div>
  );
};

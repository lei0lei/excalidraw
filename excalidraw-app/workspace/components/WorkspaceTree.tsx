import { memo, useMemo } from "react";

import type { ReactNode } from "react";
import type { WorkspaceFileNode, WorkspaceFolderNode } from "../types";

type WorkspaceTreeFolderRow = {
  key: string;
  kind: "folder";
  depth: number;
  folder: WorkspaceFolderNode;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  isRoot: boolean;
};

type WorkspaceTreeFileRow = {
  key: string;
  kind: "file";
  depth: number;
  file: WorkspaceFileNode;
  isSelected: boolean;
};

type WorkspaceTreeRowData = WorkspaceTreeFolderRow | WorkspaceTreeFileRow;

const WORKSPACE_TREE_ROW_HEIGHT = 32;
const WORKSPACE_TREE_OVERSCAN = 8;

const buildWorkspaceTreeRows = ({
  rootFolder,
  selectedFolderId,
  selectedFileId,
  expandedFolderIds,
  folderChildrenByParent,
  filesByFolderId,
  loadingFolderIds,
}: {
  rootFolder: WorkspaceFolderNode;
  selectedFolderId: string | null;
  selectedFileId: string | null;
  expandedFolderIds: Set<string>;
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>;
  filesByFolderId: Record<string, WorkspaceFileNode[]>;
  loadingFolderIds: Set<string>;
}): WorkspaceTreeRowData[] => {
  const rows: WorkspaceTreeRowData[] = [];

  const visitFolder = (
    folder: WorkspaceFolderNode,
    depth: number,
    isRoot: boolean,
  ) => {
    const isExpanded = expandedFolderIds.has(folder.id);
    rows.push({
      key: folder.id,
      kind: "folder",
      depth,
      folder,
      isExpanded,
      isSelected: selectedFolderId === folder.id,
      isLoading: loadingFolderIds.has(folder.id),
      isRoot,
    });

    if (!isExpanded) {
      return;
    }

    for (const childFolder of folderChildrenByParent[folder.id] ?? []) {
      visitFolder(childFolder, depth + 1, false);
    }
    for (const file of filesByFolderId[folder.id] ?? []) {
      rows.push({
        key: file.id,
        kind: "file",
        depth: depth + 1,
        file,
        isSelected: selectedFileId === file.id,
      });
    }
  };

  visitFolder(rootFolder, 0, true);
  return rows;
};

const Row = memo(
  ({
    row,
    top,
    onToggleFolder,
    onSelectFolder,
    onSelectFile,
    onOpenFile,
    rootActions,
  }: {
    row: WorkspaceTreeRowData;
    top: number;
    onToggleFolder: (folder: WorkspaceFolderNode) => Promise<void>;
    onSelectFolder: (folder: WorkspaceFolderNode) => Promise<void>;
    onSelectFile: (file: WorkspaceFileNode) => void;
    onOpenFile: (file: WorkspaceFileNode) => Promise<void>;
    rootActions?: ReactNode;
  }) => {
    if (row.kind === "folder") {
      return (
        <div
          className="workspace-tree-node__row workspace-tree-node__row--virtual"
          style={{
            top,
            height: `${WORKSPACE_TREE_ROW_HEIGHT}px`,
            paddingInlineStart: `${row.depth * 16}px`,
          }}
        >
          <button
            type="button"
            className="workspace-tree-node__toggle"
            onClick={() => void onToggleFolder(row.folder)}
          >
            {row.isExpanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            className={`workspace-tree-node__button ${
              row.isSelected ? "workspace-tree-node__button--selected" : ""
            }`}
            onClick={() => void onSelectFolder(row.folder)}
          >
            <span className="workspace-tree-node__label">
              {row.folder.name}
            </span>
            {row.isLoading ? (
              <span className="workspace-tree-node__meta">...</span>
            ) : null}
          </button>
          {row.isRoot && rootActions ? (
            <div className="workspace-tree-actions">{rootActions}</div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className="workspace-tree-node__row workspace-tree-node__row--virtual"
        style={{
          top,
          height: `${WORKSPACE_TREE_ROW_HEIGHT}px`,
          paddingInlineStart: `${row.depth * 16}px`,
        }}
      >
        <span className="workspace-tree-node__toggle workspace-tree-node__toggle--placeholder" />
        <button
          type="button"
          className={`workspace-tree-file__button ${
            row.isSelected ? "workspace-tree-file__button--selected" : ""
          } ${
            !row.file.isExcalidrawFile
              ? "workspace-tree-file__button--disabled"
              : ""
          }`}
          onClick={() => onSelectFile(row.file)}
          onDoubleClick={() => {
            if (row.file.isExcalidrawFile) {
              void onOpenFile(row.file);
            }
          }}
        >
          <span className="workspace-tree-node__label">{row.file.name}</span>
        </button>
      </div>
    );
  },
);

type WorkspaceTreeProps = {
  rootFolder: WorkspaceFolderNode | null;
  selectedFolderId: string | null;
  selectedFileId: string | null;
  expandedFolderIds: Set<string>;
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>;
  filesByFolderId: Record<string, WorkspaceFileNode[]>;
  loadingFolderIds: Set<string>;
  treeScrollTop: number;
  treeViewportHeight: number;
  onTreeScroll: (value: number) => void;
  setTreeScrollRef: (node: HTMLDivElement | null) => void;
  onToggleFolder: (folder: WorkspaceFolderNode) => Promise<void>;
  onSelectFolder: (folder: WorkspaceFolderNode) => Promise<void>;
  onSelectFile: (file: WorkspaceFileNode) => void;
  onOpenFile: (file: WorkspaceFileNode) => Promise<void>;
  rootActions?: ReactNode;
  placeholder: string;
};

export const WorkspaceTree = ({
  rootFolder,
  selectedFolderId,
  selectedFileId,
  expandedFolderIds,
  folderChildrenByParent,
  filesByFolderId,
  loadingFolderIds,
  treeScrollTop,
  treeViewportHeight,
  onTreeScroll,
  setTreeScrollRef,
  onToggleFolder,
  onSelectFolder,
  onSelectFile,
  onOpenFile,
  rootActions,
  placeholder,
}: WorkspaceTreeProps) => {
  const treeRows = useMemo(() => {
    if (!rootFolder) {
      return [];
    }
    return buildWorkspaceTreeRows({
      rootFolder,
      selectedFolderId,
      selectedFileId,
      expandedFolderIds,
      folderChildrenByParent,
      filesByFolderId,
      loadingFolderIds,
    });
  }, [
    rootFolder,
    selectedFolderId,
    selectedFileId,
    expandedFolderIds,
    folderChildrenByParent,
    filesByFolderId,
    loadingFolderIds,
  ]);

  const treeStartIndex = Math.max(
    0,
    Math.floor(treeScrollTop / WORKSPACE_TREE_ROW_HEIGHT) -
      WORKSPACE_TREE_OVERSCAN,
  );
  const treeEndIndex = Math.min(
    treeRows.length,
    Math.ceil(
      (treeScrollTop +
        Math.max(treeViewportHeight, WORKSPACE_TREE_ROW_HEIGHT)) /
        WORKSPACE_TREE_ROW_HEIGHT,
    ) + WORKSPACE_TREE_OVERSCAN,
  );
  const visibleTreeRows = treeRows.slice(treeStartIndex, treeEndIndex);

  if (!rootFolder) {
    return (
      <div className="workspace-placeholder workspace-placeholder--sidebar">
        {placeholder}
      </div>
    );
  }

  return (
    <div
      ref={setTreeScrollRef}
      className="workspace-tree"
      onScroll={(event) => onTreeScroll(event.currentTarget.scrollTop)}
    >
      <div
        className="workspace-tree__spacer"
        style={{ height: `${treeRows.length * WORKSPACE_TREE_ROW_HEIGHT}px` }}
      >
        {visibleTreeRows.map((row, index) => (
          <Row
            key={row.key}
            row={row}
            top={(treeStartIndex + index) * WORKSPACE_TREE_ROW_HEIGHT}
            onToggleFolder={onToggleFolder}
            onSelectFolder={onSelectFolder}
            onSelectFile={onSelectFile}
            onOpenFile={onOpenFile}
            rootActions={rootActions}
          />
        ))}
      </div>
    </div>
  );
};

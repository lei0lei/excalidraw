import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  connectGoogleDrive,
  createGoogleDriveFolder,
  deleteGoogleDriveEntry,
  downloadGoogleDriveFile,
  getMissingGoogleDriveEnvVars,
  getStoredGoogleDriveRootFolder,
  hasStoredGoogleDriveAccessToken,
  listGoogleDriveFolderChildren,
  pickGoogleDriveRootFolder,
  renameGoogleDriveEntry,
  storeGoogleDriveRootFolder,
} from "./data/googleDrive";
import {
  createLocalFolder,
  deleteLocalEntry,
  isLocalDirectoryAccessSupported,
  listLocalFolderChildren,
  pickLocalRootFolder,
  readLocalFile,
  renameLocalFolder,
  renameLocalFile,
  restoreStoredLocalRootFolder,
} from "./data/localDirectory";
import { normalizeExcalidrawFileName } from "./data/saveManager";
import {
  cacheExcalidrawThumbnail,
  createExcalidrawThumbnailUrl,
  getCachedExcalidrawThumbnail,
} from "./data/thumbnail";

import type { ReactNode } from "react";
import type { GoogleDriveFile, GoogleDriveFolder } from "./data/googleDrive";
import type {
  LocalDirectoryFile,
  LocalDirectoryFolder,
} from "./data/localDirectory";

type BackendId = "google-drive" | "local";

type WorkspacePageProps = {
  onBackToEditor: () => void;
  onOpenGoogleDriveFile: (file: GoogleDriveFile) => Promise<void>;
  onCreateGoogleDriveFile: (params: {
    folderId: string;
    name: string;
  }) => Promise<GoogleDriveFile>;
  onCurrentGoogleDriveFileRenamed: (file: GoogleDriveFile) => void;
  onCurrentGoogleDriveFileDeleted: (fileId: string) => void;
  onOpenLocalFile: (file: LocalDirectoryFile) => Promise<void>;
  onCreateLocalFile: (params: {
    folder: LocalDirectoryFolder;
    name: string;
  }) => Promise<LocalDirectoryFile>;
  onCurrentLocalFileRenamed: (file: LocalDirectoryFile) => void;
  onCurrentLocalFileDeleted: (fileId: string) => void;
  currentFileProvider: "gdrive" | "local" | null;
  currentFileId: string | null;
  theme: "light" | "dark";
};

type WorkspaceFolderNode = {
  provider: BackendId;
  id: string;
  rawId: string;
  name: string;
  parentId: string | null;
  modifiedTime?: string;
  data: GoogleDriveFolder | LocalDirectoryFolder;
};

type WorkspaceFileNode = {
  provider: BackendId;
  id: string;
  rawId: string;
  name: string;
  parentId: string | null;
  mimeType: string;
  modifiedTime?: string;
  isExcalidrawFile: boolean;
  data: GoogleDriveFile | LocalDirectoryFile;
};

type BuildWorkspaceTreeRowsParams = {
  rootFolder: WorkspaceFolderNode;
  selectedFolderId: string | null;
  selectedFileId: string | null;
  expandedFolderIds: Set<string>;
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>;
  filesByFolderId: Record<string, WorkspaceFileNode[]>;
  loadingFolderIds: Set<string>;
};

type WorkspaceThumbnailState = {
  cacheKey: string;
  status: "loading" | "ready" | "empty" | "error";
  svg: string | null;
};

type WorkspaceNotice = {
  id: number;
  message: string;
};

type WorkspaceFileCardProps = {
  file: WorkspaceFileNode;
  isSelected: boolean;
  thumbnail?: WorkspaceThumbnailState;
  openingFileId: string | null;
  onVisibilityChange: (fileId: string, isVisible: boolean) => void;
  onSelectFile: (file: WorkspaceFileNode) => void;
  onOpenFile: (file: WorkspaceFileNode) => Promise<void>;
};

type WorkspaceFolderCardProps = {
  folder: WorkspaceFolderNode;
  openingFolderId: string | null;
  onOpenFolder: (folder: WorkspaceFolderNode) => Promise<void>;
};

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

type WorkspaceTreeRowProps = {
  row: WorkspaceTreeRowData;
  top: number;
  onToggleFolder: (folder: WorkspaceFolderNode) => Promise<void>;
  onSelectFolder: (folder: WorkspaceFolderNode) => Promise<void>;
  onSelectFile: (file: WorkspaceFileNode) => void;
  onOpenFile: (file: WorkspaceFileNode) => Promise<void>;
  rootActions?: ReactNode;
};

const BACKENDS = [
  { id: "google-drive", title: "Google Drive" },
  { id: "local", title: "Local directory" },
] as const;

const WORKSPACE_BACKEND_STORAGE_KEY = "excalidraw-workspace-backend";
const naturalNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const INITIAL_THUMBNAIL_BATCH_SIZE = 8;
const MAX_THUMBNAIL_RENDER_CONCURRENCY = 3;
const WORKSPACE_TREE_ROW_HEIGHT = 32;
const WORKSPACE_TREE_OVERSCAN = 8;
const THUMBNAIL_MAX_RETRY_COUNT = 1;
const THUMBNAIL_RETRY_DELAY_MS = 1200;

const getStoredWorkspaceBackend = (): BackendId => {
  if (typeof window === "undefined") {
    return "google-drive";
  }

  const storedBackend = window.localStorage.getItem(
    WORKSPACE_BACKEND_STORAGE_KEY,
  );
  return storedBackend === "local" ? "local" : "google-drive";
};

const sortFoldersByName = (folders: WorkspaceFolderNode[]) => {
  return [...folders].sort((a, b) =>
    naturalNameCollator.compare(a.name, b.name),
  );
};

const sortFilesByName = (files: WorkspaceFileNode[]) => {
  return [...files].sort((a, b) => naturalNameCollator.compare(a.name, b.name));
};

const formatModifiedTime = (value?: string) => {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const toGoogleFolderNode = (
  folder: { id: string; name: string; modifiedTime?: string },
  parentRawId: string | null,
): WorkspaceFolderNode => ({
  provider: "google-drive",
  id: `gdrive:${folder.id}`,
  rawId: folder.id,
  name: folder.name,
  parentId: parentRawId ? `gdrive:${parentRawId}` : null,
  modifiedTime: folder.modifiedTime,
  data: {
    id: folder.id,
    name: folder.name,
    modifiedTime: folder.modifiedTime,
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  },
});

const toGoogleFileNode = (file: GoogleDriveFile): WorkspaceFileNode => ({
  provider: "google-drive",
  id: `gdrive:${file.id}`,
  rawId: file.id,
  name: file.name,
  parentId: file.parentId ? `gdrive:${file.parentId}` : null,
  mimeType: file.mimeType,
  modifiedTime: file.modifiedTime,
  isExcalidrawFile: file.isExcalidrawFile,
  data: file,
});

const toLocalFolderNode = (
  folder: LocalDirectoryFolder,
): WorkspaceFolderNode => ({
  provider: "local",
  id: folder.id,
  rawId: folder.id,
  name: folder.name,
  parentId: folder.parentId,
  modifiedTime: folder.modifiedTime,
  data: folder,
});

const toLocalFileNode = (file: LocalDirectoryFile): WorkspaceFileNode => ({
  provider: "local",
  id: file.id,
  rawId: file.id,
  name: file.name,
  parentId: file.parentId,
  mimeType: file.mimeType,
  modifiedTime: file.modifiedTime,
  isExcalidrawFile: file.isExcalidrawFile,
  data: file,
});

const findFolderById = (
  folderId: string | null,
  rootFolder: WorkspaceFolderNode | null,
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>,
) => {
  if (!folderId) {
    return null;
  }

  if (rootFolder?.id === folderId) {
    return rootFolder;
  }

  for (const folders of Object.values(folderChildrenByParent)) {
    const match = folders.find((folder) => folder.id === folderId);
    if (match) {
      return match;
    }
  }

  return null;
};

const findFileById = (
  fileId: string | null,
  filesByFolderId: Record<string, WorkspaceFileNode[]>,
) => {
  if (!fileId) {
    return null;
  }

  for (const files of Object.values(filesByFolderId)) {
    const match = files.find((file) => file.id === fileId);
    if (match) {
      return match;
    }
  }

  return null;
};

const toCurrentFileNodeId = (
  provider: "gdrive" | "local" | null | undefined,
  fileId: string | null | undefined,
) => {
  if (!provider || !fileId) {
    return null;
  }

  return provider === "gdrive" ? `gdrive:${fileId}` : fileId;
};

const getThumbnailCacheKey = (file: WorkspaceFileNode) =>
  `${file.id}:${file.modifiedTime || ""}:${file.name}`;

const collectFolderSubtreeIds = (
  rootId: string,
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>,
) => {
  const folderIds: string[] = [];
  const queue = [rootId];

  while (queue.length) {
    const currentId = queue.shift() as string;
    folderIds.push(currentId);

    for (const child of folderChildrenByParent[currentId] ?? []) {
      queue.push(child.id);
    }
  }

  return folderIds;
};

const WorkspaceChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d={expanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceFolderIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M1.75 4.75a1.5 1.5 0 0 1 1.5-1.5h2.6l1.2 1.5h5.7a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-6.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceFileIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4.25 1.75h4.5l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M8.75 1.75v3h3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceNewFolderIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M1.75 4.75a1.5 1.5 0 0 1 1.5-1.5h2.6l1.2 1.5h5.7a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-6.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M11.25 7.25v3.5M9.5 9h3.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const WorkspaceNewFileIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4.25 1.75h4.5l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M8.75 1.75v3h3M8 7.5V11M6.25 9.25h3.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceEditIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M9.75 3.25 12.75 6.25M3.25 12.75l2.2-.4a2 2 0 0 0 1-.55l5.1-5.1a1.414 1.414 0 1 0-2-2l-5.1 5.1a2 2 0 0 0-.55 1l-.65 1.95Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceTrashIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.75 4.25h10.5M6.25 1.75h3.5M5 4.25v8.5m3-8.5v8.5m3-8.5v8.5M4.5 14.25h7a1 1 0 0 0 1-1v-9H3.5v9a1 1 0 0 0 1 1Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceBackIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M9 4.75 3.75 10 9 15.25M4.25 10h12"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceConnectIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M8.25 6.25H6.5a3.25 3.25 0 1 0 0 6.5h1.75M11.75 6.25h1.75a3.25 3.25 0 1 1 0 6.5h-1.75M7.5 10h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceFolderOpenIcon = () => (
  <svg
    className="workspace-inline-icon"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.5 6.5A1.75 1.75 0 0 1 4.25 4.75h2.9l1.25 1.75h6a1.75 1.75 0 0 1 1.7 2.2l-.9 4a1.75 1.75 0 0 1-1.7 1.3H4a1.75 1.75 0 0 1-1.72-2.05L2.75 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkspaceIndentGuides = ({ depth }: { depth: number }) => {
  if (depth <= 0) {
    return null;
  }

  return (
    <span className="workspace-tree-guides" aria-hidden="true">
      {Array.from({ length: depth }, (_, index) => (
        <span
          key={index}
          className="workspace-tree-guide"
          style={{ insetInlineStart: `${index * 16 + 9}px` }}
        />
      ))}
      <span
        className="workspace-tree-guide workspace-tree-guide--branch"
        style={{ insetInlineStart: `${(depth - 1) * 16 + 9}px` }}
      />
    </span>
  );
};

const WorkspaceFileCard = ({
  file,
  isSelected,
  thumbnail,
  openingFileId,
  onVisibilityChange,
  onSelectFile,
  onOpenFile,
}: WorkspaceFileCardProps) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resolvedThumbnail = thumbnail ?? {
    cacheKey: getThumbnailCacheKey(file),
    status: "loading" as const,
    svg: null,
  };

  useEffect(() => {
    const node = cardRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      onVisibilityChange(file.id, true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          onVisibilityChange(file.id, entry.isIntersecting);
        });
      },
      {
        rootMargin: "240px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      onVisibilityChange(file.id, false);
    };
  }, [file.id, onVisibilityChange]);

  return (
    <div
      ref={cardRef}
      className={`workspace-file-card ${
        isSelected ? "workspace-file-card--selected" : ""
      }`}
    >
      <div className="workspace-file-card__preview-toolbar">
        <button
          type="button"
          className="workspace-file-card__open"
          onClick={() => {
            void onOpenFile(file);
          }}
          disabled={openingFileId === file.id}
        >
          {openingFileId === file.id ? "..." : "Open"}
        </button>
      </div>
      <button
        type="button"
        className="workspace-file-card__select"
        onClick={() => onSelectFile(file)}
        onDoubleClick={() => {
          void onOpenFile(file);
        }}
      >
        <div className="workspace-file-card__preview">
          {resolvedThumbnail.status === "ready" && resolvedThumbnail.svg ? (
            <div
              className="workspace-file-card__preview-svg"
              aria-label={`${file.name} preview`}
              dangerouslySetInnerHTML={{ __html: resolvedThumbnail.svg }}
            />
          ) : (
            <span className="workspace-file-card__preview-label">
              {resolvedThumbnail.status === "loading"
                ? "Loading preview..."
                : resolvedThumbnail.status === "empty"
                ? "Empty file"
                : resolvedThumbnail.status === "error"
                ? "Preview unavailable"
                : "Preview pending"}
            </span>
          )}
        </div>
        <div className="workspace-file-card__body">
          <div className="workspace-file-card__name" title={file.name}>
            {file.name}
          </div>
          <div className="workspace-file-card__meta">
            Modified {formatModifiedTime(file.modifiedTime)}
          </div>
        </div>
      </button>
    </div>
  );
};

const WorkspaceFolderCard = ({
  folder,
  openingFolderId,
  onOpenFolder,
}: WorkspaceFolderCardProps) => {
  const isOpening = openingFolderId === folder.id;

  return (
    <div className="workspace-file-card workspace-file-card--folder">
      <div className="workspace-file-card__preview-toolbar">
        <button
          type="button"
          className="workspace-file-card__open"
          onClick={() => {
            void onOpenFolder(folder);
          }}
          disabled={isOpening}
        >
          {isOpening ? "..." : "Open"}
        </button>
      </div>
      <button
        type="button"
        className="workspace-file-card__select"
        onClick={() => {
          void onOpenFolder(folder);
        }}
        onDoubleClick={() => {
          void onOpenFolder(folder);
        }}
      >
        <div className="workspace-file-card__preview workspace-file-card__preview--folder">
          <span className="workspace-file-card__folder-icon" aria-hidden="true">
            <WorkspaceFolderIcon />
          </span>
        </div>
        <div className="workspace-file-card__body">
          <div className="workspace-file-card__name" title={folder.name}>
            {folder.name}
          </div>
          <div className="workspace-file-card__meta">
            Folder · Modified {formatModifiedTime(folder.modifiedTime)}
          </div>
        </div>
      </button>
    </div>
  );
};

const buildWorkspaceTreeRows = ({
  rootFolder,
  selectedFolderId,
  selectedFileId,
  expandedFolderIds,
  folderChildrenByParent,
  filesByFolderId,
  loadingFolderIds,
}: BuildWorkspaceTreeRowsParams): WorkspaceTreeRowData[] => {
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

const WorkspaceTreeRow = memo(
  ({
    row,
    top,
    onToggleFolder,
    onSelectFolder,
    onSelectFile,
    onOpenFile,
    rootActions,
  }: WorkspaceTreeRowProps) => {
    if (row.kind === "folder") {
      const { folder, depth, isExpanded, isSelected, isLoading, isRoot } = row;

      return (
        <div
          className="workspace-tree-node__row workspace-tree-node__row--virtual"
          style={{
            top,
            height: `${WORKSPACE_TREE_ROW_HEIGHT}px`,
            paddingInlineStart: `${depth * 16}px`,
          }}
        >
          <WorkspaceIndentGuides depth={depth} />
          <button
            type="button"
            className="workspace-tree-node__toggle"
            onClick={() => {
              void onToggleFolder(folder);
            }}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            <WorkspaceChevronIcon expanded={isExpanded} />
          </button>
          <button
            type="button"
            className={`workspace-tree-node__button ${
              isSelected ? "workspace-tree-node__button--selected" : ""
            }`}
            onClick={() => {
              void onSelectFolder(folder);
            }}
            title={folder.name}
          >
            <span className="workspace-tree-item__icon" aria-hidden="true">
              <WorkspaceFolderIcon />
            </span>
            <span className="workspace-tree-node__label">{folder.name}</span>
            {isLoading ? (
              <span className="workspace-tree-node__meta">Loading...</span>
            ) : null}
          </button>
          {isRoot && rootActions ? (
            <div className="workspace-tree-actions">{rootActions}</div>
          ) : null}
        </div>
      );
    }

    const { file, depth, isSelected } = row;
    return (
      <div
        className="workspace-tree-node__row workspace-tree-node__row--virtual"
        style={{
          top,
          height: `${WORKSPACE_TREE_ROW_HEIGHT}px`,
          paddingInlineStart: `${depth * 16}px`,
        }}
      >
        <WorkspaceIndentGuides depth={depth} />
        <span className="workspace-tree-node__toggle workspace-tree-node__toggle--placeholder" />
        <button
          type="button"
          className={`workspace-tree-file__button ${
            isSelected ? "workspace-tree-file__button--selected" : ""
          } ${
            !file.isExcalidrawFile
              ? "workspace-tree-file__button--disabled"
              : ""
          }`}
          onClick={() => onSelectFile(file)}
          onDoubleClick={() => {
            if (file.isExcalidrawFile) {
              void onOpenFile(file);
            }
          }}
          title={file.name}
        >
          <span className="workspace-tree-item__icon" aria-hidden="true">
            <WorkspaceFileIcon />
          </span>
          <span className="workspace-tree-node__label">{file.name}</span>
          {!file.isExcalidrawFile ? (
            <span className="workspace-tree-node__meta">Read only</span>
          ) : null}
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (
      prevProps.top !== nextProps.top ||
      prevProps.rootActions !== nextProps.rootActions ||
      prevProps.onToggleFolder !== nextProps.onToggleFolder ||
      prevProps.onSelectFolder !== nextProps.onSelectFolder ||
      prevProps.onSelectFile !== nextProps.onSelectFile ||
      prevProps.onOpenFile !== nextProps.onOpenFile
    ) {
      return false;
    }

    if (prevProps.row.kind !== nextProps.row.kind) {
      return false;
    }

    if (prevProps.row.kind === "folder" && nextProps.row.kind === "folder") {
      return (
        prevProps.row.key === nextProps.row.key &&
        prevProps.row.depth === nextProps.row.depth &&
        prevProps.row.isExpanded === nextProps.row.isExpanded &&
        prevProps.row.isSelected === nextProps.row.isSelected &&
        prevProps.row.isLoading === nextProps.row.isLoading &&
        prevProps.row.folder.name === nextProps.row.folder.name
      );
    }

    if (prevProps.row.kind === "file" && nextProps.row.kind === "file") {
      return (
        prevProps.row.key === nextProps.row.key &&
        prevProps.row.depth === nextProps.row.depth &&
        prevProps.row.isSelected === nextProps.row.isSelected &&
        prevProps.row.file.name === nextProps.row.file.name &&
        prevProps.row.file.isExcalidrawFile ===
          nextProps.row.file.isExcalidrawFile
      );
    }

    return false;
  },
);

WorkspaceTreeRow.displayName = "WorkspaceTreeRow";

export const WorkspacePage = ({
  onBackToEditor,
  onOpenGoogleDriveFile,
  onCreateGoogleDriveFile,
  onCurrentGoogleDriveFileRenamed,
  onCurrentGoogleDriveFileDeleted,
  onOpenLocalFile,
  onCreateLocalFile,
  onCurrentLocalFileRenamed,
  onCurrentLocalFileDeleted,
  currentFileProvider,
  currentFileId,
  theme,
}: WorkspacePageProps) => {
  const [selectedBackend, setSelectedBackend] = useState<BackendId>(
    getStoredWorkspaceBackend,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPickingRoot, setIsPickingRoot] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isMutatingSelection, setIsMutatingSelection] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(() =>
    hasStoredGoogleDriveAccessToken(),
  );
  const [rootFolder, setRootFolder] = useState<WorkspaceFolderNode | null>(
    null,
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [folderParentById, setFolderParentById] = useState<
    Record<string, string | null>
  >({});
  const [folderChildrenByParent, setFolderChildrenByParent] = useState<
    Record<string, WorkspaceFolderNode[]>
  >({});
  const [filesByFolderId, setFilesByFolderId] = useState<
    Record<string, WorkspaceFileNode[]>
  >({});
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [openingFolderId, setOpeningFolderId] = useState<string | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);
  const [thumbnailsByFileId, setThumbnailsByFileId] = useState<
    Record<string, WorkspaceThumbnailState>
  >({});
  const [visibleThumbnailFileIds, setVisibleThumbnailFileIds] = useState<
    Set<string>
  >(new Set());
  const [floatingNotice, setFloatingNotice] = useState<WorkspaceNotice | null>(
    null,
  );
  const thumbnailsByFileIdRef = useRef<Record<string, WorkspaceThumbnailState>>(
    {},
  );
  const activeThumbnailLoadKeysRef = useRef<Record<string, string>>({});
  const thumbnailRetryAttemptsRef = useRef<Record<string, number>>({});
  const thumbnailRetryTimeoutsRef = useRef<Record<string, number>>({});
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const [treeScrollTop, setTreeScrollTop] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(0);

  const missingEnvVars = useMemo(() => getMissingGoogleDriveEnvVars(), []);
  const isLocalSupported = useMemo(() => isLocalDirectoryAccessSupported(), []);

  const selectedFolder = useMemo(
    () => findFolderById(selectedFolderId, rootFolder, folderChildrenByParent),
    [folderChildrenByParent, rootFolder, selectedFolderId],
  );
  const selectedFile = useMemo(
    () => findFileById(selectedFileId, filesByFolderId),
    [filesByFolderId, selectedFileId],
  );

  const canRenameSelectedFolder =
    !!selectedFolder && !!rootFolder && selectedFolder.id !== rootFolder.id;
  const canDeleteSelectedFolder =
    !!selectedFolder && !!rootFolder && selectedFolder.id !== rootFolder.id;
  const canRenameSelectedFile = !!selectedFile;
  const canDeleteSelectedFile = !!selectedFile;

  const clearThumbnailRetry = useCallback((fileId: string) => {
    const timeoutId = thumbnailRetryTimeoutsRef.current[fileId];
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      delete thumbnailRetryTimeoutsRef.current[fileId];
    }
    delete thumbnailRetryAttemptsRef.current[fileId];
  }, []);

  const clearAllThumbnailRetries = useCallback(() => {
    Object.values(thumbnailRetryTimeoutsRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    thumbnailRetryTimeoutsRef.current = {};
    thumbnailRetryAttemptsRef.current = {};
  }, []);

  const resetWorkspaceState = useCallback(
    (nextRootFolder: WorkspaceFolderNode | null) => {
      activeThumbnailLoadKeysRef.current = {};
      clearAllThumbnailRetries();
      setRootFolder(nextRootFolder);
      setSelectedFolderId(nextRootFolder?.id ?? null);
      setSelectedFileId(null);
      setFolderChildrenByParent({});
      setFilesByFolderId({});
      setFolderParentById(nextRootFolder ? { [nextRootFolder.id]: null } : {});
      setLoadingFolderIds(new Set());
      setExpandedFolderIds(
        nextRootFolder ? new Set([nextRootFolder.id]) : new Set(),
      );
      setTreeScrollTop(0);
      treeScrollRef.current?.scrollTo({ top: 0 });
      setOpeningFolderId(null);
      setOpeningFileId(null);
      setThumbnailsByFileId({});
      setVisibleThumbnailFileIds(new Set());
    },
    [clearAllThumbnailRetries],
  );

  const showFloatingNotice = useCallback((message: string) => {
    setFloatingNotice({
      id: Date.now(),
      message,
    });
  }, []);

  useEffect(() => {
    return () => {
      clearAllThumbnailRetries();
    };
  }, [clearAllThumbnailRetries]);

  useEffect(() => {
    const node = treeScrollRef.current;
    if (!node) {
      return;
    }

    const syncViewportHeight = () => {
      setTreeViewportHeight(node.clientHeight);
    };

    syncViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncViewportHeight();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [rootFolder]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        WORKSPACE_BACKEND_STORAGE_KEY,
        selectedBackend,
      );
    }
  }, [selectedBackend]);

  useEffect(() => {
    const nextFileId =
      selectedBackend === "google-drive"
        ? currentFileProvider === "gdrive"
          ? toCurrentFileNodeId(currentFileProvider, currentFileId)
          : null
        : currentFileProvider === "local"
        ? toCurrentFileNodeId(currentFileProvider, currentFileId)
        : null;

    setSelectedFileId(nextFileId);
  }, [currentFileId, currentFileProvider, selectedBackend]);

  useEffect(() => {
    setErrorMessage(null);
    let cancelled = false;

    if (selectedBackend === "google-drive") {
      const storedGoogleRootFolder = getStoredGoogleDriveRootFolder();
      const hasStoredToken = hasStoredGoogleDriveAccessToken();
      setIsDriveConnected(hasStoredToken);
      resetWorkspaceState(
        hasStoredToken && storedGoogleRootFolder
          ? toGoogleFolderNode(storedGoogleRootFolder, null)
          : null,
      );
      return;
    }

    setIsDriveConnected(false);
    resetWorkspaceState(null);

    void restoreStoredLocalRootFolder()
      .then((storedLocalRootFolder) => {
        if (cancelled) {
          return;
        }

        resetWorkspaceState(
          storedLocalRootFolder
            ? toLocalFolderNode(storedLocalRootFolder)
            : null,
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to restore the local workspace folder.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [resetWorkspaceState, selectedBackend]);

  const loadFolder = useCallback(async (folder: WorkspaceFolderNode) => {
    setLoadingFolderIds((prev) => {
      const next = new Set(prev);
      next.add(folder.id);
      return next;
    });

    try {
      let folders: WorkspaceFolderNode[] = [];
      let files: WorkspaceFileNode[] = [];

      if (folder.provider === "google-drive") {
        const result = await listGoogleDriveFolderChildren(folder.rawId);
        folders = result.folders.map((childFolder) =>
          toGoogleFolderNode(childFolder, folder.rawId),
        );
        files = result.files.map((file) => toGoogleFileNode(file));
        setIsDriveConnected(true);
      } else {
        const result = await listLocalFolderChildren(
          folder.data as LocalDirectoryFolder,
        );
        folders = result.folders.map((childFolder) =>
          toLocalFolderNode(childFolder),
        );
        files = result.files.map((file) => toLocalFileNode(file));
      }

      setFolderChildrenByParent((prev) => ({
        ...prev,
        [folder.id]: sortFoldersByName(folders),
      }));
      setFilesByFolderId((prev) => ({
        ...prev,
        [folder.id]: sortFilesByName(files),
      }));
      setFolderParentById((prev) => {
        const next = { ...prev };

        for (const childFolder of folders) {
          next[childFolder.id] = folder.id;
        }

        return next;
      });
    } finally {
      setLoadingFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(folder.id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!rootFolder) {
      return;
    }

    if (
      !folderChildrenByParent[rootFolder.id] ||
      !filesByFolderId[rootFolder.id]
    ) {
      void loadFolder(rootFolder).catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load workspace root folder.";

        if (rootFolder.provider === "google-drive") {
          setIsDriveConnected(false);
          storeGoogleDriveRootFolder(null);
          resetWorkspaceState(null);
          showFloatingNotice(message);
          return;
        }

        setErrorMessage(message);
      });
    }
  }, [
    filesByFolderId,
    folderChildrenByParent,
    loadFolder,
    resetWorkspaceState,
    rootFolder,
    showFloatingNotice,
  ]);

  const ensureFolderLoaded = useCallback(
    async (folder: WorkspaceFolderNode) => {
      if (!folderChildrenByParent[folder.id] || !filesByFolderId[folder.id]) {
        await loadFolder(folder);
      }
    },
    [filesByFolderId, folderChildrenByParent, loadFolder],
  );

  const connectDrive = useCallback(async () => {
    setErrorMessage(null);
    setIsConnecting(true);

    try {
      await connectGoogleDrive();
      setIsDriveConnected(true);
      const storedGoogleRootFolder = getStoredGoogleDriveRootFolder();
      if (storedGoogleRootFolder) {
        resetWorkspaceState(toGoogleFolderNode(storedGoogleRootFolder, null));
      }
    } catch (error) {
      showFloatingNotice(
        error instanceof Error ? error.message : "Google Drive connect failed.",
      );
    } finally {
      setIsConnecting(false);
    }
  }, [resetWorkspaceState, showFloatingNotice]);

  const chooseRootFolder = useCallback(async () => {
    setErrorMessage(null);
    setIsPickingRoot(true);

    try {
      if (selectedBackend === "google-drive") {
        const folder = await pickGoogleDriveRootFolder();

        if (folder) {
          storeGoogleDriveRootFolder(folder);
          resetWorkspaceState(toGoogleFolderNode(folder, null));
          setIsDriveConnected(true);
        }

        return;
      }

      const folder = await pickLocalRootFolder();
      if (folder) {
        resetWorkspaceState(toLocalFolderNode(folder));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to choose workspace root folder.",
      );
    } finally {
      setIsPickingRoot(false);
    }
  }, [resetWorkspaceState, selectedBackend]);

  const handleToggleFolder = useCallback(
    async (folder: WorkspaceFolderNode) => {
      setErrorMessage(null);

      const isExpanded = expandedFolderIds.has(folder.id);
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);

        if (next.has(folder.id)) {
          next.delete(folder.id);
        } else {
          next.add(folder.id);
        }

        return next;
      });

      if (!isExpanded) {
        try {
          await ensureFolderLoaded(folder);
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load folder.",
          );
        }
      }
    },
    [ensureFolderLoaded, expandedFolderIds],
  );

  const handleSelectFolder = useCallback(
    async (folder: WorkspaceFolderNode) => {
      setErrorMessage(null);
      setSelectedFolderId(folder.id);
      setSelectedFileId(null);
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(folder.id);
        return next;
      });

      try {
        await ensureFolderLoaded(folder);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load folder.",
        );
      }
    },
    [ensureFolderLoaded],
  );

  const handleSelectFile = useCallback((file: WorkspaceFileNode) => {
    setErrorMessage(null);
    setSelectedFileId(file.id);

    if (file.parentId) {
      setSelectedFolderId(file.parentId);
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(file.parentId as string);
        return next;
      });
    }
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!rootFolder) {
      setErrorMessage("Choose a workspace root folder first.");
      return;
    }

    const targetFolder = selectedFolder ?? rootFolder;
    const folderName = window.prompt("New folder name");

    if (folderName === null) {
      return;
    }

    const trimmedName = folderName.trim();
    if (!trimmedName) {
      setErrorMessage("Folder name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setIsCreatingFolder(true);

    try {
      let createdFolder: WorkspaceFolderNode;

      if (targetFolder.provider === "google-drive") {
        const folder = await createGoogleDriveFolder({
          parentId: targetFolder.rawId,
          name: trimmedName,
        });
        createdFolder = toGoogleFolderNode(folder, targetFolder.rawId);
      } else {
        const folder = await createLocalFolder({
          parentFolder: targetFolder.data as LocalDirectoryFolder,
          name: trimmedName,
        });
        createdFolder = toLocalFolderNode(folder);
      }

      setFolderChildrenByParent((prev) => ({
        ...prev,
        [targetFolder.id]: sortFoldersByName([
          ...(prev[targetFolder.id] ?? []),
          createdFolder,
        ]),
      }));
      setFilesByFolderId((prev) => ({
        ...prev,
        [createdFolder.id]: prev[createdFolder.id] ?? [],
      }));
      setFolderParentById((prev) => ({
        ...prev,
        [createdFolder.id]: targetFolder.id,
      }));
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(targetFolder.id);
        return next;
      });
      setSelectedFolderId(createdFolder.id);
      setSelectedFileId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create folder.",
      );
    } finally {
      setIsCreatingFolder(false);
    }
  }, [rootFolder, selectedFolder]);

  const handleCreateFile = useCallback(async () => {
    if (!rootFolder) {
      setErrorMessage("Choose a workspace root folder first.");
      return;
    }

    const targetFolder = selectedFolder ?? rootFolder;
    const fileName = window.prompt("New Excalidraw file name", "Untitled");

    if (fileName === null) {
      return;
    }

    const trimmedName = fileName.trim();
    if (!trimmedName) {
      setErrorMessage("File name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setIsCreatingFile(true);

    try {
      const createdFile =
        targetFolder.provider === "google-drive"
          ? toGoogleFileNode(
              await onCreateGoogleDriveFile({
                folderId: targetFolder.rawId,
                name: trimmedName,
              }),
            )
          : toLocalFileNode(
              await onCreateLocalFile({
                folder: targetFolder.data as LocalDirectoryFolder,
                name: trimmedName,
              }),
            );

      setFilesByFolderId((prev) => ({
        ...prev,
        [targetFolder.id]: sortFilesByName([
          ...(prev[targetFolder.id] ?? []),
          createdFile,
        ]),
      }));
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(targetFolder.id);
        return next;
      });
      setSelectedFolderId(targetFolder.id);
      setSelectedFileId(createdFile.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create file.",
      );
    } finally {
      setIsCreatingFile(false);
    }
  }, [onCreateGoogleDriveFile, onCreateLocalFile, rootFolder, selectedFolder]);

  const handleRenameFile = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    const nextName = window.prompt(
      "Rename file",
      selectedFile.name.replace(/\.excalidraw$/i, ""),
    );

    if (nextName === null) {
      return;
    }

    const normalizedName = normalizeExcalidrawFileName(nextName);
    if (!normalizedName.trim()) {
      setErrorMessage("File name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setIsMutatingSelection(true);

    try {
      let resolvedRenamedFile: WorkspaceFileNode;

      if (selectedFile.provider === "google-drive") {
        const renamed = await renameGoogleDriveEntry({
          entryId: selectedFile.rawId,
          name: normalizedName,
        });
        resolvedRenamedFile = toGoogleFileNode({
          ...(selectedFile.data as GoogleDriveFile),
          name: renamed.name,
          modifiedTime: renamed.modifiedTime,
          parentId:
            renamed.parents?.[0] ??
            (selectedFile.data as GoogleDriveFile).parentId,
        });
      } else {
        const renamed = await renameLocalFile({
          file: selectedFile.data as LocalDirectoryFile,
          name: normalizedName,
        });
        resolvedRenamedFile = toLocalFileNode(renamed);
      }

      if (selectedFile.parentId) {
        setFilesByFolderId((prev) => ({
          ...prev,
          [selectedFile.parentId as string]: sortFilesByName(
            (prev[selectedFile.parentId as string] ?? []).map((file) =>
              file.id === selectedFile.id ? resolvedRenamedFile : file,
            ),
          ),
        }));
      }
      setSelectedFileId(resolvedRenamedFile.id);

      if (
        currentFileProvider === "gdrive" &&
        currentFileId === selectedFile.rawId
      ) {
        onCurrentGoogleDriveFileRenamed(
          resolvedRenamedFile.data as GoogleDriveFile,
        );
      } else if (
        currentFileProvider === "local" &&
        currentFileId === selectedFile.rawId
      ) {
        onCurrentLocalFileRenamed(
          resolvedRenamedFile.data as LocalDirectoryFile,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to rename file.",
      );
    } finally {
      setIsMutatingSelection(false);
    }
  }, [
    currentFileId,
    currentFileProvider,
    onCurrentGoogleDriveFileRenamed,
    onCurrentLocalFileRenamed,
    selectedFile,
  ]);

  const handleRenameFolder = useCallback(async () => {
    if (!selectedFolder || !rootFolder || selectedFolder.id === rootFolder.id) {
      return;
    }

    const nextName = window.prompt("Rename folder", selectedFolder.name);

    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setErrorMessage("Folder name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setIsMutatingSelection(true);

    try {
      const parentId = folderParentById[selectedFolder.id];

      if (!parentId) {
        return;
      }

      if (selectedFolder.provider === "google-drive") {
        const renamed = await renameGoogleDriveEntry({
          entryId: selectedFolder.rawId,
          name: trimmedName,
        });

        setFolderChildrenByParent((prev) => ({
          ...prev,
          [parentId]: sortFoldersByName(
            (prev[parentId] ?? []).map((folder) =>
              folder.id === selectedFolder.id
                ? {
                    ...folder,
                    name: renamed.name,
                    modifiedTime: renamed.modifiedTime,
                    data: {
                      ...(folder.data as GoogleDriveFolder),
                      name: renamed.name,
                      modifiedTime: renamed.modifiedTime,
                    },
                  }
                : folder,
            ),
          ),
        }));
        return;
      }

      const renamedFolder = toLocalFolderNode(
        await renameLocalFolder({
          folder: selectedFolder.data as LocalDirectoryFolder,
          name: trimmedName,
        }),
      );
      const subtreeFolderIds = collectFolderSubtreeIds(
        selectedFolder.id,
        folderChildrenByParent,
      );

      setFolderChildrenByParent((prev) => {
        const next = { ...prev };
        next[parentId] = sortFoldersByName(
          (prev[parentId] ?? []).map((folder) =>
            folder.id === selectedFolder.id ? renamedFolder : folder,
          ),
        );

        subtreeFolderIds.forEach((folderId) => {
          if (folderId !== selectedFolder.id) {
            delete next[folderId];
          }
        });
        delete next[selectedFolder.id];

        return next;
      });
      setFilesByFolderId((prev) => {
        const next = { ...prev };
        subtreeFolderIds.forEach((folderId) => {
          delete next[folderId];
        });
        return next;
      });
      setFolderParentById((prev) => {
        const next = { ...prev };
        subtreeFolderIds.forEach((folderId) => {
          delete next[folderId];
        });
        next[renamedFolder.id] = parentId;
        return next;
      });
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        subtreeFolderIds.forEach((folderId) => {
          next.delete(folderId);
        });
        next.add(parentId);
        next.add(renamedFolder.id);
        return next;
      });
      setSelectedFolderId(renamedFolder.id);
      setSelectedFileId(null);
      await loadFolder(renamedFolder);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to rename folder.",
      );
    } finally {
      setIsMutatingSelection(false);
    }
  }, [
    folderChildrenByParent,
    folderParentById,
    loadFolder,
    rootFolder,
    selectedFolder,
  ]);

  const handleDeleteSelection = useCallback(async () => {
    if (selectedFile) {
      if (!window.confirm(`Delete file "${selectedFile.name}"?`)) {
        return;
      }

      setErrorMessage(null);
      setIsMutatingSelection(true);

      try {
        if (selectedFile.provider === "google-drive") {
          await deleteGoogleDriveEntry(selectedFile.rawId);

          if (
            currentFileProvider === "gdrive" &&
            currentFileId === selectedFile.rawId
          ) {
            onCurrentGoogleDriveFileDeleted(selectedFile.rawId);
          }
        } else {
          await deleteLocalEntry(selectedFile.data as LocalDirectoryFile);

          if (
            currentFileProvider === "local" &&
            currentFileId === selectedFile.rawId
          ) {
            onCurrentLocalFileDeleted(selectedFile.rawId);
          }
        }

        if (selectedFile.parentId) {
          setFilesByFolderId((prev) => ({
            ...prev,
            [selectedFile.parentId as string]: (
              prev[selectedFile.parentId as string] ?? []
            ).filter((file) => file.id !== selectedFile.id),
          }));
        }

        setThumbnailsByFileId((prev) => {
          const next = { ...prev };
          delete next[selectedFile.id];
          return next;
        });
        delete activeThumbnailLoadKeysRef.current[selectedFile.id];
        clearThumbnailRetry(selectedFile.id);
        setVisibleThumbnailFileIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedFile.id);
          return next;
        });
        setSelectedFileId(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to delete file.",
        );
      } finally {
        setIsMutatingSelection(false);
      }

      return;
    }

    if (!selectedFolder || !rootFolder || selectedFolder.id === rootFolder.id) {
      return;
    }

    if (!window.confirm(`Delete folder "${selectedFolder.name}"?`)) {
      return;
    }

    setErrorMessage(null);
    setIsMutatingSelection(true);

    try {
      if (selectedFolder.provider === "google-drive") {
        await deleteGoogleDriveEntry(selectedFolder.rawId);
      } else {
        await deleteLocalEntry(selectedFolder.data as LocalDirectoryFolder);
      }

      const parentId = folderParentById[selectedFolder.id] || rootFolder.id;
      const subtreeFolderIds = collectFolderSubtreeIds(
        selectedFolder.id,
        folderChildrenByParent,
      );
      const removedFileIds = subtreeFolderIds.flatMap((folderId) =>
        (filesByFolderId[folderId] ?? []).map((file) => file.id),
      );

      setFolderChildrenByParent((prev) => {
        const next = { ...prev };
        next[parentId] = (prev[parentId] ?? []).filter(
          (folder) => folder.id !== selectedFolder.id,
        );

        subtreeFolderIds.forEach((folderId) => {
          delete next[folderId];
        });

        return next;
      });
      setFilesByFolderId((prev) => {
        const next = { ...prev };

        subtreeFolderIds.forEach((folderId) => {
          delete next[folderId];
        });

        return next;
      });
      setFolderParentById((prev) => {
        const next = { ...prev };

        subtreeFolderIds.forEach((folderId) => {
          delete next[folderId];
        });

        return next;
      });
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);

        subtreeFolderIds.forEach((folderId) => {
          next.delete(folderId);
        });

        next.add(parentId);
        return next;
      });
      setThumbnailsByFileId((prev) => {
        const next = { ...prev };

        removedFileIds.forEach((fileId) => {
          delete next[fileId];
          delete activeThumbnailLoadKeysRef.current[fileId];
          clearThumbnailRetry(fileId);
        });

        return next;
      });
      setVisibleThumbnailFileIds((prev) => {
        const next = new Set(prev);

        removedFileIds.forEach((fileId) => {
          next.delete(fileId);
        });

        return next;
      });
      setSelectedFolderId(parentId);
      setSelectedFileId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete folder.",
      );
    } finally {
      setIsMutatingSelection(false);
    }
  }, [
    clearThumbnailRetry,
    currentFileId,
    currentFileProvider,
    filesByFolderId,
    folderChildrenByParent,
    folderParentById,
    onCurrentGoogleDriveFileDeleted,
    onCurrentLocalFileDeleted,
    rootFolder,
    selectedFile,
    selectedFolder,
  ]);

  const currentFolderFiles = useMemo(() => {
    return selectedFolderId ? filesByFolderId[selectedFolderId] ?? [] : [];
  }, [filesByFolderId, selectedFolderId]);
  const currentChildFolders = useMemo(() => {
    return selectedFolderId
      ? folderChildrenByParent[selectedFolderId] ?? []
      : [];
  }, [folderChildrenByParent, selectedFolderId]);
  const currentExcalidrawFiles = useMemo(() => {
    return currentFolderFiles.filter((file) => file.isExcalidrawFile);
  }, [currentFolderFiles]);
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
    expandedFolderIds,
    filesByFolderId,
    folderChildrenByParent,
    loadingFolderIds,
    rootFolder,
    selectedFileId,
    selectedFolderId,
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

  const handleOpenWorkspaceFile = useCallback(
    async (file: WorkspaceFileNode) => {
      setErrorMessage(null);
      setOpeningFolderId(null);
      setOpeningFileId(file.id);
      setSelectedFileId(file.id);

      if (file.parentId) {
        setSelectedFolderId(file.parentId);
      }

      try {
        if (file.provider === "google-drive") {
          await onOpenGoogleDriveFile(file.data as GoogleDriveFile);
        } else {
          await onOpenLocalFile(file.data as LocalDirectoryFile);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to open workspace file.",
        );
      } finally {
        setOpeningFileId(null);
      }
    },
    [onOpenGoogleDriveFile, onOpenLocalFile],
  );

  const handleOpenWorkspaceFolder = useCallback(
    async (folder: WorkspaceFolderNode) => {
      setErrorMessage(null);
      setOpeningFileId(null);
      setOpeningFolderId(folder.id);

      try {
        await handleSelectFolder(folder);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to open workspace folder.",
        );
      } finally {
        setOpeningFolderId(null);
      }
    },
    [handleSelectFolder],
  );

  const handleRenameAction = useCallback(() => {
    if (selectedFile) {
      void handleRenameFile();
      return;
    }

    void handleRenameFolder();
  }, [handleRenameFile, handleRenameFolder, selectedFile]);

  const loadThumbnailSourceFile = useCallback(
    async (file: WorkspaceFileNode) => {
      if (file.provider === "google-drive") {
        return downloadGoogleDriveFile(file.rawId, file.name, file.mimeType);
      }

      return readLocalFile(file.data as LocalDirectoryFile);
    },
    [],
  );

  useEffect(() => {
    thumbnailsByFileIdRef.current = thumbnailsByFileId;
  }, [thumbnailsByFileId]);

  const setThumbnailVisibility = useCallback(
    (fileId: string, isVisible: boolean) => {
      setVisibleThumbnailFileIds((prev) => {
        const alreadyVisible = prev.has(fileId);

        if (alreadyVisible === isVisible) {
          return prev;
        }

        const next = new Set(prev);
        if (isVisible) {
          next.add(fileId);
        } else {
          next.delete(fileId);
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    setVisibleThumbnailFileIds(() => {
      const next = new Set<string>();

      currentExcalidrawFiles
        .slice(0, INITIAL_THUMBNAIL_BATCH_SIZE)
        .forEach((file) => next.add(file.id));
      if (selectedFileId) {
        next.add(selectedFileId);
      }

      return next;
    });
  }, [currentExcalidrawFiles, selectedFileId]);

  useEffect(() => {
    const prioritizedFiles = [
      ...currentExcalidrawFiles.filter((file) => file.id === selectedFileId),
      ...currentExcalidrawFiles.filter(
        (file) =>
          file.id !== selectedFileId && visibleThumbnailFileIds.has(file.id),
      ),
      ...currentExcalidrawFiles
        .slice(0, INITIAL_THUMBNAIL_BATCH_SIZE)
        .filter(
          (file) =>
            file.id !== selectedFileId && !visibleThumbnailFileIds.has(file.id),
        ),
    ];

    if (!prioritizedFiles.length) {
      return;
    }

    const queue = prioritizedFiles.filter((file) => {
      const cacheKey = getThumbnailCacheKey(file);
      const currentThumbnail = thumbnailsByFileIdRef.current[file.id];

      if (
        currentThumbnail?.cacheKey === cacheKey &&
        (currentThumbnail.status === "ready" ||
          currentThumbnail.status === "empty")
      ) {
        return false;
      }

      if (activeThumbnailLoadKeysRef.current[file.id] === cacheKey) {
        return false;
      }

      return true;
    });

    if (!queue.length) {
      return;
    }

    let cancelled = false;

    const loadThumbnailForFile = async (file: WorkspaceFileNode) => {
      const cacheKey = getThumbnailCacheKey(file);
      const currentThumbnail = thumbnailsByFileIdRef.current[file.id];

      setThumbnailsByFileId((prev) => ({
        ...prev,
        [file.id]: {
          cacheKey,
          status: "loading",
          svg: currentThumbnail?.svg ?? null,
        },
      }));
      activeThumbnailLoadKeysRef.current[file.id] = cacheKey;

      try {
        const cachedThumbnail = await getCachedExcalidrawThumbnail(cacheKey);

        if (cancelled) {
          return;
        }

        if (cachedThumbnail) {
          clearThumbnailRetry(file.id);
          setThumbnailsByFileId((prev) => {
            if (prev[file.id]?.cacheKey !== cacheKey) {
              return prev;
            }

            return {
              ...prev,
              [file.id]: {
                cacheKey,
                status: cachedThumbnail.status,
                svg: cachedThumbnail.svg,
              },
            };
          });
          return;
        }

        const sourceFile = await loadThumbnailSourceFile(file);
        const thumbnailSvg = await createExcalidrawThumbnailUrl(sourceFile);

        if (cancelled) {
          return;
        }

        const nextThumbnailState = {
          cacheKey,
          status: thumbnailSvg ? ("ready" as const) : ("empty" as const),
          svg: thumbnailSvg,
        };
        clearThumbnailRetry(file.id);

        setThumbnailsByFileId((prev) => {
          if (prev[file.id]?.cacheKey !== cacheKey) {
            return prev;
          }

          return {
            ...prev,
            [file.id]: nextThumbnailState,
          };
        });

        await cacheExcalidrawThumbnail(cacheKey, {
          status: nextThumbnailState.status,
          svg: nextThumbnailState.svg,
        });
      } catch {
        if (cancelled) {
          return;
        }

        const retryAttempt = thumbnailRetryAttemptsRef.current[file.id] ?? 0;
        if (retryAttempt < THUMBNAIL_MAX_RETRY_COUNT) {
          const nextRetryAttempt = retryAttempt + 1;
          thumbnailRetryAttemptsRef.current[file.id] = nextRetryAttempt;
          const timeoutId = window.setTimeout(() => {
            delete thumbnailRetryTimeoutsRef.current[file.id];
            delete activeThumbnailLoadKeysRef.current[file.id];
            setVisibleThumbnailFileIds((prev) => new Set(prev));
          }, THUMBNAIL_RETRY_DELAY_MS);
          thumbnailRetryTimeoutsRef.current[file.id] = timeoutId;
        }

        setThumbnailsByFileId((prev) => {
          if (prev[file.id]?.cacheKey !== cacheKey) {
            return prev;
          }

          return {
            ...prev,
            [file.id]: {
              cacheKey,
              status: "error",
              svg: null,
            },
          };
        });
      } finally {
        if (activeThumbnailLoadKeysRef.current[file.id] === cacheKey) {
          delete activeThumbnailLoadKeysRef.current[file.id];
        }
      }
    };

    const workerCount = Math.min(
      MAX_THUMBNAIL_RENDER_CONCURRENCY,
      queue.length,
    );
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length && !cancelled) {
        const file = queue.shift();
        if (!file) {
          return;
        }

        await loadThumbnailForFile(file);
      }
    });

    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [
    clearThumbnailRetry,
    currentExcalidrawFiles,
    loadThumbnailSourceFile,
    selectedFileId,
    visibleThumbnailFileIds,
  ]);

  const rootActionDisabled =
    !rootFolder || isCreatingFolder || isCreatingFile || isMutatingSelection;
  const googleDriveStatusClassName =
    isDriveConnected && !missingEnvVars.length
      ? "workspace-status-dot--connected"
      : "workspace-status-dot--disconnected";
  const localStatusClassName = isLocalSupported
    ? "workspace-status-dot--connected"
    : "workspace-status-dot--disconnected";
  const rootTreeActions = useMemo(
    () => (
      <>
        <button
          type="button"
          className="workspace-tree-icon-button"
          title="New folder"
          aria-label="New folder"
          onClick={() => {
            void handleCreateFolder();
          }}
          disabled={rootActionDisabled}
        >
          <WorkspaceNewFolderIcon />
        </button>
        <button
          type="button"
          className="workspace-tree-icon-button"
          title="New file"
          aria-label="New file"
          onClick={() => {
            void handleCreateFile();
          }}
          disabled={rootActionDisabled}
        >
          <WorkspaceNewFileIcon />
        </button>
        <button
          type="button"
          className="workspace-tree-icon-button"
          title="Rename selected item"
          aria-label="Rename selected item"
          onClick={handleRenameAction}
          disabled={
            isCreatingFolder ||
            isCreatingFile ||
            isMutatingSelection ||
            (!canRenameSelectedFile && !canRenameSelectedFolder)
          }
        >
          <WorkspaceEditIcon />
        </button>
        <button
          type="button"
          className="workspace-tree-icon-button workspace-tree-icon-button--danger"
          title="Delete selected item"
          aria-label="Delete selected item"
          onClick={() => {
            void handleDeleteSelection();
          }}
          disabled={
            isCreatingFolder ||
            isCreatingFile ||
            isMutatingSelection ||
            (!canDeleteSelectedFile && !canDeleteSelectedFolder)
          }
        >
          <WorkspaceTrashIcon />
        </button>
      </>
    ),
    [
      canDeleteSelectedFile,
      canDeleteSelectedFolder,
      canRenameSelectedFile,
      canRenameSelectedFolder,
      handleCreateFile,
      handleCreateFolder,
      handleDeleteSelection,
      handleRenameAction,
      isCreatingFile,
      isCreatingFolder,
      isMutatingSelection,
      rootActionDisabled,
    ],
  );
  return (
    <div
      className={`workspace-page ${
        theme === "dark" ? "workspace-page--dark" : ""
      }`}
    >
      <div className="workspace-page__content">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-topbar__icon-button workspace-topbar__icon-button--back"
            onClick={onBackToEditor}
            aria-label="Back to editor"
            title="Back to editor"
          >
            <WorkspaceBackIcon />
          </button>
          <select
            className="workspace-topbar__select"
            value={selectedBackend}
            onChange={(event) =>
              setSelectedBackend(event.target.value as BackendId)
            }
            aria-label="Storage backend"
          >
            {BACKENDS.map((backend) => (
              <option key={backend.id} value={backend.id}>
                {backend.title}
              </option>
            ))}
          </select>
          <span
            className={`workspace-status-dot workspace-topbar__status-dot ${
              selectedBackend === "google-drive"
                ? googleDriveStatusClassName
                : localStatusClassName
            }`}
            title={
              selectedBackend === "google-drive"
                ? isDriveConnected && !missingEnvVars.length
                  ? "Google Drive connected"
                  : "Google Drive not connected"
                : isLocalSupported
                ? "Local directory available"
                : "Local directory unavailable"
            }
          />
          <button
            type="button"
            className="workspace-topbar__icon-button"
            onClick={() => {
              void connectDrive();
            }}
            disabled={
              selectedBackend !== "google-drive" ||
              isConnecting ||
              !!missingEnvVars.length
            }
            aria-label="Connect Google Drive"
            title="Connect Google Drive"
          >
            <WorkspaceConnectIcon />
          </button>
          <button
            type="button"
            className="workspace-topbar__icon-button"
            onClick={() => {
              void chooseRootFolder();
            }}
            disabled={
              selectedBackend === "google-drive"
                ? isPickingRoot || isConnecting || !!missingEnvVars.length
                : isPickingRoot || !isLocalSupported
            }
            aria-label="Choose folder"
            title="Choose folder"
          >
            <WorkspaceFolderOpenIcon />
          </button>
        </header>
        <section className="workspace-layout">
          <aside className="workspace-sidebar workspace-panel">
            {rootFolder ? (
              <div
                ref={treeScrollRef}
                className="workspace-tree"
                onScroll={(event) => {
                  setTreeScrollTop(event.currentTarget.scrollTop);
                }}
              >
                <div
                  className="workspace-tree__spacer"
                  style={{
                    height: `${treeRows.length * WORKSPACE_TREE_ROW_HEIGHT}px`,
                  }}
                >
                  {visibleTreeRows.map((row, index) => (
                    <WorkspaceTreeRow
                      key={row.key}
                      row={row}
                      top={(treeStartIndex + index) * WORKSPACE_TREE_ROW_HEIGHT}
                      onToggleFolder={handleToggleFolder}
                      onSelectFolder={handleSelectFolder}
                      onSelectFile={handleSelectFile}
                      onOpenFile={handleOpenWorkspaceFile}
                      rootActions={rootTreeActions}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="workspace-placeholder workspace-placeholder--sidebar">
                Choose a folder to start browsing files.
              </div>
            )}
          </aside>

          <section className="workspace-panel workspace-panel--main">
            <div className="workspace-preview-scroll">
              {!rootFolder || !selectedFolderId ? (
                <div className="workspace-placeholder">
                  After selecting a folder, its child folders and Excalidraw
                  files will appear here.
                </div>
              ) : loadingFolderIds.has(selectedFolderId) ? (
                <div className="workspace-placeholder">
                  Loading folder content...
                </div>
              ) : currentChildFolders.length > 0 ||
                currentExcalidrawFiles.length > 0 ? (
                <div className="workspace-files-grid">
                  {currentChildFolders.map((folder) => (
                    <WorkspaceFolderCard
                      key={folder.id}
                      folder={folder}
                      openingFolderId={openingFolderId}
                      onOpenFolder={handleOpenWorkspaceFolder}
                    />
                  ))}
                  {currentExcalidrawFiles.map((file) => (
                    <WorkspaceFileCard
                      key={file.id}
                      file={file}
                      isSelected={selectedFileId === file.id}
                      thumbnail={thumbnailsByFileId[file.id]}
                      openingFileId={openingFileId}
                      onVisibilityChange={setThumbnailVisibility}
                      onSelectFile={handleSelectFile}
                      onOpenFile={handleOpenWorkspaceFile}
                    />
                  ))}
                </div>
              ) : (
                <div className="workspace-placeholder">
                  No child folders or .excalidraw files in the current folder
                  yet.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
      {floatingNotice ? (
        <div className="workspace-floating-notice" key={floatingNotice.id}>
          <div className="workspace-floating-notice__message">
            {floatingNotice.message}
          </div>
          <button
            type="button"
            className="workspace-floating-notice__close"
            onClick={() => setFloatingNotice(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
};

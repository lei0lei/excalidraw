import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { t } from "@excalidraw/excalidraw/i18n";

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
import { WorkspaceGrid } from "./components/WorkspaceGrid";
import { WorkspaceTextDialog as WorkspaceTextDialogExternal } from "./components/WorkspaceTextDialog";
import { WorkspaceTopbar } from "./components/WorkspaceTopbar";
import { WorkspaceTree } from "./components/WorkspaceTree";
import {
  useWorkspaceData,
  useWorkspaceDirectoryOrchestration,
} from "./hooks/useWorkspaceData";
import { useWorkspaceGridVirtualization } from "./hooks/useWorkspaceGridVirtualization";
import { useWorkspaceThumbnails } from "./hooks/useWorkspaceThumbnails";

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

type CachedFolderContents = {
  folders: WorkspaceFolderNode[];
  files: WorkspaceFileNode[];
  loadedAt: number;
};

type WorkspaceTextDialogKind =
  | "new-folder"
  | "new-file"
  | "rename-file"
  | "rename-folder";

type WorkspaceTextDialogState = {
  kind: WorkspaceTextDialogKind;
  title: string;
  initialValue: string;
  submitLabel: string;
  inputLabel?: string;
};

type WorkspacePreviewFolderItem = {
  key: string;
  kind: "folder";
  folder: WorkspaceFolderNode;
};

type WorkspacePreviewFileItem = {
  key: string;
  kind: "file";
  file: WorkspaceFileNode;
};

type WorkspacePreviewItem =
  | WorkspacePreviewFolderItem
  | WorkspacePreviewFileItem;

const WORKSPACE_BACKEND_STORAGE_KEY = "excalidraw-workspace-backend";
const naturalNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const MAX_FOLDER_LOAD_CONCURRENCY = 2;
const FOLDER_CACHE_STALE_MS = 30_000;

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

const createTaskLimiter = (limit: number) => {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (activeCount >= limit) {
      return;
    }

    const next = queue.shift();
    if (!next) {
      return;
    }

    activeCount += 1;
    next();
  };

  return async <T,>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        void task()
          .then(resolve, reject)
          .finally(() => {
            activeCount = Math.max(0, activeCount - 1);
            runNext();
          });
      });

      runNext();
    });
};

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

// tree rows are now rendered by `WorkspaceTree`

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
  const {
    pendingAction,
    setPendingAction,
    errorState,
    setWorkspaceError,
    clearError,
    runErrorAction,
  } = useWorkspaceData();
  const setErrorMessage = useCallback(
    (message: string | null) => {
      if (!message) {
        clearError();
        return;
      }
      setWorkspaceError({
        kind: "recoverable",
        message,
        action: "retry",
      });
    },
    [clearError, setWorkspaceError],
  );
  const [textDialog, setTextDialog] = useState<WorkspaceTextDialogState | null>(
    null,
  );
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const [treeScrollTop, setTreeScrollTop] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(0);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const [previewScrollTop, setPreviewScrollTop] = useState(0);
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
  const workspaceSessionRef = useRef(0);
  const folderCacheRef = useRef<Record<string, CachedFolderContents>>({});
  const activeFolderLoadsRef = useRef<
    Record<string, Promise<void> | undefined>
  >({});
  const folderRequestLimiterRef = useRef(
    createTaskLimiter(MAX_FOLDER_LOAD_CONCURRENCY),
  );

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

  const resetWorkspaceState = useCallback(
    (nextRootFolder: WorkspaceFolderNode | null) => {
      workspaceSessionRef.current += 1;
      activeFolderLoadsRef.current = {};
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
      setPreviewScrollTop(0);
      previewScrollRef.current?.scrollTo({ top: 0 });
      setOpeningFolderId(null);
      setOpeningFileId(null);
    },
    [],
  );

  const textDialogSubmitRef = useRef<(rawValue: string) => Promise<void>>(
    async () => {},
  );

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
  }, [rootFolder, setErrorMessage]);

  useEffect(() => {
    const node = previewScrollRef.current;
    if (!node) {
      return;
    }

    const syncViewport = () => {
      setPreviewViewportHeight(node.clientHeight);
      setPreviewViewportWidth(node.clientWidth);
    };

    syncViewport();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncViewport();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [rootFolder, selectedFolderId]);

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
  }, [resetWorkspaceState, selectedBackend, setErrorMessage]);

  const fetchFolderContents = useCallback(
    async (folder: WorkspaceFolderNode) => {
      return folderRequestLimiterRef.current(async () => {
        if (folder.provider === "google-drive") {
          const result = await listGoogleDriveFolderChildren(folder.rawId);
          setIsDriveConnected(true);

          return {
            folders: result.folders.map((childFolder) =>
              toGoogleFolderNode(childFolder, folder.rawId),
            ),
            files: result.files.map((file) => toGoogleFileNode(file)),
          };
        }

        const result = await listLocalFolderChildren(
          folder.data as LocalDirectoryFolder,
        );
        return {
          folders: result.folders.map((childFolder) =>
            toLocalFolderNode(childFolder),
          ),
          files: result.files.map((file) => toLocalFileNode(file)),
        };
      });
    },
    [],
  );

  const { loadFolder, ensureFolderLoaded } = useWorkspaceDirectoryOrchestration(
    {
      folderChildrenByParent,
      filesByFolderId,
      setFolderChildrenByParent,
      setFilesByFolderId,
      setFolderParentById,
      setLoadingFolderIds,
      folderCacheRef,
      activeFolderLoadsRef,
      workspaceSessionRef,
      staleMs: FOLDER_CACHE_STALE_MS,
      fetchFolderContents,
      sortFoldersByName,
      sortFilesByName,
    },
  );

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
          setWorkspaceError({
            kind: "blocking",
            message,
            action: "reconnect",
            onRetry: () => {
              void connectGoogleDrive();
            },
          });
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
    setErrorMessage,
    setWorkspaceError,
  ]);

  const connectDrive = useCallback(async () => {
    setErrorMessage(null);
    setPendingAction("connect-drive");

    try {
      await connectGoogleDrive();
      setIsDriveConnected(true);
      const storedGoogleRootFolder = getStoredGoogleDriveRootFolder();
      if (storedGoogleRootFolder) {
        resetWorkspaceState(toGoogleFolderNode(storedGoogleRootFolder, null));
      }
    } catch (error) {
      setWorkspaceError({
        kind: "blocking",
        message:
          error instanceof Error
            ? error.message
            : "Google Drive connect failed.",
        action: "reconnect",
        onRetry: () => {
          void connectDrive();
        },
      });
    } finally {
      setPendingAction(null);
    }
  }, [
    resetWorkspaceState,
    setErrorMessage,
    setPendingAction,
    setWorkspaceError,
  ]);

  const chooseRootFolder = useCallback(async () => {
    setErrorMessage(null);
    setPendingAction("pick-root");

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
      setPendingAction(null);
    }
  }, [resetWorkspaceState, selectedBackend, setErrorMessage, setPendingAction]);

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
    [ensureFolderLoaded, expandedFolderIds, setErrorMessage],
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
    [ensureFolderLoaded, setErrorMessage],
  );

  const handleSelectFile = useCallback(
    (file: WorkspaceFileNode) => {
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
    },
    [setErrorMessage],
  );

  const handleCreateFolder = useCallback(() => {
    if (!rootFolder) {
      setErrorMessage("Choose a workspace root folder first.");
      return;
    }

    setTextDialog({
      kind: "new-folder",
      title: "New folder",
      initialValue: "",
      submitLabel: "Create",
      inputLabel: "Folder name",
    });
  }, [rootFolder, setErrorMessage]);

  const handleCreateFile = useCallback(() => {
    if (!rootFolder) {
      setErrorMessage("Choose a workspace root folder first.");
      return;
    }

    setTextDialog({
      kind: "new-file",
      title: "New Excalidraw file",
      initialValue: "Untitled",
      submitLabel: "Create",
      inputLabel: "File name",
    });
  }, [rootFolder, setErrorMessage]);

  const handleRenameFile = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    setTextDialog({
      kind: "rename-file",
      title: "Rename file",
      initialValue: selectedFile.name.replace(/\.excalidraw$/i, ""),
      submitLabel: "Rename",
      inputLabel: "Name",
    });
  }, [selectedFile]);

  const handleRenameFolder = useCallback(() => {
    if (!selectedFolder || !rootFolder || selectedFolder.id === rootFolder.id) {
      return;
    }

    setTextDialog({
      kind: "rename-folder",
      title: "Rename folder",
      initialValue: selectedFolder.name,
      submitLabel: "Rename",
      inputLabel: "Folder name",
    });
  }, [rootFolder, selectedFolder]);

  useLayoutEffect(() => {
    textDialogSubmitRef.current = async (rawValue: string) => {
      const dialog = textDialog;
      if (!dialog) {
        return;
      }

      switch (dialog.kind) {
        case "new-folder": {
          const trimmedName = rawValue.trim();
          if (!trimmedName) {
            setErrorMessage("Folder name cannot be empty.");
            return;
          }
          if (!rootFolder) {
            setErrorMessage("Choose a workspace root folder first.");
            return;
          }

          const targetFolder = selectedFolder ?? rootFolder;
          setErrorMessage(null);
          setPendingAction("create-folder");

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
            folderCacheRef.current[targetFolder.id] = {
              folders: sortFoldersByName([
                ...(folderCacheRef.current[targetFolder.id]?.folders ?? []),
                createdFolder,
              ]),
              files: sortFilesByName(
                folderCacheRef.current[targetFolder.id]?.files ?? [],
              ),
              loadedAt: Date.now(),
            };
            folderCacheRef.current[createdFolder.id] = {
              folders: [],
              files: [],
              loadedAt: Date.now(),
            };
            setTextDialog(null);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Failed to create folder.",
            );
          } finally {
            setPendingAction(null);
          }

          break;
        }

        case "new-file": {
          const trimmedName = rawValue.trim();
          if (!trimmedName) {
            setErrorMessage("File name cannot be empty.");
            return;
          }
          if (!rootFolder) {
            setErrorMessage("Choose a workspace root folder first.");
            return;
          }

          const targetFolder = selectedFolder ?? rootFolder;
          setErrorMessage(null);
          setPendingAction("create-file");

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
            folderCacheRef.current[targetFolder.id] = {
              folders: sortFoldersByName(
                folderCacheRef.current[targetFolder.id]?.folders ?? [],
              ),
              files: sortFilesByName([
                ...(folderCacheRef.current[targetFolder.id]?.files ?? []),
                createdFile,
              ]),
              loadedAt: Date.now(),
            };
            setTextDialog(null);
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Failed to create file.",
            );
          } finally {
            setPendingAction(null);
          }

          break;
        }

        case "rename-file": {
          if (!selectedFile) {
            setTextDialog(null);
            return;
          }

          const normalizedName = normalizeExcalidrawFileName(rawValue);
          if (!normalizedName.trim()) {
            setErrorMessage("File name cannot be empty.");
            return;
          }

          setErrorMessage(null);
          setPendingAction("rename");

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
              folderCacheRef.current[selectedFile.parentId] = {
                folders: sortFoldersByName(
                  folderCacheRef.current[selectedFile.parentId]?.folders ?? [],
                ),
                files: sortFilesByName(
                  (
                    folderCacheRef.current[selectedFile.parentId]?.files ?? []
                  ).map((file) =>
                    file.id === selectedFile.id ? resolvedRenamedFile : file,
                  ),
                ),
                loadedAt: Date.now(),
              };
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
            setTextDialog(null);
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Failed to rename file.",
            );
          } finally {
            setPendingAction(null);
          }

          break;
        }

        case "rename-folder": {
          if (!selectedFolder || !rootFolder) {
            setTextDialog(null);
            return;
          }

          const trimmedName = rawValue.trim();
          if (!trimmedName) {
            setErrorMessage("Folder name cannot be empty.");
            return;
          }

          setErrorMessage(null);
          setPendingAction("rename");

          try {
            const parentId = folderParentById[selectedFolder.id];

            if (!parentId) {
              setTextDialog(null);
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
              folderCacheRef.current[parentId] = {
                folders: sortFoldersByName(
                  (folderCacheRef.current[parentId]?.folders ?? []).map(
                    (folder) =>
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
                files: sortFilesByName(
                  folderCacheRef.current[parentId]?.files ?? [],
                ),
                loadedAt: Date.now(),
              };
              setTextDialog(null);
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
            subtreeFolderIds.forEach((folderId) => {
              delete folderCacheRef.current[folderId];
            });
            folderCacheRef.current[parentId] = {
              folders: sortFoldersByName(
                (folderCacheRef.current[parentId]?.folders ?? []).map(
                  (folder) =>
                    folder.id === selectedFolder.id ? renamedFolder : folder,
                ),
              ),
              files: sortFilesByName(
                folderCacheRef.current[parentId]?.files ?? [],
              ),
              loadedAt: Date.now(),
            };
            await loadFolder(renamedFolder);
            setTextDialog(null);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Failed to rename folder.",
            );
          } finally {
            setPendingAction(null);
          }

          break;
        }
      }
    };
  });

  const handleDeleteSelection = useCallback(async () => {
    if (selectedFile) {
      if (!window.confirm(`Delete file "${selectedFile.name}"?`)) {
        return;
      }

      setErrorMessage(null);
      setPendingAction("delete");

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
          folderCacheRef.current[selectedFile.parentId] = {
            folders: sortFoldersByName(
              folderCacheRef.current[selectedFile.parentId]?.folders ?? [],
            ),
            files: sortFilesByName(
              (
                folderCacheRef.current[selectedFile.parentId]?.files ?? []
              ).filter((file) => file.id !== selectedFile.id),
            ),
            loadedAt: Date.now(),
          };
        }

        setSelectedFileId(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to delete file.",
        );
      } finally {
        setPendingAction(null);
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
    setPendingAction("delete");

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
      subtreeFolderIds.forEach((folderId) => {
        delete folderCacheRef.current[folderId];
      });
      folderCacheRef.current[parentId] = {
        folders: sortFoldersByName(
          (folderCacheRef.current[parentId]?.folders ?? []).filter(
            (folder) => folder.id !== selectedFolder.id,
          ),
        ),
        files: sortFilesByName(folderCacheRef.current[parentId]?.files ?? []),
        loadedAt: Date.now(),
      };
      setSelectedFolderId(parentId);
      setSelectedFileId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete folder.",
      );
    } finally {
      setPendingAction(null);
    }
  }, [
    currentFileId,
    currentFileProvider,
    folderChildrenByParent,
    folderParentById,
    onCurrentGoogleDriveFileDeleted,
    onCurrentLocalFileDeleted,
    rootFolder,
    selectedFile,
    selectedFolder,
    setErrorMessage,
    setPendingAction,
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
  const previewItems = useMemo<WorkspacePreviewItem[]>(() => {
    return [
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
    ];
  }, [currentChildFolders, currentExcalidrawFiles]);
  const { visibleThumbnailFileIds } = useWorkspaceGridVirtualization({
    previewItems,
    currentExcalidrawFiles,
    selectedFileId,
    previewScrollTop,
    previewViewportHeight,
    previewViewportWidth,
  });

  const handleOpenWorkspaceFile = useCallback(
    async (file: WorkspaceFileNode) => {
      setErrorMessage(null);
      setOpeningFolderId(null);
      setOpeningFileId(file.id);
      setPendingAction("open-file");
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
        setPendingAction(null);
      }
    },
    [onOpenGoogleDriveFile, onOpenLocalFile, setErrorMessage, setPendingAction],
  );

  const handleOpenWorkspaceFolder = useCallback(
    async (folder: WorkspaceFolderNode) => {
      setErrorMessage(null);
      setOpeningFileId(null);
      setOpeningFolderId(folder.id);
      setPendingAction("open-folder");

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
        setPendingAction(null);
      }
    },
    [handleSelectFolder, setErrorMessage, setPendingAction],
  );

  useEffect(() => {
    setPreviewScrollTop(0);
    previewScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedFolderId]);

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

  const { thumbnailsByFileId } = useWorkspaceThumbnails({
    files: currentExcalidrawFiles,
    selectedFileId,
    visibleFileIds: visibleThumbnailFileIds,
    loadThumbnailSourceFile,
  });

  const hasPendingAction =
    pendingAction === "create-folder" ||
    pendingAction === "create-file" ||
    pendingAction === "rename" ||
    pendingAction === "delete";
  const rootActionDisabled = !rootFolder || hasPendingAction;
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
            hasPendingAction ||
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
            hasPendingAction ||
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
      hasPendingAction,
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
        <WorkspaceTopbar
          selectedBackend={selectedBackend}
          onChangeBackend={setSelectedBackend}
          onBackToEditor={onBackToEditor}
          onConnectDrive={() => {
            void connectDrive();
          }}
          onChooseRootFolder={() => {
            void chooseRootFolder();
          }}
          canConnectDrive={
            selectedBackend === "google-drive" &&
            pendingAction !== "connect-drive" &&
            !missingEnvVars.length
          }
          canChooseRoot={
            selectedBackend === "google-drive"
              ? pendingAction !== "pick-root" &&
                pendingAction !== "connect-drive" &&
                !missingEnvVars.length
              : pendingAction !== "pick-root" && isLocalSupported
          }
          isDriveConnected={isDriveConnected && !missingEnvVars.length}
          isLocalSupported={isLocalSupported}
          errorState={errorState}
          onDismissError={() => setErrorMessage(null)}
          onRetryError={() => {
            void runErrorAction();
          }}
        />
        <section className="workspace-layout">
          <aside className="workspace-sidebar workspace-panel">
            <WorkspaceTree
              rootFolder={rootFolder}
              selectedFolderId={selectedFolderId}
              selectedFileId={selectedFileId}
              expandedFolderIds={expandedFolderIds}
              folderChildrenByParent={folderChildrenByParent}
              filesByFolderId={filesByFolderId}
              loadingFolderIds={loadingFolderIds}
              treeScrollTop={treeScrollTop}
              treeViewportHeight={treeViewportHeight}
              onTreeScroll={setTreeScrollTop}
              setTreeScrollRef={(node) => {
                treeScrollRef.current = node;
              }}
              onToggleFolder={handleToggleFolder}
              onSelectFolder={handleSelectFolder}
              onSelectFile={handleSelectFile}
              onOpenFile={handleOpenWorkspaceFile}
              rootActions={rootTreeActions}
              placeholder={t("workspace.sidebarPlaceholder")}
            />
          </aside>

          <section className="workspace-panel workspace-panel--main">
            <WorkspaceGrid
              rootFolder={rootFolder}
              selectedFolderId={selectedFolderId}
              currentChildFolders={currentChildFolders}
              currentExcalidrawFiles={currentExcalidrawFiles}
              loadingFolderIds={loadingFolderIds}
              previewScrollTop={previewScrollTop}
              previewViewportHeight={previewViewportHeight}
              previewViewportWidth={previewViewportWidth}
              setPreviewScrollRef={(node) => {
                previewScrollRef.current = node;
              }}
              onPreviewScroll={setPreviewScrollTop}
              openingFolderId={openingFolderId}
              openingFileId={openingFileId}
              selectedFileId={selectedFileId}
              thumbnailsByFileId={thumbnailsByFileId}
              onOpenFolder={handleOpenWorkspaceFolder}
              onSelectFile={handleSelectFile}
              onOpenFile={handleOpenWorkspaceFile}
            />
          </section>
        </section>
      </div>
      <WorkspaceTextDialogExternal
        open={textDialog !== null}
        title={textDialog?.title ?? ""}
        initialValue={textDialog?.initialValue ?? ""}
        submitLabel={textDialog?.submitLabel ?? "OK"}
        inputLabel={textDialog?.inputLabel}
        onClose={() => setTextDialog(null)}
        onSubmit={(value) => textDialogSubmitRef.current(value)}
      />
    </div>
  );
};

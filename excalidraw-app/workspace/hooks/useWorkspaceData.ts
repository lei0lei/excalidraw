import { useCallback, useMemo, useRef, useState } from "react";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  PendingAction,
  WorkspaceErrorAction,
  WorkspaceErrorKind,
  WorkspaceErrorState,
  WorkspaceFileNode,
  WorkspaceFolderNode,
} from "../types";

export const useWorkspaceData = () => {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorState, setErrorState] = useState<WorkspaceErrorState>(null);
  const retryRef = useRef<(() => void | Promise<void>) | null>(null);

  const hasPendingAction = pendingAction !== null;

  const clearError = useCallback(() => {
    setErrorState(null);
    retryRef.current = null;
  }, []);

  const setWorkspaceError = useCallback(
    ({
      kind,
      message,
      action = null,
      onRetry,
    }: {
      kind: WorkspaceErrorKind;
      message: string;
      action?: WorkspaceErrorAction;
      onRetry?: (() => void | Promise<void>) | null;
    }) => {
      setErrorState({
        kind,
        message,
        action,
      });
      retryRef.current = onRetry ?? null;
    },
    [],
  );

  const runErrorAction = useCallback(async () => {
    const fn = retryRef.current;
    if (!fn) {
      return;
    }
    await fn();
  }, []);

  return useMemo(
    () => ({
      pendingAction,
      setPendingAction,
      hasPendingAction,
      errorState,
      setWorkspaceError,
      clearError,
      runErrorAction,
    }),
    [
      clearError,
      errorState,
      hasPendingAction,
      pendingAction,
      runErrorAction,
      setWorkspaceError,
    ],
  );
};

type CachedFolderContents = {
  folders: WorkspaceFolderNode[];
  files: WorkspaceFileNode[];
  loadedAt: number;
};

export const useWorkspaceDirectoryOrchestration = ({
  folderChildrenByParent,
  filesByFolderId,
  setFolderChildrenByParent,
  setFilesByFolderId,
  setFolderParentById,
  setLoadingFolderIds,
  folderCacheRef,
  activeFolderLoadsRef,
  workspaceSessionRef,
  staleMs,
  fetchFolderContents,
  sortFoldersByName,
  sortFilesByName,
}: {
  folderChildrenByParent: Record<string, WorkspaceFolderNode[]>;
  filesByFolderId: Record<string, WorkspaceFileNode[]>;
  setFolderChildrenByParent: Dispatch<
    SetStateAction<Record<string, WorkspaceFolderNode[]>>
  >;
  setFilesByFolderId: Dispatch<
    SetStateAction<Record<string, WorkspaceFileNode[]>>
  >;
  setFolderParentById: Dispatch<SetStateAction<Record<string, string | null>>>;
  setLoadingFolderIds: Dispatch<SetStateAction<Set<string>>>;
  folderCacheRef: MutableRefObject<Record<string, CachedFolderContents>>;
  activeFolderLoadsRef: MutableRefObject<
    Record<string, Promise<void> | undefined>
  >;
  workspaceSessionRef: MutableRefObject<number>;
  staleMs: number;
  fetchFolderContents: (folder: WorkspaceFolderNode) => Promise<{
    folders: WorkspaceFolderNode[];
    files: WorkspaceFileNode[];
  }>;
  sortFoldersByName: (folders: WorkspaceFolderNode[]) => WorkspaceFolderNode[];
  sortFilesByName: (files: WorkspaceFileNode[]) => WorkspaceFileNode[];
}) => {
  const applyFolderContents = useCallback(
    (
      folder: WorkspaceFolderNode,
      contents: {
        folders: WorkspaceFolderNode[];
        files: WorkspaceFileNode[];
      },
    ) => {
      const nextFolders = sortFoldersByName(contents.folders);
      const nextFiles = sortFilesByName(contents.files);

      setFolderChildrenByParent((prev) => ({
        ...prev,
        [folder.id]: nextFolders,
      }));
      setFilesByFolderId((prev) => ({
        ...prev,
        [folder.id]: nextFiles,
      }));
      setFolderParentById((prev) => {
        const next = {
          ...prev,
          [folder.id]: prev[folder.id] ?? folder.parentId,
        };

        for (const childFolder of nextFolders) {
          next[childFolder.id] = folder.id;
        }

        return next;
      });
      folderCacheRef.current[folder.id] = {
        folders: nextFolders,
        files: nextFiles,
        loadedAt: Date.now(),
      };
    },
    [
      folderCacheRef,
      setFilesByFolderId,
      setFolderChildrenByParent,
      setFolderParentById,
      sortFilesByName,
      sortFoldersByName,
    ],
  );

  const loadFolder = useCallback(
    async (
      folder: WorkspaceFolderNode,
      opts?: { force?: boolean; background?: boolean },
    ) => {
      const cachedContents = folderCacheRef.current[folder.id];
      const isCacheFresh =
        !!cachedContents && Date.now() - cachedContents.loadedAt < staleMs;
      const sessionId = workspaceSessionRef.current;

      if (cachedContents && !opts?.force) {
        applyFolderContents(folder, cachedContents);
        if (isCacheFresh) {
          return;
        }
      }

      if (activeFolderLoadsRef.current[folder.id]) {
        return activeFolderLoadsRef.current[folder.id];
      }

      const shouldShowLoading = !opts?.background && !cachedContents;
      if (shouldShowLoading) {
        setLoadingFolderIds((prev) => {
          const next = new Set(prev);
          next.add(folder.id);
          return next;
        });
      }

      const request = (async () => {
        try {
          const contents = await fetchFolderContents(folder);
          if (workspaceSessionRef.current !== sessionId) {
            return;
          }
          applyFolderContents(folder, contents);
        } finally {
          delete activeFolderLoadsRef.current[folder.id];
          if (shouldShowLoading) {
            setLoadingFolderIds((prev) => {
              const next = new Set(prev);
              next.delete(folder.id);
              return next;
            });
          }
        }
      })();

      activeFolderLoadsRef.current[folder.id] = request;
      return request;
    },
    [
      activeFolderLoadsRef,
      applyFolderContents,
      fetchFolderContents,
      folderCacheRef,
      setLoadingFolderIds,
      staleMs,
      workspaceSessionRef,
    ],
  );

  const ensureFolderLoaded = useCallback(
    async (folder: WorkspaceFolderNode) => {
      if (!folderChildrenByParent[folder.id] || !filesByFolderId[folder.id]) {
        await loadFolder(folder);
        return;
      }

      const cachedContents = folderCacheRef.current[folder.id];
      const isCacheFresh =
        !!cachedContents && Date.now() - cachedContents.loadedAt < staleMs;

      if (!isCacheFresh) {
        void loadFolder(folder, { background: true });
      }
    },
    [
      filesByFolderId,
      folderChildrenByParent,
      folderCacheRef,
      loadFolder,
      staleMs,
    ],
  );

  return {
    applyFolderContents,
    loadFolder,
    ensureFolderLoaded,
  };
};

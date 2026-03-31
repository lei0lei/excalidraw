import { useEffect, useMemo, useRef, useState } from "react";

import {
  cacheExcalidrawThumbnail,
  createExcalidrawThumbnailUrl,
  getCachedExcalidrawThumbnail,
  getLatestCachedExcalidrawThumbnailForFile,
} from "../data/thumbnail";

import type { WorkspaceFileNode, WorkspaceThumbnailState } from "../types";

const INITIAL_THUMBNAIL_BATCH_SIZE = 12;
const THUMBNAIL_MAX_RETRY_COUNT = 1;
const THUMBNAIL_RETRY_DELAY_MS = 1200;

const getThumbnailCacheKey = (file: WorkspaceFileNode) =>
  `${file.id}:${file.modifiedTime || ""}:${file.name}`;

export const useWorkspaceThumbnails = ({
  files,
  selectedFileId,
  visibleFileIds,
  loadThumbnailSourceFile,
}: {
  files: WorkspaceFileNode[];
  selectedFileId: string | null;
  visibleFileIds: Set<string>;
  loadThumbnailSourceFile: (file: WorkspaceFileNode) => Promise<Blob | File>;
}) => {
  const [thumbnailsByFileId, setThumbnailsByFileId] = useState<
    Record<string, WorkspaceThumbnailState>
  >({});
  const thumbnailsRef = useRef<Record<string, WorkspaceThumbnailState>>({});
  const activeKeysRef = useRef<Record<string, string>>({});
  const retryAttemptsRef = useRef<Record<string, number>>({});
  const retryTimeoutsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    thumbnailsRef.current = thumbnailsByFileId;
  }, [thumbnailsByFileId]);

  const prioritizedFiles = useMemo(() => {
    const fileMap = new Map<string, WorkspaceFileNode>();

    files
      .filter((file) => file.id === selectedFileId)
      .forEach((file) => fileMap.set(file.id, file));
    files
      .filter(
        (file) => file.id !== selectedFileId && visibleFileIds.has(file.id),
      )
      .forEach((file) => fileMap.set(file.id, file));
    files
      .slice(0, INITIAL_THUMBNAIL_BATCH_SIZE)
      .filter(
        (file) => file.id !== selectedFileId && !visibleFileIds.has(file.id),
      )
      .forEach((file) => fileMap.set(file.id, file));

    return [...fileMap.values()];
  }, [files, selectedFileId, visibleFileIds]);

  useEffect(() => {
    if (!prioritizedFiles.length) {
      return;
    }

    let cancelled = false;
    const queue = prioritizedFiles.filter((file) => {
      const cacheKey = getThumbnailCacheKey(file);
      const current = thumbnailsRef.current[file.id];
      if (
        current?.cacheKey === cacheKey &&
        (current.status === "ready" || current.status === "empty")
      ) {
        return false;
      }
      return activeKeysRef.current[file.id] !== cacheKey;
    });

    const clearRetry = (fileId: string) => {
      const timeoutId = retryTimeoutsRef.current[fileId];
      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
        delete retryTimeoutsRef.current[fileId];
      }
      delete retryAttemptsRef.current[fileId];
    };

    const run = async (file: WorkspaceFileNode) => {
      const cacheKey = getThumbnailCacheKey(file);
      const current = thumbnailsRef.current[file.id];
      setThumbnailsByFileId((prev) => ({
        ...prev,
        [file.id]: { cacheKey, status: "loading", svg: current?.svg ?? null },
      }));
      activeKeysRef.current[file.id] = cacheKey;

      try {
        const cached = await getCachedExcalidrawThumbnail(cacheKey);
        if (cancelled) {
          return;
        }
        if (cached) {
          clearRetry(file.id);
          setThumbnailsByFileId((prev) => ({
            ...prev,
            [file.id]: { cacheKey, status: cached.status, svg: cached.svg },
          }));
          return;
        }

        const stale = await getLatestCachedExcalidrawThumbnailForFile(file.id);
        if (cancelled) {
          return;
        }
        if (stale?.svg) {
          setThumbnailsByFileId((prev) => ({
            ...prev,
            [file.id]: { cacheKey, status: "loading", svg: stale.svg },
          }));
        }

        const source = await loadThumbnailSourceFile(file);
        const svg = await createExcalidrawThumbnailUrl(source);
        if (cancelled) {
          return;
        }
        const nextState = {
          cacheKey,
          status: svg ? ("ready" as const) : ("empty" as const),
          svg,
        };
        clearRetry(file.id);
        setThumbnailsByFileId((prev) => ({ ...prev, [file.id]: nextState }));
        await cacheExcalidrawThumbnail(cacheKey, {
          status: nextState.status,
          svg: nextState.svg,
        });
      } catch {
        if (cancelled) {
          return;
        }
        const retryAttempt = retryAttemptsRef.current[file.id] ?? 0;
        if (retryAttempt < THUMBNAIL_MAX_RETRY_COUNT) {
          retryAttemptsRef.current[file.id] = retryAttempt + 1;
          retryTimeoutsRef.current[file.id] = window.setTimeout(() => {
            delete activeKeysRef.current[file.id];
            setThumbnailsByFileId((prev) => ({ ...prev }));
          }, THUMBNAIL_RETRY_DELAY_MS);
        }
        setThumbnailsByFileId((prev) => ({
          ...prev,
          [file.id]: { cacheKey, status: "error", svg: null },
        }));
      } finally {
        if (activeKeysRef.current[file.id] === cacheKey) {
          delete activeKeysRef.current[file.id];
        }
      }
    };

    void Promise.all(queue.map((file) => run(file)));

    return () => {
      cancelled = true;
    };
  }, [loadThumbnailSourceFile, prioritizedFiles]);

  return {
    thumbnailsByFileId,
    setThumbnailsByFileId,
  };
};

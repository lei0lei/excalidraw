import {
  exportToSvg,
  getNonDeletedElements,
  loadFromBlob,
} from "@excalidraw/excalidraw";

const THUMBNAIL_BACKGROUND = "#ffffff";
const THUMBNAIL_DB_NAME = "excalidraw-workspace-thumbnail-cache";
const THUMBNAIL_STORE_NAME = "thumbnails";
const THUMBNAIL_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const THUMBNAIL_CACHE_MAX_ENTRIES = 250;

export type CachedThumbnailState = {
  status: "ready" | "empty";
  svg: string | null;
};

type StoredThumbnailRecord = CachedThumbnailState & {
  updatedAt: number;
};

const thumbnailMemoryCache = new Map<string, StoredThumbnailRecord>();
let thumbnailCacheCleanupPromise: Promise<void> | null = null;

const isThumbnailRecordExpired = (record: StoredThumbnailRecord) =>
  Date.now() - record.updatedAt > THUMBNAIL_CACHE_MAX_AGE_MS;

const toCachedThumbnailState = (
  record: StoredThumbnailRecord,
): CachedThumbnailState => ({
  status: record.status,
  svg: record.svg,
});

const openThumbnailCacheDb = async (): Promise<IDBDatabase | null> => {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(THUMBNAIL_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(THUMBNAIL_STORE_NAME)) {
          db.createObjectStore(THUMBNAIL_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
};

export const getCachedExcalidrawThumbnail = async (
  cacheKey: string,
): Promise<CachedThumbnailState | null> => {
  const inMemory = thumbnailMemoryCache.get(cacheKey);
  if (inMemory) {
    if (isThumbnailRecordExpired(inMemory)) {
      thumbnailMemoryCache.delete(cacheKey);
    } else {
      return toCachedThumbnailState(inMemory);
    }
  }

  const db = await openThumbnailCacheDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const result = request.result as StoredThumbnailRecord | undefined;
        if (result) {
          if (isThumbnailRecordExpired(result)) {
            thumbnailMemoryCache.delete(cacheKey);
            resolve(null);
            return;
          }

          thumbnailMemoryCache.set(cacheKey, result);
          resolve(toCachedThumbnailState(result));
          return;
        }

        resolve(null);
      };

      request.onerror = () => {
        resolve(null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
      transaction.onerror = () => {
        db.close();
      };
      transaction.onabort = () => {
        db.close();
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
};

export const getLatestCachedExcalidrawThumbnailForFile = async (
  fileId: string,
): Promise<CachedThumbnailState | null> => {
  const cacheKeyPrefix = `${fileId}:`;
  let newestRecord: StoredThumbnailRecord | null = null;

  thumbnailMemoryCache.forEach((record, key) => {
    if (!key.startsWith(cacheKeyPrefix)) {
      return;
    }

    if (isThumbnailRecordExpired(record)) {
      thumbnailMemoryCache.delete(key);
      return;
    }

    if (!newestRecord || record.updatedAt > newestRecord.updatedAt) {
      newestRecord = record;
    }
  });

  if (newestRecord) {
    return toCachedThumbnailState(newestRecord);
  }

  const db = await openThumbnailCacheDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve(newestRecord ? toCachedThumbnailState(newestRecord) : null);
          return;
        }

        const key = String(cursor.primaryKey);
        const value = cursor.value as StoredThumbnailRecord;

        if (!key.startsWith(cacheKeyPrefix)) {
          cursor.continue();
          return;
        }

        if (isThumbnailRecordExpired(value)) {
          thumbnailMemoryCache.delete(key);
          cursor.continue();
          return;
        }

        thumbnailMemoryCache.set(key, value);
        if (!newestRecord || value.updatedAt > newestRecord.updatedAt) {
          newestRecord = value;
        }

        cursor.continue();
      };

      request.onerror = () => {
        resolve(newestRecord ? toCachedThumbnailState(newestRecord) : null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
      transaction.onerror = () => {
        db.close();
      };
      transaction.onabort = () => {
        db.close();
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
};

const cleanupThumbnailCache = async () => {
  const db = await openThumbnailCacheDb();
  if (!db) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readwrite");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const records: Array<{ key: string; updatedAt: number }> = [];
      const now = Date.now();

      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          const overflowCount = records.length - THUMBNAIL_CACHE_MAX_ENTRIES;
          if (overflowCount > 0) {
            records
              .sort((a, b) => a.updatedAt - b.updatedAt)
              .slice(0, overflowCount)
              .forEach((record) => {
                store.delete(record.key);
                thumbnailMemoryCache.delete(record.key);
              });
          }
          return;
        }

        const key = String(cursor.primaryKey);
        const value = cursor.value as StoredThumbnailRecord;

        if (now - value.updatedAt > THUMBNAIL_CACHE_MAX_AGE_MS) {
          cursor.delete();
          thumbnailMemoryCache.delete(key);
        } else {
          records.push({ key, updatedAt: value.updatedAt });
        }

        cursor.continue();
      };

      request.onerror = () => resolve();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
};

const scheduleThumbnailCacheCleanup = () => {
  if (thumbnailCacheCleanupPromise) {
    return thumbnailCacheCleanupPromise;
  }

  thumbnailCacheCleanupPromise = cleanupThumbnailCache().finally(() => {
    thumbnailCacheCleanupPromise = null;
  });

  return thumbnailCacheCleanupPromise;
};

export const cacheExcalidrawThumbnail = async (
  cacheKey: string,
  thumbnail: CachedThumbnailState,
) => {
  const record: StoredThumbnailRecord = {
    ...thumbnail,
    updatedAt: Date.now(),
  };

  thumbnailMemoryCache.set(cacheKey, record);

  const db = await openThumbnailCacheDb();
  if (!db) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readwrite");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      store.put(record, cacheKey);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } finally {
    db.close();
  }

  void scheduleThumbnailCacheCleanup();
};

export const createExcalidrawThumbnailUrl = async (
  blob: Blob | File,
): Promise<string | null> => {
  const scene = await loadFromBlob(blob, null, null);
  const elements = getNonDeletedElements(scene.elements);

  if (!elements.length) {
    return null;
  }

  const svg = await exportToSvg({
    elements,
    appState: {
      exportBackground: true,
      viewBackgroundColor:
        scene.appState.viewBackgroundColor || THUMBNAIL_BACKGROUND,
    },
    exportPadding: 24,
    files: scene.files,
  });

  svg.querySelector(".style-fonts")?.remove();
  return svg.outerHTML;
};

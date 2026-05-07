import JSZip from "jszip";

import {
  downloadGoogleDriveFile,
  listGoogleDriveFolderChildren,
} from "./data/googleDrive";
import { listLocalFolderChildren, readLocalFile } from "./data/localDirectory";

import type { LocalDirectoryFolder } from "./data/localDirectory";
import type { WorkspaceFolderNode } from "./types";

const INVALID_ZIP_SEGMENT = /[/\\:*?"<>|]/g;

export const sanitizeZipPathSegment = (name: string) => {
  const cleaned = name
    .replace(INVALID_ZIP_SEGMENT, "_")
    .replace(/^\s+|\s+$/g, "")
    .trim();
  return cleaned || "untitled";
};

const mapPool = async <T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) {
        return;
      }
      results[i] = await mapper(items[i]!);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};

const addLocalSubtree = async (
  zip: JSZip,
  folder: LocalDirectoryFolder,
  pathPrefix: string,
  downloadConcurrency: number,
) => {
  const { folders, files } = await listLocalFolderChildren(folder);

  await mapPool(files, downloadConcurrency, async (file) => {
    const rel = `${pathPrefix}${sanitizeZipPathSegment(file.name)}`;
    const blob = await readLocalFile(file);
    zip.file(rel, await blob.arrayBuffer());
  });

  for (const sub of folders) {
    const nextPrefix = `${pathPrefix}${sanitizeZipPathSegment(sub.name)}/`;
    await addLocalSubtree(zip, sub, nextPrefix, downloadConcurrency);
  }
};

const addGoogleDriveSubtree = async (
  zip: JSZip,
  folderId: string,
  pathPrefix: string,
  downloadConcurrency: number,
) => {
  const { folders, files } = await listGoogleDriveFolderChildren(folderId);

  await mapPool(files, downloadConcurrency, async (file) => {
    const rel = `${pathPrefix}${sanitizeZipPathSegment(file.name)}`;
    const downloaded = await downloadGoogleDriveFile(
      file.id,
      file.name,
      file.mimeType,
    );
    zip.file(rel, await downloaded.arrayBuffer());
  });

  for (const sub of folders) {
    const nextPrefix = `${pathPrefix}${sanitizeZipPathSegment(sub.name)}/`;
    await addGoogleDriveSubtree(zip, sub.id, nextPrefix, downloadConcurrency);
  }
};

export const exportWorkspaceTreeToZip = async (
  root: WorkspaceFolderNode,
  options?: { downloadConcurrency?: number },
) => {
  const zip = new JSZip();
  const rootSeg = sanitizeZipPathSegment(root.name);
  const prefix = `${rootSeg}/`;
  const concurrency = options?.downloadConcurrency ?? 4;

  if (root.provider === "local") {
    await addLocalSubtree(
      zip,
      root.data as LocalDirectoryFolder,
      prefix,
      concurrency,
    );
  } else {
    await addGoogleDriveSubtree(zip, root.rawId, prefix, concurrency);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `${rootSeg}-excalidraw-workspace.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

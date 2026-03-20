import { MIME_TYPES } from "@excalidraw/common";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

export type CloudProviderKind = "gdrive" | "dropbox" | "local";

export type CloudFileRef = {
  provider: CloudProviderKind;
  fileId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  revision?: string;
  path?: string;
  fileHandle?: FileSystemFileHandle | null;
  directoryHandle?: FileSystemDirectoryHandle | null;
};

export type BackupTarget = {
  provider: CloudProviderKind;
  folderId: string;
  enabled: boolean;
  label?: string;
};

export type SaveProfile = {
  primary: CloudFileRef | null;
  backups: BackupTarget[];
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
};

export const DEFAULT_SAVE_PROFILE: SaveProfile = {
  primary: null,
  backups: [],
  autosaveEnabled: true,
  autosaveIntervalMs: 60_000,
};

export const normalizeExcalidrawFileName = (name: string) => {
  const trimmed = name.trim() || "Untitled";
  return trimmed.toLowerCase().endsWith(".excalidraw")
    ? trimmed
    : `${trimmed}.excalidraw`;
};

export const buildExcalidrawBlob = ({
  elements,
  appState,
  files,
}: {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}) => {
  const serialized = serializeAsJSON(elements, appState, files, "local");
  return new Blob([serialized], {
    type: MIME_TYPES.excalidraw,
  });
};

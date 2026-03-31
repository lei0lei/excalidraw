import type { GoogleDriveFile, GoogleDriveFolder } from "./data/googleDrive";
import type {
  LocalDirectoryFile,
  LocalDirectoryFolder,
} from "./data/localDirectory";

export type BackendId = "google-drive" | "local";

export type WorkspaceFolderNode = {
  provider: BackendId;
  id: string;
  rawId: string;
  name: string;
  parentId: string | null;
  modifiedTime?: string;
  data: GoogleDriveFolder | LocalDirectoryFolder;
};

export type WorkspaceFileNode = {
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

export type WorkspaceThumbnailState = {
  cacheKey: string;
  status: "pending" | "loading" | "ready" | "empty" | "error";
  svg: string | null;
};

export type WorkspaceTextDialogKind =
  | "new-folder"
  | "new-file"
  | "rename-file"
  | "rename-folder";

export type WorkspaceTextDialogState = {
  kind: WorkspaceTextDialogKind;
  title: string;
  initialValue: string;
  submitLabel: string;
  inputLabel?: string;
};

export type PendingAction =
  | "connect-drive"
  | "pick-root"
  | "create-folder"
  | "create-file"
  | "rename"
  | "delete"
  | "open-file"
  | "open-folder"
  | null;

export type WorkspaceErrorKind = "recoverable" | "blocking";

export type WorkspaceErrorAction = "retry" | "reconnect" | null;

export type WorkspaceErrorState = {
  kind: WorkspaceErrorKind;
  message: string;
  action: WorkspaceErrorAction;
} | null;

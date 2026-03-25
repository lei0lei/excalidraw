export type LocalDirectoryFolder = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  directoryHandle: FileSystemDirectoryHandle;
  parentDirectoryHandle: FileSystemDirectoryHandle | null;
  modifiedTime?: string;
};

export type LocalDirectoryFile = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  mimeType: string;
  modifiedTime?: string;
  isExcalidrawFile: boolean;
  fileHandle: FileSystemFileHandle;
  directoryHandle: FileSystemDirectoryHandle;
  parentDirectoryHandle: FileSystemDirectoryHandle;
};

const LOCAL_ROOT_ID = "local:/";
const LOCAL_ROOT_DB_NAME = "excalidraw-workspace-local-root";
const LOCAL_ROOT_STORE_NAME = "handles";
const LOCAL_ROOT_STORE_KEY = "root";

let storedLocalRootFolder: LocalDirectoryFolder | null = null;

const openLocalRootDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_ROOT_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_ROOT_STORE_NAME)) {
        database.createObjectStore(LOCAL_ROOT_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open local root storage."));
  });

const persistLocalRootHandle = async (
  handle: FileSystemDirectoryHandle | null,
) => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }

  const database = await openLocalRootDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      LOCAL_ROOT_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(LOCAL_ROOT_STORE_NAME);

    if (handle) {
      store.put(handle, LOCAL_ROOT_STORE_KEY);
    } else {
      store.delete(LOCAL_ROOT_STORE_KEY);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error("Failed to persist the local root folder handle."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ||
          new Error("Persisting the local root folder handle was aborted."),
      );
  });

  database.close();
};

const readPersistedLocalRootHandle = async () => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return null;
  }

  const database = await openLocalRootDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>(
    (resolve, reject) => {
      const transaction = database.transaction(
        LOCAL_ROOT_STORE_NAME,
        "readonly",
      );
      const store = transaction.objectStore(LOCAL_ROOT_STORE_NAME);
      const request = store.get(LOCAL_ROOT_STORE_KEY);

      request.onsuccess = () =>
        resolve(
          (request.result as FileSystemDirectoryHandle | undefined) || null,
        );
      request.onerror = () =>
        reject(
          request.error ||
            new Error("Failed to read the persisted local root folder handle."),
        );
    },
  );
  database.close();
  return handle;
};

const getDirectoryPermissionState = async (
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState | "unknown"> => {
  if (typeof (handle as any).queryPermission !== "function") {
    return "unknown";
  }

  return (handle as any).queryPermission({ mode: "readwrite" });
};

const toLocalId = (path: string) =>
  path ? `local:/${path.replace(/\\/g, "/")}` : LOCAL_ROOT_ID;

const joinPath = (parentPath: string, name: string) =>
  parentPath ? `${parentPath}/${name}` : name;

const toLocalFolder = ({
  directoryHandle,
  parent,
}: {
  directoryHandle: FileSystemDirectoryHandle;
  parent: LocalDirectoryFolder | null;
}): LocalDirectoryFolder => {
  const path = parent ? joinPath(parent.path, directoryHandle.name) : "";
  return {
    id: toLocalId(path),
    name: directoryHandle.name,
    parentId: parent?.id ?? null,
    path,
    directoryHandle,
    parentDirectoryHandle: parent?.directoryHandle ?? null,
  };
};

const toLocalFile = async ({
  fileHandle,
  parent,
}: {
  fileHandle: FileSystemFileHandle;
  parent: LocalDirectoryFolder;
}): Promise<LocalDirectoryFile> => {
  const file = await fileHandle.getFile();
  const path = joinPath(parent.path, fileHandle.name);

  return {
    id: toLocalId(path),
    name: fileHandle.name,
    parentId: parent.id,
    path,
    mimeType: file.type || "application/octet-stream",
    modifiedTime: file.lastModified
      ? new Date(file.lastModified).toISOString()
      : undefined,
    isExcalidrawFile:
      file.type === "application/vnd.excalidraw+json" ||
      fileHandle.name.toLowerCase().endsWith(".excalidraw"),
    fileHandle,
    directoryHandle: parent.directoryHandle,
    parentDirectoryHandle: parent.directoryHandle,
  };
};

export const isLocalDirectoryAccessSupported = () => {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
};

export const getStoredLocalRootFolder = () => storedLocalRootFolder;

export const restoreStoredLocalRootFolder = async () => {
  if (storedLocalRootFolder) {
    return storedLocalRootFolder;
  }

  if (!isLocalDirectoryAccessSupported()) {
    return null;
  }

  const directoryHandle = await readPersistedLocalRootHandle();
  if (!directoryHandle) {
    return null;
  }

  const permissionState = await getDirectoryPermissionState(directoryHandle);
  if (permissionState === "denied") {
    await persistLocalRootHandle(null);
    return null;
  }

  const rootFolder = toLocalFolder({ directoryHandle, parent: null });
  storedLocalRootFolder = rootFolder;
  return rootFolder;
};

export const pickLocalRootFolder =
  async (): Promise<LocalDirectoryFolder | null> => {
    if (!isLocalDirectoryAccessSupported()) {
      throw new Error("This browser does not support local directory access.");
    }

    const directoryHandle = await window.showDirectoryPicker?.({
      mode: "readwrite",
    });
    if (!directoryHandle) {
      return null;
    }
    const rootFolder = toLocalFolder({ directoryHandle, parent: null });
    storedLocalRootFolder = rootFolder;
    await persistLocalRootHandle(directoryHandle);
    return rootFolder;
  };

export const listLocalFolderChildren = async (
  folder: LocalDirectoryFolder,
): Promise<{
  folders: LocalDirectoryFolder[];
  files: LocalDirectoryFile[];
}> => {
  const folders: LocalDirectoryFolder[] = [];
  const files: LocalDirectoryFile[] = [];

  for await (const entry of (folder.directoryHandle as any).values()) {
    if (entry.kind === "directory") {
      folders.push(
        toLocalFolder({
          directoryHandle: entry as FileSystemDirectoryHandle,
          parent: folder,
        }),
      );
      continue;
    }

    files.push(
      await toLocalFile({
        fileHandle: entry as FileSystemFileHandle,
        parent: folder,
      }),
    );
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { folders, files };
};

export const readLocalFile = async (file: LocalDirectoryFile) => {
  const rawFile = await file.fileHandle.getFile();
  return new File([rawFile], file.name, {
    type: rawFile.type || file.mimeType,
    lastModified: rawFile.lastModified,
  });
};

export const createLocalFolder = async ({
  parentFolder,
  name,
}: {
  parentFolder: LocalDirectoryFolder;
  name: string;
}) => {
  const directoryHandle = await parentFolder.directoryHandle.getDirectoryHandle(
    name,
    { create: true },
  );

  return toLocalFolder({
    directoryHandle,
    parent: parentFolder,
  });
};

export const createLocalFile = async ({
  parentFolder,
  name,
  blob,
}: {
  parentFolder: LocalDirectoryFolder;
  name: string;
  blob: Blob;
}) => {
  const fileHandle = await parentFolder.directoryHandle.getFileHandle(name, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return toLocalFile({
    fileHandle,
    parent: parentFolder,
  });
};

export const updateLocalFile = async ({
  file,
  blob,
}: {
  file: LocalDirectoryFile;
  blob: Blob;
}) => {
  const writable = await file.fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return toLocalFile({
    fileHandle: file.fileHandle,
    parent: {
      id: file.parentId || LOCAL_ROOT_ID,
      name: file.directoryHandle.name,
      parentId: null,
      path: file.path.split("/").slice(0, -1).join("/"),
      directoryHandle: file.directoryHandle,
      parentDirectoryHandle: file.parentDirectoryHandle,
    },
  });
};

export const getLocalFileMetadata = async ({
  fileHandle,
  name,
  parentId,
  path,
  directoryHandle,
  parentDirectoryHandle,
}: {
  fileHandle: FileSystemFileHandle;
  name: string;
  parentId: string | null;
  path: string;
  directoryHandle: FileSystemDirectoryHandle;
  parentDirectoryHandle: FileSystemDirectoryHandle;
}) => {
  const parentPath = path.split("/").slice(0, -1).join("/");

  return toLocalFile({
    fileHandle,
    parent: {
      id: parentId || LOCAL_ROOT_ID,
      name: directoryHandle.name,
      parentId: null,
      path: parentPath,
      directoryHandle,
      parentDirectoryHandle,
    },
  });
};

export const renameLocalFile = async ({
  file,
  name,
}: {
  file: LocalDirectoryFile;
  name: string;
}) => {
  if (file.name === name) {
    return file;
  }

  const sourceFile = await file.fileHandle.getFile();
  const fileHandle = await file.directoryHandle.getFileHandle(name, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(sourceFile);
  await writable.close();

  await file.parentDirectoryHandle.removeEntry(file.name);

  return toLocalFile({
    fileHandle,
    parent: {
      id: file.parentId || LOCAL_ROOT_ID,
      name: file.directoryHandle.name,
      parentId: null,
      path: file.path.split("/").slice(0, -1).join("/"),
      directoryHandle: file.directoryHandle,
      parentDirectoryHandle: file.parentDirectoryHandle,
    },
  });
};

const copyLocalDirectoryContents = async ({
  source,
  destination,
}: {
  source: FileSystemDirectoryHandle;
  destination: FileSystemDirectoryHandle;
}) => {
  for await (const entry of (source as any).values()) {
    if (entry.kind === "directory") {
      const nextDestination = await destination.getDirectoryHandle(entry.name, {
        create: true,
      });
      await copyLocalDirectoryContents({
        source: entry as FileSystemDirectoryHandle,
        destination: nextDestination,
      });
      continue;
    }

    const sourceFile = await (entry as FileSystemFileHandle).getFile();
    const nextFileHandle = await destination.getFileHandle(entry.name, {
      create: true,
    });
    const writable = await nextFileHandle.createWritable();
    await writable.write(sourceFile);
    await writable.close();
  }
};

export const renameLocalFolder = async ({
  folder,
  name,
}: {
  folder: LocalDirectoryFolder;
  name: string;
}) => {
  if (!folder.parentDirectoryHandle) {
    throw new Error("Cannot rename the local root folder.");
  }

  if (folder.name === name) {
    return folder;
  }

  const parentPath = folder.path.split("/").slice(0, -1).join("/");
  const nextDirectoryHandle =
    await folder.parentDirectoryHandle.getDirectoryHandle(name, {
      create: true,
    });

  await copyLocalDirectoryContents({
    source: folder.directoryHandle,
    destination: nextDirectoryHandle,
  });

  await folder.parentDirectoryHandle.removeEntry(folder.name, {
    recursive: true,
  });

  return {
    id: toLocalId(parentPath ? `${parentPath}/${name}` : name),
    name,
    parentId: folder.parentId,
    path: parentPath ? `${parentPath}/${name}` : name,
    directoryHandle: nextDirectoryHandle,
    parentDirectoryHandle: folder.parentDirectoryHandle,
    modifiedTime: new Date().toISOString(),
  };
};

export const deleteLocalEntry = async (
  entry: LocalDirectoryFile | LocalDirectoryFolder,
) => {
  if (!entry.parentId) {
    throw new Error("Cannot delete the local root folder.");
  }

  const parentHandle = entry.parentDirectoryHandle;

  if (
    !parentHandle ||
    typeof (parentHandle as any).removeEntry !== "function"
  ) {
    throw new Error(
      "This browser does not support deleting entries from a local directory.",
    );
  }

  await (parentHandle as any).removeEntry(entry.name, {
    recursive: !("fileHandle" in entry),
  });
};

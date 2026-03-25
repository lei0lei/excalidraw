export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder" as const;

export type GoogleDriveRootFolder = {
  id: string;
  name: string;
};

export type GoogleDriveFolder = {
  id: string;
  name: string;
  mimeType: typeof GOOGLE_DRIVE_FOLDER_MIME_TYPE;
  modifiedTime?: string;
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parentId: string | null;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
  isExcalidrawFile: boolean;
};

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_API_SCRIPT = "https://apis.google.com/js/api.js";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const ROOT_FOLDER_STORAGE_KEY = "excalidraw-workspace-google-root-folder";
const ACCESS_TOKEN_STORAGE_KEY = "excalidraw-workspace-google-access-token";
const ACCESS_TOKEN_EXPIRY_STORAGE_KEY =
  "excalidraw-workspace-google-access-token-expiry";

let googleIdentityScriptPromise: Promise<void> | null = null;
let googleApiScriptPromise: Promise<void> | null = null;
let googlePickerModulePromise: Promise<void> | null = null;
let tokenClientPromise: Promise<any> | null = null;
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let hasRestoredStoredAccessToken = false;

const GOOGLE_DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_SCRIPT_LOAD_TIMEOUT_MS = 15000;

const toFriendlyScriptLoadError = (src: string) => {
  if (src.includes("accounts.google.com") || src.includes("apis.google.com")) {
    return new Error(
      "Failed to load Google script. Please check whether Google domains are reachable, and disable ad blockers or privacy extensions for this site.",
    );
  }

  return new Error(`Failed to load script: ${src}`);
};

const loadScript = (src: string) => {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );

    if (existingScript?.dataset.loaded === "true") {
      resolve();
      return;
    }

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    let isSettled = false;
    const timeout = window.setTimeout(() => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      script.remove();
      reject(toFriendlyScriptLoadError(src));
    }, GOOGLE_SCRIPT_LOAD_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      window.clearTimeout(timeout);
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      window.clearTimeout(timeout);
      script.remove();
      reject(toFriendlyScriptLoadError(src));
    };
    document.head.appendChild(script);
  });
};

const loadGoogleIdentityScript = () => {
  if (!googleIdentityScriptPromise) {
    googleIdentityScriptPromise = loadScript(GOOGLE_IDENTITY_SCRIPT).catch(
      (error) => {
        googleIdentityScriptPromise = null;
        throw error;
      },
    );
  }
  return googleIdentityScriptPromise;
};

const loadGoogleApiScript = () => {
  if (!googleApiScriptPromise) {
    googleApiScriptPromise = loadScript(GOOGLE_API_SCRIPT).catch((error) => {
      googleApiScriptPromise = null;
      throw error;
    });
  }
  return googleApiScriptPromise;
};

const getGoogleDriveConfig = () => {
  return {
    clientId: import.meta.env.VITE_APP_GOOGLE_CLIENT_ID,
    apiKey: import.meta.env.VITE_APP_GOOGLE_API_KEY,
    appId: import.meta.env.VITE_APP_GOOGLE_APP_ID,
  };
};

const clearStoredAccessToken = () => {
  accessToken = null;
  accessTokenExpiresAt = 0;

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_EXPIRY_STORAGE_KEY);
};

const storeAccessToken = (token: string, expiresAt: number) => {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(
    ACCESS_TOKEN_EXPIRY_STORAGE_KEY,
    expiresAt.toString(),
  );
};

const restoreStoredAccessToken = () => {
  if (hasRestoredStoredAccessToken || typeof window === "undefined") {
    return;
  }

  hasRestoredStoredAccessToken = true;

  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  const storedExpiry = Number.parseInt(
    window.localStorage.getItem(ACCESS_TOKEN_EXPIRY_STORAGE_KEY) || "",
    10,
  );

  if (!storedToken || !Number.isFinite(storedExpiry)) {
    clearStoredAccessToken();
    return;
  }

  if (Date.now() >= storedExpiry) {
    clearStoredAccessToken();
    return;
  }

  accessToken = storedToken;
  accessTokenExpiresAt = storedExpiry;
};

export const getMissingGoogleDriveEnvVars = () => {
  const { clientId, apiKey, appId } = getGoogleDriveConfig();
  return [
    !clientId && "VITE_APP_GOOGLE_CLIENT_ID",
    !apiKey && "VITE_APP_GOOGLE_API_KEY",
    !appId && "VITE_APP_GOOGLE_APP_ID",
  ].filter(Boolean) as string[];
};

const assertGoogleDriveConfig = () => {
  const missingVars = getMissingGoogleDriveEnvVars();
  if (missingVars.length) {
    throw new Error(
      `Missing Google Drive config: ${missingVars.join(", ")}. ` +
        `Please set them in your .env file before using Workspace.`,
    );
  }
  return getGoogleDriveConfig();
};

const ensureTokenClient = async () => {
  if (!tokenClientPromise) {
    tokenClientPromise = (async () => {
      const { clientId } = assertGoogleDriveConfig();
      await loadGoogleIdentityScript();

      if (!window.google?.accounts?.oauth2) {
        throw new Error("Google Identity Services failed to initialize.");
      }

      return window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: () => undefined,
        error_callback: (error: { message?: string }) => {
          console.error("Google Drive auth error:", error);
        },
      });
    })();
  }

  return tokenClientPromise;
};

const ensurePickerModule = async () => {
  if (!googlePickerModulePromise) {
    googlePickerModulePromise = (async () => {
      await loadGoogleApiScript();

      if (!window.gapi?.load) {
        throw new Error("Google API client failed to initialize.");
      }

      await new Promise<void>((resolve, reject) => {
        try {
          window.gapi.load("picker", {
            callback: () => resolve(),
            onerror: () =>
              reject(new Error("Google Picker failed to initialize.")),
          });
        } catch (error) {
          reject(error);
        }
      });
    })();
  }

  return googlePickerModulePromise;
};

const requestAccessToken = async ({
  prompt = "",
  interactive = false,
}: {
  prompt?: "" | "consent";
  interactive?: boolean;
} = {}) => {
  restoreStoredAccessToken();

  if (accessToken && Date.now() < accessTokenExpiresAt) {
    return accessToken;
  }

  if (!interactive) {
    throw new Error("Google Drive is not connected. Please connect first.");
  }

  const tokenClient = await ensureTokenClient();

  return new Promise<string>((resolve, reject) => {
    tokenClient.callback = (response: {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    }) => {
      if (response.error || !response.access_token) {
        clearStoredAccessToken();
        reject(
          new Error(
            response.error_description ||
              response.error ||
              "Failed to acquire Google Drive access token.",
          ),
        );
        return;
      }

      const expiresAt =
        Date.now() + Math.max((response.expires_in ?? 3600) - 60, 60) * 1000;
      storeAccessToken(response.access_token, expiresAt);
      resolve(response.access_token);
    };

    tokenClient.requestAccessToken({ prompt });
  });
};

export const connectGoogleDrive = async () => {
  await requestAccessToken({ prompt: "consent", interactive: true });
};

export const getGoogleDriveAccessToken = async () => {
  return requestAccessToken({ prompt: "", interactive: false });
};

export const hasStoredGoogleDriveAccessToken = () => {
  restoreStoredAccessToken();
  return !!accessToken && Date.now() < accessTokenExpiresAt;
};

const escapeGoogleDriveQueryValue = (value: string) =>
  value.replace(/'/g, "\\'");

const parseGoogleDriveError = async (response: Response) => {
  let detailedMessage = `${response.status} ${response.statusText}`;

  try {
    const errorBody = (await response.json()) as {
      error?: {
        code?: number;
        message?: string;
        errors?: Array<{
          reason?: string;
          message?: string;
        }>;
      };
    };

    const reason = errorBody.error?.errors?.[0]?.reason;
    const message =
      errorBody.error?.errors?.[0]?.message || errorBody.error?.message;

    if (reason || message) {
      detailedMessage = [reason, message].filter(Boolean).join(": ");
    }
  } catch {
    // ignore JSON parse failures and keep the HTTP status text fallback
  }

  return detailedMessage;
};

const fetchGoogleDriveJson = async <T>(
  input: string,
  init?: RequestInit,
): Promise<T> => {
  const token = await getGoogleDriveAccessToken();
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive request failed: ${await parseGoogleDriveError(response)}`,
    );
  }

  return response.json() as Promise<T>;
};

export const listGoogleDriveFolderChildren = async (
  folderId: string,
): Promise<{
  folders: GoogleDriveFolder[];
  files: GoogleDriveFile[];
}> => {
  const query = [
    `'${escapeGoogleDriveQueryValue(folderId)}' in parents`,
    "trashed = false",
  ].join(" and ");

  const url = new URL(GOOGLE_DRIVE_FILES_API);
  url.searchParams.set("q", query);
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,modifiedTime,thumbnailLink,iconLink)",
  );
  url.searchParams.set("pageSize", "200");
  url.searchParams.set("orderBy", "folder,name_natural");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const data = await fetchGoogleDriveJson<{
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      thumbnailLink?: string;
      iconLink?: string;
    }>;
  }>(url.toString());

  const entries = data.files ?? [];

  const folders = entries
    .filter((entry) => entry.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      modifiedTime: entry.modifiedTime,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = entries
    .filter((entry) => entry.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      mimeType: entry.mimeType,
      parentId: folderId,
      modifiedTime: entry.modifiedTime,
      thumbnailLink: entry.thumbnailLink,
      iconLink: entry.iconLink,
      isExcalidrawFile:
        entry.mimeType === "application/vnd.excalidraw+json" ||
        entry.name.toLowerCase().endsWith(".excalidraw"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { folders, files };
};

export const downloadGoogleDriveFile = async (
  fileId: string,
  fileName: string,
  mimeType = "application/octet-stream",
) => {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(`${GOOGLE_DRIVE_FILES_API}/${fileId}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download Google Drive file: ${await parseGoogleDriveError(
        response,
      )}`,
    );
  }

  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || mimeType,
  });
};

const uploadGoogleDriveFile = async ({
  method,
  fileId,
  metadata,
  blob,
}: {
  method: "POST" | "PATCH";
  fileId?: string;
  metadata: Record<string, unknown>;
  blob: Blob;
}) => {
  const token = await getGoogleDriveAccessToken();
  const boundary = `-------excalidraw-${Date.now().toString(16)}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = new Blob([
    delimiter,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
    blob,
    closeDelimiter,
  ]);

  const url = new URL(
    fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}`
      : "https://www.googleapis.com/upload/drive/v3/files",
  );
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,parents");

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive upload failed: ${await parseGoogleDriveError(response)}`,
    );
  }

  return response.json() as Promise<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    parents?: string[];
  }>;
};

export const createGoogleDriveFile = async ({
  folderId,
  name,
  blob,
  mimeType = "application/vnd.excalidraw+json",
}: {
  folderId: string;
  name: string;
  blob: Blob;
  mimeType?: string;
}) => {
  return uploadGoogleDriveFile({
    method: "POST",
    metadata: {
      name,
      parents: [folderId],
      mimeType,
    },
    blob,
  });
};

export const createGoogleDriveFolder = async ({
  parentId,
  name,
}: {
  parentId: string;
  name: string;
}) => {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(GOOGLE_DRIVE_FILES_API);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      name,
      parents: [parentId],
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive create folder failed: ${await parseGoogleDriveError(
        response,
      )}`,
    );
  }

  return response.json() as Promise<GoogleDriveFolder>;
};

export const renameGoogleDriveEntry = async ({
  entryId,
  name,
}: {
  entryId: string;
  name: string;
}) => {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(`${GOOGLE_DRIVE_FILES_API}/${entryId}`);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,parents");

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive rename failed: ${await parseGoogleDriveError(response)}`,
    );
  }

  return response.json() as Promise<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    parents?: string[];
  }>;
};

export const deleteGoogleDriveEntry = async (entryId: string) => {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(`${GOOGLE_DRIVE_FILES_API}/${entryId}`);
  url.searchParams.set("supportsAllDrives", "true");

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive delete failed: ${await parseGoogleDriveError(response)}`,
    );
  }
};

export const updateGoogleDriveFile = async ({
  fileId,
  name,
  blob,
  mimeType = "application/vnd.excalidraw+json",
}: {
  fileId: string;
  name?: string;
  blob: Blob;
  mimeType?: string;
}) => {
  return uploadGoogleDriveFile({
    method: "PATCH",
    fileId,
    metadata: {
      ...(name ? { name } : {}),
      mimeType,
    },
    blob,
  });
};

export const getGoogleDriveFileMetadata = async (fileId: string) => {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(`${GOOGLE_DRIVE_FILES_API}/${fileId}`);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,parents");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google Drive metadata request failed: ${await parseGoogleDriveError(
        response,
      )}`,
    );
  }

  return response.json() as Promise<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    parents?: string[];
  }>;
};

export const pickGoogleDriveRootFolder =
  async (): Promise<GoogleDriveRootFolder | null> => {
    const { apiKey, appId } = assertGoogleDriveConfig();
    const token = await getGoogleDriveAccessToken();
    await ensurePickerModule();

    if (!window.google?.picker) {
      throw new Error("Google Picker is unavailable.");
    }

    return new Promise<GoogleDriveRootFolder | null>((resolve) => {
      const { picker } = window.google;
      const docsView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const pickerBuilder = new picker.PickerBuilder()
        .setDeveloperKey(apiKey)
        .setOAuthToken(token)
        .setTitle("Select a Google Drive folder")
        .addView(docsView)
        .setCallback(
          (data: { action?: string; docs?: Array<Record<string, string>> }) => {
            if (data.action === picker.Action.PICKED && data.docs?.[0]) {
              const doc = data.docs[0];
              resolve({
                id: doc[picker.Document.ID] || doc.id,
                name:
                  doc[picker.Document.NAME] || doc.name || "Untitled folder",
              });
              return;
            }

            if (data.action === picker.Action.CANCEL) {
              resolve(null);
            }
          },
        );

      if (appId) {
        pickerBuilder.setAppId(appId);
      }

      pickerBuilder.build().setVisible(true);
    });
  };

export const getStoredGoogleDriveRootFolder = () => {
  try {
    const raw = window.localStorage.getItem(ROOT_FOLDER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as GoogleDriveRootFolder;
  } catch (error) {
    console.warn("Failed to parse stored Google Drive root folder:", error);
    return null;
  }
};

export const storeGoogleDriveRootFolder = (
  folder: GoogleDriveRootFolder | null,
) => {
  if (!folder) {
    window.localStorage.removeItem(ROOT_FOLDER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ROOT_FOLDER_STORAGE_KEY, JSON.stringify(folder));
};

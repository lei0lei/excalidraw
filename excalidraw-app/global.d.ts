import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

declare global {
  interface Window {
    __EXCALIDRAW_SHA__: string | undefined;
    google?: any;
    gapi?: any;
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};

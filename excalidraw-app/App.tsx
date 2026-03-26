import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  usersIcon,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import {
  isEmbeddableElement,
  isInitializedImageElement,
  newElementWith,
  newEmbeddableElement,
} from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";
import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  ExcalidrawEmbeddableElement,
  ExcalidrawElement,
  FileId,
  NonDeleted,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { CodeBlockDialog } from "./components/CodeBlockDialog";
import { CodeBlockEmbeddable } from "./components/CodeBlockEmbeddable";
import { MathFormulaEmbeddable } from "./components/MathFormulaEmbeddable";
import { MathFormulaDialog } from "./components/MathFormulaDialog";
import { TemplateLibraryDialog } from "./components/TemplateLibraryDialog";

import "./index.scss";

import { AppSidebar } from "./components/AppSidebar";
import { WorkspacePage } from "./workspace/WorkspacePage";
import {
  createGoogleDriveFile,
  downloadGoogleDriveFile,
  getGoogleDriveFileMetadata,
  pickGoogleDriveRootFolder,
  updateGoogleDriveFile,
} from "./workspace/data/googleDrive";
import {
  createLocalFile,
  getLocalFileMetadata,
  getStoredLocalRootFolder,
  pickLocalRootFolder,
  readLocalFile,
  updateLocalFile,
} from "./workspace/data/localDirectory";
import {
  buildExcalidrawBlob,
  normalizeExcalidrawFileName,
} from "./workspace/data/saveManager";
import {
  measureCodeBlockDimensions,
  normalizeCodeBlockStyle,
  type CodeBlockStyle,
} from "./code/codeBlock";
import {
  createMathFormulaAsset,
  measureMathFormulaDimensions,
  normalizeMathFormulaStyle,
  type MathFormulaStyle,
} from "./math/formula";
import {
  createDefaultUmlClassTemplateData,
  createUmlClassTemplate,
  getUmlClassTemplateData,
  getUmlClassTemplateLayoutSignature,
  getUmlClassTemplateRootId,
  resolveSelectedUmlClassTemplateRootWithMap,
  syncUmlClassTemplateLayoutInSceneWithMap,
  updateUmlClassTemplateInScene,
  type UmlClassTemplateData,
  type UmlClassTemplatePreset,
} from "./templates/umlClass";
import {
  createUmlDiagramTemplate,
  getUmlDiagramTemplateData,
  getUmlDiagramTemplateLayoutSignature,
  getUmlDiagramTemplateRootId,
  isEditableUmlDiagramTemplatePreset,
  resolveSelectedUmlDiagramTemplateRootWithMap,
  syncUmlDiagramTemplateLayoutInSceneWithMap,
  updateUmlDiagramTemplateInScene,
  type UmlDiagramTemplateData,
  type UmlDiagramTemplatePreset,
} from "./templates/umlDiagram";

import type { CollabAPI } from "./collab/Collab";
import type { GoogleDriveFile } from "./workspace/data/googleDrive";
import type {
  LocalDirectoryFile,
  LocalDirectoryFolder,
} from "./workspace/data/localDirectory";
import type { CloudFileRef } from "./workspace/data/saveManager";

type MathFormulaDialogState = {
  mode: "insert" | "edit";
  initialValue?: string;
  initialStyle?: MathFormulaStyle;
  sceneX?: number;
  sceneY?: number;
  toolLocked?: boolean;
  targetElementId?: string;
};

type CodeBlockDialogState = {
  mode: "insert" | "edit";
  initialValue?: string;
  initialStyle?: CodeBlockStyle;
  sceneX?: number;
  sceneY?: number;
  toolLocked?: boolean;
  targetElementId?: string;
};

type SaveIndicatorStatus =
  | "idle"
  | "unsaved"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

const areUmlClassTemplateDataEqual = (
  left: UmlClassTemplateData | null,
  right: UmlClassTemplateData | null,
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const serializeMembers = (items: UmlClassTemplateData["attributes"]) =>
    items.map((item) => item.text).join("\n");

  return (
    left.name === right.name &&
    (left.stereotype || "") === (right.stereotype || "") &&
    serializeMembers(left.attributes) === serializeMembers(right.attributes) &&
    serializeMembers(left.methods) === serializeMembers(right.methods)
  );
};

const areUmlDiagramTemplateDataEqual = (
  left: UmlDiagramTemplateData | null,
  right: UmlDiagramTemplateData | null,
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.preset === right.preset &&
    left.label === right.label &&
    (left.body || "") === (right.body || "")
  );
};

const getSelectedElementIdsSignature = (
  selectedElementIds: AppState["selectedElementIds"] | null | undefined,
) =>
  Object.keys(selectedElementIds || {})
    .filter((elementId) => selectedElementIds?.[elementId])
    .sort()
    .join("|");

const serializeUmlClassTemplateData = (data: UmlClassTemplateData | null) => {
  if (!data) {
    return "";
  }

  return [
    data.name,
    data.stereotype || "",
    data.attributes.map((item) => item.text).join("\n"),
    data.methods.map((item) => item.text).join("\n"),
  ].join("::");
};

const serializeUmlDiagramTemplateData = (
  data: UmlDiagramTemplateData | null,
) => {
  if (!data) {
    return "";
  }

  return [data.preset, data.label, data.body || ""].join("::");
};

const buildUmlSelectionSignature = (
  selectedIdsSignature: string,
  rootId: string | null,
  dataSignature: string,
) => [selectedIdsSignature, rootId || "", dataSignature].join("##");

const pruneSignatureCache = (
  cache: Map<string, string>,
  elementsById: ReadonlyMap<string, ExcalidrawElement>,
) => {
  for (const rootId of cache.keys()) {
    if (!elementsById.has(rootId)) {
      cache.delete(rootId);
    }
  }
};

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;
const pwaInstallStateListeners = new Set<() => void>();

const WorkspaceExplorerIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4.75h14a1.75 1.75 0 0 1 1.75 1.75v11a1.75 1.75 0 0 1-1.75 1.75H5A1.75 1.75 0 0 1 3.25 17.5v-11A1.75 1.75 0 0 1 5 4.75Z" />
      <path d="M8.5 4.75v14.5" />
      <path d="M11.75 9h5" />
      <path d="M11.75 12.5h5" />
      <path d="M11.75 16h3.25" />
    </g>
  </svg>
);

const WorkspaceEntryTrigger = ({
  onOpenWorkspace,
}: {
  onOpenWorkspace: () => void;
}) => {
  const { MainMenuTunnel } = useTunnels();
  const editorInterface = useEditorInterface();

  if (editorInterface.formFactor === "phone") {
    return null;
  }

  return (
    <MainMenuTunnel.In>
      <button
        type="button"
        className="dropdown-menu-button main-menu-trigger workspace-canvas-trigger"
        title="Open workspace"
        aria-label="Open workspace"
        onClick={onOpenWorkspace}
      >
        {WorkspaceExplorerIcon}
      </button>
    </MainMenuTunnel.In>
  );
};

const isPWAInstalled = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
};

const shouldShowPWAInstallButton = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return !isPWAInstalled() && "serviceWorker" in window.navigator;
};

const notifyPWAInstallStateListeners = () => {
  pwaInstallStateListeners.forEach((listener) => {
    listener();
  });
};

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
    notifyPWAInstallStateListeners();
  },
);

window.addEventListener("appinstalled", () => {
  pwaEvent = null;
  notifyPWAInstallStateListeners();
});

let isSelfEmbedding = false;
const CUSTOM_EMBEDDABLE_DOUBLE_CLICK_MS = 350;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const getMathFormulaElementData = (
  element: NonDeletedExcalidrawElement | null,
): {
  source: string;
  style: MathFormulaStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | {
        formulaType?: string;
        formulaSource?: string;
        formulaStyle?: Partial<MathFormulaStyle> | null;
        intrinsicWidth?: number;
        intrinsicHeight?: number;
      }
    | undefined;

  if (
    customData?.formulaType !== "math" ||
    typeof customData.formulaSource !== "string"
  ) {
    return null;
  }

  return {
    source: customData.formulaSource,
    style: normalizeMathFormulaStyle(customData.formulaStyle),
    intrinsicWidth:
      typeof customData.intrinsicWidth === "number"
        ? customData.intrinsicWidth
        : undefined,
    intrinsicHeight:
      typeof customData.intrinsicHeight === "number"
        ? customData.intrinsicHeight
        : undefined,
  };
};

const getCodeBlockElementData = (
  element: NonDeletedExcalidrawElement | null,
): {
  source: string;
  style: CodeBlockStyle;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
} | null => {
  if (!element) {
    return null;
  }

  const customData = element.customData as
    | {
        codeBlockType?: string;
        codeBlockSource?: string;
        codeBlockStyle?: Partial<CodeBlockStyle> | null;
        intrinsicWidth?: number;
        intrinsicHeight?: number;
      }
    | undefined;

  if (
    customData?.codeBlockType !== "code" ||
    typeof customData.codeBlockSource !== "string"
  ) {
    return null;
  }

  return {
    source: customData.codeBlockSource,
    style: normalizeCodeBlockStyle(customData.codeBlockStyle),
    intrinsicWidth:
      typeof customData.intrinsicWidth === "number"
        ? customData.intrinsicWidth
        : undefined,
    intrinsicHeight:
      typeof customData.intrinsicHeight === "number"
        ? customData.intrinsicHeight
        : undefined,
  };
};

const stripCustomEmbeddableLinks = <T extends ExcalidrawElement>(
  elements: readonly T[],
): readonly T[] => {
  let didChange = false;

  const nextElements = elements.map((element) => {
    const customData = element.customData as
      | {
          formulaType?: string;
          codeBlockType?: string;
        }
      | undefined;

    if (
      (customData?.formulaType === "math" ||
        customData?.codeBlockType === "code") &&
      element.link
    ) {
      didChange = true;
      return {
        ...element,
        link: null,
      };
    }

    return element;
  }) as T[];

  return didChange ? nextElements : elements;
};

const sanitizeCustomEmbeddableScene = <
  T extends {
    elements?: readonly ExcalidrawElement[] | null;
  },
>(
  scene: T | null,
): T | null => {
  if (!scene?.elements) {
    return scene;
  }

  const nextElements = stripCustomEmbeddableLinks(scene.elements);

  if (nextElements === scene.elements) {
    return scene;
  }

  return {
    ...scene,
    elements: nextElements,
  };
};

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [appMode, setAppMode] = useState<"editor" | "workspace">("editor");
  const [primaryFile, setPrimaryFile] = useState<CloudFileRef | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [saveIndicatorStatus, setSaveIndicatorStatus] =
    useState<SaveIndicatorStatus>("idle");
  const [saveIndicatorMessage, setSaveIndicatorMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(() => !!pwaEvent);
  const [showInstallPWA, setShowInstallPWA] = useState(() =>
    shouldShowPWAInstallButton(),
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [mathFormulaDialogState, setMathFormulaDialogState] =
    useState<MathFormulaDialogState | null>(null);
  const [codeBlockDialogState, setCodeBlockDialogState] =
    useState<CodeBlockDialogState | null>(null);
  const [isTemplateLibraryDialogOpen, setIsTemplateLibraryDialogOpen] =
    useState(false);
  const [selectedUmlClassRootId, setSelectedUmlClassRootId] = useState<
    string | null
  >(null);
  const [selectedUmlClassData, setSelectedUmlClassData] =
    useState<UmlClassTemplateData | null>(null);
  const [selectedUmlDiagramRootId, setSelectedUmlDiagramRootId] = useState<
    string | null
  >(null);
  const [selectedUmlDiagramData, setSelectedUmlDiagramData] =
    useState<UmlDiagramTemplateData | null>(null);
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const suppressDirtyMarkUntilRef = useRef(0);
  const lastEditableEmbeddablePointerRef = useRef<{
    elementId: string;
    timestamp: number;
    kind: "math-formula" | "code-block";
  } | null>(null);
  const currentAppStateRef = useRef<AppState | null>(null);
  const templateLibraryDialogOpenRef = useRef(false);
  const selectedUmlClassRootIdRef = useRef<string | null>(null);
  const selectedUmlClassDataRef = useRef<UmlClassTemplateData | null>(null);
  const umlClassSelectionSignatureRef = useRef("");
  const umlClassLayoutSignatureCacheRef = useRef<Map<string, string>>(
    new Map(),
  );
  const selectedUmlDiagramRootIdRef = useRef<string | null>(null);
  const selectedUmlDiagramDataRef = useRef<UmlDiagramTemplateData | null>(null);
  const umlDiagramSelectionSignatureRef = useRef("");
  const umlDiagramLayoutSignatureCacheRef = useRef<Map<string, string>>(
    new Map(),
  );
  const umlTemplateRelayoutGuardRef = useRef<{
    rootId: string | null;
    until: number;
  }>({
    rootId: null,
    until: 0,
  });

  const suppressDirtyMark = useCallback((durationMs = 800) => {
    suppressDirtyMarkUntilRef.current = Date.now() + durationMs;
  }, []);

  const markSaveIndicatorSaved = useCallback((message?: string) => {
    setSaveIndicatorStatus("saved");
    setSaveIndicatorMessage(message || "");
    setLastSavedAt(Date.now());
  }, []);

  const markSaveIndicatorDirty = useCallback(() => {
    setSaveIndicatorStatus((prev) => (prev === "saving" ? prev : "unsaved"));
    setSaveIndicatorMessage("");
  }, []);

  const markSaveIndicatorError = useCallback((message: string) => {
    setSaveIndicatorStatus("error");
    setSaveIndicatorMessage(message);
  }, []);

  const markSaveIndicatorConflict = useCallback((message: string) => {
    setSaveIndicatorStatus("conflict");
    setSaveIndicatorMessage(message);
  }, []);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  useEffect(() => {
    const syncPWAInstallState = () => {
      setCanInstallPWA(!!pwaEvent);
      setShowInstallPWA(shouldShowPWAInstallButton());
    };

    pwaInstallStateListeners.add(syncPWAInstallState);
    syncPWAInstallState();

    return () => {
      pwaInstallStateListeners.delete(syncPWAInstallState);
    };
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  const handleInstallPWA = useCallback(async () => {
    if (!pwaEvent) {
      const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        window.navigator.userAgent,
      );
      const needsDevPWAFlag =
        import.meta.env.DEV && import.meta.env.VITE_APP_ENABLE_PWA !== "true";

      setErrorMessage(
        isIOS && isSafari
          ? "iPhone/iPad 请在 Safari 里点击分享按钮，然后选择“添加到主屏幕”。"
          : needsDevPWAFlag
          ? "开发环境还没有启用 PWA。请在 .env.development 里设置 VITE_APP_ENABLE_PWA=true，然后重启 dev server。"
          : "当前浏览器还没有触发安装提示。请优先使用 Chrome/Edge，并确认页面运行在 localhost 或 HTTPS 下；也可以从浏览器菜单中选择“安装应用”或“添加到桌面”。",
      );
      return;
    }

    const currentPWAEvent = pwaEvent;
    await currentPWAEvent.prompt();
    await currentPWAEvent.userChoice.catch(() => null);

    if (pwaEvent === currentPWAEvent) {
      pwaEvent = null;
      notifyPWAInstallStateListeners();
    }
  }, []);

  const handleInsertMathFormulaAtPointer = useCallback(
    (sceneX: number, sceneY: number, activeTool: AppState["activeTool"]) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      setMathFormulaDialogState({
        mode: "insert",
        sceneX,
        sceneY,
        initialStyle: normalizeMathFormulaStyle(),
        toolLocked: activeTool.locked,
      });
    },
    [excalidrawAPI],
  );

  const handleEditMathFormula = useCallback(
    (element: NonDeletedExcalidrawElement) => {
      const mathFormulaData = getMathFormulaElementData(element);
      if (!mathFormulaData) {
        return;
      }

      setMathFormulaDialogState({
        mode: "edit",
        targetElementId: element.id,
        initialValue: mathFormulaData.source,
        initialStyle: mathFormulaData.style,
      });
      excalidrawAPI?.setActiveTool({ type: "selection" });
    },
    [excalidrawAPI],
  );

  const handleCloseMathFormulaDialog = useCallback(() => {
    const dialogState = mathFormulaDialogState;
    setMathFormulaDialogState(null);

    if (dialogState?.mode === "insert" && !dialogState.toolLocked) {
      excalidrawAPI?.setActiveTool({ type: "selection" });
    }
  }, [excalidrawAPI, mathFormulaDialogState]);

  const handleSubmitMathFormula = useCallback(
    async (formula: string, style: MathFormulaStyle) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const dialogState = mathFormulaDialogState;

      if (!dialogState) {
        return;
      }

      const normalizedFormula = formula.trim();

      if (!normalizedFormula) {
        throw new Error("Formula cannot be empty.");
      }

      const {
        width,
        height,
        style: normalizedStyle,
      } = measureMathFormulaDimensions(normalizedFormula, style);

      const formulaCustomData = {
        formulaSource: normalizedFormula,
        formulaType: "math",
        formulaStyle: normalizedStyle,
        intrinsicWidth: width,
        intrinsicHeight: height,
      };

      if (dialogState.mode === "edit" && dialogState.targetElementId) {
        const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
        const targetElement = elements.find(
          (element) => element.id === dialogState.targetElementId,
        );

        if (!targetElement) {
          throw new Error("Original formula element was not found.");
        }

        const centerX = targetElement.x + targetElement.width / 2;
        const centerY = targetElement.y + targetElement.height / 2;

        let updatedElement: NonDeletedExcalidrawElement;

        if (isEmbeddableElement(targetElement)) {
          updatedElement = newElementWith(targetElement, {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            link: null,
            customData: formulaCustomData,
          });
        } else if (isInitializedImageElement(targetElement)) {
          const { fileData } = await createMathFormulaAsset(
            normalizedFormula,
            normalizedStyle,
          );

          excalidrawAPI.addFiles([fileData]);

          updatedElement = newElementWith(targetElement, {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            fileId: fileData.id,
            status: "saved",
            customData: formulaCustomData,
          });
        } else {
          throw new Error("Original formula element was not found.");
        }

        excalidrawAPI.updateScene({
          elements: elements.map((element) =>
            element.id === targetElement.id ? updatedElement : element,
          ),
          appState: {
            selectedElementIds: {
              [targetElement.id]: true,
            },
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        setMathFormulaDialogState(null);
        excalidrawAPI.setToast({
          message: "Updated math formula",
        });
        return;
      }

      if (
        typeof dialogState.sceneX !== "number" ||
        typeof dialogState.sceneY !== "number"
      ) {
        throw new Error("Formula insertion position is missing.");
      }

      let embeddableElement = newEmbeddableElement({
        type: "embeddable",
        x: dialogState.sceneX - width / 2,
        y: dialogState.sceneY - height / 2,
        width,
        height,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        roundness: null,
        locked: false,
      });

      embeddableElement = newElementWith(embeddableElement, {
        customData: formulaCustomData,
      });

      excalidrawAPI.updateScene({
        elements: [
          ...excalidrawAPI.getSceneElementsIncludingDeleted(),
          embeddableElement,
        ],
        appState: {
          selectedElementIds: {
            [embeddableElement.id]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      setMathFormulaDialogState(null);

      if (!dialogState.toolLocked) {
        excalidrawAPI.setActiveTool({ type: "selection" });
      }

      excalidrawAPI.setToast({
        message: "Inserted math formula",
      });
    },
    [excalidrawAPI, mathFormulaDialogState],
  );

  const handleInsertCodeBlockAtPointer = useCallback(
    (sceneX: number, sceneY: number, activeTool: AppState["activeTool"]) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      setCodeBlockDialogState({
        mode: "insert",
        sceneX,
        sceneY,
        initialStyle: normalizeCodeBlockStyle({
          theme: appTheme === THEME.DARK ? "dark" : "light",
        }),
        toolLocked: activeTool.locked,
      });
    },
    [appTheme, excalidrawAPI],
  );

  const handleEditCodeBlock = useCallback(
    (element: NonDeletedExcalidrawElement) => {
      const codeBlockData = getCodeBlockElementData(element);
      if (!codeBlockData) {
        return;
      }

      setCodeBlockDialogState({
        mode: "edit",
        targetElementId: element.id,
        initialValue: codeBlockData.source,
        initialStyle: codeBlockData.style,
      });
      excalidrawAPI?.setActiveTool({ type: "selection" });
    },
    [excalidrawAPI],
  );

  const handleCloseCodeBlockDialog = useCallback(() => {
    const dialogState = codeBlockDialogState;
    setCodeBlockDialogState(null);

    if (dialogState?.mode === "insert" && !dialogState.toolLocked) {
      excalidrawAPI?.setActiveTool({ type: "selection" });
    }
  }, [codeBlockDialogState, excalidrawAPI]);

  const handleSubmitCodeBlock = useCallback(
    async (code: string, style: CodeBlockStyle) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const dialogState = codeBlockDialogState;

      if (!dialogState) {
        return;
      }

      const normalizedCode = code.replace(/\r\n/g, "\n").trimEnd();

      if (!normalizedCode.trim()) {
        throw new Error("Code cannot be empty.");
      }

      const {
        width,
        height,
        style: normalizedStyle,
      } = measureCodeBlockDimensions(normalizedCode, style);

      const codeBlockCustomData = {
        codeBlockSource: normalizedCode,
        codeBlockType: "code",
        codeBlockStyle: normalizedStyle,
        intrinsicWidth: width,
        intrinsicHeight: height,
      };

      if (dialogState.mode === "edit" && dialogState.targetElementId) {
        const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
        const targetElement = elements.find(
          (element) => element.id === dialogState.targetElementId,
        );

        if (!targetElement || !isEmbeddableElement(targetElement)) {
          throw new Error("Original code block element was not found.");
        }

        const updatedElement = newElementWith(targetElement, {
          width,
          height,
          link: null,
          customData: codeBlockCustomData,
        });

        excalidrawAPI.updateScene({
          elements: elements.map((element) =>
            element.id === targetElement.id ? updatedElement : element,
          ),
          appState: {
            selectedElementIds: {
              [targetElement.id]: true,
            },
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        setCodeBlockDialogState(null);
        excalidrawAPI.setToast({
          message: "Updated code block",
        });
        return;
      }

      if (
        typeof dialogState.sceneX !== "number" ||
        typeof dialogState.sceneY !== "number"
      ) {
        throw new Error("Code block insertion position is missing.");
      }

      let embeddableElement = newEmbeddableElement({
        type: "embeddable",
        x: dialogState.sceneX - width / 2,
        y: dialogState.sceneY - height / 2,
        width,
        height,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        roundness: null,
        locked: false,
        link: null,
      });

      embeddableElement = newElementWith(embeddableElement, {
        customData: codeBlockCustomData,
      });

      excalidrawAPI.updateScene({
        elements: [
          ...excalidrawAPI.getSceneElementsIncludingDeleted(),
          embeddableElement,
        ],
        appState: {
          selectedElementIds: {
            [embeddableElement.id]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      setCodeBlockDialogState(null);

      if (!dialogState.toolLocked) {
        excalidrawAPI.setActiveTool({ type: "selection" });
      }

      excalidrawAPI.setToast({
        message: "Inserted code block",
      });
    },
    [codeBlockDialogState, excalidrawAPI],
  );

  useEffect(() => {
    templateLibraryDialogOpenRef.current = isTemplateLibraryDialogOpen;
  }, [isTemplateLibraryDialogOpen]);

  const handleCloseTemplateLibraryDialog = useCallback(() => {
    templateLibraryDialogOpenRef.current = false;
    setIsTemplateLibraryDialogOpen(false);
    excalidrawAPI?.setActiveTool({ type: "selection" });
  }, [excalidrawAPI]);

  const handleInsertUmlClassTemplate = useCallback(
    (preset: UmlClassTemplatePreset = "class") => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const appState =
        currentAppStateRef.current || excalidrawAPI.getAppState();
      const zoom = appState.zoom.value || 1;
      const sceneCenterX = -appState.scrollX + appState.width / (2 * zoom);
      const sceneCenterY = -appState.scrollY + appState.height / (2 * zoom);
      const templateElements = createUmlClassTemplate(
        sceneCenterX - 140,
        sceneCenterY - 110,
        createDefaultUmlClassTemplateData(preset),
      );

      excalidrawAPI.updateScene({
        elements: [
          ...excalidrawAPI.getSceneElementsIncludingDeleted(),
          ...templateElements,
        ],
        appState: {
          selectedElementIds: Object.fromEntries(
            templateElements.map((element) => [element.id, true]),
          ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      templateLibraryDialogOpenRef.current = false;
      setIsTemplateLibraryDialogOpen(false);
      excalidrawAPI.setActiveTool({ type: "selection" });
      excalidrawAPI.setToast({
        message: `Inserted UML ${preset}`,
      });
    },
    [excalidrawAPI],
  );

  const handleInsertUmlDiagramTemplate = useCallback(
    (preset: UmlDiagramTemplatePreset) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const appState =
        currentAppStateRef.current || excalidrawAPI.getAppState();
      const zoom = appState.zoom.value || 1;
      const sceneCenterX = -appState.scrollX + appState.width / (2 * zoom);
      const sceneCenterY = -appState.scrollY + appState.height / (2 * zoom);
      const templateElements = createUmlDiagramTemplate(
        sceneCenterX - 120,
        sceneCenterY - 80,
        preset,
      );

      excalidrawAPI.updateScene({
        elements: [
          ...excalidrawAPI.getSceneElementsIncludingDeleted(),
          ...templateElements,
        ],
        appState: {
          selectedElementIds: Object.fromEntries(
            templateElements.map((element) => [element.id, true]),
          ),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      templateLibraryDialogOpenRef.current = false;
      setIsTemplateLibraryDialogOpen(false);
      excalidrawAPI.setActiveTool({ type: "selection" });
      excalidrawAPI.setToast({
        message: `Inserted UML ${preset}`,
      });
    },
    [excalidrawAPI],
  );

  const handleUpdateSelectedUmlClass = useCallback(
    (data: UmlClassTemplateData) => {
      if (!excalidrawAPI || !selectedUmlClassRootId) {
        return;
      }

      const nextElements = updateUmlClassTemplateInScene(
        excalidrawAPI.getSceneElementsIncludingDeleted(),
        selectedUmlClassRootId,
        data,
      );

      excalidrawAPI.updateScene({
        elements: nextElements,
        appState: {
          selectedElementIds: {
            [selectedUmlClassRootId]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [excalidrawAPI, selectedUmlClassRootId],
  );

  const handleUpdateSelectedUmlDiagram = useCallback(
    (data: UmlDiagramTemplateData) => {
      if (!excalidrawAPI || !selectedUmlDiagramRootId) {
        return;
      }

      const nextElements = updateUmlDiagramTemplateInScene(
        excalidrawAPI.getSceneElementsIncludingDeleted(),
        selectedUmlDiagramRootId,
        data,
      );

      excalidrawAPI.updateScene({
        elements: nextElements,
        appState: {
          selectedElementIds: {
            [selectedUmlDiagramRootId]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [excalidrawAPI, selectedUmlDiagramRootId],
  );

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const openSidebarName = excalidrawAPI.getAppState().openSidebar?.name;
    const openSidebarTab = excalidrawAPI.getAppState().openSidebar?.tab;

    if (selectedUmlClassRootId || selectedUmlDiagramRootId) {
      void excalidrawAPI.toggleSidebar({
        name: "default",
        tab: "uml-template",
        force: true,
      });
      return;
    }

    if (openSidebarName === "default" && openSidebarTab === "uml-template") {
      void excalidrawAPI.toggleSidebar({ name: null });
    }
  }, [excalidrawAPI, selectedUmlClassRootId, selectedUmlDiagramRootId]);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Hoisted loadImages
  // ---------------------------------------------------------------------------
  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          if (fileIds.length) {
            // Direct Firebase call (not through FileManager), so track manually
            FileStatusStore.updateStatuses(
              fileIds.map((id) => [id, "loading"]),
            );
          }
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
            FileStatusStore.updateStatuses([
              ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
              ...[...erroredFiles.keys()].map(
                (id) => [id, "error"] as [FileId, "error"],
              ),
            ]);
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(async ({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({
            currentFileIds: fileIds,
          });
        }
      }
    },
    [collabAPI, excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      data.scene = sanitizeCustomEmbeddableScene(data.scene);
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          data.scene = sanitizeCustomEmbeddableScene(data.scene);
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...sanitizeCustomEmbeddableScene(localDataState),
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, setLangCode, loadImages]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    currentAppStateRef.current = appState;

    if (
      appState.activeTool.type === "custom" &&
      appState.activeTool.customType === "template-library" &&
      !templateLibraryDialogOpenRef.current
    ) {
      templateLibraryDialogOpenRef.current = true;
      setIsTemplateLibraryDialogOpen(true);
      excalidrawAPI?.setActiveTool({ type: "selection" });
    }

    const elementsById = new Map<string, ExcalidrawElement>(
      elements.map((element) => [element.id, element]),
    );
    const selectedElementIdsSignature = getSelectedElementIdsSignature(
      appState.selectedElementIds,
    );
    pruneSignatureCache(umlClassLayoutSignatureCacheRef.current, elementsById);
    pruneSignatureCache(
      umlDiagramLayoutSignatureCacheRef.current,
      elementsById,
    );

    try {
      const selectedUmlRoot = resolveSelectedUmlClassTemplateRootWithMap(
        elementsById,
        appState.selectedElementIds,
      );
      if (selectedUmlRoot && excalidrawAPI) {
        const guard = umlTemplateRelayoutGuardRef.current;
        const shouldSkipRelayout =
          guard.rootId === selectedUmlRoot.id && Date.now() < guard.until;
        const nextLayoutSignature = getUmlClassTemplateLayoutSignature(
          selectedUmlRoot,
          elementsById,
        );
        const cachedLayoutSignature =
          umlClassLayoutSignatureCacheRef.current.get(selectedUmlRoot.id);
        const shouldCheckRelayout =
          nextLayoutSignature === null ||
          nextLayoutSignature !== cachedLayoutSignature;

        if (!shouldSkipRelayout && shouldCheckRelayout) {
          const relayoutElements = syncUmlClassTemplateLayoutInSceneWithMap(
            elements,
            selectedUmlRoot.id,
            elementsById,
          );

          if (relayoutElements !== elements) {
            const relayoutElementsById = new Map<string, ExcalidrawElement>(
              relayoutElements.map((element) => [element.id, element]),
            );
            const relayoutRoot = relayoutElementsById.get(selectedUmlRoot.id);
            const relayoutSignature = getUmlClassTemplateLayoutSignature(
              relayoutRoot,
              relayoutElementsById,
            );
            if (relayoutSignature) {
              umlClassLayoutSignatureCacheRef.current.set(
                selectedUmlRoot.id,
                relayoutSignature,
              );
            }
            umlTemplateRelayoutGuardRef.current = {
              rootId: selectedUmlRoot.id,
              until: Date.now() + 200,
            };
            excalidrawAPI.updateScene({
              elements: relayoutElements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
            return;
          }
        }

        if (nextLayoutSignature) {
          umlClassLayoutSignatureCacheRef.current.set(
            selectedUmlRoot.id,
            nextLayoutSignature,
          );
        }
      }

      const nextSelectedUmlData = getUmlClassTemplateData(selectedUmlRoot);
      const nextSelectedUmlRootId = selectedUmlRoot?.id || null;
      const nextUmlClassSelectionSignature = buildUmlSelectionSignature(
        selectedElementIdsSignature,
        nextSelectedUmlRootId,
        serializeUmlClassTemplateData(nextSelectedUmlData),
      );

      if (
        umlClassSelectionSignatureRef.current !== nextUmlClassSelectionSignature
      ) {
        umlClassSelectionSignatureRef.current = nextUmlClassSelectionSignature;

        if (selectedUmlClassRootIdRef.current !== nextSelectedUmlRootId) {
          selectedUmlClassRootIdRef.current = nextSelectedUmlRootId;
          setSelectedUmlClassRootId(nextSelectedUmlRootId);
        }

        if (
          !areUmlClassTemplateDataEqual(
            selectedUmlClassDataRef.current,
            nextSelectedUmlData,
          )
        ) {
          selectedUmlClassDataRef.current = nextSelectedUmlData;
          setSelectedUmlClassData(nextSelectedUmlData);
        }
      }

      const selectedUmlDiagramRoot =
        resolveSelectedUmlDiagramTemplateRootWithMap(
          elementsById,
          appState.selectedElementIds,
        );
      if (selectedUmlDiagramRoot && excalidrawAPI) {
        const guard = umlTemplateRelayoutGuardRef.current;
        const shouldSkipRelayout =
          guard.rootId === selectedUmlDiagramRoot.id &&
          Date.now() < guard.until;
        const nextLayoutSignature = getUmlDiagramTemplateLayoutSignature(
          selectedUmlDiagramRoot,
          elementsById,
        );
        const cachedLayoutSignature =
          umlDiagramLayoutSignatureCacheRef.current.get(
            selectedUmlDiagramRoot.id,
          );
        const shouldCheckRelayout =
          nextLayoutSignature === null ||
          nextLayoutSignature !== cachedLayoutSignature;

        if (!shouldSkipRelayout && shouldCheckRelayout) {
          const relayoutDiagramElements =
            syncUmlDiagramTemplateLayoutInSceneWithMap(
              elements,
              selectedUmlDiagramRoot.id,
              elementsById,
            );

          if (relayoutDiagramElements !== elements) {
            const relayoutElementsById = new Map<string, ExcalidrawElement>(
              relayoutDiagramElements.map((element) => [element.id, element]),
            );
            const relayoutRoot = relayoutElementsById.get(
              selectedUmlDiagramRoot.id,
            );
            const relayoutSignature = getUmlDiagramTemplateLayoutSignature(
              relayoutRoot,
              relayoutElementsById,
            );
            if (relayoutSignature) {
              umlDiagramLayoutSignatureCacheRef.current.set(
                selectedUmlDiagramRoot.id,
                relayoutSignature,
              );
            }
            umlTemplateRelayoutGuardRef.current = {
              rootId: selectedUmlDiagramRoot.id,
              until: Date.now() + 200,
            };
            excalidrawAPI.updateScene({
              elements: relayoutDiagramElements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
            return;
          }
        }

        if (nextLayoutSignature) {
          umlDiagramLayoutSignatureCacheRef.current.set(
            selectedUmlDiagramRoot.id,
            nextLayoutSignature,
          );
        }
      }

      const nextSelectedUmlDiagramData = getUmlDiagramTemplateData(
        selectedUmlDiagramRoot,
      );
      const editableUmlDiagramData =
        nextSelectedUmlDiagramData &&
        isEditableUmlDiagramTemplatePreset(nextSelectedUmlDiagramData.preset)
          ? nextSelectedUmlDiagramData
          : null;
      const nextSelectedUmlDiagramRootId = editableUmlDiagramData
        ? selectedUmlDiagramRoot?.id || null
        : null;
      const nextUmlDiagramSelectionSignature = buildUmlSelectionSignature(
        selectedElementIdsSignature,
        nextSelectedUmlDiagramRootId,
        serializeUmlDiagramTemplateData(editableUmlDiagramData),
      );

      if (
        umlDiagramSelectionSignatureRef.current !==
        nextUmlDiagramSelectionSignature
      ) {
        umlDiagramSelectionSignatureRef.current =
          nextUmlDiagramSelectionSignature;

        if (
          selectedUmlDiagramRootIdRef.current !== nextSelectedUmlDiagramRootId
        ) {
          selectedUmlDiagramRootIdRef.current = nextSelectedUmlDiagramRootId;
          setSelectedUmlDiagramRootId(nextSelectedUmlDiagramRootId);
        }

        if (
          !areUmlDiagramTemplateDataEqual(
            selectedUmlDiagramDataRef.current,
            editableUmlDiagramData,
          )
        ) {
          selectedUmlDiagramDataRef.current = editableUmlDiagramData;
          setSelectedUmlDiagramData(editableUmlDiagramData);
        }
      }
    } catch (error) {
      console.error("Failed to sync UML template sidebar state", error);
      umlClassSelectionSignatureRef.current = "";
      umlDiagramSelectionSignatureRef.current = "";
      if (selectedUmlClassRootIdRef.current !== null) {
        selectedUmlClassRootIdRef.current = null;
        setSelectedUmlClassRootId(null);
      }
      if (selectedUmlClassDataRef.current !== null) {
        selectedUmlClassDataRef.current = null;
        setSelectedUmlClassData(null);
      }
      if (selectedUmlDiagramRootIdRef.current !== null) {
        selectedUmlDiagramRootIdRef.current = null;
        setSelectedUmlDiagramRootId(null);
      }
      if (selectedUmlDiagramDataRef.current !== null) {
        selectedUmlDiagramDataRef.current = null;
        setSelectedUmlDiagramData(null);
      }
    }

    if (Date.now() > suppressDirtyMarkUntilRef.current) {
      markSaveIndicatorDirty();
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  const detectSaveConflict = useCallback(
    async (
      fileRef: CloudFileRef,
    ): Promise<{
      hasConflict: boolean;
      latestModifiedTime?: string;
      latestName?: string;
      latestMimeType?: string;
      latestFolderId?: string | null;
      latestPath?: string;
    }> => {
      if (fileRef.provider === "gdrive") {
        const metadata = await getGoogleDriveFileMetadata(fileRef.fileId);
        return {
          hasConflict: !!(
            fileRef.modifiedTime &&
            metadata.modifiedTime &&
            metadata.modifiedTime !== fileRef.modifiedTime
          ),
          latestModifiedTime: metadata.modifiedTime,
          latestName: metadata.name,
          latestMimeType: metadata.mimeType,
          latestFolderId: metadata.parents?.[0] || fileRef.folderId,
        };
      }

      if (
        fileRef.provider === "local" &&
        fileRef.fileHandle &&
        fileRef.directoryHandle
      ) {
        const metadata = await getLocalFileMetadata({
          fileHandle: fileRef.fileHandle,
          name: fileRef.name,
          parentId: fileRef.folderId,
          path: fileRef.path || fileRef.fileId,
          directoryHandle: fileRef.directoryHandle,
          parentDirectoryHandle: fileRef.directoryHandle,
        });

        return {
          hasConflict: !!(
            fileRef.modifiedTime &&
            metadata.modifiedTime &&
            metadata.modifiedTime !== fileRef.modifiedTime
          ),
          latestModifiedTime: metadata.modifiedTime,
          latestName: metadata.name,
          latestMimeType: metadata.mimeType,
          latestFolderId: metadata.parentId,
          latestPath: metadata.path,
        };
      }

      return {
        hasConflict: false,
      };
    },
    [],
  );

  const getSaveIndicatorLabel = useCallback(() => {
    if (saveIndicatorStatus === "saving") {
      return "Saving…";
    }

    if (saveIndicatorStatus === "unsaved") {
      return "Unsaved";
    }

    if (saveIndicatorStatus === "conflict") {
      return "Conflict";
    }

    if (saveIndicatorStatus === "error") {
      return "Save failed";
    }

    if (saveIndicatorStatus === "saved") {
      if (!lastSavedAt) {
        return "Saved";
      }

      return `Saved ${new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastSavedAt)}`;
    }

    return primaryFile ? "Saved" : "Not saved";
  }, [lastSavedAt, primaryFile, saveIndicatorStatus]);

  const handleOpenGoogleDriveFile = useCallback(
    async (file: GoogleDriveFile) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const downloadedFile = await downloadGoogleDriveFile(
        file.id,
        file.name,
        file.mimeType,
      );

      const loadedScene = await loadFromBlob(
        downloadedFile,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      );
      const sanitizedElements = stripCustomEmbeddableLinks(
        loadedScene.elements,
      );

      suppressDirtyMark();
      excalidrawAPI.updateScene({
        elements: sanitizedElements,
        appState: {
          ...loadedScene.appState,
          name:
            loadedScene.appState.name ||
            file.name.replace(/\.excalidraw$/i, ""),
          openDialog: null,
          openSidebar: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.addFiles(Object.values(loadedScene.files));
      excalidrawAPI.history.clear();

      setPrimaryFile({
        provider: "gdrive",
        fileId: file.id,
        folderId: file.parentId,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
      });
      markSaveIndicatorSaved(`Loaded from Google Drive`);
      setAppMode("editor");
      excalidrawAPI.setToast({
        message: `Loaded "${file.name}" from Google Drive`,
      });
    },
    [excalidrawAPI, markSaveIndicatorSaved, suppressDirtyMark],
  );

  const handleOpenLocalFile = useCallback(
    async (file: LocalDirectoryFile) => {
      if (!excalidrawAPI) {
        throw new Error("Excalidraw editor is not ready yet.");
      }

      const localFile = await readLocalFile(file);
      const loadedScene = await loadFromBlob(
        localFile,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      );
      const sanitizedElements = stripCustomEmbeddableLinks(
        loadedScene.elements,
      );

      suppressDirtyMark();
      excalidrawAPI.updateScene({
        elements: sanitizedElements,
        appState: {
          ...loadedScene.appState,
          name:
            loadedScene.appState.name ||
            file.name.replace(/\.excalidraw$/i, ""),
          openDialog: null,
          openSidebar: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.addFiles(Object.values(loadedScene.files));
      excalidrawAPI.history.clear();

      setPrimaryFile({
        provider: "local",
        fileId: file.id,
        folderId: file.parentId,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        path: file.path,
        fileHandle: file.fileHandle,
        directoryHandle: file.directoryHandle,
      });
      markSaveIndicatorSaved(`Loaded from local directory`);
      setAppMode("editor");
      excalidrawAPI.setToast({
        message: `Loaded "${file.name}" from local directory`,
      });
    },
    [excalidrawAPI, markSaveIndicatorSaved, suppressDirtyMark],
  );

  const handleCreateGoogleDriveFile = useCallback(
    async ({ folderId, name }: { folderId: string; name: string }) => {
      const normalizedName = normalizeExcalidrawFileName(name);
      const blob = buildExcalidrawBlob({
        elements: [],
        appState: {
          viewBackgroundColor: getDefaultAppState().viewBackgroundColor,
        },
        files: {},
      });

      const savedFile = await createGoogleDriveFile({
        folderId,
        name: normalizedName,
        blob,
      });

      const createdFile: GoogleDriveFile = {
        id: savedFile.id,
        name: savedFile.name,
        mimeType: savedFile.mimeType,
        parentId: savedFile.parents?.[0] || folderId,
        modifiedTime: savedFile.modifiedTime,
        isExcalidrawFile: true,
      };

      excalidrawAPI?.setToast({
        message: `Created "${createdFile.name}" in Google Drive`,
      });

      return createdFile;
    },
    [excalidrawAPI],
  );

  const handleCreateLocalFile = useCallback(
    async ({
      folder,
      name,
    }: {
      folder: LocalDirectoryFolder;
      name: string;
    }) => {
      const normalizedName = normalizeExcalidrawFileName(name);
      const blob = buildExcalidrawBlob({
        elements: [],
        appState: {
          viewBackgroundColor: getDefaultAppState().viewBackgroundColor,
        },
        files: {},
      });

      const createdFile = await createLocalFile({
        parentFolder: folder,
        name: normalizedName,
        blob,
      });

      excalidrawAPI?.setToast({
        message: `Created "${createdFile.name}" in local directory`,
      });

      return createdFile;
    },
    [excalidrawAPI],
  );

  const saveToGoogleDriveAs = useCallback(async () => {
    if (!excalidrawAPI) {
      throw new Error("Excalidraw editor is not ready yet.");
    }

    const targetFolder = await pickGoogleDriveRootFolder();

    if (!targetFolder) {
      return null;
    }

    const suggestedName = normalizeExcalidrawFileName(
      excalidrawAPI.getName() || primaryFile?.name || "Untitled",
    );
    const inputName = window.prompt(
      "请输入保存到 Google Drive 的文件名",
      suggestedName,
    );

    if (!inputName) {
      return null;
    }

    const normalizedName = normalizeExcalidrawFileName(inputName);
    const blob = buildExcalidrawBlob({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });

    const savedFile = await createGoogleDriveFile({
      folderId: targetFolder.id,
      name: normalizedName,
      blob,
    });

    const nextPrimaryFile: CloudFileRef = {
      provider: "gdrive",
      fileId: savedFile.id,
      folderId: savedFile.parents?.[0] || targetFolder.id,
      name: savedFile.name,
      mimeType: savedFile.mimeType,
      modifiedTime: savedFile.modifiedTime,
    };

    setPrimaryFile(nextPrimaryFile);
    suppressDirtyMark();
    excalidrawAPI.updateScene({
      appState: {
        name: savedFile.name.replace(/\.excalidraw$/i, ""),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    markSaveIndicatorSaved("Saved to Google Drive");
    excalidrawAPI.setToast({
      message: `Saved "${savedFile.name}" to Google Drive`,
    });

    return nextPrimaryFile;
  }, [excalidrawAPI, markSaveIndicatorSaved, primaryFile, suppressDirtyMark]);

  const saveToLocalAs = useCallback(async () => {
    if (!excalidrawAPI) {
      throw new Error("Excalidraw editor is not ready yet.");
    }

    const targetFolder =
      getStoredLocalRootFolder() ?? (await pickLocalRootFolder());

    if (!targetFolder) {
      return null;
    }

    const suggestedName = normalizeExcalidrawFileName(
      excalidrawAPI.getName() || primaryFile?.name || "Untitled",
    );
    const inputName = window.prompt(
      "Enter the file name to save into the local directory",
      suggestedName,
    );

    if (!inputName) {
      return null;
    }

    const normalizedName = normalizeExcalidrawFileName(inputName);
    const blob = buildExcalidrawBlob({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });

    const savedFile = await createLocalFile({
      parentFolder: targetFolder,
      name: normalizedName,
      blob,
    });

    const nextPrimaryFile: CloudFileRef = {
      provider: "local",
      fileId: savedFile.id,
      folderId: savedFile.parentId,
      name: savedFile.name,
      mimeType: savedFile.mimeType,
      modifiedTime: savedFile.modifiedTime,
      path: savedFile.path,
      fileHandle: savedFile.fileHandle,
      directoryHandle: savedFile.directoryHandle,
    };

    setPrimaryFile(nextPrimaryFile);
    suppressDirtyMark();
    excalidrawAPI.updateScene({
      appState: {
        name: savedFile.name.replace(/\.excalidraw$/i, ""),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    markSaveIndicatorSaved("Saved to local directory");
    excalidrawAPI.setToast({
      message: `Saved "${savedFile.name}" to local directory`,
    });

    return nextPrimaryFile;
  }, [excalidrawAPI, markSaveIndicatorSaved, primaryFile, suppressDirtyMark]);

  const handleSaveToCloud = useCallback(async () => {
    if (!excalidrawAPI || isSavingToCloud) {
      return;
    }

    setIsSavingToCloud(true);
    setSaveIndicatorStatus("saving");
    setSaveIndicatorMessage("");
    try {
      if (primaryFile?.provider === "gdrive") {
        const conflictCheck = await detectSaveConflict(primaryFile);

        if (conflictCheck.hasConflict) {
          const conflictMessage =
            "Google Drive file changed since last open/save. Overwrite the remote version?";
          markSaveIndicatorConflict(conflictMessage);

          if (!window.confirm(conflictMessage)) {
            return;
          }
        }

        const normalizedName = normalizeExcalidrawFileName(primaryFile.name);
        const blob = buildExcalidrawBlob({
          elements: excalidrawAPI.getSceneElements(),
          appState: excalidrawAPI.getAppState(),
          files: excalidrawAPI.getFiles(),
        });

        const savedFile = await updateGoogleDriveFile({
          fileId: primaryFile.fileId,
          name: normalizedName,
          blob,
        });

        const nextPrimaryFile: CloudFileRef = {
          ...primaryFile,
          name: savedFile.name,
          mimeType: savedFile.mimeType,
          folderId: savedFile.parents?.[0] || primaryFile.folderId,
          modifiedTime: savedFile.modifiedTime,
        };

        setPrimaryFile(nextPrimaryFile);
        suppressDirtyMark();
        excalidrawAPI.updateScene({
          appState: {
            name: savedFile.name.replace(/\.excalidraw$/i, ""),
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        markSaveIndicatorSaved("Saved to Google Drive");
        excalidrawAPI.setToast({
          message: `Saved "${savedFile.name}" to Google Drive`,
        });
        return;
      }

      if (
        primaryFile?.provider === "local" &&
        primaryFile.fileHandle &&
        primaryFile.directoryHandle
      ) {
        const conflictCheck = await detectSaveConflict(primaryFile);

        if (conflictCheck.hasConflict) {
          const conflictMessage =
            "Local file changed on disk since last open/save. Overwrite the local version?";
          markSaveIndicatorConflict(conflictMessage);

          if (!window.confirm(conflictMessage)) {
            return;
          }
        }

        const blob = buildExcalidrawBlob({
          elements: excalidrawAPI.getSceneElements(),
          appState: excalidrawAPI.getAppState(),
          files: excalidrawAPI.getFiles(),
        });

        const savedFile = await updateLocalFile({
          file: {
            id: primaryFile.fileId,
            name: primaryFile.name,
            parentId: primaryFile.folderId,
            path: primaryFile.path || primaryFile.fileId,
            mimeType: primaryFile.mimeType,
            modifiedTime: primaryFile.modifiedTime,
            isExcalidrawFile: true,
            fileHandle: primaryFile.fileHandle,
            directoryHandle: primaryFile.directoryHandle,
            parentDirectoryHandle: primaryFile.directoryHandle,
          },
          blob,
        });

        const nextPrimaryFile: CloudFileRef = {
          ...primaryFile,
          name: savedFile.name,
          mimeType: savedFile.mimeType,
          folderId: savedFile.parentId,
          modifiedTime: savedFile.modifiedTime,
          path: savedFile.path,
          fileHandle: savedFile.fileHandle,
          directoryHandle: savedFile.directoryHandle,
        };

        setPrimaryFile(nextPrimaryFile);
        suppressDirtyMark();
        excalidrawAPI.updateScene({
          appState: {
            name: savedFile.name.replace(/\.excalidraw$/i, ""),
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        markSaveIndicatorSaved("Saved to local directory");
        excalidrawAPI.setToast({
          message: `Saved "${savedFile.name}" to local directory`,
        });
        return;
      }

      const saveLocalFirst = window.confirm(
        "Save to a local directory?\nPress Cancel to save to Google Drive instead.",
      );
      if (saveLocalFirst) {
        await saveToLocalAs();
        return;
      }

      await saveToGoogleDriveAs();
    } catch (error) {
      markSaveIndicatorError(
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    } finally {
      setIsSavingToCloud(false);
    }
  }, [
    detectSaveConflict,
    excalidrawAPI,
    isSavingToCloud,
    markSaveIndicatorConflict,
    markSaveIndicatorError,
    markSaveIndicatorSaved,
    primaryFile,
    saveToGoogleDriveAs,
    saveToLocalAs,
    suppressDirtyMark,
  ]);

  const handleSaveAsToCloud = useCallback(async () => {
    if (isSavingToCloud) {
      return;
    }

    setIsSavingToCloud(true);
    setSaveIndicatorStatus("saving");
    setSaveIndicatorMessage("");
    try {
      if (primaryFile?.provider === "local") {
        await saveToLocalAs();
        return;
      }

      if (primaryFile?.provider === "gdrive") {
        await saveToGoogleDriveAs();
        return;
      }

      const saveLocalFirst = window.confirm(
        "Save to a local directory?\nPress Cancel to save to Google Drive instead.",
      );
      if (saveLocalFirst) {
        await saveToLocalAs();
        return;
      }

      await saveToGoogleDriveAs();
    } catch (error) {
      markSaveIndicatorError(
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    } finally {
      setIsSavingToCloud(false);
    }
  }, [
    isSavingToCloud,
    markSaveIndicatorError,
    primaryFile,
    saveToGoogleDriveAs,
    saveToLocalAs,
  ]);

  const handleCurrentGoogleDriveFileRenamed = useCallback(
    (file: GoogleDriveFile) => {
      setPrimaryFile((prev) => {
        if (prev?.provider !== "gdrive" || prev.fileId !== file.id) {
          return prev;
        }

        return {
          ...prev,
          name: file.name,
          folderId: file.parentId,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
        };
      });

      suppressDirtyMark();
      excalidrawAPI?.updateScene({
        appState: {
          name: file.name.replace(/\.excalidraw$/i, ""),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      markSaveIndicatorSaved("Saved to Google Drive");
      excalidrawAPI?.setToast({
        message: `Renamed current file to "${file.name}"`,
      });
    },
    [excalidrawAPI, markSaveIndicatorSaved, suppressDirtyMark],
  );

  const handleCurrentGoogleDriveFileDeleted = useCallback(
    (fileId: string) => {
      setPrimaryFile((prev) => {
        if (prev?.provider !== "gdrive" || prev.fileId !== fileId) {
          return prev;
        }
        return null;
      });

      markSaveIndicatorConflict(
        "Current Google Drive file was deleted. Use Save As to save a new copy.",
      );
      excalidrawAPI?.setToast({
        message: "Current Google Drive file was deleted",
      });
    },
    [excalidrawAPI, markSaveIndicatorConflict],
  );

  const handleCurrentLocalFileDeleted = useCallback(
    (fileId: string) => {
      setPrimaryFile((prev) => {
        if (prev?.provider !== "local" || prev.fileId !== fileId) {
          return prev;
        }
        return null;
      });

      markSaveIndicatorConflict(
        "Current local file was deleted. Use Save As to save a new copy.",
      );
      excalidrawAPI?.setToast({
        message: "Current local file was deleted",
      });
    },
    [excalidrawAPI, markSaveIndicatorConflict],
  );

  const handleCurrentLocalFileRenamed = useCallback(
    (file: LocalDirectoryFile) => {
      setPrimaryFile((prev) => {
        if (prev?.provider !== "local" || prev.fileId !== file.id) {
          return prev;
        }

        return {
          ...prev,
          fileId: file.id,
          folderId: file.parentId,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          path: file.path,
          fileHandle: file.fileHandle,
          directoryHandle: file.directoryHandle,
        };
      });

      suppressDirtyMark();
      excalidrawAPI?.updateScene({
        appState: {
          name: file.name.replace(/\.excalidraw$/i, ""),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      markSaveIndicatorSaved("Saved to local directory");
    },
    [excalidrawAPI, markSaveIndicatorSaved, suppressDirtyMark],
  );

  const handleAutoResizeMathFormula = useCallback(
    (elementId: string, size: { width: number; height: number }) => {
      if (!excalidrawAPI) {
        return;
      }

      const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const targetElement = elements.find(
        (element) => element.id === elementId,
      );

      if (!targetElement || !isEmbeddableElement(targetElement)) {
        return;
      }

      const currentCustomData = (targetElement.customData || {}) as Record<
        string,
        unknown
      >;
      const prevIntrinsicWidth =
        typeof currentCustomData.intrinsicWidth === "number"
          ? Math.max(currentCustomData.intrinsicWidth, 1)
          : Math.max(targetElement.width, 1);
      const prevIntrinsicHeight =
        typeof currentCustomData.intrinsicHeight === "number"
          ? Math.max(currentCustomData.intrinsicHeight, 1)
          : Math.max(targetElement.height, 1);
      const widthScale = targetElement.width / prevIntrinsicWidth;
      const heightScale = targetElement.height / prevIntrinsicHeight;
      const nextIntrinsicWidth = Math.max(size.width, 1);
      const nextIntrinsicHeight = Math.max(size.height, 1);
      const nextWidth = Math.max(
        1,
        Math.round(
          nextIntrinsicWidth * (Number.isFinite(widthScale) ? widthScale : 1),
        ),
      );
      const nextHeight = Math.max(
        1,
        Math.round(
          nextIntrinsicHeight *
            (Number.isFinite(heightScale) ? heightScale : 1),
        ),
      );

      if (
        Math.abs(nextIntrinsicWidth - prevIntrinsicWidth) < 2 &&
        Math.abs(nextIntrinsicHeight - prevIntrinsicHeight) < 2
      ) {
        return;
      }

      const nextElement = newElementWith(targetElement, {
        x: targetElement.x + targetElement.width / 2 - nextWidth / 2,
        y: targetElement.y + targetElement.height / 2 - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
        link: null,
        customData: {
          ...currentCustomData,
          intrinsicWidth: nextIntrinsicWidth,
          intrinsicHeight: nextIntrinsicHeight,
        },
      });

      excalidrawAPI.updateScene({
        elements: elements.map((element) =>
          element.id === elementId ? nextElement : element,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [excalidrawAPI],
  );

  const handleAutoResizeCodeBlock = useCallback(
    (elementId: string, size: { width: number; height: number }) => {
      if (!excalidrawAPI) {
        return;
      }

      const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const targetElement = elements.find(
        (element) => element.id === elementId,
      );

      if (!targetElement || !isEmbeddableElement(targetElement)) {
        return;
      }

      const nextWidth = Math.max(Math.round(size.width), 1);
      const nextHeight = Math.max(Math.round(size.height), 1);
      const currentCustomData = (targetElement.customData || {}) as Record<
        string,
        unknown
      >;
      const prevIntrinsicWidth =
        typeof currentCustomData.intrinsicWidth === "number"
          ? Math.max(currentCustomData.intrinsicWidth, 1)
          : Math.max(targetElement.width, 1);
      const isUsingNaturalWidth =
        Math.abs(targetElement.width - prevIntrinsicWidth) < 2;
      const resolvedWidth = isUsingNaturalWidth
        ? nextWidth
        : Math.max(targetElement.width, 1);

      if (
        Math.abs(targetElement.width - resolvedWidth) < 1 &&
        Math.abs(targetElement.height - nextHeight) < 1 &&
        currentCustomData.intrinsicWidth === nextWidth &&
        currentCustomData.intrinsicHeight === nextHeight
      ) {
        return;
      }

      const updatedElement = newElementWith(targetElement, {
        width: resolvedWidth,
        height: nextHeight,
        link: null,
        customData: {
          ...currentCustomData,
          intrinsicWidth: nextWidth,
          intrinsicHeight: nextHeight,
        },
      });

      excalidrawAPI.updateScene({
        elements: elements.map((element) =>
          element.id === targetElement.id ? updatedElement : element,
        ),
        appState: {
          selectedElementIds: {
            [targetElement.id]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [excalidrawAPI],
  );

  const openEditableEmbeddable = useCallback(
    (target: { elementId: string; kind: "math-formula" | "code-block" }) => {
      if (!excalidrawAPI) {
        return;
      }

      const targetElement = excalidrawAPI
        .getSceneElementsIncludingDeleted()
        .find((element) => element.id === target.elementId);

      if (!targetElement || !isEmbeddableElement(targetElement)) {
        return;
      }

      if (target.kind === "code-block") {
        handleEditCodeBlock(targetElement);
      } else {
        handleEditMathFormula(targetElement);
      }
    },
    [excalidrawAPI, handleEditCodeBlock, handleEditMathFormula],
  );

  const renderEmbeddable = useCallback(
    (
      element: NonDeleted<ExcalidrawEmbeddableElement>,
      appState?: { theme?: "light" | "dark" },
    ) => {
      const codeBlockData = getCodeBlockElementData(element);

      if (codeBlockData) {
        return (
          <CodeBlockEmbeddable
            element={element}
            code={codeBlockData.source}
            style={codeBlockData.style}
            intrinsicWidth={codeBlockData.intrinsicWidth}
            intrinsicHeight={codeBlockData.intrinsicHeight}
            editorTheme={appState?.theme === "dark" ? "dark" : "light"}
            onAutoResize={(size) => handleAutoResizeCodeBlock(element.id, size)}
          />
        );
      }

      const mathFormulaData = getMathFormulaElementData(element);

      if (!mathFormulaData) {
        return null;
      }

      return (
        <MathFormulaEmbeddable
          element={element}
          formula={mathFormulaData.source}
          style={mathFormulaData.style}
          intrinsicWidth={mathFormulaData.intrinsicWidth}
          intrinsicHeight={mathFormulaData.intrinsicHeight}
          onAutoResize={(size) => handleAutoResizeMathFormula(element.id, size)}
        />
      );
    },
    [handleAutoResizeCodeBlock, handleAutoResizeMathFormula],
  );

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  return (
    <div
      style={{ height: "100%", position: "relative" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
      onDoubleClickCapture={(event) => {
        if (
          mathFormulaDialogState ||
          codeBlockDialogState ||
          !(event.target instanceof HTMLCanvasElement)
        ) {
          return;
        }

        const lastPointer = lastEditableEmbeddablePointerRef.current;

        if (
          !lastPointer ||
          Date.now() - lastPointer.timestamp >
            CUSTOM_EMBEDDABLE_DOUBLE_CLICK_MS + 150
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        lastEditableEmbeddablePointerRef.current = null;
        openEditableEmbeddable(lastPointer);
      }}
    >
      <Excalidraw
        onChange={onChange}
        onPointerDown={(activeTool, pointerDownState) => {
          const hitElement = pointerDownState.hit.element;
          const isDialogOpen =
            !!mathFormulaDialogState || !!codeBlockDialogState;

          if (
            activeTool.type === "custom" &&
            activeTool.customType === "math-formula" &&
            !mathFormulaDialogState
          ) {
            try {
              handleInsertMathFormulaAtPointer(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
                activeTool,
              );
            } catch (error) {
              setErrorMessage(
                error instanceof Error ? error.message : String(error),
              );
              if (!activeTool.locked) {
                excalidrawAPI?.setActiveTool({ type: "selection" });
              }
            }
            return;
          }

          if (
            activeTool.type === "custom" &&
            activeTool.customType === "code-block" &&
            !codeBlockDialogState
          ) {
            try {
              handleInsertCodeBlockAtPointer(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
                activeTool,
              );
            } catch (error) {
              setErrorMessage(
                error instanceof Error ? error.message : String(error),
              );
              if (!activeTool.locked) {
                excalidrawAPI?.setActiveTool({ type: "selection" });
              }
            }
            return;
          }

          if (activeTool.type !== "selection" || isDialogOpen) {
            lastEditableEmbeddablePointerRef.current = null;
            return;
          }

          const codeBlockData = getCodeBlockElementData(hitElement);
          const mathFormulaData = getMathFormulaElementData(hitElement);
          const umlTemplateRootId = getUmlClassTemplateRootId(hitElement);
          const umlDiagramRootId = getUmlDiagramTemplateRootId(hitElement);
          const umlDiagramData = getUmlDiagramTemplateData(hitElement);
          const editableKind = codeBlockData
            ? "code-block"
            : mathFormulaData
            ? "math-formula"
            : null;

          if (umlTemplateRootId) {
            window.setTimeout(() => {
              void excalidrawAPI?.toggleSidebar({
                name: "default",
                tab: "uml-template",
                force: true,
              });
            }, 0);
          }

          if (
            umlDiagramRootId &&
            umlDiagramData &&
            isEditableUmlDiagramTemplatePreset(umlDiagramData.preset)
          ) {
            window.setTimeout(() => {
              void excalidrawAPI?.toggleSidebar({
                name: "default",
                tab: "uml-template",
                force: true,
              });
            }, 0);
          }

          if (!editableKind || !hitElement) {
            lastEditableEmbeddablePointerRef.current = null;
            return;
          }

          lastEditableEmbeddablePointerRef.current = {
            elementId: hitElement.id,
            timestamp: Date.now(),
            kind: editableKind,
          };
        }}
        onExport={onExport}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        renderEmbeddable={renderEmbeddable}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile) {
            return null;
          }

          return (
            <div className="excalidraw-ui-top-right">
              <div
                className={clsx(
                  "cloud-save-indicator",
                  `cloud-save-indicator--${saveIndicatorStatus}`,
                )}
                title={saveIndicatorMessage || getSaveIndicatorLabel()}
              >
                {getSaveIndicatorLabel()}
              </div>
              <button
                type="button"
                className="cloud-save-button"
                onClick={() => {
                  handleSaveToCloud().catch((error: Error) => {
                    setErrorMessage(error.message);
                  });
                }}
                disabled={isSavingToCloud}
              >
                {isSavingToCloud ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="cloud-save-button cloud-save-button--secondary"
                onClick={() => {
                  handleSaveAsToCloud().catch((error: Error) => {
                    setErrorMessage(error.message);
                  });
                }}
                disabled={isSavingToCloud}
              >
                Save as
              </button>
              {collabError.message && <CollabError collabError={collabError} />}
              {collabAPI && !isCollabDisabled && (
                <LiveCollaborationTrigger
                  isCollaborating={isCollaborating}
                  onSelect={() =>
                    setShareDialogState({ isOpen: true, type: "share" })
                  }
                  editorInterface={editorInterface}
                />
              )}
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <WorkspaceEntryTrigger
          onOpenWorkspace={() => setAppMode("workspace")}
        />
        <AppWelcomeScreen
          onCollabDialogOpen={onCollabDialogOpen}
          isCollabEnabled={!isCollabDisabled}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
        </OverwriteConfirmDialog>
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        <AppSidebar
          onOpenWorkspace={() => setAppMode("workspace")}
          onInstallPWA={() => {
            void handleInstallPWA();
          }}
          showInstallPWA={showInstallPWA}
          umlTemplateData={selectedUmlClassData}
          onChangeUmlTemplate={handleUpdateSelectedUmlClass}
          umlDiagramTemplateData={selectedUmlDiagramData}
          onChangeUmlDiagramTemplate={handleUpdateSelectedUmlDiagram}
        />

        {mathFormulaDialogState && (
          <MathFormulaDialog
            initialValue={mathFormulaDialogState.initialValue}
            initialStyle={mathFormulaDialogState.initialStyle}
            mode={mathFormulaDialogState.mode}
            onClose={handleCloseMathFormulaDialog}
            onSubmit={handleSubmitMathFormula}
          />
        )}

        {isTemplateLibraryDialogOpen && (
          <TemplateLibraryDialog
            onClose={handleCloseTemplateLibraryDialog}
            onInsertUmlClass={handleInsertUmlClassTemplate}
            onInsertUmlDiagram={handleInsertUmlDiagramTemplate}
          />
        )}

        {codeBlockDialogState && (
          <CodeBlockDialog
            initialValue={codeBlockDialogState.initialValue}
            initialStyle={codeBlockDialogState.initialStyle}
            mode={codeBlockDialogState.mode}
            onClose={handleCloseCodeBlockDialog}
            onSubmit={handleSubmitCodeBlock}
          />
        )}

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: "Workspace",
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              keywords: [
                "workspace",
                "drive",
                "google",
                "cloud",
                "folder",
                "project",
              ],
              perform: () => {
                setAppMode("workspace");
              },
            },
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => canInstallPWA,
              perform: () => {
                void handleInstallPWA();
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
      {appMode === "workspace" && (
        <WorkspacePage
          onBackToEditor={() => setAppMode("editor")}
          onOpenGoogleDriveFile={handleOpenGoogleDriveFile}
          onCreateGoogleDriveFile={handleCreateGoogleDriveFile}
          onCurrentGoogleDriveFileRenamed={handleCurrentGoogleDriveFileRenamed}
          onCurrentGoogleDriveFileDeleted={handleCurrentGoogleDriveFileDeleted}
          onOpenLocalFile={handleOpenLocalFile}
          onCreateLocalFile={handleCreateLocalFile}
          onCurrentLocalFileRenamed={handleCurrentLocalFileRenamed}
          onCurrentLocalFileDeleted={handleCurrentLocalFileDeleted}
          currentFileProvider={
            primaryFile?.provider === "gdrive" ||
            primaryFile?.provider === "local"
              ? primaryFile.provider
              : null
          }
          currentFileId={primaryFile?.fileId ?? null}
          theme={editorTheme}
        />
      )}
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawWrapper />
        </ExcalidrawAPIProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;

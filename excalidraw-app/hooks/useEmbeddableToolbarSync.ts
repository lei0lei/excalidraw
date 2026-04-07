import { useCallback, useEffect, useRef } from "react";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import { isEmbeddableElement, newElementWith } from "@excalidraw/element";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  measureCodeBlockDimensions,
  normalizeCodeBlockStyle,
} from "../code/codeBlock";
import {
  measureMathFormulaDimensions,
  normalizeMathFormulaStyle,
} from "../math/formula";
import {
  getCodeBlockElementData,
  getMathFormulaElementData,
  resolveMathFormulaColorFromSidebar,
} from "../embeddable/elementData";

/**
 * When a code block or math formula embeddable is selected, keep its stored style
 * in sync with the properties sidebar (font size, stroke color → formula color, etc.).
 * Coalesced with rAF so rapid onChange bursts do not repeatedly measure/update the scene.
 */
export function useEmbeddableToolbarSync({
  excalidrawAPI,
  editorTheme,
  isEmbeddableDialogOpen,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  editorTheme: "light" | "dark";
  /** While a code/math embeddable dialog is open, skip sync to avoid racing updateScene with the modal. */
  isEmbeddableDialogOpen: () => boolean;
}) {
  const pendingRef = useRef<{
    appState: AppState;
    elementsById: Map<string, ExcalidrawElement>;
    elements: readonly ExcalidrawElement[];
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const performSync = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      elementsById: Map<string, ExcalidrawElement>,
    ): boolean => {
      if (!excalidrawAPI) {
        return false;
      }

      if (isEmbeddableDialogOpen()) {
        return false;
      }

      const selectedElementIds = Object.keys(
        appState.selectedElementIds || {},
      ).filter((elementId) => appState.selectedElementIds?.[elementId]);

      if (selectedElementIds.length !== 1) {
        return false;
      }

      const selectedElement = elementsById.get(selectedElementIds[0]);

      if (!selectedElement || !isEmbeddableElement(selectedElement)) {
        return false;
      }

      const codeBlockData = getCodeBlockElementData(
        selectedElement as NonDeletedExcalidrawElement,
      );

      if (codeBlockData) {
        if (!codeBlockData.source.trim()) {
          return false;
        }

        const sidebarStyle = normalizeCodeBlockStyle({
          ...codeBlockData.style,
          fontSize: appState.currentItemFontSize,
        });

        const didSidebarStyleChange =
          sidebarStyle.fontSize !== codeBlockData.style.fontSize ||
          sidebarStyle.highlightStyle !== codeBlockData.style.highlightStyle ||
          sidebarStyle.highlightCustomBorderColor !==
            codeBlockData.style.highlightCustomBorderColor ||
          sidebarStyle.highlightCustomBackground !==
            codeBlockData.style.highlightCustomBackground ||
          sidebarStyle.highlightBorderWidth !==
            codeBlockData.style.highlightBorderWidth ||
          sidebarStyle.highlightBorderRadius !==
            codeBlockData.style.highlightBorderRadius;

        if (!didSidebarStyleChange) {
          return false;
        }

        const {
          width: nextIntrinsicWidth,
          height: nextIntrinsicHeight,
          style: normalizedStyle,
        } = measureCodeBlockDimensions(codeBlockData.source, sidebarStyle);
        const currentCustomData = (selectedElement.customData || {}) as Record<
          string,
          unknown
        >;
        const prevIntrinsicWidth =
          typeof currentCustomData.intrinsicWidth === "number"
            ? Math.max(currentCustomData.intrinsicWidth, 1)
            : Math.max(selectedElement.width, 1);
        const prevIntrinsicHeight =
          typeof currentCustomData.intrinsicHeight === "number"
            ? Math.max(currentCustomData.intrinsicHeight, 1)
            : Math.max(selectedElement.height, 1);
        const widthScale = selectedElement.width / prevIntrinsicWidth;
        const heightScale = selectedElement.height / prevIntrinsicHeight;
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
        const updatedElement = newElementWith(selectedElement, {
          width: nextWidth,
          height: nextHeight,
          link: null,
          customData: {
            ...currentCustomData,
            codeBlockStyle: normalizedStyle,
            intrinsicWidth: nextIntrinsicWidth,
            intrinsicHeight: nextIntrinsicHeight,
          },
        });

        excalidrawAPI.updateScene({
          elements: elements.map((element) =>
            element.id === selectedElement.id ? updatedElement : element,
          ),
          appState: {
            selectedElementIds: {
              [selectedElement.id]: true,
            },
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return true;
      }

      const mathFormulaData = getMathFormulaElementData(
        selectedElement as NonDeletedExcalidrawElement,
      );

      if (!mathFormulaData) {
        return false;
      }

      if (!mathFormulaData.source.trim()) {
        return false;
      }

      const sidebarStyle = normalizeMathFormulaStyle({
        ...mathFormulaData.style,
        fontSize: appState.currentItemFontSize,
        color: resolveMathFormulaColorFromSidebar(
          appState.currentItemStrokeColor,
          editorTheme,
        ),
      });

      const didSidebarStyleChange =
        sidebarStyle.fontSize !== mathFormulaData.style.fontSize ||
        sidebarStyle.color !== mathFormulaData.style.color ||
        sidebarStyle.displayMode !== mathFormulaData.style.displayMode;

      if (!didSidebarStyleChange) {
        return false;
      }

      const {
        width: nextIntrinsicWidth,
        height: nextIntrinsicHeight,
        style: normalizedStyle,
      } = measureMathFormulaDimensions(mathFormulaData.source, sidebarStyle);

      const currentCustomData = (selectedElement.customData || {}) as Record<
        string,
        unknown
      >;
      const prevIntrinsicWidth =
        typeof currentCustomData.intrinsicWidth === "number"
          ? Math.max(currentCustomData.intrinsicWidth, 1)
          : Math.max(selectedElement.width, 1);
      const prevIntrinsicHeight =
        typeof currentCustomData.intrinsicHeight === "number"
          ? Math.max(currentCustomData.intrinsicHeight, 1)
          : Math.max(selectedElement.height, 1);
      const widthScale = selectedElement.width / prevIntrinsicWidth;
      const heightScale = selectedElement.height / prevIntrinsicHeight;
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

      const updatedElement = newElementWith(selectedElement, {
        width: nextWidth,
        height: nextHeight,
        link: null,
        customData: {
          ...currentCustomData,
          formulaStyle: normalizedStyle,
          intrinsicWidth: nextIntrinsicWidth,
          intrinsicHeight: nextIntrinsicHeight,
        },
      });

      excalidrawAPI.updateScene({
        elements: elements.map((element) =>
          element.id === selectedElement.id ? updatedElement : element,
        ),
        appState: {
          selectedElementIds: {
            [selectedElement.id]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return true;
    },
    [excalidrawAPI, editorTheme, isEmbeddableDialogOpen],
  );

  const syncEmbeddableToolbarFromSidebar = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      elementsById: Map<string, ExcalidrawElement>,
    ): void => {
      pendingRef.current = { elements, appState, elementsById };
      if (rafRef.current != null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        if (!pending) {
          return;
        }
        try {
          performSync(pending.elements, pending.appState, pending.elementsById);
        } catch (error) {
          console.error(
            "Failed to sync code block / math formula toolbar state",
            error,
          );
        }
      });
    },
    [performSync],
  );

  return { syncEmbeddableToolbarFromSidebar };
}

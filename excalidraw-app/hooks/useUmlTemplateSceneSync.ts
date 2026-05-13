import { useCallback, useEffect, useRef } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  areBarChartTemplateDataEqual,
  areLineChartTemplateDataEqual,
  arePieChartTemplateDataEqual,
  readBarChartTemplateDataFromRoot,
  readLineChartTemplateDataFromRoot,
  readPieChartTemplateDataFromRoot,
  serializeBarChartTemplateDataForSync,
  serializeLineChartTemplateDataForSync,
  serializePieChartTemplateDataForSync,
  type BarChartTemplateData,
  type LineChartTemplateData,
  type PieChartTemplateData,
  getChartGraphicPresetFromElement,
  getUmlClassTemplateData,
  getUmlDiagramTemplateData,
  isEditableUmlDiagramTemplatePreset,
  resolveSelectedChartGraphicRootWithMap,
  resolveSelectedUmlClassTemplateRootWithMap,
  resolveSelectedUmlDiagramTemplateRootWithMap,
  type ChartGraphicPreset,
  type UmlClassTemplateData,
  type UmlDiagramTemplateData,
} from "../templates";

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

export type UmlTemplateSceneSyncParams = {
  setSelectedUmlClassRootId: (id: string | null) => void;
  setSelectedUmlClassData: (data: UmlClassTemplateData | null) => void;
  setSelectedUmlDiagramRootId: (id: string | null) => void;
  setSelectedUmlDiagramData: (data: UmlDiagramTemplateData | null) => void;
  setSelectedChartGraphicRootId: (id: string | null) => void;
  setSelectedChartGraphicPreset: (preset: ChartGraphicPreset | null) => void;
  setSelectedBarChartTemplateData: (data: BarChartTemplateData | null) => void;
  setSelectedLineChartTemplateData: (
    data: LineChartTemplateData | null,
  ) => void;
  setSelectedPieChartTemplateData: (data: PieChartTemplateData | null) => void;
};

/**
 * Keeps UML template sidebar state in sync with the current selection.
 *
 * Intentionally does **not** run `sync*TemplateLayoutInScene` from the canvas `onChange`:
 * that relayout caused repeated `updateScene` (new array refs), selection jitter, and UI
 * freezes. Layout fixes run when the user edits template data via the sidebar
 * (`updateUmlClassTemplateInScene` / `updateUmlDiagramTemplateInScene`).
 *
 * Sync work is coalesced with `requestAnimationFrame` so rapid `onChange` bursts do not
 * repeat resolver work every call.
 */
export function useUmlTemplateSceneSync({
  setSelectedUmlClassRootId,
  setSelectedUmlClassData,
  setSelectedUmlDiagramRootId,
  setSelectedUmlDiagramData,
  setSelectedChartGraphicRootId,
  setSelectedChartGraphicPreset,
  setSelectedBarChartTemplateData,
  setSelectedLineChartTemplateData,
  setSelectedPieChartTemplateData,
}: UmlTemplateSceneSyncParams) {
  const selectedUmlClassRootIdRef = useRef<string | null>(null);
  const selectedUmlClassDataRef = useRef<UmlClassTemplateData | null>(null);
  const umlClassSelectionSignatureRef = useRef("");
  const selectedUmlDiagramRootIdRef = useRef<string | null>(null);
  const selectedUmlDiagramDataRef = useRef<UmlDiagramTemplateData | null>(null);
  const umlDiagramSelectionSignatureRef = useRef("");
  const selectedChartGraphicRootIdRef = useRef<string | null>(null);
  const selectedChartGraphicPresetRef = useRef<ChartGraphicPreset | null>(null);
  const chartGraphicSelectionSignatureRef = useRef("");
  const selectedBarChartTemplateDataRef = useRef<BarChartTemplateData | null>(
    null,
  );
  const selectedLineChartTemplateDataRef = useRef<LineChartTemplateData | null>(
    null,
  );
  const selectedPieChartTemplateDataRef = useRef<PieChartTemplateData | null>(
    null,
  );

  type PendingSync = {
    appState: AppState;
    elementsById: Map<string, ExcalidrawElement>;
  };
  const pendingUmlSyncRef = useRef<PendingSync | null>(null);
  const umlSyncRafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (umlSyncRafRef.current != null) {
        cancelAnimationFrame(umlSyncRafRef.current);
      }
    },
    [],
  );

  const performUmlTemplateSceneSync = useCallback(
    (
      appState: AppState,
      elementsById: Map<string, ExcalidrawElement>,
    ): void => {
      const selectedElementIdsSignature = getSelectedElementIdsSignature(
        appState.selectedElementIds,
      );

      try {
        const selectedUmlRoot = resolveSelectedUmlClassTemplateRootWithMap(
          elementsById,
          appState.selectedElementIds,
        );
        const selectedUmlDiagramRoot =
          resolveSelectedUmlDiagramTemplateRootWithMap(
            elementsById,
            appState.selectedElementIds,
          );

        const nextSelectedUmlData = getUmlClassTemplateData(selectedUmlRoot);
        const nextSelectedUmlRootId = selectedUmlRoot?.id || null;
        const nextUmlClassSelectionSignature = buildUmlSelectionSignature(
          selectedElementIdsSignature,
          nextSelectedUmlRootId,
          serializeUmlClassTemplateData(nextSelectedUmlData),
        );

        if (
          umlClassSelectionSignatureRef.current !==
          nextUmlClassSelectionSignature
        ) {
          umlClassSelectionSignatureRef.current =
            nextUmlClassSelectionSignature;

          const rootChanged =
            selectedUmlClassRootIdRef.current !== nextSelectedUmlRootId;
          const dataChanged = !areUmlClassTemplateDataEqual(
            selectedUmlClassDataRef.current,
            nextSelectedUmlData,
          );
          if (rootChanged) {
            selectedUmlClassRootIdRef.current = nextSelectedUmlRootId;
          }
          if (dataChanged) {
            selectedUmlClassDataRef.current = nextSelectedUmlData;
          }
          if (rootChanged || dataChanged) {
            const nextRoot = nextSelectedUmlRootId;
            const nextData = nextSelectedUmlData;
            queueMicrotask(() => {
              if (rootChanged) {
                setSelectedUmlClassRootId(nextRoot);
              }
              if (dataChanged) {
                setSelectedUmlClassData(nextData);
              }
            });
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

          const diagramRootChanged =
            selectedUmlDiagramRootIdRef.current !==
            nextSelectedUmlDiagramRootId;
          const diagramDataChanged = !areUmlDiagramTemplateDataEqual(
            selectedUmlDiagramDataRef.current,
            editableUmlDiagramData,
          );
          if (diagramRootChanged) {
            selectedUmlDiagramRootIdRef.current = nextSelectedUmlDiagramRootId;
          }
          if (diagramDataChanged) {
            selectedUmlDiagramDataRef.current = editableUmlDiagramData;
          }
          if (diagramRootChanged || diagramDataChanged) {
            const nextDiagramRoot = nextSelectedUmlDiagramRootId;
            const nextDiagramData = editableUmlDiagramData;
            queueMicrotask(() => {
              if (diagramRootChanged) {
                setSelectedUmlDiagramRootId(nextDiagramRoot);
              }
              if (diagramDataChanged) {
                setSelectedUmlDiagramData(nextDiagramData);
              }
            });
          }
        }

        const selectedChartGraphicRoot = resolveSelectedChartGraphicRootWithMap(
          elementsById,
          appState.selectedElementIds,
        );
        const nextChartPreset = selectedChartGraphicRoot
          ? getChartGraphicPresetFromElement(selectedChartGraphicRoot)
          : null;
        const nextSelectedChartGraphicRootId = nextChartPreset
          ? selectedChartGraphicRoot?.id || null
          : null;
        const nextBarData =
          nextChartPreset === "bar-chart" && selectedChartGraphicRoot
            ? readBarChartTemplateDataFromRoot(selectedChartGraphicRoot)
            : null;
        const nextLineData =
          nextChartPreset === "line-chart" && selectedChartGraphicRoot
            ? readLineChartTemplateDataFromRoot(selectedChartGraphicRoot)
            : null;
        const nextPieData =
          nextChartPreset === "pie-chart" && selectedChartGraphicRoot
            ? readPieChartTemplateDataFromRoot(selectedChartGraphicRoot)
            : null;
        const chartSubSignature =
          nextChartPreset === "bar-chart"
            ? serializeBarChartTemplateDataForSync(nextBarData)
            : nextChartPreset === "line-chart"
            ? serializeLineChartTemplateDataForSync(nextLineData)
            : nextChartPreset === "pie-chart"
            ? serializePieChartTemplateDataForSync(nextPieData)
            : "";
        const nextChartGraphicSelectionSignature = buildUmlSelectionSignature(
          selectedElementIdsSignature,
          nextSelectedChartGraphicRootId,
          [nextChartPreset || "", chartSubSignature].join("@@"),
        );

        if (
          chartGraphicSelectionSignatureRef.current !==
          nextChartGraphicSelectionSignature
        ) {
          chartGraphicSelectionSignatureRef.current =
            nextChartGraphicSelectionSignature;

          const chartRootChanged =
            selectedChartGraphicRootIdRef.current !==
            nextSelectedChartGraphicRootId;
          const chartPresetChanged =
            selectedChartGraphicPresetRef.current !== nextChartPreset;
          const barDataChanged = !areBarChartTemplateDataEqual(
            selectedBarChartTemplateDataRef.current,
            nextBarData,
          );
          const lineDataChanged = !areLineChartTemplateDataEqual(
            selectedLineChartTemplateDataRef.current,
            nextLineData,
          );
          const pieDataChanged = !arePieChartTemplateDataEqual(
            selectedPieChartTemplateDataRef.current,
            nextPieData,
          );

          if (chartRootChanged) {
            selectedChartGraphicRootIdRef.current =
              nextSelectedChartGraphicRootId;
          }
          if (chartPresetChanged) {
            selectedChartGraphicPresetRef.current = nextChartPreset;
          }
          if (barDataChanged) {
            selectedBarChartTemplateDataRef.current = nextBarData;
          }
          if (lineDataChanged) {
            selectedLineChartTemplateDataRef.current = nextLineData;
          }
          if (pieDataChanged) {
            selectedPieChartTemplateDataRef.current = nextPieData;
          }

          if (
            chartRootChanged ||
            chartPresetChanged ||
            barDataChanged ||
            lineDataChanged ||
            pieDataChanged
          ) {
            const nextChartRoot = nextSelectedChartGraphicRootId;
            const nextPreset = nextChartPreset;
            const nextBar = nextBarData;
            const nextLine = nextLineData;
            const nextPie = nextPieData;
            queueMicrotask(() => {
              if (chartRootChanged) {
                setSelectedChartGraphicRootId(nextChartRoot);
              }
              if (chartPresetChanged) {
                setSelectedChartGraphicPreset(nextPreset);
              }
              if (barDataChanged) {
                setSelectedBarChartTemplateData(nextBar);
              }
              if (lineDataChanged) {
                setSelectedLineChartTemplateData(nextLine);
              }
              if (pieDataChanged) {
                setSelectedPieChartTemplateData(nextPie);
              }
            });
          }
        }
      } catch (error) {
        console.error("Failed to sync UML template sidebar state", error);
        umlClassSelectionSignatureRef.current = "";
        umlDiagramSelectionSignatureRef.current = "";
        chartGraphicSelectionSignatureRef.current = "";
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
        if (selectedChartGraphicRootIdRef.current !== null) {
          selectedChartGraphicRootIdRef.current = null;
          setSelectedChartGraphicRootId(null);
        }
        if (selectedChartGraphicPresetRef.current !== null) {
          selectedChartGraphicPresetRef.current = null;
          setSelectedChartGraphicPreset(null);
        }
        if (selectedBarChartTemplateDataRef.current !== null) {
          selectedBarChartTemplateDataRef.current = null;
          setSelectedBarChartTemplateData(null);
        }
        if (selectedLineChartTemplateDataRef.current !== null) {
          selectedLineChartTemplateDataRef.current = null;
          setSelectedLineChartTemplateData(null);
        }
        if (selectedPieChartTemplateDataRef.current !== null) {
          selectedPieChartTemplateDataRef.current = null;
          setSelectedPieChartTemplateData(null);
        }
      }
    },
    [
      setSelectedUmlClassRootId,
      setSelectedUmlClassData,
      setSelectedUmlDiagramRootId,
      setSelectedUmlDiagramData,
      setSelectedChartGraphicRootId,
      setSelectedChartGraphicPreset,
      setSelectedBarChartTemplateData,
      setSelectedLineChartTemplateData,
      setSelectedPieChartTemplateData,
    ],
  );

  const syncUmlTemplateScene = useCallback(
    (
      _elements: readonly ExcalidrawElement[],
      appState: AppState,
      elementsById: Map<string, ExcalidrawElement>,
    ): void => {
      pendingUmlSyncRef.current = { appState, elementsById };
      if (umlSyncRafRef.current != null) {
        return;
      }
      umlSyncRafRef.current = requestAnimationFrame(() => {
        umlSyncRafRef.current = null;
        const pending = pendingUmlSyncRef.current;
        if (!pending) {
          return;
        }
        performUmlTemplateSceneSync(pending.appState, pending.elementsById);
      });
    },
    [performUmlTemplateSceneSync],
  );

  return { syncUmlTemplateScene };
}

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  DEFAULT_ELEMENT_STROKE_PICKS,
  isColorDark,
  randomId,
} from "@excalidraw/common";
import {
  FillCrossHatchIcon,
  FillHachureIcon,
  FillSolidIcon,
  FillZigZagIcon,
  PlusIcon,
  slashIcon,
  strokeIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { FullColorPickerPopover } from "@excalidraw/excalidraw/components/ColorPicker/FullColorPickerPopover";
import { ButtonSeparator } from "@excalidraw/excalidraw/components/ButtonSeparator";
import { RadioSelection } from "@excalidraw/excalidraw/components/RadioSelection";
import { Switch } from "@excalidraw/excalidraw/components/Switch";
import {
  useExcalidrawAppState,
  useExcalidrawElements,
} from "@excalidraw/excalidraw/components/App";
import { useI18n, useStylesPanelMode } from "@excalidraw/excalidraw";

import clsx from "clsx";
import { Popover } from "radix-ui";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { FillStyle } from "@excalidraw/element/types";

import {
  areBarChartTemplateDataEqual,
  BAR_CHART_DEFAULT_COLORS,
  normalizeBarChartItem,
  normalizeBarChartTemplateData,
  type BarChartTemplateData,
} from "../templates";

import "./BarChartTemplateSidebar.scss";

type BarChartTemplateSidebarProps = {
  data: BarChartTemplateData | null;
  onChange: (data: BarChartTemplateData) => void;
  templateInstanceId?: string | null;
};

const BAR_QUICK_COLORS = DEFAULT_ELEMENT_STROKE_PICKS;

export const BarChartTemplateSidebar = ({
  data,
  onChange,
  templateInstanceId = null,
}: BarChartTemplateSidebarProps) => {
  const { t } = useI18n();
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";
  const isMobileMode = stylesPanelMode === "mobile";

  const canonical = data ? normalizeBarChartTemplateData(data) : null;

  const [draft, setDraft] = useState<BarChartTemplateData | null>(canonical);
  const [customColorItemId, setCustomColorItemId] = useState<string | null>(
    null,
  );

  const dataRef = useRef(data);
  const selectionKeyRef = useRef<string | null>(null);
  const suppressDataSyncRef = useRef(false);
  const emitBarChartChangeRef = useRef(onChange);
  emitBarChartChangeRef.current = onChange;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!data) {
      setDraft(null);
      selectionKeyRef.current = null;
      return;
    }
    const next = normalizeBarChartTemplateData(data);
    const selectionKey = templateInstanceId ?? "";
    if (selectionKeyRef.current !== selectionKey) {
      selectionKeyRef.current = selectionKey;
      setDraft(next);
      return;
    }
    if (suppressDataSyncRef.current) {
      return;
    }
    setDraft((prev) => {
      if (!prev) {
        return next;
      }
      if (areBarChartTemplateDataEqual(prev, next)) {
        return prev;
      }
      return next;
    });
  }, [data, templateInstanceId]);

  const patchedDraft = useMemo(
    () => (draft ? normalizeBarChartTemplateData(draft) : null),
    [draft],
  );

  useEffect(() => {
    if (
      !patchedDraft ||
      !canonical ||
      areBarChartTemplateDataEqual(patchedDraft, canonical)
    ) {
      return;
    }
    const id = requestAnimationFrame(() => {
      emitBarChartChangeRef.current(patchedDraft);
    });
    return () => cancelAnimationFrame(id);
  }, [canonical, patchedDraft]);

  const onTemplateRangePointerDown = () => {
    suppressDataSyncRef.current = true;
    const finish = () => {
      suppressDataSyncRef.current = false;
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  if (!canonical || !draft) {
    return null;
  }

  const update = (next: BarChartTemplateData) => {
    setDraft(normalizeBarChartTemplateData(next));
  };

  const defaultItemFill: FillStyle = draft.items[0]?.fillStyle ?? "hachure";

  const chartTitleLabel = t("barChartTemplate.chartTitle", null, "Chart title");

  return (
    <div className="BarChartTemplateSidebar">
      <div className="BarChartTemplateSidebar__content">
        <div className="BarChartTemplateSidebar__inlineField">
          <span className="BarChartTemplateSidebar__inlineLabel">
            {chartTitleLabel}
          </span>
          <input
            className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--inline"
            value={draft.title}
            onChange={(e) => update({ ...draft, title: e.target.value })}
            aria-label={chartTitleLabel}
          />
        </div>

        <div className="BarChartTemplateSidebar__toggleRow">
          <span className="BarChartTemplateSidebar__toggleLabel">
            {t("barChartTemplate.showFrameBorder", null, "Frame border")}
          </span>
          <Switch
            name="bar-chart-frame-border"
            checked={draft.frameBorderEnabled}
            onChange={(checked) =>
              update({ ...draft, frameBorderEnabled: checked })
            }
          />
        </div>

        <div className="BarChartTemplateSidebar__inlineField">
          <span className="BarChartTemplateSidebar__inlineLabel">
            {t("barChartTemplate.axisXShort", null, "X")}
          </span>
          <input
            className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--inline"
            value={draft.xAxisLabel}
            onChange={(e) => update({ ...draft, xAxisLabel: e.target.value })}
          />
        </div>

        <div className="BarChartTemplateSidebar__inlineField">
          <span className="BarChartTemplateSidebar__inlineLabel">
            {t("barChartTemplate.axisYShort", null, "Y")}
          </span>
          <input
            className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--inline"
            value={draft.yAxisLabel}
            onChange={(e) => update({ ...draft, yAxisLabel: e.target.value })}
          />
        </div>

        <div className="BarChartTemplateSidebar__toggleRow">
          <span className="BarChartTemplateSidebar__toggleLabel">
            {t("barChartTemplate.showAxisTicks", null, "Axis ticks")}
          </span>
          <Switch
            name="bar-chart-show-ticks"
            checked={draft.showAxisTicks}
            onChange={(checked) => update({ ...draft, showAxisTicks: checked })}
          />
        </div>

        <div className="BarChartTemplateSidebar__toggleRow">
          <span className="BarChartTemplateSidebar__toggleLabel">
            {t("barChartTemplate.legend", null, "Legend")}
          </span>
          <Switch
            name="bar-chart-show-legend"
            checked={draft.legendVisible}
            onChange={(checked) => update({ ...draft, legendVisible: checked })}
          />
        </div>

        <div className="BarChartTemplateSidebar__sectionHeader BarChartTemplateSidebar__sectionHeader--items">
          <span>{t("barChartTemplate.items", null, "Bar settings")}</span>
          <button
            type="button"
            className="BarChartTemplateSidebar__iconButton"
            title={t("barChartTemplate.addItem", null, "Add bar")}
            aria-label={t("barChartTemplate.addItem", null, "Add bar")}
            onClick={() => {
              const nextIndex = draft.items.length;
              const color =
                BAR_CHART_DEFAULT_COLORS[
                  nextIndex % BAR_CHART_DEFAULT_COLORS.length
                ]!;
              update({
                ...draft,
                items: [
                  ...draft.items,
                  normalizeBarChartItem(
                    {
                      id: randomId(),
                      label: t("barChartTemplate.newItemName", null, "New bar"),
                      backgroundColor: color,
                      strokeColor: color,
                      value: 0.4,
                    },
                    defaultItemFill,
                  ),
                ],
              });
            }}
          >
            {PlusIcon}
          </button>
        </div>

        <ul className="BarChartTemplateSidebar__items">
          {draft.items.map((item, index) => {
            const barColor = item.backgroundColor || item.strokeColor || "";
            const customOpen = customColorItemId === item.id;
            const strokeLabel = t("labels.stroke", null, "Stroke");

            const patchItem = (patch: Partial<typeof draft.items[number]>) => {
              update({
                ...draft,
                items: draft.items.map((it, idx) =>
                  idx === index ? { ...it, ...patch } : it,
                ),
              });
            };

            return (
              <li key={item.id} className="BarChartTemplateSidebar__item">
                <div className="BarChartTemplateSidebar__itemHeadRow">
                  <input
                    className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--sm"
                    value={item.label}
                    aria-label={t(
                      "barChartTemplate.itemName",
                      null,
                      "Name (along baseline)",
                    )}
                    onChange={(e) => patchItem({ label: e.target.value })}
                  />
                  <button
                    type="button"
                    className="BarChartTemplateSidebar__iconButton BarChartTemplateSidebar__iconButton--danger BarChartTemplateSidebar__iconButton--compact"
                    disabled={draft.items.length <= 1}
                    title={t("barChartTemplate.removeItem", null, "Remove bar")}
                    aria-label={t(
                      "barChartTemplate.removeItem",
                      null,
                      "Remove bar",
                    )}
                    onClick={() => {
                      if (draft.items.length <= 1) {
                        return;
                      }
                      setCustomColorItemId((id) =>
                        id === item.id ? null : id,
                      );
                      update({
                        ...draft,
                        items: draft.items.filter((_, idx) => idx !== index),
                      });
                    }}
                  >
                    {TrashIcon}
                  </button>
                </div>

                <div className="BarChartTemplateSidebar__colorPickerShell">
                  <div
                    className={clsx(
                      "color-picker__top-picks",
                      "BarChartTemplateSidebar__colorSwatches",
                    )}
                  >
                    {BAR_QUICK_COLORS.map((color) => (
                      <button
                        key={`${item.id}-${color}`}
                        type="button"
                        className={clsx("color-picker__button", {
                          active: color === item.backgroundColor,
                          "is-transparent": color === "transparent" || !color,
                          "has-outline": !isColorDark(
                            color,
                            COLOR_OUTLINE_CONTRAST_THRESHOLD,
                          ),
                        })}
                        style={{ "--swatch-color": color } as CSSProperties}
                        title={color}
                        aria-label={color}
                        onClick={() =>
                          patchItem({
                            backgroundColor: color,
                            strokeColor: color,
                          })
                        }
                      >
                        <div className="color-picker__button-outline" />
                      </button>
                    ))}
                  </div>
                  <div
                    className="BarChartTemplateSidebar__colorPickerSeparator"
                    aria-hidden
                  >
                    <ButtonSeparator />
                  </div>
                  <div className="BarChartTemplateSidebar__colorPickerTriggerCell">
                    <Popover.Root
                      open={customOpen}
                      onOpenChange={(open) =>
                        setCustomColorItemId(open ? item.id : null)
                      }
                    >
                      <Popover.Trigger
                        type="button"
                        className={clsx(
                          "color-picker__button",
                          "active-color",
                          "properties-trigger",
                          {
                            "is-transparent":
                              !barColor || barColor === "transparent",
                            "has-outline":
                              !barColor ||
                              !isColorDark(
                                barColor,
                                COLOR_OUTLINE_CONTRAST_THRESHOLD,
                              ),
                            "compact-sizing": isCompactMode,
                            "mobile-border": isMobileMode,
                          },
                        )}
                        aria-label={strokeLabel}
                        title={t("labels.showStroke", null, "Show stroke")}
                        style={
                          barColor && barColor !== "transparent"
                            ? ({ "--swatch-color": barColor } as CSSProperties)
                            : undefined
                        }
                      >
                        <div className="color-picker__button-outline">
                          {(!barColor || barColor === "transparent") &&
                            slashIcon}
                        </div>
                        {isCompactMode &&
                          !!barColor &&
                          barColor !== "transparent" && (
                            <div className="color-picker__button-background">
                              <span
                                style={{
                                  color: isColorDark(
                                    barColor,
                                    COLOR_OUTLINE_CONTRAST_THRESHOLD,
                                  )
                                    ? "#fff"
                                    : "#111",
                                }}
                              >
                                {strokeIcon}
                              </span>
                            </div>
                          )}
                      </Popover.Trigger>
                      <FullColorPickerPopover
                        color={barColor || null}
                        label={strokeLabel}
                        type="elementStroke"
                        elements={elements}
                        appState={appState}
                        onChange={(nextColor) =>
                          patchItem({
                            backgroundColor: nextColor,
                            strokeColor: nextColor,
                          })
                        }
                        onRequestClose={() => setCustomColorItemId(null)}
                        popoverProps={{
                          desktopSide: "left",
                          desktopAlign: "start",
                          sideOffset: 8,
                          alignOffset: 0,
                          contentStyle: {
                            zIndex: "var(--zIndex-popup)",
                          },
                        }}
                      />
                    </Popover.Root>
                  </div>
                </div>

                <div className="BarChartTemplateSidebar__valueRow">
                  <input
                    id={`bar-chart-value-${item.id}`}
                    className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--sm"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={t(
                      "barChartTemplate.itemHeight",
                      null,
                      "Relative height",
                    )}
                    value={Math.round(item.value * 100)}
                    onPointerDown={onTemplateRangePointerDown}
                    onChange={(e) => {
                      const v = clampPercent(Number.parseFloat(e.target.value));
                      patchItem({ value: v / 100 });
                    }}
                  />
                  <span className="BarChartTemplateSidebar__percent">%</span>
                </div>

                <div className="BarChartTemplateSidebar__fillRow buttonList">
                  <RadioSelection
                    type="button"
                    value={item.fillStyle}
                    options={[
                      {
                        value: "hachure" as const,
                        text: t("labels.hachure", null, "Hachure"),
                        icon: FillHachureIcon,
                        testId: `bar-chart-${item.id}-fill-hachure`,
                      },
                      {
                        value: "cross-hatch" as const,
                        text: t("labels.crossHatch", null, "Cross-hatch"),
                        icon: FillCrossHatchIcon,
                        testId: `bar-chart-${item.id}-fill-cross-hatch`,
                      },
                      {
                        value: "solid" as const,
                        text: t("labels.solid", null, "Solid"),
                        icon: FillSolidIcon,
                        testId: `bar-chart-${item.id}-fill-solid`,
                      },
                      {
                        value: "zigzag" as const,
                        text: t("labels.zigzag", null, "Zigzag"),
                        icon: FillZigZagIcon,
                        testId: `bar-chart-${item.id}-fill-zigzag`,
                      },
                    ]}
                    onClick={(value) => patchItem({ fillStyle: value })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const clampPercent = (raw: number) => {
  if (!Number.isFinite(raw)) {
    return 35;
  }
  return Math.min(100, Math.max(0, Math.round(raw)));
};

import { randomId } from "@excalidraw/common";
import { PlusIcon, TrashIcon } from "@excalidraw/excalidraw/components/icons";
import { Switch } from "@excalidraw/excalidraw/components/Switch";
import { useI18n } from "@excalidraw/excalidraw";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  areLineChartTemplateDataEqual,
  normalizeLineChartItem,
  normalizeLineChartTemplateData,
  type LineChartTemplateData,
} from "../templates";

import "./BarChartTemplateSidebar.scss";

type LineChartTemplateSidebarProps = {
  data: LineChartTemplateData | null;
  onChange: (data: LineChartTemplateData) => void;
  templateInstanceId?: string | null;
};

export const LineChartTemplateSidebar = ({
  data,
  onChange,
  templateInstanceId = null,
}: LineChartTemplateSidebarProps) => {
  const { t } = useI18n();

  const canonical = data ? normalizeLineChartTemplateData(data) : null;

  const [draft, setDraft] = useState<LineChartTemplateData | null>(canonical);

  const selectionKeyRef = useRef<string | null>(null);
  const suppressDataSyncRef = useRef(false);
  const emitChangeRef = useRef(onChange);
  emitChangeRef.current = onChange;

  useEffect(() => {
    if (!data) {
      setDraft(null);
      selectionKeyRef.current = null;
      return;
    }
    const next = normalizeLineChartTemplateData(data);
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
      if (areLineChartTemplateDataEqual(prev, next)) {
        return prev;
      }
      return next;
    });
  }, [data, templateInstanceId]);

  const patchedDraft = useMemo(
    () => (draft ? normalizeLineChartTemplateData(draft) : null),
    [draft],
  );

  useEffect(() => {
    if (
      !patchedDraft ||
      !canonical ||
      areLineChartTemplateDataEqual(patchedDraft, canonical)
    ) {
      return;
    }
    const id = requestAnimationFrame(() => {
      emitChangeRef.current(patchedDraft);
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

  const update = (next: LineChartTemplateData) => {
    setDraft(normalizeLineChartTemplateData(next));
  };

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
            name="line-chart-frame-border"
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
            name="line-chart-show-ticks"
            checked={draft.showAxisTicks}
            onChange={(checked) => update({ ...draft, showAxisTicks: checked })}
          />
        </div>

        <div className="BarChartTemplateSidebar__toggleRow">
          <span className="BarChartTemplateSidebar__toggleLabel">
            {t("barChartTemplate.legend", null, "Legend")}
          </span>
          <Switch
            name="line-chart-show-legend"
            checked={draft.legendVisible}
            onChange={(checked) => update({ ...draft, legendVisible: checked })}
          />
        </div>

        <div className="BarChartTemplateSidebar__sectionHeader BarChartTemplateSidebar__sectionHeader--items">
          <span>{t("lineChartTemplate.items", null, "Points")}</span>
          <button
            type="button"
            className="BarChartTemplateSidebar__iconButton"
            title={t("lineChartTemplate.addItem", null, "Add point")}
            aria-label={t("lineChartTemplate.addItem", null, "Add point")}
            onClick={() => {
              update({
                ...draft,
                items: [
                  ...draft.items,
                  normalizeLineChartItem({
                    id: randomId(),
                    label: t(
                      "lineChartTemplate.newItemName",
                      null,
                      "New point",
                    ),
                    value: 0.4,
                  }),
                ],
              });
            }}
          >
            {PlusIcon}
          </button>
        </div>

        <ul className="BarChartTemplateSidebar__items">
          {draft.items.map((item, index) => {
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
                      "lineChartTemplate.itemName",
                      null,
                      "Name (along baseline)",
                    )}
                    onChange={(e) => patchItem({ label: e.target.value })}
                  />
                  <button
                    type="button"
                    className="BarChartTemplateSidebar__iconButton BarChartTemplateSidebar__iconButton--danger BarChartTemplateSidebar__iconButton--compact"
                    disabled={draft.items.length <= 1}
                    title={t(
                      "lineChartTemplate.removeItem",
                      null,
                      "Remove point",
                    )}
                    aria-label={t(
                      "lineChartTemplate.removeItem",
                      null,
                      "Remove point",
                    )}
                    onClick={() => {
                      if (draft.items.length <= 1) {
                        return;
                      }
                      update({
                        ...draft,
                        items: draft.items.filter((_, idx) => idx !== index),
                      });
                    }}
                  >
                    {TrashIcon}
                  </button>
                </div>

                <div className="BarChartTemplateSidebar__valueRow">
                  <input
                    id={`line-chart-value-${item.id}`}
                    className="BarChartTemplateSidebar__input BarChartTemplateSidebar__input--sm"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={t(
                      "lineChartTemplate.itemValue",
                      null,
                      "Relative value",
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

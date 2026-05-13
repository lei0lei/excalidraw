import { FONT_FAMILY, randomId } from "@excalidraw/common";
import {
  newElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

const STROKE = "#374151";
const LINE = "#9ca3af";
const FONT = FONT_FAMILY.Helvetica;

export type MindMapTemplatePreset =
  | "radial"
  | "right-branches"
  | "top-down-tree"
  | "outline-spine";

const topicColors = ["#eef2ff", "#ecfdf5", "#fff7ed", "#fce7f3", "#f0f9ff"];

const roundedNode = (
  x: number,
  y: number,
  width: number,
  height: number,
  backgroundColor: string,
  groupIds: string[],
): NonDeletedExcalidrawElement =>
  newElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: STROKE,
    backgroundColor,
    fillStyle: "solid",
    strokeWidth: 1.5,
    roundness: { type: 3, value: 10 },
    roughness: 0,
    groupIds,
  });

const topicLabel = (
  cx: number,
  cy: number,
  text: string,
  fontSize: number,
  groupIds: string[],
): NonDeletedExcalidrawElement =>
  newTextElement({
    x: cx,
    y: cy,
    text,
    fontSize,
    fontFamily: FONT,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: "#111827",
    groupIds,
  });

const connector = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  groupIds: string[],
): NonDeletedExcalidrawElement => {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return newLinearElement({
    type: "line",
    x,
    y,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    points: [
      [x1 - x, y1 - y],
      [x2 - x, y2 - y],
    ] as any,
    strokeColor: LINE,
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 0,
    groupIds,
  });
};

const nodeWithLabel = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  fontSize: number,
  colorIndex: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] => {
  const bg = topicColors[colorIndex % topicColors.length]!;
  const rect = roundedNode(x, y, width, height, bg, groupIds);
  const text = topicLabel(
    x + width / 2,
    y + height / 2,
    label,
    fontSize,
    groupIds,
  );
  return [rect, text];
};

const buildRadial = (
  ox: number,
  oy: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  const cx = ox + 210;
  const cy = oy + 154;
  const cw = 128;
  const ch = 48;
  const rx = cx - cw / 2;
  const ry = cy - ch / 2;
  els.push(...nodeWithLabel(rx, ry, cw, ch, "Central topic", 17, 0, groupIds));

  const branches: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    ci: number;
  }> = [
    { x: ox + 160, y: oy + 20, w: 100, h: 38, label: "Branch 1", ci: 1 },
    { x: ox + 300, y: oy + 136, w: 100, h: 38, label: "Branch 2", ci: 2 },
    { x: ox + 160, y: oy + 252, w: 100, h: 38, label: "Branch 3", ci: 3 },
    { x: ox + 22, y: oy + 136, w: 100, h: 38, label: "Branch 4", ci: 4 },
  ];

  for (const b of branches) {
    els.push(...nodeWithLabel(b.x, b.y, b.w, b.h, b.label, 15, b.ci, groupIds));
  }

  const attach = (bx: number, by: number, bw: number, bh: number) => {
    const tcx = bx + bw / 2;
    const tcy = by + bh / 2;
    const dx = tcx - cx;
    const dy = tcy - cy;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let x0 = cx;
    let y0 = cy;
    let x1 = tcx;
    let y1 = tcy;
    if (absY >= absX) {
      if (dy < 0) {
        y0 = ry;
        y1 = by + bh;
      } else {
        y0 = ry + ch;
        y1 = by;
      }
    } else if (dx < 0) {
      x0 = rx;
      x1 = bx + bw;
    } else {
      x0 = rx + cw;
      x1 = bx;
    }
    els.push(connector(x0, y0, x1, y1, groupIds));
  };

  for (const b of branches) {
    attach(b.x, b.y, b.w, b.h);
  }

  return els;
};

const buildRightBranches = (
  ox: number,
  oy: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  els.push(
    ...nodeWithLabel(ox + 24, oy + 96, 96, 120, "Main\ntopic", 16, 0, groupIds),
  );

  const rights = [
    { y: oy + 28, label: "Subtopic A" },
    { y: oy + 118, label: "Subtopic B" },
    { y: oy + 208, label: "Subtopic C" },
  ];
  const mainR = ox + 24 + 96;

  for (const r of rights) {
    const yc = r.y + 22;
    els.push(
      ...nodeWithLabel(ox + 168, r.y, 168, 44, r.label, 15, 1, groupIds),
    );
    els.push(connector(mainR, yc, ox + 168, yc, groupIds));
  }

  return els;
};

const buildTopDownTree = (
  ox: number,
  oy: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  const rootX = ox + 120;
  const rootY = oy + 16;
  els.push(...nodeWithLabel(rootX, rootY, 140, 42, "Root", 17, 0, groupIds));

  const c1 = { x: ox + 32, y: oy + 100, label: "Child A" };
  const c2 = { x: ox + 248, y: oy + 100, label: "Child B" };
  for (const [i, c] of [c1, c2].entries()) {
    els.push(...nodeWithLabel(c.x, c.y, 112, 40, c.label, 15, i + 1, groupIds));
  }

  const rootBottom = { x: rootX + 70, y: rootY + 42 };
  els.push(connector(rootBottom.x, rootBottom.y, ox + 88, oy + 100, groupIds));
  els.push(connector(rootBottom.x, rootBottom.y, ox + 304, oy + 100, groupIds));

  const leaves = [
    { x: ox + 12, y: oy + 188, label: "Detail A1" },
    { x: ox + 92, y: oy + 188, label: "Detail A2" },
    { x: ox + 228, y: oy + 188, label: "Detail B1" },
    { x: ox + 308, y: oy + 188, label: "Detail B2" },
  ];
  for (const [i, L] of leaves.entries()) {
    els.push(
      ...nodeWithLabel(L.x, L.y, 84, 34, L.label, 13, (i % 2) + 2, groupIds),
    );
  }

  els.push(connector(ox + 88, oy + 140, ox + 54, oy + 188, groupIds));
  els.push(connector(ox + 88, oy + 140, ox + 134, oy + 188, groupIds));
  els.push(connector(ox + 304, oy + 140, ox + 270, oy + 188, groupIds));
  els.push(connector(ox + 304, oy + 140, ox + 350, oy + 188, groupIds));

  return els;
};

const buildOutlineSpine = (
  ox: number,
  oy: number,
  groupIds: string[],
): NonDeletedExcalidrawElement[] => {
  const els: NonDeletedExcalidrawElement[] = [];
  const spineX = ox + 108;
  els.push(
    newLinearElement({
      type: "line",
      x: spineX,
      y: oy + 28,
      width: 0,
      height: 232,
      points: [
        [0, 0],
        [0, 232],
      ] as any,
      strokeColor: LINE,
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      groupIds,
    }),
  );

  const rows = [
    { y: oy + 32, side: "right" as const, text: "Topic 1" },
    { y: oy + 92, side: "left" as const, text: "Topic 2" },
    { y: oy + 152, side: "right" as const, text: "Topic 3" },
    { y: oy + 212, side: "left" as const, text: "Topic 4" },
  ];

  let idx = 0;
  for (const row of rows) {
    if (row.side === "right") {
      const bx = spineX + 16;
      els.push(
        ...nodeWithLabel(bx, row.y, 156, 36, row.text, 14, idx, groupIds),
      );
      els.push(connector(spineX, row.y + 18, bx, row.y + 18, groupIds));
    } else {
      const bx = spineX - 16 - 156;
      els.push(
        ...nodeWithLabel(bx, row.y, 156, 36, row.text, 14, idx, groupIds),
      );
      els.push(connector(spineX, row.y + 18, bx + 156, row.y + 18, groupIds));
    }
    idx += 1;
  }

  return els;
};

export const createMindMapTemplate = (
  originX: number,
  originY: number,
  preset: MindMapTemplatePreset,
): NonDeletedExcalidrawElement[] => {
  const groupIds = [randomId()];
  const ox = originX;
  const oy = originY;

  switch (preset) {
    case "radial":
      return buildRadial(ox, oy, groupIds);
    case "right-branches":
      return buildRightBranches(ox, oy, groupIds);
    case "top-down-tree":
      return buildTopDownTree(ox, oy, groupIds);
    case "outline-spine":
    default:
      return buildOutlineSpine(ox, oy, groupIds);
  }
};

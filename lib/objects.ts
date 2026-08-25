import { createId } from "./ids";
import type {
  ArrowObject,
  EllipseObject,
  MapObject,
  MapProject,
  PolygonObject,
  RectObject,
  TextObject,
} from "./types";

const FONT = "Arial, Helvetica, sans-serif";

function base(
  name: string,
  x: number,
  y: number,
  fill: string,
  extras?: Partial<MapObject>,
) {
  return {
    id: createId("obj"),
    name,
    x,
    y,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill,
    stroke: "#ffffff",
    strokeWidth: 4,
    ...extras,
  };
}

export function labeledRect(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  extras?: Partial<RectObject>,
): RectObject {
  return {
    ...base(name, x, y, fill),
    type: "rect",
    width,
    height,
    cornerRadius: 0,
    label: name.toUpperCase(),
    labelColor: "#ffffff",
    fontSize: 22,
    fontFamily: FONT,
    ...extras,
  };
}

export function labeledEllipse(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  extras?: Partial<EllipseObject>,
): EllipseObject {
  return {
    ...base(name, x, y, fill),
    type: "ellipse",
    width,
    height,
    label: name,
    labelColor: "#ffffff",
    fontSize: 16,
    fontFamily: FONT,
    ...extras,
  };
}

export function labeledPolygon(
  name: string,
  absPoints: number[],
  fill: string,
  extras?: Partial<PolygonObject>,
): PolygonObject {
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < absPoints.length; i += 2) {
    minX = Math.min(minX, absPoints[i]);
    minY = Math.min(minY, absPoints[i + 1]);
  }
  const points = absPoints.map((value, index) =>
    index % 2 === 0 ? value - minX : value - minY,
  );
  return {
    ...base(name, minX, minY, fill),
    type: "polygon",
    points,
    label: name.toUpperCase(),
    labelColor: "#ffffff",
    fontSize: 22,
    fontFamily: FONT,
    ...extras,
  };
}

export function mapText(
  text: string,
  x: number,
  y: number,
  extras?: Partial<TextObject>,
): TextObject {
  return {
    ...base(text, x, y, "#111111", { stroke: "transparent", strokeWidth: 0 }),
    type: "text",
    text,
    fontSize: 20,
    fontFamily: FONT,
    fontStyle: "bold",
    width: 280,
    height: 36,
    align: "left",
    ...extras,
  };
}

export function mapArrow(
  x: number,
  y: number,
  dx: number,
  dy: number,
  extras?: Partial<ArrowObject>,
): ArrowObject {
  return {
    ...base("Arrow", x, y, "#e53935", { stroke: "#e53935", strokeWidth: 6 }),
    type: "arrow",
    points: [0, 0, dx, dy],
    pointerLength: 16,
    pointerWidth: 16,
    ...extras,
  };
}

export function createBlankProject(
  name = "New venue",
  width = 1500,
  height = 780,
): MapProject {
  return {
    id: createId("map"),
    name,
    width,
    height,
    background: {
      type: "color",
      color: "#ffffff",
    },
    objects: [],
    updatedAt: Date.now(),
  };
}

export function createDemoProject(): MapProject {
  const trees: EllipseObject[] = [
    [520, 40],
    [610, 70],
    [700, 40],
    [780, 90],
    [880, 50],
    [980, 80],
    [1080, 40],
    [520, 520],
    [620, 560],
    [860, 540],
    [960, 500],
    [250, 620],
    [1180, 620],
    [1320, 560],
  ].map(([x, y], index) =>
    labeledEllipse(`Tree ${index + 1}`, x, y, 28, 28, "#2e7d32", {
      label: "",
      stroke: "#1b5e20",
      strokeWidth: 2,
      name: "Tree",
    }),
  );

  const objects: MapObject[] = [
    labeledPolygon(
      "Japan Town",
      [40, 36, 300, 36, 340, 150, 170, 210, 20, 140],
      "#d32f2f",
      { fontSize: 20 },
    ),
    labeledRect("Bazaar", 40, 240, 300, 150, "#ef6c00", {
      cornerRadius: 18,
      fontSize: 28,
    }),
    labeledRect("Art Corner", 380, 40, 210, 130, "#00acc1", { fontSize: 20 }),
    labeledRect("Maghara Studio", 380, 190, 240, 110, "#8e2242", {
      fontSize: 18,
    }),
    labeledRect("Egycon Studio", 640, 190, 160, 110, "#ec407a", {
      fontSize: 16,
    }),
    labeledRect("Redbull Gaming Ground", 40, 430, 340, 150, "#1565c0", {
      fontSize: 18,
    }),
    labeledPolygon(
      "Glow",
      [1080, 250, 760, 120, 760, 430],
      "#c5e1a5",
      {
        label: "",
        opacity: 0.45,
        stroke: "transparent",
        strokeWidth: 0,
        name: "Stage glow",
      },
    ),
    labeledRect("Stage", 1080, 200, 300, 180, "#f06292", {
      cornerRadius: 12,
      fontSize: 32,
    }),
    labeledPolygon(
      "Food Court",
      [400, 360, 720, 360, 780, 520, 380, 520],
      "#2e7d32",
      { fontSize: 22 },
    ),
    labeledPolygon(
      "Dodge Arrow",
      [820, 360, 1040, 380, 1020, 500, 800, 520],
      "#212121",
      { fontSize: 16 },
    ),
    labeledPolygon(
      "Amanat",
      [1040, 430, 1180, 430, 1220, 540, 1020, 540],
      "#1e88e5",
      { fontSize: 18 },
    ),
    labeledRect("Changing Rooms", 820, 200, 150, 70, "#9e9e9e", {
      fontSize: 12,
      labelColor: "#111111",
      stroke: "#ffffff",
    }),
    labeledRect("Guests Office", 820, 280, 150, 60, "#fbc02d", {
      fontSize: 12,
      labelColor: "#111111",
    }),
    labeledRect("WC", 990, 200, 50, 50, "#fdd835", {
      fontSize: 14,
      labelColor: "#111111",
      cornerRadius: 6,
    }),
    mapArrow(700, 700, 0, -70),
    mapArrow(280, 700, 0, -70),
    mapText("MAIN ENTRANCE", 620, 720, {
      fill: "#111111",
      fontSize: 18,
      width: 200,
      align: "center",
    }),
    ...trees,
  ];

  return {
    id: createId("map"),
    name: "Default venue",
    width: 1500,
    height: 780,
    background: {
      type: "pattern",
      color: "#7cb342",
      patternColor: "#558b2f",
    },
    objects,
    updatedAt: Date.now(),
  };
}

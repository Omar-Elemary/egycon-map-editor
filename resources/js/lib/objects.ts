import { defaultCanvasShape, isPolygonCanvas } from "./canvas-shape";
import { createId } from "./ids";
import type {
  ArrowObject,
  CanvasShape,
  EllipseObject,
  ImageObject,
  MapObject,
  MapProject,
  PathObject,
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

export function mapPath(
  name: string,
  data: string,
  extras?: Partial<PathObject>,
): PathObject {
  return {
    ...base(name, 0, 0, "transparent", { stroke: "#ffffff", strokeWidth: 5 }),
    type: "path",
    data,
    ...extras,
  };
}

export function mapImage(
  name: string,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extras?: Partial<ImageObject>,
): ImageObject {
  return {
    ...base(name, x, y, "transparent", { stroke: "transparent", strokeWidth: 0 }),
    type: "image",
    src,
    width,
    height,
    ...extras,
  };
}

export const EGYCON_MAP_ID = "map_egycon_official";

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
    canvasShape: defaultCanvasShape(),
    objects: [],
    updatedAt: Date.now(),
  };
}

export function normalizeProject(project: MapProject): MapProject {
  const canvasShape: CanvasShape = isPolygonCanvas(project.canvasShape)
    ? project.canvasShape
    : defaultCanvasShape();
  return {
    ...project,
    canvasShape,
    objects: project.objects.map((object) => ({
      ...object,
      animationSpeed: object.animationSpeed ?? 1,
    })),
  };
}

export function createDemoProject(): MapProject {
  const tree = (x: number, y: number, size = 30): EllipseObject =>
    labeledEllipse("Tree", x, y, size, size, "#1b5e20", {
      label: "",
      stroke: "#145214",
      strokeWidth: 2,
      name: "Tree",
    });

  const venue: number[] = [
    36, 86,
    1188, 40,
    1578, 40,
    1578, 846,
    1060, 866,
    978, 938,
    778, 938,
    696, 866,
    148, 846,
    28, 548,
    20, 178,
  ];

  const objects: MapObject[] = [
    labeledPolygon("Stage glow high", [1256, 92, 760, 52, 792, 214], "#dcedc8", {
      label: "",
      name: "Stage glow",
      opacity: 0.42,
      stroke: "transparent",
      strokeWidth: 0,
      fillStyle: "glow",
      animation: "glow",
      animationSpeed: 0.55,
      glowColor: "#f1ffc8",
      shadowBlur: 34,
      cssClass: "stage-glow",
    }),
    labeledPolygon("Stage glow low", [1256, 268, 812, 214, 848, 430], "#c5e1a5", {
      label: "",
      name: "Stage glow",
      opacity: 0.38,
      stroke: "transparent",
      strokeWidth: 0,
      fillStyle: "glow",
      animation: "glow",
      animationSpeed: 0.8,
      glowColor: "#e8ffb0",
      shadowBlur: 30,
      cssClass: "stage-glow",
    }),
    labeledPolygon(
      "Japan Town",
      [56, 98, 392, 88, 452, 252, 224, 324, 42, 238],
      "#e53935",
      {
        fontSize: 22,
        animation: "breathe",
        animationSpeed: 0.45,
        cssClass: "japan-town",
      },
    ),
    labeledRect("Art Corner", 460, 86, 214, 134, "#00bcd4", {
      cornerRadius: 10,
      fontSize: 18,
      animation: "pulse",
      animationSpeed: 0.9,
      cssClass: "art-corner",
    }),
    labeledRect("Bazaar", 690, 58, 500, 214, "#ef6c00", {
      cornerRadius: 18,
      fontSize: 42,
      animation: "shimmer",
      animationSpeed: 0.5,
      cssClass: "bazaar",
      hours: "10:00 – 20:00",
      activity: "Artists, merch, and indie booths",
      description: "Walk the stalls for prints, crafts, and convention exclusives.",
    }),
    labeledRect("Stage", 1260, 58, 298, 372, "#ec407a", {
      cornerRadius: 16,
      fontSize: 42,
      animation: "pulse",
      animationSpeed: 0.55,
      cssClass: "stage",
      shadowBlur: 18,
      glowColor: "#ff80ab",
      hours: "See the event schedule",
      activity: "Talks, concerts, and main ceremony",
      description: "The main stage. Sit or stand along the front when a show starts.",
    }),
    labeledRect("Maghara Studio", 460, 236, 272, 118, "#8e2242", {
      cornerRadius: 8,
      fontSize: 16,
    }),
    labeledRect("Egycon Studio", 744, 236, 226, 118, "#d81b60", {
      cornerRadius: 8,
      fontSize: 16,
      animation: "pulse",
      animationSpeed: 1.1,
    }),
    labeledRect("Guests Office", 298, 302, 152, 70, "#fbc02d", {
      cornerRadius: 8,
      fontSize: 12,
      labelColor: "#111111",
      rotation: -8,
    }),
    labeledRect("Redbull Gaming Ground", 418, 372, 640, 158, "#1565c0", {
      cornerRadius: 12,
      fontSize: 20,
      animation: "pulse",
      animationSpeed: 0.7,
      cssClass: "gaming-ground",
    }),
    labeledRect("Changing Rooms", 292, 548, 158, 74, "#9e9e9e", {
      cornerRadius: 8,
      fontSize: 12,
      labelColor: "#111111",
    }),
    labeledPolygon(
      "Amanat",
      [68, 508, 304, 478, 368, 708, 72, 748],
      "#1e88e5",
      {
        fontSize: 22,
        animation: "breathe",
        animationSpeed: 0.35,
        cssClass: "amanat",
      },
    ),
    labeledPolygon(
      "Dodge Arrow",
      [698, 548, 1054, 528, 1036, 712, 676, 728],
      "#212121",
      {
        fontSize: 16,
        animation: "shimmer",
        animationSpeed: 1.15,
        cssClass: "dodge-arrow",
      },
    ),
    labeledPolygon(
      "Food Court",
      [1072, 498, 1558, 498, 1558, 838, 1018, 852],
      "#2e7d32",
      {
        fontSize: 26,
        cssClass: "food-court",
        hours: "11:00 – 22:00",
        activity: "Meals and drinks",
        description: "Food stalls and seating. Peak times are lunch and after the main stage.",
      },
    ),
    labeledRect("WC", 54, 348, 64, 64, "#fdd835", {
      cornerRadius: 32,
      fontSize: 14,
      labelColor: "#111111",
      stroke: "#ffffff",
      strokeWidth: 3,
      hours: "Open all day",
      description: "Restrooms near the west entrance.",
    }),
    mapPath("Entrance path", "M 828 910 Q 910 760 1008 640", {
      stroke: "#ffffff",
      strokeWidth: 6,
      fill: "transparent",
      opacity: 0.9,
    }),
    mapArrow(6, 392, 86, 6, { strokeWidth: 10, pointerLength: 22, pointerWidth: 22 }),
    mapArrow(828, 948, 0, -86, { strokeWidth: 10, pointerLength: 22, pointerWidth: 22 }),
    tree(508, 48, 28),
    tree(598, 76, 32),
    tree(1124, 46, 30),
    tree(1204, 78, 26),
    tree(980, 292, 28),
    tree(1108, 268, 32),
    tree(188, 786, 30),
    tree(268, 812, 26),
    tree(498, 808, 32),
    tree(618, 768, 28),
    tree(1090, 470, 26),
    mapImage("Mascot", "/egycon-mascot.png", 1128, 568, 390, 520),
  ];

  return {
    id: EGYCON_MAP_ID,
    name: "Egycon Map",
    width: 1640,
    height: 960,
    background: {
      type: "pattern",
      color: "#9ccc65",
      patternColor: "#7cb342",
    },
    canvasShape: { type: "polygon", points: venue },
    youAreHere: { x: 828, y: 900 },
    objects,
    updatedAt: Date.now(),
  };
}

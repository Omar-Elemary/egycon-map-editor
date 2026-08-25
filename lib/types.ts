export type Tool =
  | "select"
  | "rect"
  | "rounded-rect"
  | "ellipse"
  | "polygon"
  | "text"
  | "image"
  | "arrow";

export type BackgroundType = "color" | "pattern" | "image";

export type MapBackground = {
  type: BackgroundType;
  color: string;
  patternColor?: string;
  imageDataUrl?: string;
};

export type BaseObject = {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type Labeled = {
  label: string;
  labelColor: string;
  fontSize: number;
  fontFamily: string;
};

export type RectObject = BaseObject &
  Labeled & {
    type: "rect";
    width: number;
    height: number;
    cornerRadius: number;
  };

export type EllipseObject = BaseObject &
  Labeled & {
    type: "ellipse";
    width: number;
    height: number;
  };

export type PolygonObject = BaseObject &
  Labeled & {
    type: "polygon";
    points: number[];
  };

export type TextObject = BaseObject & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: "normal" | "bold" | "italic" | "bold italic";
  width: number;
  height: number;
  align: "left" | "center" | "right";
};

export type ImageObject = BaseObject & {
  type: "image";
  src: string;
  width: number;
  height: number;
};

export type ArrowObject = BaseObject & {
  type: "arrow";
  points: number[];
  pointerLength: number;
  pointerWidth: number;
};

export type PathObject = BaseObject & {
  type: "path";
  data: string;
};

export type MapObject =
  | RectObject
  | EllipseObject
  | PolygonObject
  | TextObject
  | ImageObject
  | ArrowObject
  | PathObject;

export type ObjectPatch = Partial<BaseObject> &
  Partial<Labeled> & {
    width?: number;
    height?: number;
    cornerRadius?: number;
    points?: number[];
    text?: string;
    fontStyle?: TextObject["fontStyle"];
    align?: TextObject["align"];
    src?: string;
    pointerLength?: number;
    pointerWidth?: number;
    data?: string;
  };

export type MapProject = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: MapBackground;
  objects: MapObject[];
  updatedAt: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
};

export type ProjectIndex = {
  currentId: string | null;
  summaries: ProjectSummary[];
};

export function isLabeled(
  object: MapObject,
): object is RectObject | EllipseObject | PolygonObject {
  return object.type === "rect" || object.type === "ellipse" || object.type === "polygon";
}

export function isMapProject(value: unknown): value is MapProject {
  if (!value || typeof value !== "object") return false;
  const project = value as MapProject;
  return (
    typeof project.name === "string" &&
    typeof project.width === "number" &&
    typeof project.height === "number" &&
    Array.isArray(project.objects) &&
    !!project.background &&
    typeof project.background === "object"
  );
}

import type { MapObject } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type Bounds = { x: number; y: number; width: number; height: number };

export function boxesIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function polygonBounds(points: number[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxX = Math.max(maxX, points[i]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getObjectBounds(object: MapObject): Bounds {
  switch (object.type) {
    case "rect":
    case "ellipse":
    case "image":
    case "text":
      return {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      };
    case "polygon": {
      const bounds = polygonBounds(object.points);
      return {
        x: object.x + bounds.x,
        y: object.y + bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }
    case "arrow": {
      const [x1, y1, x2, y2] = object.points;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      return {
        x: object.x + minX,
        y: object.y + minY,
        width: Math.max(8, Math.abs(x2 - x1)),
        height: Math.max(8, Math.abs(y2 - y1)),
      };
    }
    case "path":
      return { x: object.x, y: object.y, width: 24, height: 24 };
  }
}

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Bounds {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

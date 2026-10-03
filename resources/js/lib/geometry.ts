import type { MapObject } from "./types";

export function pointInPolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  const count = points.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function objectCenter(object: MapObject): { x: number; y: number } {
  const bounds = getObjectBounds(object);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

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

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { distance: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const dist = Math.hypot(px - x1, py - y1);
    return { distance: dist, t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return { distance: Math.hypot(px - closestX, py - closestY), t };
}

export function insertVertexOnEdge(
  points: number[],
  x: number,
  y: number,
  threshold = 14,
): number[] | null {
  let bestIndex = -1;
  let bestDistance = threshold;
  const count = points.length / 2;
  for (let i = 0; i < count; i += 1) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[((i + 1) % count) * 2];
    const y2 = points[((i + 1) % count) * 2 + 1];
    const { distance, t } = distanceToSegment(x, y, x1, y1, x2, y2);
    if (t > 0.08 && t < 0.92 && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i + 1;
    }
  }
  if (bestIndex < 0) return null;
  const next = points.slice();
  next.splice(bestIndex * 2, 0, x, y);
  return next;
}

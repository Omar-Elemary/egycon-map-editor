import type { CanvasShape, MapProject } from "./types";
import { polygonBounds } from "./geometry";

export function isPolygonCanvas(
  shape: CanvasShape | undefined,
): shape is { type: "polygon"; points: number[] } {
  return shape?.type === "polygon" && Array.isArray(shape.points) && shape.points.length >= 6;
}

export function rectOutline(width: number, height: number): number[] {
  return [0, 0, width, 0, width, height, 0, height];
}

export function defaultCanvasShape(): CanvasShape {
  return { type: "rect" };
}

export function outlineStroke(project: MapProject): { color: string; width: number } {
  if (project.background.type === "pattern") {
    return { color: "#ffffff", width: 20 };
  }
  if (project.background.type === "image") {
    return { color: "#111111", width: 2 };
  }
  return {
    color: "#111111",
    width: project.background.color === "#ffffff" ? 1 : 16,
  };
}

export function expandSizeToPoints(
  width: number,
  height: number,
  points: number[],
): { width: number; height: number } {
  const bounds = polygonBounds(points);
  return {
    width: Math.max(200, Math.round(Math.max(width, bounds.x + bounds.width))),
    height: Math.max(200, Math.round(Math.max(height, bounds.y + bounds.height))),
  };
}

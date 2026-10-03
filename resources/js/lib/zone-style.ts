import type { MapObject, ZoneStyle } from "./types";
import { isLabeled } from "./types";

export const ZONE_FILL_STYLES = [
  { id: "solid", label: "Solid" },
  { id: "hatch", label: "Hatch" },
  { id: "dots", label: "Dots" },
  { id: "glow", label: "Glow" },
] as const;

export const ZONE_ANIMATIONS = [
  { id: "none", label: "None" },
  { id: "pulse", label: "Pulse" },
  { id: "glow", label: "Glow pulse" },
  { id: "breathe", label: "Breathe" },
  { id: "shimmer", label: "Shimmer" },
] as const;

export function defaultZoneStyle(): ZoneStyle {
  return {
    fillStyle: "solid",
    animation: "none",
    animationSpeed: 1,
    hatchColor: "#00000055",
    glowColor: "#ffffff",
    shadowBlur: 0,
    shadowColor: "#000000",
    cssClass: "",
  };
}

export function getZoneStyle(object: MapObject): ZoneStyle {
  const defaults = defaultZoneStyle();
  return {
    fillStyle: object.fillStyle ?? defaults.fillStyle,
    animation: object.animation ?? defaults.animation,
    animationSpeed: object.animationSpeed ?? defaults.animationSpeed,
    hatchColor: object.hatchColor ?? defaults.hatchColor,
    glowColor: object.glowColor ?? object.fill,
    shadowBlur: object.shadowBlur ?? (object.fillStyle === "glow" ? 22 : defaults.shadowBlur),
    shadowColor: object.shadowColor ?? object.glowColor ?? object.fill,
    cssClass: object.cssClass ?? defaults.cssClass,
  };
}

export function isZone(object: MapObject): boolean {
  return isLabeled(object);
}

export function makeHatchPattern(background: string, line: string): HTMLCanvasElement {
  const size = 18;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.lineTo(8, -4);
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(size - 8, size + 4);
  ctx.lineTo(size + 4, size - 8);
  ctx.stroke();
  return canvas;
}

export function makeDotFillPattern(background: string, dot: string): HTMLCanvasElement {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

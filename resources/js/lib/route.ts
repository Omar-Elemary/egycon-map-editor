import { isPolygonCanvas } from "./canvas-shape";
import { getObjectBounds, objectCenter, pointInPolygon } from "./geometry";
import type { MapObject, MapProject } from "./types";
import { isLabeled } from "./types";

const STEP = 28;

function localPoint(object: MapObject, x: number, y: number) {
  const dx = x - object.x;
  const dy = y - object.y;
  const rad = (-object.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

function insideZone(object: MapObject, x: number, y: number): boolean {
  const local = localPoint(object, x, y);
  if (object.type === "rect") {
    return local.x >= 0 && local.y >= 0 && local.x <= object.width && local.y <= object.height;
  }
  if (object.type === "ellipse") {
    const rx = object.width / 2;
    const ry = object.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (local.x - rx) / rx;
    const ny = (local.y - ry) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (object.type === "polygon") {
    return pointInPolygon(local.x, local.y, object.points);
  }
  return false;
}

function insideMap(map: MapProject, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x > map.width || y > map.height) return false;
  if (isPolygonCanvas(map.canvasShape)) {
    return pointInPolygon(x, y, map.canvasShape.points);
  }
  return true;
}

function blockingZones(map: MapProject, goalId?: string) {
  return map.objects.filter(
    (object) =>
      object.visible &&
      isLabeled(object) &&
      Boolean(object.label?.trim()) &&
      object.id !== goalId &&
      object.opacity > 0.35,
  );
}

function isWalkable(map: MapProject, x: number, y: number, goalId?: string): boolean {
  if (!insideMap(map, x, y)) return false;
  return !blockingZones(map, goalId).some((object) => insideZone(object, x, y));
}

function lineClear(map: MapProject, x1: number, y1: number, x2: number, y2: number, goalId?: string) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(dist / (STEP / 2)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (!isWalkable(map, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, goalId)) return false;
  }
  return true;
}

function snapWalkable(map: MapProject, x: number, y: number, goalId?: string) {
  if (isWalkable(map, x, y, goalId)) return { x, y };
  for (let radius = STEP; radius <= STEP * 6; radius += STEP) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const nx = x + Math.cos(angle) * radius;
      const ny = y + Math.sin(angle) * radius;
      if (isWalkable(map, nx, ny, goalId)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

function smooth(map: MapProject, points: number[], goalId?: string) {
  if (points.length < 6) return points;
  const out: number[] = [points[0], points[1]];
  let i = 0;
  while (i < points.length - 2) {
    let best = i + 2;
    for (let j = i + 4; j < points.length; j += 2) {
      if (lineClear(map, points[i], points[i + 1], points[j], points[j + 1], goalId)) {
        best = j;
      }
    }
    out.push(points[best], points[best + 1]);
    i = best;
  }
  return out;
}

export function routeToZone(map: MapProject, zone: MapObject): number[] | null {
  const start = map.youAreHere;
  if (!start) return null;
  const goal = objectCenter(zone);
  const from = snapWalkable(map, start.x, start.y, zone.id);
  const to = snapWalkable(map, goal.x, goal.y, zone.id);
  if (lineClear(map, from.x, from.y, to.x, to.y, zone.id)) {
    return [start.x, start.y, to.x, to.y, goal.x, goal.y];
  }

  const cols = Math.ceil(map.width / STEP) + 1;
  const rows = Math.ceil(map.height / STEP) + 1;
  const key = (c: number, r: number) => r * cols + c;
  const startC = Math.round(from.x / STEP);
  const startR = Math.round(from.y / STEP);
  const goalC = Math.round(to.x / STEP);
  const goalR = Math.round(to.y / STEP);

  const walkable = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      walkable[key(c, r)] = isWalkable(map, c * STEP, r * STEP, zone.id) ? 1 : 0;
    }
  }
  walkable[key(Math.min(cols - 1, Math.max(0, startC)), Math.min(rows - 1, Math.max(0, startR)))] = 1;
  walkable[key(Math.min(cols - 1, Math.max(0, goalC)), Math.min(rows - 1, Math.max(0, goalR)))] = 1;

  const came = new Int32Array(cols * rows).fill(-1);
  const gScore = new Float32Array(cols * rows).fill(Number.POSITIVE_INFINITY);
  const open: { c: number; r: number; f: number }[] = [];
  const startKey = key(startC, startR);
  gScore[startKey] = 0;
  open.push({ c: startC, r: startR, f: Math.hypot(goalC - startC, goalR - startR) });

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  let found = -1;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[best].f) best = i;
    }
    const current = open.splice(best, 1)[0];
    const currentKey = key(current.c, current.r);
    if (current.c === goalC && current.r === goalR) {
      found = currentKey;
      break;
    }
    for (const [dc, dr] of dirs) {
      const nc = current.c + dc;
      const nr = current.r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nextKey = key(nc, nr);
      if (!walkable[nextKey]) continue;
      const step = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
      const tentative = gScore[currentKey] + step;
      if (tentative >= gScore[nextKey]) continue;
      came[nextKey] = currentKey;
      gScore[nextKey] = tentative;
      open.push({ c: nc, r: nr, f: tentative + Math.hypot(goalC - nc, goalR - nr) });
    }
  }

  if (found < 0) {
    return [start.x, start.y, goal.x, goal.y];
  }

  const path: number[] = [to.x, to.y, goal.x, goal.y];
  let cursor = found;
  while (cursor >= 0) {
    const c = cursor % cols;
    const r = Math.floor(cursor / cols);
    path.unshift(c * STEP, r * STEP);
    cursor = came[cursor];
  }
  path.unshift(start.x, start.y);
  return smooth(map, path, zone.id);
}

export function zoneMatchesQuery(object: MapObject, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    object.name,
    isLabeled(object) ? object.label : "",
    isLabeled(object) ? object.description : "",
    isLabeled(object) ? object.hours : "",
    isLabeled(object) ? object.activity : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

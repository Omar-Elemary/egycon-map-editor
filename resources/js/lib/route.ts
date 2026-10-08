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

function zoneInteriorPoint(zone: MapObject): { x: number; y: number } {
  const center = objectCenter(zone);
  if (insideZone(zone, center.x, center.y)) return center;
  const bounds = getObjectBounds(zone);
  // Sample a small grid inside the bounds to find a guaranteed interior
  // point (bounds center can sit outside concave polygons).
  for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const x = bounds.x + bounds.width * fx;
      const y = bounds.y + bounds.height * fy;
      if (insideZone(zone, x, y)) return { x, y };
    }
  }
  return center;
}

const ARRIVAL_BACKOFF = 10;

function clipRouteToZoneBorder(
  zone: MapObject,
  points: number[],
  backoff = ARRIVAL_BACKOFF,
): number[] {
  if (points.length < 4) return points;
  const inside = (x: number, y: number) => insideZone(zone, x, y);
  // If we start inside the zone there is nothing to walk.
  if (inside(points[0], points[1])) return points.slice(0, 2);
  // Walk the polyline and find the first entry into the zone.
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    const outside1 = !inside(x1, y1);
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    if (segLen < 1e-6) continue;
    // Dense sampling finds the entry even on long smoothed segments.
    const steps = Math.max(1, Math.ceil(segLen / 4));
    let prevInside = !outside1;
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      const curInside = inside(sx, sy);
      if (!prevInside && curInside) {
        // Binary-search the border between the last outside sample and this inside sample.
        let lo = (s - 1) / steps;
        let hi = t;
        for (let iter = 0; iter < 24; iter += 1) {
          const mid = (lo + hi) / 2;
          const mx = x1 + (x2 - x1) * mid;
          const my = y1 + (y2 - y1) * mid;
          if (inside(mx, my)) hi = mid;
          else lo = mid;
        }
        const bx = x1 + (x2 - x1) * hi;
        const by = y1 + (y2 - y1) * hi;
        // Step back along the travel direction so the line cap rests just
        // outside the border instead of bleeding into the zone middle.
        const ux = (x2 - x1) / segLen;
        const uy = (y2 - y1) / segLen;
        const distFromSegStart = hi * segLen;
        const pull = Math.min(backoff, Math.max(0, distFromSegStart - 1));
        const ax = bx - ux * pull;
        const ay = by - uy * pull;
        const out: number[] = [];
        for (let k = 0; k <= i; k += 2) {
          out.push(points[k], points[k + 1]);
        }
        // Avoid duplicating the segment start point.
        if (out.length >= 2) {
          const lx = out[out.length - 2];
          const ly = out[out.length - 1];
          if (Math.hypot(ax - lx, ay - ly) < 0.5) {
            return out;
          }
        }
        out.push(ax, ay);
        return out;
      }
      prevInside = curInside;
    }
  }
  // Path never enters the zone (e.g. coarse grid around concave shapes):
  // drop the interior tail and keep the last outside point so we never
  // render a line through the middle.
  for (let i = points.length - 2; i >= 0; i -= 2) {
    if (!inside(points[i], points[i + 1])) {
      return points.slice(0, i + 2);
    }
  }
  return points.slice(0, 2);
}

export function routeToZone(map: MapProject, zone: MapObject): number[] | null {
  const start = map.youAreHere;
  if (!start) return null;
  if (insideZone(zone, start.x, start.y)) return null;
  const goal = zoneInteriorPoint(zone);
  const from = snapWalkable(map, start.x, start.y, zone.id);
  const to = snapWalkable(map, goal.x, goal.y, zone.id);
  if (lineClear(map, from.x, from.y, to.x, to.y, zone.id)) {
    return clipRouteToZoneBorder(zone, [start.x, start.y, to.x, to.y, goal.x, goal.y]);
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
    return clipRouteToZoneBorder(zone, [start.x, start.y, goal.x, goal.y]);
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
  return clipRouteToZoneBorder(zone, smooth(map, path, zone.id));
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

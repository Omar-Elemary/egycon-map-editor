import { createId } from "./ids";
import type { MapObject, MapProject } from "./types";
import { isLabeled, isMapProject } from "./types";

export function shareIdFromProject(projectId: string): string {
  const cleaned = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return cleaned || "map";
}

export function uniquifyObjectIds(objects: MapObject[]): MapObject[] {
  const seen = new Set<string>();
  return objects.map((object) => {
    if (object.id && !seen.has(object.id)) {
      seen.add(object.id);
      return object;
    }
    const next = { ...object, id: createId("obj") };
    seen.add(next.id);
    return next;
  });
}

export function toShareMap(project: MapProject): MapProject {
  return {
    ...project,
    objects: uniquifyObjectIds(project.objects.filter((object) => object.visible)),
    updatedAt: Date.now(),
  };
}

export function parseShareMap(value: unknown): MapProject | null {
  if (!isMapProject(value)) return null;
  return toShareMap(value);
}

export function labeledZones(project: MapProject) {
  return project.objects.filter(
    (object) => isLabeled(object) && object.visible && Boolean(object.label?.trim()),
  );
}

export function isGuestZone(object: MapObject) {
  return isLabeled(object) && object.visible && Boolean(object.label?.trim());
}

import type { MapProject, ProjectIndex, ProjectSummary } from "./types";

const INDEX_KEY = "map-editor:index";

function projectKey(id: string): string {
  return `map-editor:project:${id}`;
}

export function loadIndex(): ProjectIndex {
  if (typeof window === "undefined") {
    return { currentId: null, summaries: [] };
  }
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return { currentId: null, summaries: [] };
    const parsed = JSON.parse(raw) as ProjectIndex;
    if (!parsed || !Array.isArray(parsed.summaries)) {
      return { currentId: null, summaries: [] };
    }
    return parsed;
  } catch {
    return { currentId: null, summaries: [] };
  }
}

export function saveIndex(index: ProjectIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadProject(id: string): MapProject | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as MapProject;
  } catch {
    return null;
  }
}

export function saveProject(project: MapProject): void {
  try {
    localStorage.setItem(projectKey(project.id), JSON.stringify(project));
  } catch (error) {
    console.warn("Could not save project (storage quota?)", error);
  }
}

export function removeProject(id: string): void {
  localStorage.removeItem(projectKey(id));
}

export function toSummary(project: MapProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    width: project.width,
    height: project.height,
    updatedAt: project.updatedAt,
  };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

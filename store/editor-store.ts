"use client";

import { create } from "zustand";
import { createId } from "@/lib/ids";
import { createBlankProject, createDemoProject } from "@/lib/objects";
import {
  loadIndex,
  loadProject,
  removeProject,
  saveIndex,
  saveProject,
  toSummary,
} from "@/lib/storage";
import type {
  MapBackground,
  MapObject,
  MapProject,
  ObjectPatch,
  ProjectSummary,
  Tool,
} from "@/lib/types";
import { isMapProject } from "@/lib/types";

const MAX_HISTORY = 60;

type EditorState = {
  ready: boolean;
  summaries: ProjectSummary[];
  project: MapProject | null;
  tool: Tool;
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  past: MapProject[];
  future: MapProject[];
  toolbarLayout: "column" | "row";

  hydrate: () => void;
  createProject: (name?: string, width?: number, height?: number) => void;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (name: string) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackground: (background: Partial<MapBackground>) => void;
  setTool: (tool: Tool) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  setView: (view: { zoom?: number; panX?: number; panY?: number }) => void;
  addObject: (object: MapObject) => void;
  updateObject: (id: string, patch: ObjectPatch, commit?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  rotateSelected: (degrees: number) => void;
  reorderObject: (id: string, direction: "forward" | "backward") => void;
  undo: () => void;
  redo: () => void;
  importProjectJson: (raw: string) => string | null;
  toggleToolbarLayout: () => void;
};

function cloneProject(project: MapProject): MapProject {
  return structuredClone(project);
}

function persist(project: MapProject, summaries: ProjectSummary[]): ProjectSummary[] {
  const nextSummaries = summaries.map((summary) =>
    summary.id === project.id ? toSummary(project) : summary,
  );
  saveProject(project);
  saveIndex({ currentId: project.id, summaries: nextSummaries });
  return nextSummaries;
}

function withHistory(state: EditorState): Pick<EditorState, "past" | "future"> {
  if (!state.project) return { past: state.past, future: state.future };
  return {
    past: [...state.past, cloneProject(state.project)].slice(-MAX_HISTORY),
    future: [],
  };
}

function commitProject(
  state: EditorState,
  project: MapProject,
  extras: Partial<EditorState> = {},
  recordHistory = true,
): Partial<EditorState> {
  const history = recordHistory ? withHistory(state) : { past: state.past, future: state.future };
  const next = { ...project, updatedAt: Date.now() };
  return {
    ...history,
    project: next,
    summaries: persist(next, state.summaries),
    ...extras,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ready: false,
  summaries: [],
  project: null,
  tool: "select",
  selectedIds: [],
  zoom: 1,
  panX: 48,
  panY: 48,
  past: [],
  future: [],
  toolbarLayout: "column",

  hydrate: () => {
    if (get().ready) return;
    const index = loadIndex();
    if (index.summaries.length === 0) {
      const demo = createDemoProject();
      saveProject(demo);
      const summaries = [toSummary(demo)];
      saveIndex({ currentId: demo.id, summaries });
      set({
        ready: true,
        project: demo,
        summaries,
        past: [],
        future: [],
        selectedIds: [],
      });
      return;
    }

    const currentId = index.currentId ?? index.summaries[0].id;
    const project = loadProject(currentId) ?? loadProject(index.summaries[0].id);
    if (!project) {
      const demo = createDemoProject();
      saveProject(demo);
      const summaries = [toSummary(demo)];
      saveIndex({ currentId: demo.id, summaries });
      set({ ready: true, project: demo, summaries, selectedIds: [] });
      return;
    }

    saveIndex({ currentId: project.id, summaries: index.summaries });
    set({
      ready: true,
      project,
      summaries: index.summaries,
      selectedIds: [],
      past: [],
      future: [],
    });
  },

  createProject: (name = "New venue", width = 1500, height = 780) => {
    const project = createBlankProject(name, width, height);
    const state = get();
    const summaries = [toSummary(project), ...state.summaries];
    saveProject(project);
    saveIndex({ currentId: project.id, summaries });
    set({
      project,
      summaries,
      selectedIds: [],
      past: [],
      future: [],
      tool: "select",
    });
  },

  switchProject: (id) => {
    const state = get();
    if (state.project?.id === id) return;
    const project = loadProject(id);
    if (!project) return;
    saveIndex({ currentId: id, summaries: state.summaries });
    set({
      project,
      selectedIds: [],
      past: [],
      future: [],
      tool: "select",
    });
  },

  deleteProject: (id) => {
    const state = get();
    removeProject(id);
    const summaries = state.summaries.filter((summary) => summary.id !== id);
    if (summaries.length === 0) {
      const project = createBlankProject("New venue");
      const next = [toSummary(project)];
      saveProject(project);
      saveIndex({ currentId: project.id, summaries: next });
      set({
        project,
        summaries: next,
        selectedIds: [],
        past: [],
        future: [],
      });
      return;
    }
    const nextId =
      state.project?.id === id ? summaries[0].id : (state.project?.id ?? summaries[0].id);
    const project = loadProject(nextId) ?? createBlankProject();
    saveIndex({ currentId: project.id, summaries });
    set({
      project,
      summaries,
      selectedIds: [],
      past: [],
      future: [],
    });
  },

  renameProject: (name) => {
    const state = get();
    if (!state.project) return;
    set(commitProject(state, { ...state.project, name }));
  },

  setCanvasSize: (width, height) => {
    const state = get();
    if (!state.project) return;
    set(
      commitProject(state, {
        ...state.project,
        width: Math.max(200, Math.round(width)),
        height: Math.max(200, Math.round(height)),
      }),
    );
  },

  setBackground: (background) => {
    const state = get();
    if (!state.project) return;
    set(
      commitProject(state, {
        ...state.project,
        background: { ...state.project.background, ...background },
      }),
    );
  },

  setTool: (tool) => set({ tool }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelectedId: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((selected) => selected !== id)
        : [...state.selectedIds, id],
    })),

  setView: (view) =>
    set((state) => ({
      zoom: view.zoom ?? state.zoom,
      panX: view.panX ?? state.panX,
      panY: view.panY ?? state.panY,
    })),

  addObject: (object) => {
    const state = get();
    if (!state.project) return;
    set(
      commitProject(
        state,
        { ...state.project, objects: [...state.project.objects, object] },
        { selectedIds: [object.id], tool: "select" },
      ),
    );
  },

  updateObject: (id, patch, commit = true) => {
    const state = get();
    if (!state.project) return;
    const project: MapProject = {
      ...state.project,
      objects: state.project.objects.map((object) =>
        object.id === id ? ({ ...object, ...patch } as MapObject) : object,
      ),
    };
    set(commitProject(state, project, {}, commit));
  },

  deleteSelected: () => {
    const state = get();
    if (!state.project || state.selectedIds.length === 0) return;
    const selected = new Set(state.selectedIds);
    set(
      commitProject(
        state,
        {
          ...state.project,
          objects: state.project.objects.filter((object) => !selected.has(object.id)),
        },
        { selectedIds: [] },
      ),
    );
  },

  duplicateSelected: () => {
    const state = get();
    if (!state.project || state.selectedIds.length === 0) return;
    const selected = new Set(state.selectedIds);
    const copies: MapObject[] = [];
    for (const object of state.project.objects) {
      if (!selected.has(object.id)) continue;
      copies.push({
        ...structuredClone(object),
        id: createId("obj"),
        name: `${object.name} copy`,
        x: object.x + 24,
        y: object.y + 24,
      } as MapObject);
    }
    set(
      commitProject(
        state,
        { ...state.project, objects: [...state.project.objects, ...copies] },
        { selectedIds: copies.map((object) => object.id) },
      ),
    );
  },

  rotateSelected: (degrees) => {
    const state = get();
    if (!state.project || state.selectedIds.length !== 1) return;
    const id = state.selectedIds[0];
    const project: MapProject = {
      ...state.project,
      objects: state.project.objects.map((object) =>
        object.id === id ? { ...object, rotation: object.rotation + degrees } : object,
      ),
    };
    set(commitProject(state, project));
  },

  reorderObject: (id, direction) => {
    const state = get();
    if (!state.project) return;
    const objects = [...state.project.objects];
    const index = objects.findIndex((object) => object.id === id);
    if (index < 0) return;
    const swapWith = direction === "forward" ? index + 1 : index - 1;
    if (swapWith < 0 || swapWith >= objects.length) return;
    [objects[index], objects[swapWith]] = [objects[swapWith], objects[index]];
    set(commitProject(state, { ...state.project, objects }));
  },

  undo: () => {
    const state = get();
    if (!state.project || state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const past = state.past.slice(0, -1);
    const future = [...state.future, cloneProject(state.project)];
    const summaries = persist(previous, state.summaries);
    const remaining = new Set(previous.objects.map((object) => object.id));
    set({
      project: previous,
      past,
      future,
      summaries,
      selectedIds: state.selectedIds.filter((id) => remaining.has(id)),
    });
  },

  redo: () => {
    const state = get();
    if (!state.project || state.future.length === 0) return;
    const next = state.future[state.future.length - 1];
    const future = state.future.slice(0, -1);
    const past = [...state.past, cloneProject(state.project)];
    const summaries = persist(next, state.summaries);
    const remaining = new Set(next.objects.map((object) => object.id));
    set({
      project: next,
      past,
      future,
      summaries,
      selectedIds: state.selectedIds.filter((id) => remaining.has(id)),
    });
  },

  importProjectJson: (raw) => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isMapProject(parsed)) return "This file is not a valid map project.";
      const project: MapProject = {
        ...parsed,
        id: createId("map"),
        name: parsed.name || "Imported map",
        updatedAt: Date.now(),
        objects: parsed.objects.map((object) => ({
          ...object,
          id: object.id || createId("obj"),
        })),
      };
      const state = get();
      const summaries = [toSummary(project), ...state.summaries];
      saveProject(project);
      saveIndex({ currentId: project.id, summaries });
      set({
        project,
        summaries,
        selectedIds: [],
        past: [],
        future: [],
        tool: "select",
      });
      return null;
    } catch {
      return "Could not parse JSON file.";
    }
  },

  toggleToolbarLayout: () =>
    set((state) => ({
      toolbarLayout: state.toolbarLayout === "column" ? "row" : "column",
    })),
}));

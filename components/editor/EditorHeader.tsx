"use client";

import { Download, FileJson, Upload } from "lucide-react";
import { downloadBlob, readFileAsText } from "@/lib/storage";
import { useEditorStore } from "@/store/editor-store";

export function EditorHeader({ onExportPng }: { onExportPng: () => void }) {
  const project = useEditorStore((state) => state.project);
  const importProjectJson = useEditorStore((state) => state.importProjectJson);

  function exportJson() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(`${project.name.replace(/\s+/g, "-").toLowerCase()}.json`, blob);
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await readFileAsText(file);
      const error = importProjectJson(text);
      if (error) window.alert(error);
    };
    input.click();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-zinc-900">
          {project?.name ?? "Map Editor"}
        </div>
        <p className="truncate text-xs text-zinc-500">
          Full-screen map — use the side-buttons for tools, zone-list, and export.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={importJson}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Upload className="h-3.5 w-3.5" />
          Import JSON
        </button>
        <button
          type="button"
          onClick={exportJson}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <FileJson className="h-3.5 w-3.5" />
          Export JSON
        </button>
        <button
          type="button"
          onClick={onExportPng}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          <Download className="h-3.5 w-3.5" />
          Export PNG
        </button>
      </div>
    </header>
  );
}

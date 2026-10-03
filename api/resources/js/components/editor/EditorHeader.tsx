"use client";

import { Download, FileJson, Share2, Upload } from "lucide-react";
import { useState } from "react";
import { ShareDialog } from "@/components/share/ShareDialog";
import { downloadBlob, readFileAsText } from "@/lib/storage";
import { useEditorStore } from "@/store/editor-store";

export function EditorHeader({ onExportPng }: { onExportPng: () => void }) {
  const project = useEditorStore((state) => state.project);
  const importProjectJson = useEditorStore((state) => state.importProjectJson);
  const [shareOpen, setShareOpen] = useState(false);

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
    <>
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export PNG
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-lime-950 hover:bg-lime-400"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </header>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}

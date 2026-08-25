"use client";

import { useEffect, useRef } from "react";
import { EditorCanvas, type EditorCanvasHandle } from "@/components/canvas/EditorCanvas";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ShortcutLegend } from "@/components/editor/ShortcutLegend";
import { Inspector } from "@/components/inspector/Inspector";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { ToolBar } from "@/components/toolbar/ToolBar";
import { ZoomControls } from "@/components/toolbar/ZoomControls";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { downloadDataUrl } from "@/lib/storage";
import { useEditorStore } from "@/store/editor-store";

export default function EditorShell() {
  const hydrate = useEditorStore((state) => state.hydrate);
  const ready = useEditorStore((state) => state.ready);
  const project = useEditorStore((state) => state.project);
  const canvasRef = useRef<EditorCanvasHandle>(null);

  useEditorShortcuts();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function exportPng() {
    const dataUrl = canvasRef.current?.exportPng();
    if (!dataUrl || !project) return;
    downloadDataUrl(`${project.name.replace(/\s+/g, "-").toLowerCase()}.png`, dataUrl);
  }

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-zinc-100 text-sm text-zinc-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100 text-zinc-900">
      <ProjectSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <EditorHeader onExportPng={exportPng} />
        <div className="relative min-h-0 flex-1">
          <EditorCanvas ref={canvasRef} />
          <div className="pointer-events-none absolute top-4 left-4 z-10">
            <ToolBar />
          </div>
          <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col items-end gap-3">
            <ShortcutLegend />
            <ZoomControls onFit={() => canvasRef.current?.fitView()} />
          </div>
        </div>
      </div>
      <Inspector />
    </div>
  );
}

"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

export function ZoomControls({ onFit }: { onFit: () => void }) {
  const zoom = useEditorStore((state) => state.zoom);
  const setView = useEditorStore((state) => state.setView);

  function bump(factor: number) {
    setView({ zoom: Math.min(8, Math.max(0.1, zoom * factor)) });
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button
        type="button"
        title="Zoom in"
        onClick={() => bump(1.15)}
        className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Zoom out"
        onClick={() => bump(1 / 1.15)}
        className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Fit view"
        onClick={onFit}
        className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <div className="rounded-full border border-zinc-200 bg-white px-0 py-2 text-center text-[11px] font-medium text-zinc-500 shadow-sm">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

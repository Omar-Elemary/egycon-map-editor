"use client";

export function ShortcutLegend() {
  return (
    <div className="pointer-events-none max-w-xs text-right text-[11px] leading-5 text-zinc-500">
      <div>
        <span className="font-medium text-zinc-700">Shift+Click</span> add/remove zones.{" "}
        <span className="font-medium text-zinc-700">Drag</span> a box for multi-select.
      </div>
      <div>
        <span className="font-medium text-zinc-700">K</span> toolbar row or column.{" "}
        <span className="font-medium text-zinc-700">Ctrl+Z</span> undo.
      </div>
      <div>
        <span className="font-medium text-zinc-700">D</span> duplicate.{" "}
        <span className="font-medium text-zinc-700">R</span> rotate.{" "}
        <span className="font-medium text-zinc-700">Del</span> remove.
      </div>
    </div>
  );
}

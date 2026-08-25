"use client";

import {
  Circle,
  Hexagon,
  ImagePlus,
  MousePointer2,
  Square,
  SquareRoundCorner,
  Type,
  Undo2,
  Redo2,
  MoveUpRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { createId } from "@/lib/ids";
import { readFileAsDataUrl } from "@/lib/storage";
import type { ImageObject, Tool } from "@/lib/types";
import { useEditorStore } from "@/store/editor-store";

const tools: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: "select", label: "Select (V)", icon: <MousePointer2 className="h-4 w-4" /> },
  { id: "rect", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
  { id: "rounded-rect", label: "Rounded rectangle", icon: <SquareRoundCorner className="h-4 w-4" /> },
  { id: "ellipse", label: "Ellipse", icon: <Circle className="h-4 w-4" /> },
  { id: "polygon", label: "Polygon", icon: <Hexagon className="h-4 w-4" /> },
  { id: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
  { id: "arrow", label: "Arrow", icon: <MoveUpRight className="h-4 w-4" /> },
  { id: "image", label: "Image / icon", icon: <ImagePlus className="h-4 w-4" /> },
];

export function ToolBar() {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const layout = useEditorStore((state) => state.toolbarLayout);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const addObject = useEditorStore((state) => state.addObject);
  const project = useEditorStore((state) => state.project);

  async function onImageTool() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !project) return;
      const src = await readFileAsDataUrl(file);
      const image = new window.Image();
      image.onload = () => {
        const max = 360;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const width = Math.max(24, image.width * scale);
        const height = Math.max(24, image.height * scale);
        const object: ImageObject = {
          id: createId("obj"),
          type: "image",
          name: file.name.replace(/\.[^.]+$/, "") || "Image",
          x: project.width / 2 - width / 2,
          y: project.height / 2 - height / 2,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          fill: "transparent",
          stroke: "transparent",
          strokeWidth: 0,
          src,
          width,
          height,
        };
        addObject(object);
      };
      image.src = src;
    };
    input.click();
  }

  return (
    <div
      className={`pointer-events-auto flex gap-2 ${layout === "column" ? "flex-col" : "flex-row"}`}
    >
      {tools.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={() => {
            if (item.id === "image") {
              onImageTool();
              setTool("select");
              return;
            }
            setTool(item.id);
          }}
          className={`grid h-11 w-11 place-items-center rounded-full border shadow-sm transition ${
            tool === item.id
              ? "border-lime-500 bg-lime-100 text-lime-900"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {item.icon}
        </button>
      ))}
      <button
        type="button"
        title="Undo"
        disabled={past.length === 0}
        onClick={undo}
        className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-40"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Redo"
        disabled={future.length === 0}
        onClick={redo}
        className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-40"
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
}

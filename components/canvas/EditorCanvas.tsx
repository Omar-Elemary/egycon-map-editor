"use client";

import type Konva from "konva";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Circle, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { boxesIntersect, clamp, getObjectBounds, normalizeRect } from "@/lib/geometry";
import { exportStageRegion } from "@/lib/export";
import { labeledEllipse, labeledPolygon, labeledRect, mapArrow, mapText } from "@/lib/objects";
import type { MapObject, ObjectPatch, Tool } from "@/lib/types";
import { useEditorStore } from "@/store/editor-store";
import { BackgroundLayer } from "./BackgroundLayer";
import { MapObjectNode } from "./MapObjectNode";

export type EditorCanvasHandle = {
  exportPng: () => string | null;
  fitView: () => void;
};

type DrawState =
  | null
  | {
      mode: "rect" | "rounded-rect" | "ellipse" | "arrow" | "marquee";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | { mode: "polygon"; points: number[]; cursorX: number; cursorY: number };

const MIN_SIZE = 8;

function pointerOnProject(stage: Konva.Stage) {
  return stage.getRelativePointerPosition();
}

function bakeTransform(object: MapObject, node: Konva.Node): ObjectPatch {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  node.scaleX(1);
  node.scaleY(1);
  const patch: ObjectPatch = {
    x: node.x(),
    y: node.y(),
    rotation: node.rotation(),
  };

  if (
    object.type === "rect" ||
    object.type === "ellipse" ||
    object.type === "image" ||
    object.type === "text"
  ) {
    patch.width = Math.max(MIN_SIZE, object.width * Math.abs(scaleX));
    patch.height = Math.max(object.type === "text" ? MIN_SIZE : MIN_SIZE, object.height * Math.abs(scaleY));
    if (object.type === "text") {
      patch.fontSize = Math.max(8, object.fontSize * Math.abs(scaleY));
    }
  }
  if (object.type === "polygon" || object.type === "arrow") {
    patch.points = object.points.map((value, index) =>
      index % 2 === 0 ? value * scaleX : value * scaleY,
    );
  }
  return patch;
}

function commitDrawnShape(
  tool: Tool,
  box: { x: number; y: number; width: number; height: number },
) {
  if (tool === "rect" || tool === "rounded-rect") {
    return labeledRect("New zone", box.x, box.y, box.width, box.height, "#86efac", {
      cornerRadius: tool === "rounded-rect" ? 20 : 0,
      stroke: "#166534",
      strokeWidth: 3,
      labelColor: "#14532d",
      fontSize: 18,
    });
  }
  if (tool === "ellipse") {
    return labeledEllipse("New zone", box.x, box.y, box.width, box.height, "#7dd3fc", {
      stroke: "#0369a1",
      strokeWidth: 3,
      labelColor: "#0c4a6e",
    });
  }
  return null;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle>(function EditorCanvas(_, ref) {
  const project = useEditorStore((state) => state.project);
  const tool = useEditorStore((state) => state.tool);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const zoom = useEditorStore((state) => state.zoom);
  const panX = useEditorStore((state) => state.panX);
  const panY = useEditorStore((state) => state.panY);
  const setView = useEditorStore((state) => state.setView);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const toggleSelectedId = useEditorStore((state) => state.toggleSelectedId);
  const addObject = useEditorStore((state) => state.addObject);
  const updateObject = useEditorStore((state) => state.updateObject);
  const setTool = useEditorStore((state) => state.setTool);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const objectLayerRef = useRef<Konva.Layer>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [draw, setDraw] = useState<DrawState>(null);
  const spaceRef = useRef(false);
  const panningRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const drawRef = useRef<DrawState>(null);
  const toolRef = useRef(tool);
  const selectedRef = useRef(selectedIds);
  const fittedRef = useRef<string | null>(null);
  const skipClickRef = useRef(false);

  toolRef.current = tool;
  selectedRef.current = selectedIds;
  drawRef.current = draw;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitView = useCallback(() => {
    if (!project) return;
    const padding = 56;
    const nextZoom = clamp(
      Math.min((size.width - padding * 2) / project.width, (size.height - padding * 2) / project.height),
      0.12,
      2.5,
    );
    setView({
      zoom: nextZoom,
      panX: (size.width - project.width * nextZoom) / 2,
      panY: (size.height - project.height * nextZoom) / 2,
    });
  }, [project, setView, size.height, size.width]);

  useEffect(() => {
    if (!project || size.width < 50) return;
    if (fittedRef.current === project.id) return;
    fittedRef.current = project.id;
    fitView();
  }, [fitView, project, size.width]);

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const stage = stageRef.current;
      if (!stage || !project) return null;
      transformerRef.current?.nodes([]);
      stage.draw();
      const url = exportStageRegion(stage, project, 2);
      const layer = objectLayerRef.current;
      if (layer && selectedRef.current.length) {
        const nodes = selectedRef.current
          .map((id) => layer.findOne(`#${id}`))
          .filter((node): node is Konva.Node => Boolean(node));
        transformerRef.current?.nodes(nodes);
        stage.draw();
      }
      return url;
    },
    fitView,
  }));

  const closePolygon = useCallback(() => {
    const current = drawRef.current;
    if (!current || current.mode !== "polygon" || current.points.length < 6) {
      setDraw(null);
      return;
    }
    addObject(
      labeledPolygon("New zone", current.points, "#fca5a5", {
        stroke: "#7f1d1d",
        strokeWidth: 3,
        labelColor: "#7f1d1d",
      }),
    );
    setDraw(null);
    setTool("select");
  }, [addObject, setTool]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = objectLayerRef.current;
    if (!transformer || !layer) return;
    const nodes = selectedIds
      .map((id) => layer.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, project?.objects]);

  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      );
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !isTyping(event.target)) {
        spaceRef.current = true;
        event.preventDefault();
      }
      if (event.key === "Enter" && drawRef.current?.mode === "polygon") {
        closePolygon();
      }
      if (event.key === "Escape" && drawRef.current) {
        setDraw(null);
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        spaceRef.current = false;
        panningRef.current = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [closePolygon]);

  const cursor = useMemo(() => {
    if (panningRef.current || spaceRef.current) return "grab";
    if (tool === "select") return "default";
    return "crosshair";
  }, [tool, draw]);

  if (!project) {
    return <div className="h-full w-full bg-zinc-200" />;
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldZoom = useEditorStore.getState().zoom;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = clamp(direction > 0 ? oldZoom * 1.08 : oldZoom / 1.08, 0.1, 8);
    const { panX: currentX, panY: currentY } = useEditorStore.getState();
    const mousePointTo = {
      x: (pointer.x - currentX) / oldZoom,
      y: (pointer.y - currentY) / oldZoom,
    };
    setView({
      zoom: nextZoom,
      panX: pointer.x - mousePointTo.x * nextZoom,
      panY: pointer.y - mousePointTo.y * nextZoom,
    });
  }

  function handleMouseDown(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const isMiddle = event.evt.button === 1;
    if (spaceRef.current || isMiddle) {
      panningRef.current = true;
      lastPointerRef.current = stage.getPointerPosition();
      return;
    }
    if (event.evt.button !== 0) return;

    const pos = pointerOnProject(stage);
    if (!pos) return;
    const currentTool = toolRef.current;
    const clickedEmpty = event.target === stage;

    if (currentTool === "polygon") {
      setDraw((previous) => {
        if (previous?.mode === "polygon") {
          const nextPoints = [...previous.points, pos.x, pos.y];
          if (previous.points.length >= 6) {
            const dx = pos.x - previous.points[0];
            const dy = pos.y - previous.points[1];
            if (dx * dx + dy * dy < 16 * 16) {
              queueMicrotask(() => closePolygon());
              return previous;
            }
          }
          return { mode: "polygon", points: nextPoints, cursorX: pos.x, cursorY: pos.y };
        }
        return { mode: "polygon", points: [pos.x, pos.y], cursorX: pos.x, cursorY: pos.y };
      });
      return;
    }

    if (currentTool === "text") {
      addObject(
        mapText("Label", pos.x, pos.y, {
          fill: "#111111",
          fontSize: 24,
          width: 220,
          height: 40,
        }),
      );
      setTool("select");
      return;
    }

    if (
      currentTool === "rect" ||
      currentTool === "rounded-rect" ||
      currentTool === "ellipse" ||
      currentTool === "arrow"
    ) {
      setDraw({
        mode: currentTool,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
      });
      return;
    }

    if (currentTool === "select" && clickedEmpty) {
      if (!event.evt.shiftKey) setSelectedIds([]);
      setDraw({ mode: "marquee", x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }
  }

  function handleMouseMove(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage) return;

    if (panningRef.current) {
      const pointer = stage.getPointerPosition();
      const last = lastPointerRef.current;
      if (!pointer || !last) return;
      const current = useEditorStore.getState();
      setView({
        panX: current.panX + pointer.x - last.x,
        panY: current.panY + pointer.y - last.y,
      });
      lastPointerRef.current = pointer;
      return;
    }

    const pos = pointerOnProject(stage);
    if (!pos) return;
    const current = drawRef.current;
    if (!current) return;

    if (current.mode === "polygon") {
      setDraw({ ...current, cursorX: pos.x, cursorY: pos.y });
      return;
    }
    setDraw({ ...current, x2: pos.x, y2: pos.y });
    event.evt.preventDefault();
  }

  function handleMouseUp() {
    panningRef.current = false;
    lastPointerRef.current = null;
    const current = drawRef.current;
    if (!current) return;

    if (current.mode === "polygon") return;

    const box = normalizeRect(current.x1, current.y1, current.x2, current.y2);

    if (current.mode === "marquee") {
      if (box.width > 4 && box.height > 4 && project) {
        const hits = project.objects
          .filter((object) => object.visible && !object.locked)
          .filter((object) => boxesIntersect(box, getObjectBounds(object)))
          .map((object) => object.id);
        setSelectedIds(hits);
      }
      setDraw(null);
      return;
    }

    if (current.mode === "arrow") {
      if (Math.hypot(current.x2 - current.x1, current.y2 - current.y1) > 8) {
        skipClickRef.current = true;
        addObject(mapArrow(current.x1, current.y1, current.x2 - current.x1, current.y2 - current.y1));
        setTool("select");
        queueMicrotask(() => {
          skipClickRef.current = false;
        });
      }
      setDraw(null);
      return;
    }

    if (box.width < MIN_SIZE || box.height < MIN_SIZE) {
      setDraw(null);
      return;
    }
    const created = commitDrawnShape(current.mode, box);
    if (created) {
      skipClickRef.current = true;
      addObject(created);
      setTool("select");
      queueMicrotask(() => {
        skipClickRef.current = false;
      });
    }
    setDraw(null);
  }

  function handleObjectSelect(object: MapObject, event: Konva.KonvaEventObject<MouseEvent | Event>) {
    if (toolRef.current !== "select" || skipClickRef.current) return;
    event.cancelBubble = true;
    const native = event.evt as MouseEvent;
    if (native.shiftKey) toggleSelectedId(object.id);
    else if (!selectedRef.current.includes(object.id)) setSelectedIds([object.id]);
  }

  function handleDragEnd(object: MapObject, event: Konva.KonvaEventObject<DragEvent>) {
    updateObject(object.id, { x: event.target.x(), y: event.target.y() });
  }

  function handleTransformEnd(object: MapObject, event: Konva.KonvaEventObject<Event>) {
    updateObject(object.id, bakeTransform(object, event.target));
  }

  const previewBox =
    draw && draw.mode !== "polygon"
      ? normalizeRect(draw.x1, draw.y1, draw.x2, draw.y2)
      : null;

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-[#ececec]" style={{ cursor }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={panX}
        y={panY}
        scaleX={zoom}
        scaleY={zoom}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          panningRef.current = false;
          lastPointerRef.current = null;
        }}
        onDblClick={() => {
          if (drawRef.current?.mode === "polygon") closePolygon();
        }}
      >
        <Layer ref={objectLayerRef}>
          <BackgroundLayer
            width={project.width}
            height={project.height}
            background={project.background}
          />
          {project.objects.map((object) => (
            <MapObjectNode
              key={object.id}
              object={object}
              draggable={tool === "select"}
              onSelect={(event) => handleObjectSelect(object, event)}
              onDragStart={() => {
                if (!selectedRef.current.includes(object.id)) setSelectedIds([object.id]);
              }}
              onDragEnd={(event) => handleDragEnd(object, event)}
              onTransformEnd={(event) => handleTransformEnd(object, event)}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={false}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "middle-left",
              "middle-right",
              "top-center",
              "bottom-center",
            ]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) return oldBox;
              return newBox;
            }}
            anchorSize={8}
            borderStroke="#2563eb"
            anchorStroke="#2563eb"
          />
        </Layer>
        <Layer listening={false}>
          {previewBox && draw?.mode === "marquee" && (
            <Rect
              x={previewBox.x}
              y={previewBox.y}
              width={previewBox.width}
              height={previewBox.height}
              fill="#3b82f633"
              stroke="#2563eb"
              strokeWidth={1 / zoom}
              dash={[6 / zoom, 4 / zoom]}
            />
          )}
          {previewBox && draw && draw.mode !== "marquee" && draw.mode !== "polygon" && draw.mode !== "arrow" && (
            <Rect
              x={previewBox.x}
              y={previewBox.y}
              width={previewBox.width}
              height={previewBox.height}
              fill="#86efac88"
              stroke="#166534"
              strokeWidth={2 / zoom}
              cornerRadius={draw.mode === "rounded-rect" ? 20 : 0}
            />
          )}
          {draw?.mode === "arrow" && (
            <Line
              points={[draw.x1, draw.y1, draw.x2, draw.y2]}
              stroke="#e53935"
              strokeWidth={4 / zoom}
            />
          )}
          {draw?.mode === "polygon" && (
            <>
              <Line
                points={[...draw.points, draw.cursorX, draw.cursorY]}
                stroke="#7f1d1d"
                strokeWidth={2 / zoom}
                dash={[8 / zoom, 6 / zoom]}
              />
              {Array.from({ length: draw.points.length / 2 }).map((_, index) => (
                <Circle
                  key={index}
                  x={draw.points[index * 2]}
                  y={draw.points[index * 2 + 1]}
                  radius={5 / zoom}
                  fill="#fff"
                  stroke="#7f1d1d"
                  strokeWidth={2 / zoom}
                />
              ))}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
});

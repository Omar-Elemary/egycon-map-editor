"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Line, Rect } from "react-konva";
import { useHtmlImage } from "@/hooks/use-html-image";
import { isPolygonCanvas, outlineStroke } from "@/lib/canvas-shape";
import type { CanvasShape, MapBackground, MapProject } from "@/lib/types";

function makeDotPattern(background: string, dot: string): HTMLCanvasElement {
  const size = 20;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 2.3, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function polygonClip(points: number[]) {
  return (ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void }) => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.closePath();
  };
}

export function BackgroundLayer({
  width,
  height,
  background,
  canvasShape,
  project,
}: {
  width: number;
  height: number;
  background: MapBackground;
  canvasShape: CanvasShape;
  project: MapProject;
}) {
  const image = useHtmlImage(
    background.type === "image" ? background.imageDataUrl : undefined,
  );
  const [pattern, setPattern] = useState<HTMLCanvasElement | null>(null);
  const polygon = isPolygonCanvas(canvasShape);
  const stroke = outlineStroke(project);

  useEffect(() => {
    if (background.type !== "pattern") {
      setPattern(null);
      return;
    }
    setPattern(makeDotPattern(background.color, background.patternColor || "#33691e"));
  }, [background.type, background.color, background.patternColor]);

  const fillNode =
    background.type === "image" && image ? (
      <KonvaImage image={image} width={width} height={height} listening={false} />
    ) : background.type === "pattern" && pattern ? (
      <Rect
        width={width}
        height={height}
        fillPatternImage={pattern as unknown as HTMLImageElement}
        fillPatternRepeat="repeat"
        listening={false}
      />
    ) : (
      <Rect width={width} height={height} fill={background.color} listening={false} />
    );

  return (
    <>
      {polygon && (
        <Line
          points={canvasShape.points.map((value, index) => (index % 2 === 0 ? value + 10 : value + 14))}
          closed
          fill="#00000055"
          listening={false}
        />
      )}
      {!polygon && (
        <Rect
          x={8}
          y={10}
          width={width}
          height={height}
          fill="#00000033"
          cornerRadius={2}
          listening={false}
        />
      )}
      <Group clipFunc={polygon ? polygonClip(canvasShape.points) : undefined} listening={false}>
        {fillNode}
      </Group>
      {polygon ? (
        <>
          <Line
            points={canvasShape.points}
            closed
            stroke="#111111"
            strokeWidth={stroke.width + 8}
            lineJoin="round"
            listening={false}
          />
          <Line
            points={canvasShape.points}
            closed
            stroke={stroke.color}
            strokeWidth={stroke.width}
            lineJoin="round"
            listening={false}
          />
        </>
      ) : (
        <Rect
          width={width}
          height={height}
          fillEnabled={false}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          listening={false}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Image as KonvaImage, Rect } from "react-konva";
import { useHtmlImage } from "@/hooks/use-html-image";
import type { MapBackground } from "@/lib/types";

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

export function BackgroundLayer({
  width,
  height,
  background,
}: {
  width: number;
  height: number;
  background: MapBackground;
}) {
  const image = useHtmlImage(
    background.type === "image" ? background.imageDataUrl : undefined,
  );
  const [pattern, setPattern] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (background.type !== "pattern") {
      setPattern(null);
      return;
    }
    setPattern(makeDotPattern(background.color, background.patternColor || "#33691e"));
  }, [background.type, background.color, background.patternColor]);

  return (
    <>
      <Rect
        x={8}
        y={10}
        width={width}
        height={height}
        fill="#00000033"
        cornerRadius={2}
        listening={false}
      />
      {background.type === "image" && image ? (
        <KonvaImage image={image} width={width} height={height} listening={false} />
      ) : background.type === "pattern" && pattern ? (
        <Rect
          width={width}
          height={height}
          fillPatternImage={pattern as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          stroke="#ffffff"
          strokeWidth={16}
          listening={false}
        />
      ) : (
        <Rect
          width={width}
          height={height}
          fill={background.color}
          stroke="#111111"
          strokeWidth={background.color === "#ffffff" ? 1 : 16}
          listening={false}
        />
      )}
    </>
  );
}

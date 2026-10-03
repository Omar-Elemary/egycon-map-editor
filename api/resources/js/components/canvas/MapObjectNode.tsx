"use client";

import { useEffect, useState, type ReactNode } from "react";
import type Konva from "konva";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text } from "react-konva";
import { useHtmlImage } from "@/hooks/use-html-image";
import { useZoneAnimation } from "@/hooks/use-zone-animation";
import { polygonBounds } from "@/lib/geometry";
import type { MapObject } from "@/lib/types";
import { isLabeled } from "@/lib/types";
import { getZoneStyle, makeDotFillPattern, makeHatchPattern } from "@/lib/zone-style";

type Props = {
  object: MapObject;
  draggable: boolean;
  onSelect: (event: Konva.KonvaEventObject<MouseEvent | Event>) => void;
  onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
};

function ShapeLabel({
  width,
  height,
  object,
}: {
  width: number;
  height: number;
  object: MapObject;
}) {
  if (!isLabeled(object) || !object.label) return null;
  return (
    <Text
      width={Math.max(8, width)}
      height={Math.max(8, height)}
      text={object.label}
      fill={object.labelColor}
      fontSize={object.fontSize}
      fontFamily={object.fontFamily}
      fontStyle="bold"
      align="center"
      verticalAlign="middle"
      listening={false}
      wrap="word"
      padding={8}
    />
  );
}

function ImageNode({ object }: { object: Extract<MapObject, { type: "image" }> }) {
  const image = useHtmlImage(object.src);
  if (!image) {
    return <Rect width={object.width} height={object.height} fill="#d4d4d8" stroke={object.stroke} />;
  }
  return <KonvaImage image={image} width={object.width} height={object.height} />;
}

function useFillPattern(object: MapObject) {
  const style = getZoneStyle(object);
  const [pattern, setPattern] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (style.fillStyle === "hatch") {
      setPattern(makeHatchPattern(object.fill, style.hatchColor));
      return;
    }
    if (style.fillStyle === "dots") {
      setPattern(makeDotFillPattern(object.fill, style.hatchColor));
      return;
    }
    setPattern(null);
  }, [style.fillStyle, object.fill, style.hatchColor]);

  return pattern;
}

function zoneShapeProps(object: MapObject, pattern: HTMLCanvasElement | null) {
  const style = getZoneStyle(object);
  const glowing = style.fillStyle === "glow" || style.animation === "glow";
  const shadowBlur = glowing ? Math.max(18, style.shadowBlur) : style.shadowBlur;
  const base = {
    stroke: object.stroke,
    strokeWidth: object.strokeWidth,
    shadowColor: style.shadowColor || style.glowColor || object.fill,
    shadowBlur,
    shadowEnabled: shadowBlur > 0,
    shadowOpacity: glowing ? 0.85 : 0.45,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  if (pattern && (style.fillStyle === "hatch" || style.fillStyle === "dots")) {
    return {
      ...base,
      fillPatternImage: pattern as unknown as HTMLImageElement,
      fillPatternRepeat: "repeat",
    };
  }
  return { ...base, fill: object.fill };
}

function ZoneFill({
  object,
  origin,
  children,
}: {
  object: MapObject;
  origin: { x: number; y: number };
  children: ReactNode;
}) {
  const groupRef = useZoneAnimation(object);
  return (
    <Group
      ref={groupRef}
      x={origin.x}
      y={origin.y}
      offsetX={origin.x}
      offsetY={origin.y}
    >
      {children}
    </Group>
  );
}

export function MapObjectNode({
  object,
  draggable,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
}: Props) {
  const pattern = useFillPattern(object);
  const fillProps = zoneShapeProps(object, pattern);
  const polyBounds = object.type === "polygon" ? polygonBounds(object.points) : null;

  if (!object.visible) return null;

  return (
    <Group
      id={object.id}
      name={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      opacity={object.opacity}
      draggable={draggable && !object.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      {object.type === "rect" && (
        <>
          <ZoneFill object={object} origin={{ x: object.width / 2, y: object.height / 2 }}>
            <Rect
              width={object.width}
              height={object.height}
              cornerRadius={object.cornerRadius}
              {...fillProps}
            />
          </ZoneFill>
          <ShapeLabel width={object.width} height={object.height} object={object} />
        </>
      )}
      {object.type === "ellipse" && (
        <>
          <ZoneFill object={object} origin={{ x: object.width / 2, y: object.height / 2 }}>
            <Ellipse
              x={object.width / 2}
              y={object.height / 2}
              radiusX={Math.max(1, object.width / 2)}
              radiusY={Math.max(1, object.height / 2)}
              {...fillProps}
            />
          </ZoneFill>
          <ShapeLabel width={object.width} height={object.height} object={object} />
        </>
      )}
      {object.type === "polygon" && polyBounds && (
        <>
          <ZoneFill
            object={object}
            origin={{
              x: polyBounds.x + polyBounds.width / 2,
              y: polyBounds.y + polyBounds.height / 2,
            }}
          >
            <Line points={object.points} closed {...fillProps} />
          </ZoneFill>
          <ShapeLabel
            width={polyBounds.width}
            height={polyBounds.height}
            object={object}
          />
        </>
      )}
      {object.type === "text" && (
        <Text
          text={object.text}
          width={object.width}
          height={object.height}
          fill={object.fill}
          fontSize={object.fontSize}
          fontFamily={object.fontFamily}
          fontStyle={object.fontStyle}
          align={object.align}
        />
      )}
      {object.type === "image" && <ImageNode object={object} />}
      {object.type === "arrow" && (
        <Arrow
          points={object.points}
          fill={object.fill}
          stroke={object.stroke || object.fill}
          strokeWidth={object.strokeWidth}
          pointerLength={object.pointerLength}
          pointerWidth={object.pointerWidth}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {object.type === "path" && (
        <Path
          data={object.data}
          fillEnabled={object.fill !== "transparent"}
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </Group>
  );
}

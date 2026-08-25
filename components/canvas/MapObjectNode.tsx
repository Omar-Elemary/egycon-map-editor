"use client";

import type Konva from "konva";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text } from "react-konva";
import { useHtmlImage } from "@/hooks/use-html-image";
import { polygonBounds } from "@/lib/geometry";
import type { MapObject } from "@/lib/types";
import { isLabeled } from "@/lib/types";

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

export function MapObjectNode({
  object,
  draggable,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
}: Props) {
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
          <Rect
            width={object.width}
            height={object.height}
            fill={object.fill}
            stroke={object.stroke}
            strokeWidth={object.strokeWidth}
            cornerRadius={object.cornerRadius}
          />
          <ShapeLabel width={object.width} height={object.height} object={object} />
        </>
      )}
      {object.type === "ellipse" && (
        <>
          <Ellipse
            x={object.width / 2}
            y={object.height / 2}
            radiusX={Math.max(1, object.width / 2)}
            radiusY={Math.max(1, object.height / 2)}
            fill={object.fill}
            stroke={object.stroke}
            strokeWidth={object.strokeWidth}
          />
          <ShapeLabel width={object.width} height={object.height} object={object} />
        </>
      )}
      {object.type === "polygon" && (
        <>
          <Line
            points={object.points}
            closed
            fill={object.fill}
            stroke={object.stroke}
            strokeWidth={object.strokeWidth}
          />
          <ShapeLabel
            width={polygonBounds(object.points).width}
            height={polygonBounds(object.points).height}
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
          fill={object.fill}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
        />
      )}
    </Group>
  );
}

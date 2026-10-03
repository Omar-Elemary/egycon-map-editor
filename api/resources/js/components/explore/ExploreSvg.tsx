"use client";

import { useMemo, type CSSProperties } from "react";
import { isPolygonCanvas, outlineStroke } from "@/lib/canvas-shape";
import { polygonBounds } from "@/lib/geometry";
import type { MapObject, MapProject } from "@/lib/types";
import { isLabeled } from "@/lib/types";
import { isGuestZone } from "@/lib/share";
import { getZoneStyle } from "@/lib/zone-style";

function pointsAttr(points: number[]) {
  const pairs: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pairs.push(`${points[i]},${points[i + 1]}`);
  }
  return pairs.join(" ");
}

function zoneVars(object: MapObject): CSSProperties {
  const style = getZoneStyle(object);
  const speed = Math.max(0.25, style.animationSpeed);
  return {
    ["--zone-speed" as string]: `${(1 / speed).toFixed(2)}s`,
    ["--zone-glow" as string]: style.glowColor,
  };
}

function FillPaint({ object }: { object: MapObject }) {
  const style = getZoneStyle(object);
  if (style.fillStyle === "hatch" || style.fillStyle === "dots") {
    return `url(#fill-${object.id})`;
  }
  return object.fill;
}

function wrapLabel(text: string, fontSize: number, maxWidth: number) {
  const width = Math.max(8, maxWidth - 16);
  const charWidth = fontSize * 0.62;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length * charWidth > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

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
  const fill = object.labelColor || "#ffffff";
  const fontFamily = object.fontFamily || "Arial, Helvetica, sans-serif";
  const fontSize = object.fontSize || 16;
  const lines = wrapLabel(object.label, fontSize, width);
  const lineHeight = fontSize * 1.15;
  const block = lines.length * lineHeight;
  return (
    <text
      x={width / 2}
      y={height / 2 - block / 2 + lineHeight * 0.78}
      textAnchor="middle"
      fill={fill}
      style={{
        fill,
        color: fill,
        fontSize,
        fontFamily,
        fontWeight: 700,
        pointerEvents: "none",
      }}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${line}-${index}`}
          x={width / 2}
          dy={index === 0 ? 0 : lineHeight}
          fill={fill}
          style={{ fill, fontFamily }}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function ExploreArrow({ object }: { object: Extract<MapObject, { type: "arrow" }> }) {
  const [x1, y1, x2, y2] = object.points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const head = Math.min(object.pointerLength, length);
  const half = object.pointerWidth / 2;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const color = object.stroke || object.fill;
  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={bx}
        y2={by}
        style={{
          fill: "none",
          stroke: color,
          strokeWidth: object.strokeWidth,
          strokeLinecap: "round",
        }}
      />
      <polygon
        points={`${x2},${y2} ${bx - uy * half},${by + ux * half} ${bx + uy * half},${by - ux * half}`}
        style={{ fill: object.fill, stroke: color, strokeLinejoin: "round" }}
      />
    </>
  );
}

type ShapeRest = {
  className?: string;
  filter?: string;
  style?: CSSProperties;
};

function ZoneGeometry({ object, ...rest }: { object: MapObject } & ShapeRest) {
  if (object.type === "rect") {
    return (
      <rect
        width={object.width}
        height={object.height}
        rx={object.cornerRadius}
        ry={object.cornerRadius}
        {...rest}
      />
    );
  }
  if (object.type === "ellipse") {
    return (
      <ellipse
        cx={object.width / 2}
        cy={object.height / 2}
        rx={object.width / 2}
        ry={object.height / 2}
        {...rest}
      />
    );
  }
  if (object.type === "polygon") {
    return <polygon points={pointsAttr(object.points)} {...rest} />;
  }
  return null;
}

function ExploreObject({
  object,
  selected,
  onSelect,
}: {
  object: MapObject;
  selected: boolean;
  onSelect: (object: MapObject) => void;
}) {
  const style = getZoneStyle(object);
  const fill = FillPaint({ object });
  const glowing = style.fillStyle === "glow" || style.animation === "glow";
  const selectable = isGuestZone(object);
  const wrapAnim =
    style.animation === "pulse" || style.animation === "breathe" || style.animation === "glow"
      ? `zone-anim-${style.animation}`
      : "";
  const shapeAnim = style.animation === "shimmer" ? "zone-anim-shimmer" : "";
  const stroke = selected ? "#111111" : object.stroke;
  const vars = zoneVars(object);

  return (
    <g
      transform={`translate(${object.x} ${object.y}) rotate(${object.rotation})`}
      opacity={glowing ? undefined : object.opacity}
      onClick={(event) => {
        event.stopPropagation();
        if (selectable) onSelect(object);
      }}
      className={selectable ? "explore-zone" : undefined}
      data-zone-id={selectable ? object.id : undefined}
      style={{
        ...vars,
        pointerEvents: selectable ? "auto" : "none",
      }}
    >
      {glowing && (object.type === "rect" || object.type === "ellipse" || object.type === "polygon") && (
        <g
          className={style.animation === "glow" ? "zone-glow-halo" : "zone-glow-halo zone-glow-halo-static"}
          style={vars}
        >
          <ZoneGeometry
            object={object}
            style={{
              fill: style.glowColor,
              stroke: style.glowColor,
              strokeWidth: Math.max(22, style.shadowBlur * 0.7),
              strokeLinejoin: "round",
            }}
          />
        </g>
      )}
      {(object.type === "rect" || object.type === "ellipse" || object.type === "polygon") && (
        <>
          <g className={`${wrapAnim} ${style.cssClass}`.trim() || undefined} style={vars}>
            <ZoneGeometry
              object={object}
              className={shapeAnim || undefined}
              style={{
                fill,
                stroke: stroke === "transparent" ? "none" : stroke,
                strokeWidth: selected ? Math.max(object.strokeWidth, 5) : object.strokeWidth,
                opacity: object.opacity,
              }}
            />
          </g>
          <ShapeLabel
            width={object.type === "polygon" ? polygonBounds(object.points).width : object.width}
            height={object.type === "polygon" ? polygonBounds(object.points).height : object.height}
            object={object}
          />
        </>
      )}
      {object.type === "text" && (
        <text
          x={object.align === "center" ? object.width / 2 : 0}
          y={object.fontSize}
          textAnchor={object.align === "center" ? "middle" : object.align === "right" ? "end" : "start"}
          style={{
            fill: object.fill,
            fontSize: object.fontSize,
            fontFamily: object.fontFamily,
            fontWeight: object.fontStyle.includes("bold") ? 700 : 400,
            fontStyle: object.fontStyle.includes("italic") ? "italic" : "normal",
          }}
        >
          {object.text}
        </text>
      )}
      {object.type === "image" && (
        <image href={object.src} width={object.width} height={object.height} preserveAspectRatio="none" />
      )}
      {object.type === "arrow" && <ExploreArrow object={object} />}
      {object.type === "path" && (
        <path
          d={object.data}
          style={{
            fill: object.fill === "transparent" ? "none" : object.fill,
            stroke: object.stroke,
            strokeWidth: object.strokeWidth,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        />
      )}
    </g>
  );
}

export function ExploreSvg({
  map,
  selectedId,
  onSelect,
  route,
}: {
  map: MapProject;
  selectedId: string | null;
  onSelect: (object: MapObject | null) => void;
  route?: number[] | null;
}) {
  const outlinePoints = isPolygonCanvas(map.canvasShape) ? map.canvasShape.points : null;
  const polygon = Boolean(outlinePoints);
  const stroke = outlineStroke(map);
  const clipId = `map-clip-${map.id}`;
  const defs = useMemo(() => {
    return map.objects.flatMap((object) => {
      const style = getZoneStyle(object);
      const nodes = [];
      if (style.fillStyle === "hatch") {
        nodes.push(
          <pattern
            key={`hatch-${object.id}`}
            id={`fill-${object.id}`}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="14" height="14" fill={object.fill} />
            <line x1="0" y1="0" x2="0" y2="14" stroke={style.hatchColor} strokeWidth="5" />
          </pattern>,
        );
      }
      if (style.fillStyle === "dots") {
        nodes.push(
          <pattern
            key={`dots-${object.id}`}
            id={`fill-${object.id}`}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <rect width="16" height="16" fill={object.fill} />
            <circle cx="8" cy="8" r="2.1" fill={style.hatchColor} />
          </pattern>,
        );
      }
      return nodes;
    });
  }, [map.objects]);

  const grass = map.background.type === "pattern";

  return (
    <svg
      width={map.width}
      height={map.height}
      viewBox={`0 0 ${map.width} ${map.height}`}
      onClick={() => onSelect(null)}
      className="explore-map-svg block max-w-none select-none"
      style={{ pointerEvents: "none", color: "#18181b", overflow: "visible" }}
    >
      <defs>
        {outlinePoints && (
          <clipPath id={clipId}>
            <polygon points={pointsAttr(outlinePoints)} />
          </clipPath>
        )}
        {grass && (
          <pattern id={`grass-${map.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill={map.background.color} />
            <circle cx="10" cy="10" r="2.3" fill={map.background.patternColor || "#558b2f"} />
          </pattern>
        )}
        {defs}
      </defs>
      <g clipPath={polygon ? `url(#${clipId})` : undefined}>
        {map.background.type === "image" && map.background.imageDataUrl ? (
          <image
            href={map.background.imageDataUrl}
            width={map.width}
            height={map.height}
            preserveAspectRatio="none"
          />
        ) : (
          <rect
            width={map.width}
            height={map.height}
            fill={grass ? `url(#grass-${map.id})` : map.background.color}
          />
        )}
      </g>
      {outlinePoints ? (
        <polygon
          points={pointsAttr(outlinePoints)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinejoin="round"
        />
      ) : (
        <rect
          width={map.width}
          height={map.height}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
        />
      )}
      {map.objects.map((object) =>
        object.visible ? (
          <ExploreObject
            key={object.id}
            object={object}
            selected={selectedId === object.id}
            onSelect={onSelect}
          />
        ) : null,
      )}
      {route && route.length >= 4 && (
        <g className="explore-route" style={{ pointerEvents: "none" }}>
          <polyline
            points={pointsAttr(route)}
            fill="none"
            stroke="#ffffff"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={pointsAttr(route)}
            fill="none"
            stroke="#65a30d"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="explore-route-line"
          />
        </g>
      )}
      {map.youAreHere && (
        <g transform={`translate(${map.youAreHere.x} ${map.youAreHere.y})`} style={{ pointerEvents: "none" }}>
          <circle r="16" fill="#e53935" stroke="#ffffff" strokeWidth="4" />
          <circle r="5" fill="#ffffff" />
          <text
            y="28"
            textAnchor="middle"
            style={{ fill: "#111111", fontSize: 11, fontWeight: 700, fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            YOU ARE HERE
          </text>
        </g>
      )}
    </svg>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type Konva from "konva";
import KonvaLib from "konva";
import type { MapObject } from "@/lib/types";
import { getZoneStyle } from "@/lib/zone-style";

export function useZoneAnimation(object: MapObject) {
  const groupRef = useRef<Konva.Group>(null);
  const style = getZoneStyle(object);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const shape = group.getChildren()[0] as Konva.Shape | undefined;
    if (!shape || style.animation === "none") return;

    const layer = group.getLayer();
    if (!layer) return;

    const baseOpacity = group.opacity();
    const baseScaleX = group.scaleX();
    const baseScaleY = group.scaleY();
    const baseBlur = shape.shadowBlur();
    const baseDash = shape.dash();
    const baseDashOffset = shape.dashOffset();
    const speed = Math.max(0.15, style.animationSpeed);

    if (style.animation === "shimmer" && (!baseDash || baseDash.length === 0)) {
      shape.dash([14, 10]);
    }

    const animation = new KonvaLib.Animation((frame) => {
      const time = ((frame?.time ?? 0) / 1000) * speed;
      const wave = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);

      if (style.animation === "pulse") {
        group.opacity(Math.max(0.2, object.opacity * (0.58 + 0.42 * wave)));
      } else if (style.animation === "breathe") {
        const scale = 1 + 0.045 * Math.sin(time * Math.PI * 2);
        group.scale({ x: scale, y: scale });
      } else if (style.animation === "glow") {
        shape.shadowBlur(baseBlur + 18 * wave);
        group.opacity(Math.max(0.35, object.opacity * (0.7 + 0.3 * wave)));
      } else if (style.animation === "shimmer") {
        shape.dashOffset(-time * 48);
      }
    }, layer);

    animation.start();
    return () => {
      animation.stop();
      group.opacity(baseOpacity);
      group.scale({ x: baseScaleX, y: baseScaleY });
      shape.shadowBlur(baseBlur);
      shape.dash(baseDash);
      shape.dashOffset(baseDashOffset);
    };
  }, [
    object.id,
    object.opacity,
    style.animation,
    style.animationSpeed,
    object.fill,
    object.stroke,
    object.shadowBlur,
  ]);

  return groupRef;
}

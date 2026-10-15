import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp, type Bounds } from "@/lib/geometry";

export type ExploreView = {
  x: number;
  y: number;
  scale: number;
};

type Pointer = { x: number; y: number };

const MAX_SCALE = 12;
const MAX_FIT_SCALE = 4;
const MIN_FOCUS_SCALE = 0.12;
const MAX_FOCUS_SCALE = 4;
const PAN_MARGIN = 96;
const MIN_FIT_SCALE = 0.01;
const MOBILE_BREAKPOINT = 768;
const FIT_TOP_CHROME = 88;
const FIT_BOTTOM_CHROME = 168;
const ZOOM_OUT_HEADROOM = 0.7;

function distance(a: Pointer, b: Pointer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Pointer, b: Pointer): Pointer {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function fitArea(viewport: Bounds): Bounds {
  const mobile = viewport.width < MOBILE_BREAKPOINT;
  return {
    x: 0,
    y: mobile ? FIT_TOP_CHROME : 0,
    width: viewport.width,
    height: Math.max(1, viewport.height - (mobile ? FIT_TOP_CHROME + FIT_BOTTOM_CHROME : 0)),
  };
}

function fitPadding(viewport: Bounds): number {
  return viewport.width < MOBILE_BREAKPOINT ? 20 : 40;
}

function containScale(width: number, height: number, viewport: Bounds, padding: number): number {
  const availW = Math.max(1, viewport.width - padding * 2);
  const availH = Math.max(1, viewport.height - padding * 2);
  return clamp(Math.min(availW / width, availH / height), MIN_FIT_SCALE, MAX_FIT_SCALE);
}

export function minScaleFor(width: number, height: number, viewport: Bounds): number {
  return (
    containScale(width, height, fitArea(viewport), fitPadding(viewport)) * ZOOM_OUT_HEADROOM
  );
}

export function fitView(width: number, height: number, viewport: Bounds, padding = 28): ExploreView {
  const scale = containScale(width, height, viewport, padding);
  return {
    scale,
    x: viewport.x + (viewport.width - width * scale) / 2,
    y: viewport.y + (viewport.height - height * scale) / 2,
  };
}

export function viewForBounds(bounds: Bounds, viewport: Bounds, padding = 36): ExploreView {
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const scale = clamp(
    Math.min((viewport.width - padding * 2) / w, (viewport.height - padding * 2) / h),
    MIN_FOCUS_SCALE,
    MAX_FOCUS_SCALE,
  );
  return {
    scale,
    x: viewport.x + viewport.width / 2 - (bounds.x + w / 2) * scale,
    y: viewport.y + viewport.height / 2 - (bounds.y + h / 2) * scale,
  };
}

function clampView(view: ExploreView, viewport: Bounds, mapWidth: number, mapHeight: number): ExploreView {
  const scale = clamp(view.scale, minScaleFor(mapWidth, mapHeight, viewport), MAX_SCALE);
  const scaledW = mapWidth * scale;
  const scaledH = mapHeight * scale;
  const minX = Math.min(PAN_MARGIN, viewport.width - PAN_MARGIN) - scaledW;
  const maxX = Math.max(PAN_MARGIN, viewport.width - PAN_MARGIN);
  const minY = Math.min(PAN_MARGIN, viewport.height - PAN_MARGIN) - scaledH;
  const maxY = Math.max(PAN_MARGIN, viewport.height - PAN_MARGIN);
  return {
    scale,
    x: clamp(view.x, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(view.y, Math.min(minY, maxY), Math.max(minY, maxY)),
  };
}

// The zoom floor is applied here rather than left to clampView so the position
// is derived from the scale the view will actually end up at. Anchoring on that
// scale means reaching the floor is a no-op: the map does not drift sideways
// when the user keeps zooming out past the limit.
function zoomView(
  current: ExploreView,
  factor: number,
  origin: Pointer,
  minScale: number,
): ExploreView {
  const nextScale = clamp(current.scale * factor, minScale, MAX_SCALE);
  const worldX = (origin.x - current.x) / current.scale;
  const worldY = (origin.y - current.y) / current.scale;
  return {
    scale: nextScale,
    x: origin.x - worldX * nextScale,
    y: origin.y - worldY * nextScale,
  };
}

export function useExploreGestures(mapWidth: number, mapHeight: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ExploreView>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, Pointer>());
  const pinch = useRef<{ distance: number; scale: number; mid: Pointer; view: ExploreView } | null>(
    null,
  );
  const pan = useRef<{ x: number; y: number; view: ExploreView; slop: number } | null>(null);
  const moved = useRef(false);
  const tapReady = useRef(false);
  const userAdjusted = useRef(false);
  const lastSize = useRef<Bounds | null>(null);
  const raf = useRef(0);
  const pending = useRef<ExploreView | null>(null);

  viewRef.current = view;

  const measure = useCallback((): Bounds => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0, width: 1, height: 1 };
    const rect = el.getBoundingClientRect();
    return { x: 0, y: 0, width: rect.width, height: rect.height };
  }, []);

  const toLocal = useCallback((clientX: number, clientY: number): Pointer => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const applyView = useCallback(
    (next: ExploreView, immediate = false) => {
      const clamped = clampView(next, measure(), mapWidth, mapHeight);
      viewRef.current = clamped;
      pending.current = clamped;
      if (immediate) {
        if (raf.current) {
          cancelAnimationFrame(raf.current);
          raf.current = 0;
        }
        setView(clamped);
        return;
      }
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (pending.current) setView(pending.current);
      });
    },
    [mapHeight, mapWidth, measure],
  );

  const fit = useCallback(() => {
    const viewport = measure();
    userAdjusted.current = false;
    applyView(fitView(mapWidth, mapHeight, fitArea(viewport), fitPadding(viewport)), true);
  }, [applyView, mapHeight, mapWidth, measure]);

  const focusBounds = useCallback(
    (bounds: Bounds) => {
      const viewport = measure();
      const mobile = viewport.width < MOBILE_BREAKPOINT;
      userAdjusted.current = true;
      applyView(viewForBounds(bounds, fitArea(viewport), mobile ? 48 : 72), true);
    },
    [applyView, measure],
  );

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      userAdjusted.current = true;
      const viewport = measure();
      const origin =
        clientX != null && clientY != null
          ? toLocal(clientX, clientY)
          : { x: viewport.width / 2, y: viewport.height / 2 };
      const minScale = minScaleFor(mapWidth, mapHeight, viewport);
      applyView(zoomView(viewRef.current, factor, origin, minScale), true);
    },
    [applyView, mapHeight, mapWidth, measure, toLocal],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      userAdjusted.current = true;
      const current = viewRef.current;
      applyView({ ...current, x: current.x + dx, y: current.y + dy }, true);
    },
    [applyView],
  );

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onResize = () => {
      const next = measure();
      const previous = lastSize.current;
      lastSize.current = next;
      if (!userAdjusted.current) {
        fit();
        return;
      }
      if (!previous) return;
      const dx = (next.width - previous.width) / 2;
      const dy = (next.height - previous.height) / 2;
      if (dx === 0 && dy === 0) return;
      const current = viewRef.current;
      applyView({ ...current, x: current.x + dx, y: current.y + dy }, true);
    };
    lastSize.current = measure();
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [applyView, fit, measure]);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      event.preventDefault();
    }
    const point = toLocal(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    moved.current = false;
    tapReady.current = true;
    if (pointers.current.size === 1) {
      pan.current = {
        x: point.x,
        y: point.y,
        view: viewRef.current,
        slop: event.pointerType === "touch" ? 14 : 8,
      };
      pinch.current = null;
    } else if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: distance(a, b),
        scale: viewRef.current.scale,
        mid: midpoint(a, b),
        view: viewRef.current,
      };
      pan.current = null;
    }
  }

  function trackMove(pointerId: number, clientX: number, clientY: number) {
    if (!pointers.current.has(pointerId)) return;
    const point = toLocal(clientX, clientY);
    pointers.current.set(pointerId, point);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const nextDist = distance(a, b);
      const nextMid = midpoint(a, b);
      const ratio = nextDist / Math.max(1, pinch.current.distance);
      const nextScale = clamp(
        pinch.current.scale * ratio,
        minScaleFor(mapWidth, mapHeight, measure()),
        MAX_SCALE,
      );
      const worldX = (pinch.current.mid.x - pinch.current.view.x) / pinch.current.view.scale;
      const worldY = (pinch.current.mid.y - pinch.current.view.y) / pinch.current.view.scale;
      moved.current = true;
      userAdjusted.current = true;
      applyView({
        scale: nextScale,
        x: nextMid.x - worldX * nextScale,
        y: nextMid.y - worldY * nextScale,
      });
      return;
    }
    if (pointers.current.size === 1 && pan.current) {
      const dx = point.x - pan.current.x;
      const dy = point.y - pan.current.y;
      if (Math.hypot(dx, dy) > pan.current.slop) moved.current = true;
      if (moved.current) {
        userAdjusted.current = true;
        applyView({
          ...pan.current.view,
          x: pan.current.view.x + dx,
          y: pan.current.view.y + dy,
        });
      }
    }
  }

  function trackUp(pointerId: number) {
    const el = viewportRef.current;
    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    pointers.current.delete(pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) pan.current = null;
    if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      pan.current = { x: remaining.x, y: remaining.y, view: viewRef.current, slop: 14 };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    trackMove(event.pointerId, event.clientX, event.clientY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    trackUp(event.pointerId);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onNativeWheel(event: WheelEvent) {
      event.preventDefault();
      const origin = toLocal(event.clientX, event.clientY);
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= 120;
      const panMode = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.4;
      if (panMode && !event.ctrlKey && !event.metaKey) {
        userAdjusted.current = true;
        const current = viewRef.current;
        applyView({
          ...current,
          x: current.x - (event.shiftKey ? dy : event.deltaX),
          y: current.y - (event.shiftKey ? 0 : event.deltaY),
        });
        return;
      }
      const factor = Math.exp(-dy * 0.0018);
      userAdjusted.current = true;
      const viewport = measure();
      applyView(
        zoomView(viewRef.current, factor, origin, minScaleFor(mapWidth, mapHeight, viewport)),
      );
    }

    function onGesture(event: Event) {
      event.preventDefault();
    }

    viewport.addEventListener("wheel", onNativeWheel, { passive: false });
    viewport.addEventListener("touchmove", onGesture, { passive: false });
    viewport.addEventListener("gesturestart", onGesture, { passive: false });
    viewport.addEventListener("gesturechange", onGesture, { passive: false });
    viewport.addEventListener("gestureend", onGesture, { passive: false });

    function onWinMove(event: PointerEvent) {
      trackMove(event.pointerId, event.clientX, event.clientY);
    }
    function onWinUp(event: PointerEvent) {
      trackUp(event.pointerId);
    }
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);

    return () => {
      viewport.removeEventListener("wheel", onNativeWheel);
      viewport.removeEventListener("touchmove", onGesture);
      viewport.removeEventListener("gesturestart", onGesture);
      viewport.removeEventListener("gesturechange", onGesture);
      viewport.removeEventListener("gestureend", onGesture);
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    };
  }, [applyView, mapHeight, mapWidth, measure, toLocal]);

  function didMove() {
    return moved.current;
  }

  function consumeTap() {
    const tapped = tapReady.current && !moved.current;
    tapReady.current = false;
    return tapped;
  }

  return {
    viewportRef,
    view,
    fit,
    focusBounds,
    zoomAt,
    panBy,
    didMove,
    consumeTap,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

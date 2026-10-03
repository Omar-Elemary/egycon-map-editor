"use client";

import { Clock, List, MapPinned, Maximize2, Minus, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { ExploreSvg } from "@/components/explore/ExploreSvg";
import { useExploreGestures } from "@/hooks/use-explore-gestures";
import { getObjectBounds } from "@/lib/geometry";
import { routeToZone, zoneMatchesQuery } from "@/lib/route";
import { labeledZones, isGuestZone } from "@/lib/share";
import type { MapObject, MapProject } from "@/lib/types";
import { isLabeled } from "@/lib/types";

function ZoneDetails({
  object,
  onClose,
}: {
  object: MapObject;
  onClose: () => void;
}) {
  if (!isLabeled(object)) return null;
  return (
    <div className="rounded-3xl bg-white p-4 text-zinc-900 shadow-2xl">
      {object.photoDataUrl && (
        <img src={object.photoDataUrl} alt="" className="mb-3 h-28 w-full rounded-2xl object-cover" />
      )}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 h-10 w-10 shrink-0 rounded-2xl border border-zinc-200"
          style={{ background: object.fill }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Zone</p>
          <h2 className="text-lg font-semibold leading-tight">{object.label || object.name}</h2>
          {object.label && object.name && object.label !== object.name && (
            <p className="text-sm text-zinc-500">{object.name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {(object.hours || object.activity || object.description) && (
        <div className="mt-3 space-y-2 text-sm">
          {object.hours && (
            <p className="flex items-start gap-2 text-zinc-700">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              {object.hours}
            </p>
          )}
          {object.activity && (
            <p className="flex items-start gap-2 text-zinc-700">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              {object.activity}
            </p>
          )}
          {object.description && <p className="leading-5 text-zinc-600">{object.description}</p>}
        </div>
      )}
    </div>
  );
}

function ZoneList({
  zones,
  selectedId,
  onJump,
  tone = "dark",
}: {
  zones: MapObject[];
  selectedId: string | null;
  onJump: (object: MapObject) => void;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";
  return (
    <div className="space-y-1">
      {zones.map((object) => {
        const active = selectedId === object.id;
        return (
          <button
            key={object.id}
            type="button"
            onClick={() => onJump(object)}
            className={`flex w-full min-h-12 items-center gap-3 rounded-2xl px-2 py-3 text-left ${
              active
                ? dark
                  ? "bg-lime-400/15"
                  : "bg-lime-100"
                : dark
                  ? "hover:bg-white/10"
                  : "hover:bg-zinc-100"
            }`}
          >
            <span
              className={`h-9 w-9 shrink-0 rounded-xl border ${dark ? "border-white/15" : "border-zinc-200"}`}
              style={{ background: object.fill }}
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm font-medium ${
                dark ? "text-zinc-100" : "text-zinc-900"
              }`}
            >
              {isLabeled(object) ? object.label || object.name : object.name}
            </span>
          </button>
        );
      })}
      {zones.length === 0 && (
        <p className="px-2 py-6 text-center text-sm text-zinc-500">No labeled zones on this map.</p>
      )}
    </div>
  );
}

export function ExploreViewer({ map }: { map: MapProject }) {
  const zones = useMemo(() => labeledZones(map), [map]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [ready, setReady] = useState(false);
  const gestures = useExploreGestures(map.width, map.height);
  const selected =
    map.objects.find((object) => object.id === selectedId && isGuestZone(object)) ??
    map.objects.find((object) => object.id === selectedId) ??
    null;
  const filteredZones = useMemo(
    () => zones.filter((object) => zoneMatchesQuery(object, query)),
    [query, zones],
  );
  const route = useMemo(() => {
    if (!selected || !isLabeled(selected) || !map.youAreHere) return null;
    return routeToZone(map, selected);
  }, [map, selected]);

  useEffect(() => {
    setReady(true);
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      width: body.style.width,
      height: body.style.height,
    };
    function syncHeight() {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--vvh", `${height}px`);
    }
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";
    syncHeight();
    window.visualViewport?.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("scroll", syncHeight);
    window.addEventListener("orientationchange", syncHeight);
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.width = previous.width;
      body.style.height = previous.height;
      body.style.inset = "";
      root.style.removeProperty("--vvh");
      window.visualViewport?.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("scroll", syncHeight);
      window.removeEventListener("orientationchange", syncHeight);
    };
  }, []);

  function onViewportPointerUp(event: PointerEvent<HTMLDivElement>) {
    gestures.onPointerUp(event);
    setGrabbing(false);
    if (!gestures.consumeTap() || event.button > 0) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const zone = hit?.closest("[data-zone-id]");
    const id = zone?.getAttribute("data-zone-id");
    if (id) {
      setSelectedId(id);
      setListOpen(false);
      return;
    }
    setSelectedId(null);
  }

  function jumpTo(object: MapObject) {
    setSelectedId(object.id);
    setListOpen(false);
    gestures.focusBounds(getObjectBounds(object));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedId(null);
        setListOpen(false);
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        gestures.zoomAt(1.15);
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        gestures.zoomAt(1 / 1.15);
      }
      if (event.key === "0" || event.key.toLowerCase() === "f") {
        event.preventDefault();
        gestures.fit();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        gestures.panBy(80, 0);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        gestures.panBy(-80, 0);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        gestures.panBy(0, 80);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        gestures.panBy(0, -80);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gestures.fit, gestures.panBy, gestures.zoomAt]);

  return (
    <div className="explore-root flex w-full overflow-hidden bg-zinc-900 text-white">
      <div className="relative min-w-0 flex-1">
        <div
          ref={gestures.viewportRef}
          className={`explore-viewport absolute inset-0 ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={(event) => {
            setGrabbing(true);
            gestures.onPointerDown(event);
          }}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={(event) => {
            setGrabbing(false);
            gestures.onPointerUp(event);
          }}
          onLostPointerCapture={(event) => {
            setGrabbing(false);
            gestures.onPointerUp(event);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onDoubleClick={(event) => {
            gestures.zoomAt(1.35, event.clientX, event.clientY);
          }}
        >
          <div
            className="explore-stage text-zinc-900"
            suppressHydrationWarning
            style={{
              transform: `translate3d(${gestures.view.x}px, ${gestures.view.y}px, 0) scale(${gestures.view.scale})`,
              transformOrigin: "0 0",
              width: map.width,
              height: map.height,
            }}
          >
            <ExploreSvg map={map} selectedId={selectedId} route={route} onSelect={() => {}} />
          </div>
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pb-8 pt-[max(0.75rem,var(--explore-safe-top))] md:hidden">
          <div
            className="explore-header-fade pointer-events-auto flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-lime-300 uppercase">Explore</p>
              <h1 className="truncate text-lg font-semibold">{map.name}</h1>
              <p className="text-xs text-zinc-300">Drag to move · pinch or tap + / − to zoom</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setListOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md"
                aria-label="Zone list"
              >
                <List className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={gestures.fit}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md"
                aria-label="Fit map"
              >
                <Maximize2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <div
          className={`pointer-events-none absolute right-3 z-20 md:right-4 md:bottom-4 ${
            selected && isLabeled(selected)
              ? "bottom-[max(10.5rem,calc(var(--explore-safe-bottom)+9.5rem))]"
              : "bottom-[max(1.25rem,calc(var(--explore-safe-bottom)+1rem))]"
          }`}
        >
          <div className="pointer-events-auto flex flex-col gap-2">
            <button
              type="button"
              title="Zoom in"
              onClick={() => gestures.zoomAt(1.2)}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-zinc-900/85 text-white shadow-lg backdrop-blur-md hover:bg-zinc-800 md:h-11 md:w-11"
            >
              <Plus className="h-5 w-5 md:h-4 md:w-4" />
            </button>
            <button
              type="button"
              title="Zoom out"
              onClick={() => gestures.zoomAt(1 / 1.2)}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-zinc-900/85 text-white shadow-lg backdrop-blur-md hover:bg-zinc-800 md:h-11 md:w-11"
            >
              <Minus className="h-5 w-5 md:h-4 md:w-4" />
            </button>
            <button
              type="button"
              title="Fit map"
              onClick={gestures.fit}
              className="hidden h-11 w-11 place-items-center rounded-full border border-white/15 bg-zinc-900/85 text-white backdrop-blur-md hover:bg-zinc-800 md:grid"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <div
              className="rounded-full border border-white/15 bg-zinc-900/85 px-0 py-2 text-center text-[11px] font-medium text-zinc-300 backdrop-blur-md"
              suppressHydrationWarning
            >
              {ready ? `${Math.round(gestures.view.scale * 100)}%` : ""}
            </div>
          </div>
        </div>

        {selected && isLabeled(selected) && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,var(--explore-safe-bottom))] md:hidden">
            <ZoneDetails object={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      <aside className="hidden w-80 shrink-0 flex-col border-l border-white/10 bg-zinc-950 md:flex">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-lime-300 uppercase">Explore</p>
          <h1 className="mt-1 text-xl font-semibold">{map.name}</h1>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Scroll to zoom, drag to pan, click a zone. Double-click zooms in. Arrows move, + / − zoom, F fits.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <label className="relative mb-3 block">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search WC, Stage, food…"
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 py-3 pr-3 pl-9 text-base text-white outline-none placeholder:text-zinc-500 focus:border-lime-400 md:py-2 md:text-sm"
            />
          </label>
          {map.youAreHere && (
            <p className="mb-2 flex items-center gap-1.5 px-2 text-[11px] text-zinc-500">
              <MapPinned className="h-3.5 w-3.5" />
              Tap a zone to see the walking route
            </p>
          )}
          <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Zones</h2>
          <ZoneList tone="dark" zones={filteredZones} selectedId={selectedId} onJump={jumpTo} />
        </div>
        {selected && isLabeled(selected) && (
          <div className="border-t border-white/10 p-3">
            <ZoneDetails object={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </aside>

      {listOpen && (
        <div className="absolute inset-0 z-30 bg-black/50 md:hidden" onClick={() => setListOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,var(--explore-safe-bottom))] text-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-white px-4 py-3">
              <h2 className="text-base font-semibold">Zones</h2>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100"
                aria-label="Close list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pb-3">
              <label className="relative mb-3 block">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search WC, Stage, food…"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pr-3 pl-9 text-base text-zinc-900 outline-none focus:border-lime-500"
                />
              </label>
              <ZoneList tone="light" zones={filteredZones} selectedId={selectedId} onJump={jumpTo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

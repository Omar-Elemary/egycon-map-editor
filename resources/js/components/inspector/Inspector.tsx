"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { isPolygonCanvas, rectOutline } from "@/lib/canvas-shape";
import { readFileAsDataUrl } from "@/lib/storage";
import type { MapBackground, MapObject, ObjectPatch, ZoneAnimation, ZoneFillStyle } from "@/lib/types";
import { isLabeled } from "@/lib/types";
import { getZoneStyle, ZONE_ANIMATIONS, ZONE_FILL_STYLES } from "@/lib/zone-style";
import { useEditorStore } from "@/store/editor-store";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-lime-500 ${props.className ?? ""}`}
    />
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={hex}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-zinc-200 bg-white p-0"
        />
        <TextInput value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

export function Inspector() {
  const project = useEditorStore((state) => state.project);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const renameProject = useEditorStore((state) => state.renameProject);
  const setCanvasSize = useEditorStore((state) => state.setCanvasSize);
  const setCanvasShape = useEditorStore((state) => state.setCanvasShape);
  const setTool = useEditorStore((state) => state.setTool);
  const tool = useEditorStore((state) => state.tool);
  const editingOutline = useEditorStore((state) => state.editingOutline);
  const setEditingOutline = useEditorStore((state) => state.setEditingOutline);
  const setBackground = useEditorStore((state) => state.setBackground);
  const setYouAreHere = useEditorStore((state) => state.setYouAreHere);
  const updateObject = useEditorStore((state) => state.updateObject);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const reorderObject = useEditorStore((state) => state.reorderObject);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  if (!project) return null;

  const canvasShape = project.canvasShape ?? { type: "rect" as const };

  const selected = project.objects.filter((object) => selectedIds.includes(object.id));
  const current = selected.length === 1 ? selected[0] : null;

  async function uploadBackground() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const imageDataUrl = await readFileAsDataUrl(file);
      setBackground({ type: "image", imageDataUrl });
    };
    input.click();
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500">MAP</h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Field label="Name">
          <TextInput value={project.name} onChange={(event) => renameProject(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <TextInput
              type="number"
              value={project.width}
              onChange={(event) => setCanvasSize(Number(event.target.value), project.height)}
            />
          </Field>
          <Field label="Height">
            <TextInput
              type="number"
              value={project.height}
              onChange={(event) => setCanvasSize(project.width, Number(event.target.value))}
            />
          </Field>
        </div>
        <Field label="Map shape">
          <select
            value={canvasShape.type}
            onChange={(event) => {
              const type = event.target.value as "rect" | "polygon";
              if (type === "rect") {
                setCanvasShape({ type: "rect" });
                setEditingOutline(false);
                return;
              }
              setCanvasShape({
                type: "polygon",
                points: isPolygonCanvas(canvasShape)
                  ? canvasShape.points
                  : rectOutline(project.width, project.height),
              });
              setEditingOutline(true);
            }}
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-lime-500"
          >
            <option value="rect">Rectangle</option>
            <option value="polygon">Polygon</option>
          </select>
        </Field>
        {canvasShape.type === "polygon" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTool("outline")}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                tool === "outline"
                  ? "border-lime-500 bg-lime-100 text-lime-900"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Draw outline
            </button>
            <button
              type="button"
              onClick={() => setEditingOutline(!editingOutline)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                editingOutline
                  ? "border-lime-500 bg-lime-100 text-lime-900"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {editingOutline ? "Done editing" : "Edit vertices"}
            </button>
          </div>
        )}
        {canvasShape.type === "rect" && (
          <button
            type="button"
            onClick={() => setTool("outline")}
            className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              tool === "outline"
                ? "border-lime-500 bg-lime-100 text-lime-900"
                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Draw polygon outline
          </button>
        )}
        <Field label="Background">
          <select
            value={project.background.type}
            onChange={(event) =>
              setBackground({ type: event.target.value as MapBackground["type"] })
            }
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-lime-500"
          >
            <option value="color">Solid color</option>
            <option value="pattern">Dotted grass</option>
            <option value="image">Floor plan image</option>
          </select>
        </Field>
        <ColorField
          label="Fill color"
          value={project.background.color}
          onChange={(color) => setBackground({ color })}
        />
        {project.background.type === "pattern" && (
          <ColorField
            label="Dot color"
            value={project.background.patternColor || "#558b2f"}
            onChange={(patternColor) => setBackground({ patternColor })}
          />
        )}
        {project.background.type === "image" && (
          <button
            type="button"
            onClick={uploadBackground}
            className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            {project.background.imageDataUrl ? "Replace floor plan" : "Upload floor plan"}
          </button>
        )}
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <h4 className="text-[11px] font-semibold tracking-wide text-zinc-500">YOU ARE HERE</h4>
          <p className="text-[11px] leading-4 text-zinc-500">
            Optional pin. Guests can get a walking route from this entrance to a zone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTool("you-are-here")}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                tool === "you-are-here"
                  ? "border-lime-500 bg-lime-100 text-lime-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {project.youAreHere ? "Move pin" : "Place pin"}
            </button>
            <button
              type="button"
              disabled={!project.youAreHere}
              onClick={() => setYouAreHere(null)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500">SELECTION</h3>
          {selected.length === 0 && (
            <p className="text-sm text-zinc-400">Select a zone, label, or icon on the map.</p>
          )}
          {selected.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">{selected.length} objects selected</p>
              <button
                type="button"
                onClick={deleteSelected}
                className="w-full rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
              >
                Delete selected
              </button>
            </div>
          )}
          {current && <ObjectFields object={current} />}
        </div>

        <div className="border-t border-zinc-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500">LAYERS</h3>
          <div className="space-y-1">
            {[...project.objects].reverse().map((object) => {
              const active = selectedIds.includes(object.id);
              return (
                <div
                  key={object.id}
                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 ${
                    active ? "bg-lime-100" : "hover:bg-zinc-100"
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate px-1 text-left text-xs text-zinc-800"
                    onClick={() => setSelectedIds([object.id])}
                  >
                    {object.name || object.type}
                  </button>
                  <button
                    type="button"
                    title="Bring forward"
                    onClick={() => reorderObject(object.id, "forward")}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Send backward"
                    onClick={() => reorderObject(object.id, "backward")}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateObject(object.id, { visible: !object.visible })}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
                  >
                    {object.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateObject(object.id, { locked: !object.locked })}
                    className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
                  >
                    {object.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
            {project.objects.length === 0 && (
              <p className="text-xs text-zinc-400">No objects yet. Draw a zone to start.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ObjectFields({ object }: { object: MapObject }) {
  const update = useEditorStore((state) => state.updateObject);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  function patch(next: ObjectPatch) {
    update(object.id, next);
  }

  return (
    <div className="space-y-3">
      <Field label="Name">
        <TextInput value={object.name} onChange={(event) => patch({ name: event.target.value })} />
      </Field>
      {isLabeled(object) && (
        <>
          <Field label="Label">
            <TextInput value={object.label} onChange={(event) => patch({ label: event.target.value })} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600">
            <input
              type="checkbox"
              checked={object.showLabel !== false}
              onChange={(event) => patch({ showLabel: event.target.checked })}
              className="h-4 w-4 accent-lime-600"
            />
            Show name on map
          </label>
          <ColorField
            label="Label color"
            value={object.labelColor}
            onChange={(labelColor) => patch({ labelColor })}
          />
          <Field label="Label size">
            <TextInput
              type="number"
              value={object.fontSize}
              onChange={(event) => patch({ fontSize: Number(event.target.value) })}
            />
          </Field>
          <ZoneWallpaperFields object={object} onChange={patch} />
          <ZoneGuestFields object={object} onChange={patch} />
          <ZoneStyleFields object={object} onChange={patch} />
        </>
      )}
      {object.type === "text" && (
        <>
          <Field label="Text">
            <TextInput value={object.text} onChange={(event) => patch({ text: event.target.value })} />
          </Field>
          <Field label="Font size">
            <TextInput
              type="number"
              value={object.fontSize}
              onChange={(event) => patch({ fontSize: Number(event.target.value) })}
            />
          </Field>
        </>
      )}
      {object.type !== "image" && (
        <ColorField label="Fill" value={object.fill} onChange={(fill) => patch({ fill })} />
      )}
      {object.type !== "text" && (
        <ColorField label="Stroke" value={object.stroke} onChange={(stroke) => patch({ stroke })} />
      )}
      {object.type !== "text" && object.type !== "image" && (
        <Field label="Stroke width">
          <TextInput
            type="number"
            value={object.strokeWidth}
            onChange={(event) => patch({ strokeWidth: Number(event.target.value) })}
          />
        </Field>
      )}
      {object.type === "rect" && (
        <Field label="Corner radius">
          <TextInput
            type="number"
            value={object.cornerRadius}
            onChange={(event) => patch({ cornerRadius: Number(event.target.value) })}
          />
        </Field>
      )}
      <Field label="Opacity">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={object.opacity}
          onChange={(event) => patch({ opacity: Number(event.target.value) })}
          className="w-full"
        />
      </Field>
      <button
        type="button"
        onClick={deleteSelected}
        className="w-full rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
      >
        Delete
      </button>
    </div>
  );
}

function ZoneWallpaperFields({
  object,
  onChange,
}: {
  object: MapObject;
  onChange: (patch: ObjectPatch) => void;
}) {
  if (!isLabeled(object)) return null;
  async function uploadWallpaper() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      onChange({ wallpaperDataUrl: await readFileAsDataUrl(file) });
    };
    input.click();
  }
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <h4 className="text-[11px] font-semibold tracking-wide text-zinc-500">WALLPAPER (OPTIONAL)</h4>
      <p className="text-[11px] leading-4 text-zinc-500">
        Cover this zone with a photo or design. It is clipped to the zone shape on the shared map.
      </p>
      {object.wallpaperDataUrl && (
        <img src={object.wallpaperDataUrl} alt="" className="h-20 w-full rounded-lg object-cover" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={uploadWallpaper}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {object.wallpaperDataUrl ? "Replace image" : "Add image"}
        </button>
        <button
          type="button"
          disabled={!object.wallpaperDataUrl}
          onClick={() => onChange({ wallpaperDataUrl: null })}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          Remove
        </button>
      </div>
      {object.wallpaperDataUrl && (
        <Field label={`Image opacity ${((object.wallpaperOpacity ?? 1) * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={object.wallpaperOpacity ?? 1}
            onChange={(event) => onChange({ wallpaperOpacity: Number(event.target.value) })}
            className="w-full"
          />
        </Field>
      )}
    </div>
  );
}

function ZoneGuestFields({
  object,
  onChange,
}: {
  object: MapObject;
  onChange: (patch: ObjectPatch) => void;
}) {
  if (!isLabeled(object)) return null;
  async function uploadPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      onChange({ photoDataUrl: await readFileAsDataUrl(file) });
    };
    input.click();
  }
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <h4 className="text-[11px] font-semibold tracking-wide text-zinc-500">GUEST INFO (OPTIONAL)</h4>
      <p className="text-[11px] leading-4 text-zinc-500">
        Shown when someone taps this zone on the shared map. Leave blank to skip.
      </p>
      <Field label="Hours">
        <TextInput
          value={object.hours ?? ""}
          placeholder="11:00 – 22:00"
          onChange={(event) => onChange({ hours: event.target.value })}
        />
      </Field>
      <Field label="What happens here">
        <TextInput
          value={object.activity ?? ""}
          placeholder="Talks, merch, food…"
          onChange={(event) => onChange({ activity: event.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={object.description ?? ""}
          placeholder="A short note for guests"
          rows={3}
          onChange={(event) => onChange({ description: event.target.value })}
          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-lime-500"
        />
      </Field>
      {object.photoDataUrl && (
        <img src={object.photoDataUrl} alt="" className="h-20 w-full rounded-lg object-cover" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={uploadPhoto}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {object.photoDataUrl ? "Replace photo" : "Add photo"}
        </button>
        <button
          type="button"
          disabled={!object.photoDataUrl}
          onClick={() => onChange({ photoDataUrl: null })}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          Remove photo
        </button>
      </div>
    </div>
  );
}

function ZoneStyleFields({
  object,
  onChange,
}: {
  object: MapObject;
  onChange: (patch: ObjectPatch) => void;
}) {
  const style = getZoneStyle(object);
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <h4 className="text-[11px] font-semibold tracking-wide text-zinc-500">STYLE & ANIMATION</h4>
      <Field label="Fill style">
        <select
          value={style.fillStyle}
          onChange={(event) => onChange({ fillStyle: event.target.value as ZoneFillStyle })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-lime-500"
        >
          {ZONE_FILL_STYLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Animation">
        <select
          value={style.animation}
          onChange={(event) => onChange({ animation: event.target.value as ZoneAnimation })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-lime-500"
        >
          {ZONE_ANIMATIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {style.animation !== "none" && (
        <Field label={`Speed ${style.animationSpeed.toFixed(1)}x`}>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={style.animationSpeed}
            onChange={(event) => onChange({ animationSpeed: Number(event.target.value) })}
            className="w-full"
          />
        </Field>
      )}
      {(style.fillStyle === "hatch" || style.fillStyle === "dots") && (
        <ColorField
          label={style.fillStyle === "hatch" ? "Hatch color" : "Dot color"}
          value={style.hatchColor}
          onChange={(hatchColor) => onChange({ hatchColor })}
        />
      )}
      {(style.fillStyle === "glow" || style.animation === "glow") && (
        <ColorField
          label="Glow color"
          value={style.glowColor}
          onChange={(glowColor) => onChange({ glowColor, shadowColor: glowColor })}
        />
      )}
      <Field label="Shadow blur">
        <TextInput
          type="number"
          min={0}
          value={style.shadowBlur}
          onChange={(event) => onChange({ shadowBlur: Number(event.target.value) })}
        />
      </Field>
      <Field label="Style tag / CSS class">
        <TextInput
          value={style.cssClass}
          placeholder="vip-zone"
          onChange={(event) => onChange({ cssClass: event.target.value })}
        />
      </Field>
    </div>
  );
}

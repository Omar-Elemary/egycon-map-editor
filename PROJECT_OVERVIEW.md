# Egycon Map Editor — Project Overview & Problem Report

**Purpose of this document:** a complete map of the project plus an evidence-backed list of the problems we are currently facing, written for an AI assistant (Claude) to produce a solution plan and approach.

**What this document deliberately does NOT do:** propose solutions. Section 8 lists the problems with evidence and impact. Section 10 lists the open questions that must be answered before any approach can be chosen. The reasoning behind design trade-offs is documented so it is not accidentally reversed.

**How to use this document:** read Sections 1–7 for context, Section 8 for the problems, Section 10 before proposing anything. Every claim is cited with `file:line` so it can be verified directly rather than taken on trust. Section 11 has commands to reproduce the measurements.

---

## 1. What this product is

A **venue map editor and public map viewer** for Egycon (an Egyptian gaming convention).

Two distinct user-facing modes:

**Editor** (`/`) — an authoring tool run by venue staff on a desktop. Staff draw venue zones (stage, bazaar, food court, Japan Town, toilets, etc.) onto a canvas, style them, attach labels and photos, upload a floor plan as background, define "you are here", trace the venue outline, then publish the result as a shareable link.

**Explore** (`/m/{shareId}`) — a read-only viewer consumed by **attendees on their phones**, typically by scanning a QR code at the venue. Users pan/zoom/tap zones to read descriptions and hours, search for a zone, and get a walking route from "you are here" to any zone.

The two modes are **decoupled by design**: the editor is a desktop authoring SPA, the viewer is a mobile read-only page. They share the data model and pure logic, but they do **not** share a rendering engine. This is the single most important structural fact about the codebase (see Problem 3).

### Domain vocabulary

| Term | Meaning |
|---|---|
| **Project** | One venue map. The unit of authoring, stored client-side and published as one share. |
| **Object** | One drawable thing on the map: zone shape, text, image, arrow, SVG path. |
| **Zone** | A labelled area (rect / ellipse / polygon) that attendees can interact with in Explore. |
| **Guest zone** | A zone with a non-empty label. *This is the gate for Explore interactivity* — `lib/share.ts:42` `isGuestZone()`. |
| **Share** | A published snapshot of a project. The only thing the server stores. |
| **You are here** | A single `{x, y}` point on the map, used as the walking-route origin. |
| **Canvas shape** | The venue outline mask — either `rect` or a traced `polygon`. |

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Laravel **13.17**, PHP **^8.3** | 8 PHP source files total. No services, jobs, policies, or FormRequests. |
| Database | **SQLite** (`database/database.sqlite`) | `DB_CONNECTION=sqlite`. MySQL/PgSQL/SQL connections are configured but unused. |
| Frontend | **React 19**, **TypeScript 7** (dev dep), **Vite 8** | ~5,800 lines of TS/TSX. |
| Editor canvas | **Konva 10** / `react-konva` | Imperative canvas, immediate-mode scene graph. |
| Explore canvas | **Inline SVG + CSS `transform`** | Declarative, GPU-composited. |
| State | **Zustand 5** — a single store | `resources/js/store/editor-store.ts`. No React context, no Redux. |
| Styling | **Tailwind CSS 4** + `resources/css/explore.css` | Plain CSS for Explore-specific animation. |
| Icons | **lucide-react** | See Problem 2 — currently untyped. |
| QR codes | **qrcode 1.5.4** | See Problem 1 — editor-only, but shipped to phones. |
| Auth | **None.** Opaque bearer token, custom | Not Sanctum, no sessions, no Breeze. `users` table is unused scaffolding. |
| Server framework | **No Inertia.** | Two independent Vite entry points mounted into Blade views. |

There is **no `lint` and no `typecheck` npm script**, and **no frontend test runner** (see Problem 2). PHP tests do exist and pass.

---

## 3. Repository layout

```
app/
  Http/Controllers/ShareController.php     (163 lines)  publish / read / update / unpublish
  Http/Controllers/ExploreController.php   (28 lines)   SSR the viewer page
  Models/Share.php                         (53 lines)   string PK, payload cast to array
  Models/User.php                          (32 lines)   UNUSED scaffolding
  Support/ShareMap.php                     (56 lines)   the ENTIRE server-side validation layer
  Support/ShareUrls.php                    (168 lines)  LAN-aware share link generation
database/migrations/                       5 migrations (4 are stock Laravel scaffold)
resources/js/
  editor.tsx    explore.tsx                two Vite entries
  store/editor-store.ts                    (468 lines)  zustand store + undo/redo + persistence
  lib/          types.ts route.ts geometry.ts objects.ts storage.ts
                share.ts share-api.ts zone-style.ts canvas-shape.ts export.ts ids.ts
  components/
    editor/     EditorShell EditorHeader ShortcutLegend
    canvas/     EditorCanvas BackgroundLayer MapObjectNode
    inspect/    Inspector
    share/      ShareDialog
    sidebar/    ProjectSidebar
    toolbar/    ToolBar ZoomControls
    explore/    ExploreViewer ExploreSvg
  hooks/        use-explore-gestures use-editor-shortcuts use-zone-animation use-html-image
resources/views/
  editor.blade.php  explore.blade.php  explore-missing.blade.php  welcome.blade.php
routes/         web.php (2 routes)  api.php (4 routes)
tests/          12 PHPUnit tests, all passing
```

Largest frontend files — these are where complexity has concentrated:

| File | Lines |
|---|---|
| `components/canvas/EditorCanvas.tsx` | 713 |
| `components/inspector/Inspector.tsx` | 643 |
| `components/explore/ExploreSvg.tsx` | 523 |
| `store/editor-store.ts` | 468 |
| `components/explore/ExploreViewer.tsx` | 468 |
| `lib/objects.ts` | 416 |

---

## 4. The data model

One `MapProject` is the entire unit of data. Defined in `resources/js/lib/types.ts:163-173`:

```ts
type MapProject = {
  id: string;                    // becomes the share slug AND the DB primary key
  name: string;
  width: number;
  height: number;
  background: MapBackground;     // { type: "color"|"pattern"|"image", color, patternColor?, imageDataUrl? }
  canvasShape?: CanvasShape;     // { type:"rect" } | { type:"polygon", points: number[] }
  objects: MapObject[];
  youAreHere?: YouAreHere | null;// { x, y }
  updatedAt: number;             // ms epoch; server re-stamps on publish
};
```

`MapObject` is a **7-member discriminated union** on `type` (`types.ts:132-139`): `rect`, `ellipse`, `polygon`, `text`, `image`, `arrow`, `path`.

All objects share `BaseObject` (`types.ts:40-60`): `id, name, x, y, rotation, opacity, locked, visible, fill, stroke, strokeWidth` plus optional style overrides (`fillStyle`, `animation`, `animationSpeed`, `hatchColor`, `glowColor`, `shadowBlur`, `shadowColor`, `cssClass`).

**`rect`, `ellipse` and `polygon` additionally mix in `Labeled`** (`types.ts:62-74`) — the venue-zone metadata:

```ts
{ label, labelColor, fontSize, fontFamily,
  description?, hours?, activity?,
  photoDataUrl?,        // base64 data-URL   <-- see Problem 4
  showLabel?, wallpaperDataUrl?, wallpaperOpacity? }   // <-- see Problem 4
```

`isLabeled()` (`types.ts:188-192`) is the runtime type guard that narrows to those three shape types. It is the hinge for every zone feature — labels, descriptions, hours, photos, and wallpapers are all only reachable on rect/ellipse/polygon.

Zone visual style is a separate small vocabulary (`types.ts:26-38`): `fillStyle: solid|hatch|dots|glow`, `animation: none|pulse|glow|breathe|shimmer`.

### Object construction note worth knowing

`labeledPolygon()` (`lib/objects.ts:86`) **rebases absolute points to local coordinates** relative to the polygon's min/min. This is why `getObjectBounds()` in `lib/geometry.ts:54` adds `object.x`/`object.y` back for polygons but not for rects. Any new geometry code must respect this convention or bounds/hit-testing will be subtly wrong.

---

## 5. The two renderers (the core mental model)

This is the part that is hardest to hold in your head, so it is worth stating plainly.

**Everything above the renderer is shared. The renderer, and everything below it, is duplicated.**

```
                    SHARED, mode-agnostic
  ┌─────────────────────────────────────────────────────────┐
  │ lib/types.ts      the whole data model                  │
  │ lib/geometry.ts   bounds, hit-test, polygon ray-cast    │
  │ lib/canvas-shape.ts  outline mask helpers               │
  │ lib/zone-style.ts  getZoneStyle() → style resolution    │
  │ lib/share.ts       publish serialize / parse / guestzone │
  │ lib/route.ts       A* walking route (Explore-only)      │
  └─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
   EDITOR (Konva)                        EXPLORE (SVG)
        │                                       │
   <Stage x/y scale>              div transform: translate3d+scale
   Konva Transformer               DOM hit-test (elementFromPoint)
   marquee AABB select             CSS keyframe animations
   offscreen canvas patterns       SVG <pattern> defs
   Konva.Animation loop            16/14px pattern tiles
   fillPatternImage                <clipPath> + <image>
   zustand past/future (60)        no history
   localStorage persistence        no persistence
```

The handoff between the two worlds is **entirely server-side**, through `POST /api/share` then `GET /m/{id}`. `EditorShell.tsx` never references `ExploreViewer.tsx`.

---

## 6. Persistence and data flow

### There are exactly three storage locations

| What | Where | Code |
|---|---|---|
| Projects being authored | Browser `localStorage`, key `map-editor:project:{id}` | `lib/storage.ts:6-8` |
| Project index | `localStorage`, key `map-editor:index` | `lib/storage.ts:4` |
| Manage token | `localStorage`, key `egycon-share-token:{id}` | `lib/share-api.ts:16` |
| **Published maps** | **`shares.payload` — one `LONGTEXT` JSON blob per row** | `database/migrations/2026_09_11_000000_create_shares_table.php:14` |

There is **no file storage, no uploads, no S3, no image processing anywhere on the server.** `config/filesystems.php` is untouched stock Laravel. Every image in the entire system travels as a **base64 data-URL embedded inside the map JSON** (`lib/types.ts:19` `imageDataUrl`, `:70` `photoDataUrl`, `:72` `wallpaperDataUrl`). This is the root cause of Problem 4.

### The `shares` table

```
id          string(64)  PRIMARY KEY    ← client-derived slug, no autoincrement
name        string(255)                ← denormalized copy of project.name
payload     LONGTEXT                   ← THE ENTIRE MAP, JSON-encoded
published   boolean     default true
expires_at  timestamp   nullable
manage_token string(64)  nullable       ← sha256 hex digest
```

One row = one map project. **There are no tables for objects, zones, or labels.** The only relational query in the entire application is `Share::query()->find($id)` on a string primary key.

`Share::$incrementing = false` and `$keyType = 'string'` (`app/Models/Share.php:10-12`). The `payload => 'array'` cast (`:26`) is what makes the JSON blob transparent to Eloquent.

### Publish flow (Editor → Server)

1. `ShareDialog.tsx` calls `publishShare()` → `POST /api/share` with the **entire** `MapProject` as the request body (`lib/share-api.ts:35`).
2. `ShareController@store` (`app/Http/Controllers/ShareController.php:16`) reads the raw JSON body.
3. `ShareMap::parse()` (`app/Support/ShareMap.php:23-55`) sanitises it:
   - structural gate — requires `name`, numeric `width`/`height`, `objects` array, `background` array. Failure → `400 Invalid map project.`
   - **drops every object with `visible: false`** (`ShareMap.php:39`) — hidden layers never reach the DB or a viewer
   - **repairs duplicate and missing object IDs** (`ShareMap.php:42-45`)
   - **re-stamps `updatedAt` server-side** (`ShareMap.php:53`) — the server owns the timestamp
4. Authorization (`:32-34`): 403 if a row already exists **and** has a token **and** the request token doesn't match **and** `app()->isLocal()` is false.
5. Token: reuse if it matches, else mint `Str::random(40)` (`:36`); store `hash('sha256', $plainToken)` (`:46`).
6. `Share::query()->updateOrCreate(['id' => $id], [...])` (`:39-48`) — **replaces the entire blob.**
7. Response: `{ id, name, published, live, expiresAt, manageToken, path, urls[], phoneUrl }`.

Note: **the server derives the primary key from the client's `project.id`** (`ShareController.php:25`, via `ShareMap::idFromProject()`), so there is no separate autogenerated identifier. `idFromProject()` strips everything outside `[a-zA-Z0-9_-]`, truncates to 48 chars, and falls back to `'map'`. This logic is **duplicated** in TypeScript at `lib/share.ts:5` and must be kept in sync by hand.

### View flow (Server → Phone)

Two read paths:

**a) SSR, no API round-trip** — `GET /m/{id}` → `ExploreController@show` (`app/Http/Controllers/ExploreController.php:12`):
- invalid ID → 404; missing / unpublished / expired / non-array payload → 404
- otherwise renders `resources/views/explore.blade.php:15`, which embeds the map inline:

```blade
<script id="map-data" type="application/json">{!! json_encode($map, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES) !!}</script>
```

- `resources/js/explore.tsx:7-8` reads that `<script>`, `JSON.parse`s it, runs `parseShareMap()`, and mounts `<ExploreViewer>`.

> ⚠️ That line uses **unescaped `{!! !!}`**. The four `JSON_HEX_*` flags are the *only* defence against stored XSS via user-supplied `name`, `label`, or `description` fields. Any refactor of this expression must preserve all four flags. Treat this as load-bearing.

**b) API** — `GET /api/share/{id}` returns the raw payload unwrapped (`ShareController.php:65`). Client helper `fetchShare()` (`lib/share-api.ts:77`) is **dead code** — nothing imports it.

### Walking route (Explore only)

`lib/route.ts` — A* pathfinding on a 28px grid, used to draw a route from `youAreHere` to a tapped zone.

- `blockingZones()` (`:44`) treats visible labelled objects with a non-empty label and `opacity > 0.35` as obstacles, excluding the goal.
- Fast path: if `lineClear()` (`:60`), return a straight line.
- Otherwise build a `Uint8Array` walkability grid, force start/goal cells walkable (`:218-219`), run 8-way A* with √2 diagonal cost, reconstruct, prepend the true start, string-pull smooth (`:82`).
- `clipRouteToZoneBorder()` (`:117`) then trims the final segment so the line stops *at* the zone border rather than bleeding through the zone interior. It samples each segment at 4px, finds the outside→inside transition, binary-searches 24 iterations for the crossing point, then backs off along the travel direction by `ARRIVAL_BACKOFF = 10` px.
- `zoneInteriorPoint()` (`:99`) finds a guaranteed interior point because the bounds centre of a concave polygon can lie outside it.

This was the most recent change (commit `8fb8ed7`), so it is the freshest and least battle-tested code in the project.

### Authorization model

No Sanctum, no sessions, no login. `config/auth.php` is stock and unused; the `User` model has zero relationships and no share is owned by anyone.

Instead: an opaque bearer token.
- minted `Str::random(40)`, stored as `hash('sha256', …)` in a `string(64)` column
- sent as the `X-Share-Token` header (or a `manageToken` body field), verified with constant-time `hash_equals()` (`Share.php:51`)
- held in browser `localStorage` under `egycon-share-token:{id}`
- `PATCH` and `DELETE` require it; `POST` bypasses the check when `app()->isLocal()`

Route protection matrix:

| Route | Protected? |
|---|---|
| `GET /` | No |
| `GET /m/{id}` | No (gated only by `published` + `expires_at`) |
| `POST /api/share` | Partially — 403 unless local env |
| `GET /api/share/{id}` | No |
| `PATCH /api/share/{id}` | Yes — token required |
| `DELETE /api/share/{id}` | Yes — token required |

> Not one of the four prioritised problems, but recorded because it constrains any storage redesign: **the share's identity is the client-supplied project ID, and the write credential is a browser-local token.** Changing the blob format does not require changing either, but changing the ID scheme would.

---

## 7. Current verification baseline

Measured on commit `8fb8ed7`, Windows, PHP 8.x / Node with `node_modules` installed.

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | ✅ passes in ~4.3s. Emits a **chunk-size warning**. |
| TypeScript | `npx tsc --noEmit` | ❌ **fails, 8 errors** (Problem 2) |
| PHP tests | `php artisan test` | ✅ 12 passed, 34 assertions, 7.2s |
| Frontend tests | — | ❌ **no runner exists** |
| Lint | — | ❌ **no script exists** |

Build output:

```
public/build/assets/app-BuwQggso.css       68.70 kB │ gzip:  14.09 kB
public/build/assets/explore-BqZJoalm.js   30.20 kB │ gzip:   9.47 kB
public/build/assets/editor-CYdloLfP.js   402.85 kB │ gzip: 123.13 kB
public/build/assets/share-C1mJqFf3.js    800.05 kB │ gzip: 214.79 kB   ← Problem 1
```

Current published payloads in the database (all four are test fixtures, **none contain media**):

```
id=map_egycon_official  name=Egycon Map  payload_bytes=11,095  published=true
id=demo                 name=Egycon Demo payload_bytes=1,438   published=true
id=proj_test            name=Main hall   payload_bytes=245     published=true
id=verify_map           name=Verify hall payload_bytes=248     published=true
```

---

## 8. Problems we are facing

Prioritised as agreed. Each has: the evidence, why it matters, and what is *not* yet known.

---

### Problem 1 — The mobile viewer downloads 800 KB of code it never uses

**Severity: High. Affects every attendee, on every map view, on venue wifi.**

`public/build/manifest.json` shows that **both** entries import the same shared chunk:

```json
"resources/js/explore.tsx": {
  "file": "assets/explore-BqZJoalm.js",
  "isEntry": true,
  "imports": [ "_share-C1mJqFf3.js" ]        ← the 800 KB chunk
}
```

So the phone's total payload is `30.20 kB (explore) + 800.05 kB (share) ≈ 830 kB raw / ~224 kB gzip`, when the Explore page's own code is only **30 kB**.

The bulk of that shared chunk is the **`qrcode` library**. It is imported in exactly one place in the entire codebase:

```
resources/js/components/share/ShareDialog.tsx:5:  import QRCode from "qrcode";
resources/js/components/share/ShareDialog.tsx:54: await QRCode.toDataURL(url, {…})
resources/js/components/share/ShareDialog.tsx:214: await QRCode.toDataURL(url, {…})
```

`ShareDialog` is an **editor-only** component — rendered at `components/editor/EditorHeader.tsx:80`. `ExploreViewer` never uses QR codes. Yet the bundler placed the library into a shared chunk that Explore now pulls in, because `explore.tsx` → `ExploreViewer.tsx` → `lucide-react`, and rolldown grouped the common vendor code (React, ReactDOM, lucide, qrcode) into one chunk.

For scale, on disk: `node_modules/qrcode` = 558 KB across 156 files; `node_modules/lucide-react` = 1.2 MB across 19 files.

**Why it matters:** the Explore page is the one that has to feel instant on a phone, at a convention, possibly on congested venue wifi. We are shipping 214 kB of gzip to display a map whose actual logic is 9.5 kB gzipped. That is a ~24× overhead on the critical path, and it is a direct consequence of `resources/views/explore.blade.php:10` using `@vite(['resources/css/app.css', 'resources/js/explore.tsx'])` — a single flat entry with no route-aware splitting.

**Not yet known:** whether the chunk grouping is stable across rebuilds or shifts with unrelated dependency changes (it should be measured, not assumed). Also unmeasured: real-world load time on a mid-range Android phone on venue wifi.

---

### Problem 2 — TypeScript does not compile, and nothing in the toolchain would have told us

**Severity: High for velocity. Low for the shipped artefact.**

`npx tsc --noEmit` fails with **8 errors**, all the same root cause:

```
resources/js/components/editor/EditorHeader.tsx(3,52):      error TS7016
resources/js/components/explore/ExploreViewer.tsx(3,118):   error TS7016
resources/js/components/inspector/Inspector.tsx(3,69):       error TS7016
resources/js/components/share/ShareDialog.tsx(3,79):        error TS7016
resources/js/components/sidebar/ProjectSidebar.tsx(3,36):    error TS7016
resources/js/components/toolbar/ToolBar.tsx(15,8):          error TS7016
resources/js/components/toolbar/ZoomControls.tsx(3,40):     error TS7016

  Could not find a declaration file for module 'lucide-react'.
  '…/node_modules/lucide-react/dist/cjs/lucide-react.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/lucide-react` if it exists or add a new declaration
```

`lucide-react` is listed in `package.json:26` as a **runtime dependency**, and it ships icon components, but the installed version resolves to a CJS build with no `.d.ts`. `tsconfig.json` has `"strict": true`, so the implicit-`any` is an error rather than a warning.

**The more important half of this problem is the second half:**

`package.json:5-8` defines only two scripts:

```json
"scripts": { "build": "vite build", "dev": "vite" }
```

There is **no `typecheck` script and no `lint` script.** Vite/esbuild strips types without checking them, so `npm run build` **passes cleanly** despite 8 type errors — which is exactly why this has survived. Any editor icon is imported in 8 files with zero compile-time verification of its props or return type.

**Why it matters:** the project claims `strict: true` and has ~5,800 lines of TS, but the type checker is effectively not in the loop. Errors are only discoverable by manually running `npx tsc --noEmit`, which nothing does. Any AI-assisted or team-based work on this repo currently operates without type safety as an enforced constraint.

**Not yet known:** whether `strict: true` would surface a meaningful number of *additional* errors once `lucide-react` is fixed, or whether the 8 are genuinely the whole story. Worth knowing before planning — it changes whether this is a 5-minute fix or the first domino in a longer cleanup. (`npx tsc --noEmit` with `skipLibCheck` already on, so this is the honest total.)

---

### Problem 3 — Two renderers, with the same logic implemented twice and drifting

**Severity: High for maintenance. This is the project's core structural problem.**

Editor and Explore each implement, independently: label rendering, fill patterns, zone animations, wallpaper clipping, hit-testing, view transform, fit-to-view, and zoom clamping.

| Concern | Editor (Konva) | Explore (SVG) |
|---|---|---|
| Renderer | `EditorCanvas.tsx` | `ExploreSvg.tsx` |
| View transform | `<Stage x y scaleX scaleY>` | `div` `transform: translate3d(x,y,0) scale(s)` |
| Zoom limits | **0.1 – 8** (`EditorCanvas.tsx:313`) | **0.08 – 12** (`use-explore-gestures.ts:12-13`) |
| Fit-to-view | 56px pad, clamp 0.12 – 2.5 (`EditorCanvas.tsx:153-166`) | responsive 20/40px pad, clamp 0.08 – 4 (`use-explore-gestures.ts:24-33`) |
| Label component | `ShapeLabel` — Konva `Text`, word wrap, box shadow (`MapObjectNode.tsx:22`) | `ShapeLabel` — SVG `<text>`/`tspan`, manual `wrapLabel`, `paint-order` stroke (`ExploreSvg.tsx:36,55`) |
| Fill patterns | offscreen `HTMLCanvasElement` → `fillPatternImage` (`zone-style.ts:50,72`) | SVG `<pattern>` defs, 14px/16px tiles (`ExploreSvg.tsx:377-405`) |
| Animation engine | `Konva.Animation` loop mutating opacity/scale/shadowBlur/dash (`use-zone-animation.ts:34`) | CSS keyframes + CSS custom properties `--zone-speed`/`--zone-glow` (`ExploreSvg.tsx:19`, `explore.css:37-83`) |
| Wallpaper clip | `fillPatternImage` + `wallpaperCover()` cover-math (`MapObjectNode.tsx:61`) | `<clipPath>` + `<image preserveAspectRatio="xMidYMid slice">` (`ExploreSvg.tsx:109-177`) |
| Selection | Konva `Transformer` + marquee AABB via `boxesIntersect` (`geometry.ts:28`) | `document.elementFromPoint()` + `closest("[data-zone-id]")` (`ExploreViewer.tsx:201`) |

**Why it matters — concretely:**

1. **A style change in the editor is not automatically reflected in the viewer.** Each has its own `ShapeLabel`, its own pattern tile size, its own animation timing model. Any visual fix has to be written and verified twice, and it is entirely possible to fix one and forget the other.
2. **The two systems can already disagree.** The editor's pattern tiles are 18px/16px (`zone-style.ts:50,72`); Explore's are 14px/16px (`ExploreSvg.tsx:377-405`). A zone's fill does not look identical between authoring and viewing.
3. **Text layout differs most visibly.** The editor uses Konva's own wrapping; Explore uses a hand-rolled greedy wrap assuming `charWidth = fontSize * 0.62` (`ExploreSvg.tsx:36`). The same label will wrap at different points on a phone than in the editor. Long Arabic/English venue names will visibly reflow.
4. **The wallpaper feature added in the last commit (`8fb8ed7`) has to be maintained in both renderers** — `MapObjectNode.tsx:56-83` (Konva) and `ExploreSvg.tsx:109-177` (SVG), with different clipping maths and different "cover" fitting strategies.
5. **Nothing enforces parity.** There is no test asserting that an object renders the same in both modes. Duplication without a parity check is duplication that rots.

**Not yet known:** whether the visual divergence between editor and viewer has been noticed as a bug by the client. And whether the zoom-limit mismatch (0.1–8 vs 0.08–12) is intentional or an accident of two independently-tuned constants.

---

### Problem 4 — Images are inlined as base64, and the ceiling is close

**Severity: High. Data-loss risk, currently latent.**

Every image in the system is a **base64 data-URL embedded in the map JSON**. There is no upload endpoint, no file storage, no image resizing anywhere on the server (`config/filesystems.php` is untouched stock; grep for `Storage::`, `UploadedFile`, `putFile` across `app/` returns nothing).

Three separate media fields: `background.imageDataUrl` (`types.ts:19`), `photoDataUrl` (`types.ts:70`), `wallpaperDataUrl` (`types.ts:72`).

**The hard limits, measured:**

| Limit | Value | Source |
|---|---|---|
| PHP `post_max_size` | **8 MB** | `php -i` |
| PHP `memory_limit` | **128 MB** | `php -i` |
| Browser `localStorage` | **~5 MB per origin** (all projects combined) | browser quota |

Base64 inflates binary by ~37%. Projected blob size for a real venue map using the wallpaper feature:

| Scenario | raw media | base64 JSON | over 8 MB? |
|---|---|---|---|
| no media (**current state**) | — | 11 KB actual | no |
| 12 zones @ 150 KB wallpaper | 1,800 KB | 2,400 KB | no |
| 12 zones @ 400 KB wallpaper | 4,800 KB | 6,400 KB | no |
| 12 zones @ 400 KB + floor plan | 5,824 KB | 7,765 KB | borderline |

**Breakeven: with 12 zones, localStorage exhausts first — at roughly 311 KB per zone wallpaper. Publishing fails above roughly 498 KB per zone.** A single 1600×960 floor-plan photo exported from a phone camera is routinely 1–3 MB, i.e. **one or two such images per zone is enough to exhaust the authoring budget on a normal map.**

**The actual failure mode is worse than a hard error.** `lib/storage.ts:41-47`:

```ts
export function saveProject(project: MapProject): void {
  try {
    localStorage.setItem(projectKey(project.id), JSON.stringify(project));
  } catch (error) {
    console.warn("Could not save project (storage quota?)", error);
  }
}
```

When the quota is hit, the write is **swallowed with a `console.warn`**. There is no user-facing signal. The editor continues to accept edits, the UI shows them, and **nothing is persisted**. From the author's point of view the work simply disappears — on reload. Every mutation goes through `persist()` (`editor-store.ts:72`) on every `commitProject()` (`editor-store.ts:89`), so this is the only write path; there is no backup.

Secondary consequences of the same root cause:

- **Publishing rewrites the entire blob.** `ShareController.php:39-48` is `updateOrCreate` over `payload`. There is no partial update of map content — only `published` and `expires_at` can be patched (`ShareController.php:75-81`). Every publish uploads the full base64 payload again.
- **Every viewer pays for every image.** The SSR page inlines the whole JSON blob into the HTML (`explore.blade.php:15`), so all zone wallpapers are downloaded by the phone even though only the tapped zone's photo is ever displayed (`ExploreViewer.tsx:27-28`). A map with 12 zone wallpapers ships all 12 to every attendee.
- **No payload size validation.** `ShareMap::parse()` (`ShareMap.php:23-55`) validates only the envelope — `name` present, `width`/`height` numeric, `objects`/`background` arrays. Individual objects are never shape-checked and there is no byte-size cap.
- **Nothing is ever cleaned up.** `DELETE /api/share/{id}` is a **soft unpublish** — it sets `published = false` and saves (`ShareController.php:88-99`). The row and its payload blob stay in the table forever. There is no `app/Jobs` directory, so no scheduled purge can exist.

**Not yet known:** what the real-world photo budget per zone should be, and whether the client wants wallpapers at all on a venue map — the wallpaper feature is brand new (commit `8fb8ed7`) and no published map uses it yet, so the ceiling has never actually been hit. It is a latent limit, not a reported bug.

---

## 9. Smaller issues on record

Not prioritised, but found while mapping the codebase. Listed so they are not rediscovered from scratch.

| # | Issue | Evidence |
|---|---|---|
| 1 | Client and server duplicate the share-ID derivation (same regex, same 48-char truncation, kept in sync by hand) | `app/Support/ShareMap.php:12` vs `lib/share.ts:5` |
| 2 | Client and server validation disagree on `width`/`height`: TS checks `typeof === "number"`, PHP uses `is_numeric` | `types.ts:194-205` vs `ShareMap.php:25-34` |
| 3 | `app()->isLocal()` disables share-takeover protection; committed `.env` has `APP_ENV=local` | `ShareController.php:32`, `.env` |
| 4 | `CORS_ALLOWED_ORIGINS=*` with `api/*` paths | `.env`, `config/cors.php:4-11` |
| 5 | Undo/redo deep-clones the whole project via `structuredClone` on every commit, capped at 60 entries — O(project size) per keystroke-level change | `editor-store.ts:26,68,81` |
| 6 | `user-scalable=no` + `maximum-scale=1` in the viewer viewport blocks native pinch-zoom (WCAG 1.4.4); custom pinch is implemented instead | `explore.blade.php:6` |
| 7 | Zero frontend tests. No tests for geometry, A* pathfinding, share serialisation, or the store | `tests/` contains only PHP |
| 8 | `README.md` is untouched Laravel boilerplate; `AGENTS.md` and `CLAUDE.md` are unmodified Boost placeholders. No real project documentation exists | `README.md:1-58` |
| 9 | Dead scaffolding: `User` model, `users`/`sessions`/`jobs`/`cache` tables, `config/auth.php`, S3 disk — all unused | `app/Models/User.php`, `config/filesystems.php` |
| 10 | `lib/share-api.ts:77` `fetchShare()` is never imported | — |
| 11 | `ExploreViewer.tsx` is 468 lines with selection/search/panel/sheet logic inline; `EditorCanvas.tsx` is 713 lines | — |
| 12 | `composer.phar` (3.6 MB) sits untracked in the repo root, not in `.gitignore` | — |

---

## 10. Open questions — answer these before proposing an approach

These are genuine unknowns. A plan built on assumptions here will be wrong.

**On the product direction (these change everything downstream):**

1. **Is this heading to production with real users, or is it still a client demo?** This single answer determines whether Problem 1 is a nice-to-have (polish) or a blocker (reliability on venue wifi), and whether Problem 4 needs solving at all right now.
2. **How many zones, and how many images per zone, does a real venue map have?** Every media calculation in Problem 4 scales off this. We are extrapolating from a 26-object demo map with zero images.
3. **Do wallpapers need to be in the shared map at all, or could they be authored-only?** Wallpapers appear to be an authoring aid (helping staff identify zones while drawing). If they are never shown to attendees, they should never enter the published blob — that alone dissolves most of Problem 4.
4. **Is there a content-management or client-account requirement coming?** Right now there is no auth, a share is owned by nobody, and a share's primary key is the client's own project ID. Any real multi-user requirement invalidates the current model.

**On Problem 1 (bundle):**

5. **Is lazy-loading / route-level code splitting acceptable, or must the viewer be a single self-contained bundle?** A phone opening a venue map benefits from one round-trip; a 224 kB gzip payload on bad wifi does not. These pull in opposite directions and the tradeoff is a product decision, not a technical one.
6. **Has the 800 KB shared-chunk grouping been stable across rebuilds?** Measured once. Needs confirmation before designing around it.

**On Problem 3 (two renderers):**

7. **How much visual divergence between editor and viewer is acceptable?** Perfect parity is expensive. If "close enough" is fine, the fix may be a shared pure style/geometry layer plus a parity test, rather than unifying the renderers.
8. **Is Konva required for the editor, or was it a default choice?** A single SVG renderer for both modes would remove the entire duplication class, at the cost of editor canvas performance on large maps. That is a real trade-off with no free answer.
9. **Is the zoom-limit mismatch (0.1–8 vs 0.08–12) intentional?** If not, it is evidence of drift rather than a decision.

**On Problem 4 (media):**

10. **What image sizes are actually being uploaded today?** We have no telemetry and no published map with media, so every number in Problem 4 is a projection. Worth one real test: author a map with 12 zone wallpapers at realistic phone-photo sizes and observe exactly where it breaks.
11. **Is there deployment infrastructure for object storage, or must everything stay self-contained?** The correct fix (upload → store file → reference by URL) needs a place to put files. SQLite + `public/` is workable at small scale; it does not scale past it.
12. **Must published maps stay immutable snapshots?** If they could be mutable with per-zone lazy loading, the payload problem changes shape entirely.

**On safety nets:**

13. **Do we want a frontend test runner added, or is fixing `tsc` + a lint script sufficient?** Related: after `lucide-react` is fixed, is the 8-error total the whole story, or does `strict: true` reveal more? (Section 11 shows how to check.)
14. **What is the regression tolerance for the editor?** A refactor touching `EditorCanvas.tsx` (713 lines of hand-written canvas interaction) or the A* router is high-risk with zero frontend tests. Is a visual-regression or snapshot harness acceptable, or is manual verification the norm?

---

## 11. Reproducing these measurements

```powershell
# Problem 2 — type errors (expect 8 × TS7016)
npx tsc --noEmit

# Problem 1 — bundle sizes (expect the 800 KB shared chunk + size warning)
npm run build
Get-Content public/build/manifest.json -Raw
#   → confirm explore.tsx "imports": [ "_share-C1mJqFf3.js" ]

# Problem 1 — confirm qrcode is editor-only
rg -n "qrcode" resources/js
#   → only ShareDialog.tsx

# Problem 4 — PHP limits
php -r "echo ini_get('post_max_size'), ' / ', ini_get('memory_limit');"

# Problem 4 — actual published payload sizes
php artisan tinker --execute="DB::table('shares')->get(['id','name',DB::raw('length(payload) as bytes')])->each(fn($s)=>print($s->id.' '.$s->bytes.PHP_EOL));"

# Baseline
php artisan test        # 12 passed
```

---

## Appendix — commit context

```
9b841f3  Flatten Laravel app to repository root
a1f8983  Migrate map editor to Laravel application
d6475a0  Initial commit: add a Next.js map editor for Egycon-style venue maps.
8fb8ed7  Clip routes to zone borders and add zone wallpaper and label toggle   ← current HEAD
```

History is short and has no feature branches. The project began as a **Next.js** app and was migrated to **Laravel + Vite**; the migration flattened the app into the repository root. `resources/js/app.js` is a 1-line placeholder (`//`) left over from the Laravel skeleton and is referenced by `resources/views/welcome.blade.php:13`, which is otherwise unused.

The most recent commit is also the most substantial work: it added the `wallpaperDataUrl` / `showLabel` zone features (Problem 4's media path) and the route-clipping logic (`lib/route.ts`, the newest and least battle-tested code in the project).
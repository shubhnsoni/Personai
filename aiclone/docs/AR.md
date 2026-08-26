# AR dish viewer

How `/{slug}/ar` works, and how to produce the assets it needs.

## The constraint that shapes everything

A web page cannot detect a flat surface on its own. There is no browser API for
plane detection outside WebXR. So "put this dish on my table" has exactly three
implementations, and the viewer picks between them at runtime:

| Mechanism | Detects real surfaces | Available on | Asset it needs |
|---|---|---|---|
| WebXR `immersive-ar` + hit-test | yes (ARCore) | Android Chrome/Edge/Samsung Internet | `<name>.glb` |
| Google Scene Viewer | yes (ARCore) | any Android browser | `<name>-ar.glb` |
| iOS AR Quick Look | yes (ARKit) | all iOS browsers (WebKit) | `<name>.usdz` |

Detection lives in `src/lib/ar-platform.ts`; `detectArLaunch()` returns
`webxr | scene-viewer | quick-look | none`. Where it returns `none` the viewer
simply shows its turntable and offers no AR button — there is no camera-preview
fallback, deliberately. Compositing a dish over a camera feed without plane
detection leaves it floating in mid-air, which reads as broken AR rather than as
a preview.

### Two things that silently break native AR

1. **Scene Viewer and Quick Look fetch the model themselves**, from outside the
   page, so `localhost` and LAN addresses cannot work. `isPubliclyReachable()`
   suppresses those buttons and says so.
2. **`.usdz` must be served as `model/vnd.usdz+zip`.** As
   `application/octet-stream` Safari downloads the file and no AR session
   starts. The header rule is in `next.config.ts`.

## In-session AR behaviour (WebXR path)

Three things matter for it to feel solid, all in `src/lib/ar-engine.ts`:

- **Anchoring.** A pose captured once and held in the reference space looks
  locked for a few seconds and then slides, because ARCore keeps refining its
  map of the room and the reference space moves with it. On tap the engine calls
  `hitTestResult.createAnchor()` and then re-reads
  `frame.getPose(anchor.anchorSpace, ref)` **every frame**. That is what stops
  the dish drifting when you walk around. `anchors` is requested as an optional
  feature; without it the static pose still works, just less firmly.
- **A locked dish stays put.** After placement the reticle is hidden and stray
  taps are ignored — only the ‹ › arrows respond. *Move* in the overlay clears
  the placement and brings the reticle back.
- **Auto-rotation.** Once placed, the dish turns slowly (`AUTO_SPIN_RATE`,
  ~12°/s), pausing for 1.2 s whenever it is spun by hand.

Dish switching is offered twice over, because `dom-overlay` is optional and a
runtime may decline it: large HTML arrows in the overlay, and canvas-drawn arrows
in the scene beside the dish, hit-tested from the tap ray. `anchor` is left
unrotated and the facing yaw baked into its child instead, so billboarding the
label and arrows by copying the camera's world quaternion stays correct.

Two mistakes here cost a round trip, both worth not repeating:

- **The dom-overlay root must already be visible and populated when
  `requestSession` runs.** Gating it on `mode === "xr"` cannot work — the mode only
  flips *after* the session starts, so the runtime was handed a `display:none`,
  childless element and no HTML appeared for the whole session. The root is now
  permanently mounted as `fixed inset-0`, made inert outside AR with
  `opacity: 0` + `pointer-events: none` rather than by unmounting it.
- **`dishSize` is the dish's full width, not its radius.** Positioning the
  in-scene arrows at `dishSize * 1.02` put them two dish-widths apart, past the
  display edges at the distance a phone is actually held. They sit at `0.62` now,
  just outside the food.

`session.domOverlayState.type` tells you which path is live; when it is absent the
hint text points at the in-scene arrows instead.

## Assets

Three files per dish in `public/uploads/skydine-ar/`:

```
<name>.glb       meshopt-compressed, arbitrary units  -> in-page three.js viewer
<name>-ar.glb    plain glTF, real-world scale         -> Scene Viewer
<name>.usdz      real-world scale                     -> Quick Look
```

`<name>.glb` is normalised to real size at load time by the viewer. The other
two **must** carry real scale in the file, because Scene Viewer and Quick Look
honour the model's own units — an un-normalised export drops a 1.9-metre brownie
on the table. Sizes come from `src/lib/ar-scale.ts`.

> `ar-scale.ts` is a filename-keyed lookup, which is a stopgap. The right home
> for this is an `arSizeCm` column on `DigitalProduct`, collected by the
> dashboard when a model is uploaded. Until then, all three consumers read the
> same table so they cannot drift apart.

### Step 1 — compress the raw export

Meshy exports about 90 MB per dish: ~1.9M triangles with f32 attributes plus 4K
textures. Unusable on mobile.

```powershell
cd aiclone
pwsh -File scripts/one-off/optimize-ar-glbs.ps1
```

Weld + simplify + meshopt for geometry, ImageMagick for textures. It moves the
raw exports to `../ar-raw/skydine-ar-source/` so `public/` never serves them.
Result on the SkyDine set: **895 MB → 7.6 MB** (0.19–1.48 MB per dish).

Texture resizing goes through ImageMagick rather than `gltf-transform`'s own
`--texture-compress`, because sharp/libvips on this machine fails with
`colourspace: parameter space not set`.

### Step 2 — export the native-AR twins

three's `USDZExporter` and `GLTFExporter` only run in a browser, so this step
uses a throwaway page driven by Playwright. Recreate
`src/app/dev-ar-export/page.tsx` as a client component that dynamically imports
`three`, `GLTFLoader`, `MeshoptDecoder`, `USDZExporter` and `GLTFExporter`, and
exposes:

```ts
window.__exportAr = {
  // load, scale so the largest axis equals sizeMeters, seat on y=0,
  // then export and trigger a download
  download(srcUrl, "usdz" | "glb", filename, sizeMeters)
}
```

USDZ options that matter:

```ts
new USDZExporter().parseAsync(scene, {
  quickLookCompatible: true,       // Quick Look supports a subset of glTF materials
  maxTextureSize: 512,             // USDZ stores images uncompressed; main size lever
  includeAnchoringProperties: true,
  ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
})
```

`planeAnchoring: horizontal` is what tells ARKit to snap to tables rather than
letting the dish hang in mid-air.

USDZ geometry is ASCII and uncompressed, so export it from a decimated source or
the files reach 15 MB each:

```powershell
# temporary lite sources, deleted afterwards
New-Item -ItemType Directory -Force public\uploads\_ar-lite
# per model:
npx @gltf-transform/cli@4.4.2 simplify public\uploads\skydine-ar\<name>.glb `
  public\uploads\_ar-lite\<name>.glb --error 0.005 --ratio 0.28
```

Then drive the downloads with Playwright, saving each to
`public/uploads/skydine-ar/`, delete `public/uploads/_ar-lite/` and delete the
`dev-ar-export` route. Result: USDZ 0.7–5.3 MB, Scene Viewer GLB 0.34–3.52 MB.

### Step 3 — attach them to the menu

```powershell
node --env-file=.env scripts/one-off/assign-skydine-ar.mjs
```

Writes `arModelUrl` and `arUsdzUrl`, refuses any `.glb` over 12 MB, and reports
which of the three artefacts is missing per dish. The `-ar.glb` is not stored:
`/[slug]/ar/page.tsx` derives it from `arModelUrl` and `existsSync`-checks it, so
a missing twin hides the Scene Viewer button rather than failing at tap time.

## Locked: the Android (WebXR) view

This path is signed off. The geometry that makes it work is pinned by
`scripts/one-off/check-ar-layout.mjs`, which parses its constants **out of**
`ar-engine.ts` rather than copying them — so editing the engine either keeps the
guard passing or fails it loudly. Run it after touching anything in the AR scene:

```bash
node scripts/one-off/check-ar-layout.mjs
```

Current margins, in multiples of the dish's width:

| Invariant | Value | Why it exists |
|---|---|---|
| card clearance | 0.160 | was a bug: fixed-Y offset gave **−0.911** and overlapped in 1660 of the sampled orientations |
| arrow clearance beyond the silhouette | 0.080 | was a bug: arrows at `dishSize * 1.02` sat two dish-widths apart |
| arrow outer edge vs visible half-width at arm's length | 0.980 vs 1.141 | keeps them on screen at ~35 cm |

Both invariants were real defects, and both presented the same way — UI drawn over
the food — because the card and arrows render with `depthTest: false` and so
cannot be occluded by the dish. Depth cannot save this; only real clearance can.

### Behaviour worth not regressing

- **Anchored, not posed.** `hitTestResult.createAnchor()` on tap, then
  `frame.getPose(anchor.anchorSpace, ref)` re-read every frame. A pose captured
  once drifts as ARCore refines its map.
- **`anchor` stays unrotated**, with the facing yaw baked into its child. The
  label and arrows are billboarded by copying the camera's world quaternion into
  their *local* one, which is only correct while the parent is unrotated.
- **The card is offset along the camera's up axis**, not a world height. It is
  billboarded, so its extent along that axis is exactly half its height; the
  dish's extent along the same axis is measured from cached bounding-box corners.
  A world-Y offset fails the moment you crouch to table level.
- **A placed dish ignores stray taps.** Only the ‹ › discs and the dish itself
  respond; *Move* clears the placement to reposition.
- **Tapping the dish toggles the detail card**; it is hidden on placement.
- **In-scene card and discs are suppressed when `dom-overlay` is granted**, since
  the HTML controls already cover that and drawing both clutters the dish.

### The detail card

Frosted glass, drawn in `ar-label.ts`. Genuine backdrop blur is impossible here:
blurring what is behind the panel would mean sampling the camera feed, which
WebXR only exposes through `raw-camera-access` — not granted to ordinary pages.
So the glass is grain plus a rim light plus a specular streak, over a fill opaque
enough to stay legible against bright food, pale cloth or dark wood. Verified
against all four.

Rating comes from a mean of real `OfferReview` rows. Note that the shop listing
in `src/app/[slug]/shop/page.tsx` still *fabricates* one
(`downloadCount > 0 ? 4.5 : …`); AR deliberately does not.

## Studio framing

The bottom sheet covers a lot of a phone screen, and its height varies — the
thumbnail rail only appears with more than one dish, and the AR button only
appears on a device that can use it. So the viewer measures the sheet with a
`ResizeObserver` and calls `engine.setFrame(topBarPx, sheetPx)`, which does three
things:

- **zoom** — pulls the camera back until the dish spans `GAP_FILL` (0.76) of *the
  gap*, clamped to `WIDTH_FILL` (0.80) of the width. Sizing against the gap rather
  than the viewport is what stops a short screen with a tall sheet cropping the
  dish; the width clamp matters because `dishSize` is the largest bounding-box
  axis, which for a plated dish is its width.
- **lift** — a `camera.setViewOffset` frustum shift that moves the framing into
  the gap. A lens shift rather than a camera move, so it does not disturb the
  orbit maths or lift the dish off its contact shadow.
- **recentre** — then corrects the lift by measurement. The camera aims at the
  model's real mid-height (recorded in `userData.arHeight` at load, since a wide
  flat dish's mid-height is nowhere near a fraction of its width), but that still
  lands ~45 px top-heavy: a flat dish seen from above has a silhouette that is not
  symmetric about its world centre. `recentreDish()` projects the eight bounding
  box corners, sees where the dish really sits, and shifts by the difference. One
  pass converges, because a view offset translates the image by exactly the
  offset.

None of it applies in XR: there the projection must match the device camera or the
dish will not line up with the room. A pinch sets `zoomTouched` so the auto-fit
stops fighting the viewer; *reset* clears it.

Measured margins around the dish body, top / bottom of the free gap:

| Case | Top | Bottom | Sides |
|---|---|---|---|
| 430×900 desktop | 169 | 183 | 46 |
| 412×780 burger | 84 | 110 | 54 |
| 393×700 burger | 56 | 74 | 40 |
| 412×780 pizza | 149 | 174 | 40 |
| 380×660 momos | 64 | 87 | 44 |

## Code map

| File | Role |
|---|---|
| `src/app/[slug]/ar/page.tsx` | server: loads dishes, resolves which AR assets exist |
| `src/components/shop/ar-world.tsx` | UI: sheet, dish rail, per-platform CTA, XR overlay |
| `src/lib/ar-engine.ts` | three.js: studio + WebXR modes, anchoring, framing, snapshot || `src/lib/ar-platform.ts` | capability detection, Scene Viewer + Quick Look URLs |
| `src/lib/ar-scale.ts` | real-world size per model |
| `src/lib/ar-label.ts` | canvas billboards drawn into the AR scene |

Entry points: the AR banner and per-dish `AR` badge in
`src/components/shop/restaurant-menu.tsx`, and "View on table" in
`src/app/[slug]/shop/[id]/page.tsx`.

## Testing

Native AR cannot be verified in a desktop browser — a spoofed user agent cannot
fake ARCore or ARKit. What is checkable locally:

- studio mode renders (no black screen) on desktop, and the dish sits centred in
  the gap the sheet leaves free
- with an Android UA over a **tunnel** URL, the CTA is an `<a>` whose href is a
  well-formed `intent://arvr.google.com/scene-viewer/1.0?...` with an absolute
  `file=` and a `browser_fallback_url`
- with an iOS UA, the CTA clicks a hidden `<a rel="ar">` pointing at the `.usdz`
- `curl -I` the `.usdz` returns `model/vnd.usdz+zip`

The last mile needs a real phone on the tunnel URL: that ARCore/ARKit anchors the
dish to a real table, that it stays put while you walk around it, and that the
turntable starts once it is placed.

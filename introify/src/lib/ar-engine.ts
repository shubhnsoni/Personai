/**
 * The 3D/AR engine behind the dish viewer.
 *
 * Two display modes. The viewer always has something on screen — it starts in
 * `studio` and only moves up if the device can support it, so a browser without
 * WebXR never gets a black screen.
 *
 *   studio  a lit turntable. Works in every browser, no permissions.
 *   xr      real WebXR `immersive-ar` with plane hit-testing, so the dish is
 *           anchored to the actual table. Android Chrome + ARCore.
 *
 * There is deliberately no camera-passthrough mode. Compositing the dish over a
 * camera feed without plane detection just floats it in mid-air, which reads as
 * broken AR. Devices with no WebXR are handed off to Scene Viewer or Quick Look
 * instead — see src/lib/ar-platform.ts.
 *
 * three itself is imported dynamically: it must not land in the page bundle.
 */

import type { Group, Mesh, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from "three"
import { drawArCard, drawArOrb, type ArCardInfo } from "@/lib/ar-label"

export type ArMode = "studio" | "xr"

/** Fallback real-world width, in metres, when a dish declares no size. */
const DISH_SIZE = 0.22
const STUDIO_ZOOM = 2.8
/** Radians per frame for the turntable once a dish is placed in AR (~12°/s). */
const AUTO_SPIN_RATE = 0.0035
/** In-scene disc and card sizes, as multiples of the dish's width. */
const ORB_SIZE = 0.4
const CARD_W = 1.05
const CARD_H = 0.49

type XrHitTestSource = { cancel: () => void }

type XrPose = { transform: { matrix: number[] } }

type XrAnchor = { anchorSpace: unknown; delete?: () => void }

type XrHitTestResult = {
    getPose: (ref: unknown) => XrPose | null
    createAnchor?: () => Promise<XrAnchor>
}

type XrSession = {
    end: () => Promise<void>
    addEventListener: (type: string, fn: () => void) => void
    removeEventListener: (type: string, fn: () => void) => void
    requestReferenceSpace: (type: string) => Promise<unknown>
    requestHitTestSource?: (opts: { space: unknown }) => Promise<XrHitTestSource>
    domOverlayState?: { type: string | null }
}

type XrSystem = {
    isSessionSupported?: (mode: string) => Promise<boolean>
    requestSession: (mode: string, init?: Record<string, unknown>) => Promise<XrSession>
}

export function xrSystem(): XrSystem | null {
    if (typeof navigator === "undefined") return null
    return (navigator as Navigator & { xr?: XrSystem }).xr || null
}

/** True only where the device can anchor to real surfaces (ARCore / ARKit-WebXR). */
export async function xrSupported(): Promise<boolean> {
    const xr = xrSystem()
    if (!xr?.isSessionSupported) return false
    try {
        return await xr.isSessionSupported("immersive-ar")
    } catch {
        return false
    }
}

export type ArEngineHooks = {
    onHint: (text: string) => void
    onProgress: (ratio: number | null) => void
    onMode: (mode: ArMode) => void
    onError: (message: string) => void
}

export type ArEngine = {
    showDish: (url: string, card: ArCardInfo, sizeMeters?: number) => Promise<void>
    setCard: (card: ArCardInfo) => void
    /**
     * Lens-shifts and zooms the studio view so the dish sits fully inside the
     * space the overlaid UI leaves free. `top` and `bottom` are the covered
     * strips, in CSS pixels.
     */
    setFrame: (top: number, bottom: number) => void
    enterXr: () => Promise<void>
    leaveImmersive: () => void
    resetView: () => void
    snapshot: () => Promise<Blob | null>
    dispose: () => void
}

export async function createArEngine(opts: {
    canvas: HTMLCanvasElement
    overlay: HTMLElement
    hooks: ArEngineHooks
    onSwipe: (dir: -1 | 1) => void
    /** False for a single-dish catalogue, so no switcher is drawn. */
    canSwitch: boolean
}): Promise<ArEngine> {
    const THREE = await import("three")
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
    const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js")
    const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js")

    const { canvas, overlay, hooks } = opts
    let mode: ArMode = "studio"
    let disposed = false

    // ---------------------------------------------------------------- renderer

    const renderer: WebGLRenderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        // needed so snapshot() can read pixels back after a frame is presented
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearAlpha(0)
    renderer.xr.enabled = true

    const scene: Scene = new THREE.Scene()
    const camera: PerspectiveCamera = new THREE.PerspectiveCamera(52, 1, 0.01, 40)

    // An indoor IBL probe. Without it, glTF metal/rough food reads as flat and
    // grey — this is most of the difference between "3D model" and "photo".
    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
    const envRt = pmrem.fromScene(new RoomEnvironment(), 0.035)
    scene.environment = envRt.texture

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.55)
    scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(0.35, 0.95, 0.42)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.012
    const sc = key.shadow.camera as unknown as {
        left: number; right: number; top: number; bottom: number; near: number; far: number
        updateProjectionMatrix: () => void
    }
    sc.left = -0.35
    sc.right = 0.35
    sc.top = 0.35
    sc.bottom = -0.35
    sc.near = 0.05
    sc.far = 2.4
    sc.updateProjectionMatrix()
    scene.add(key)

    const rim = new THREE.DirectionalLight(0xbfe9ff, 0.7)
    rim.position.set(-0.6, 0.5, -0.55)
    scene.add(rim)

    // ------------------------------------------------------------------- stage

    /** Anchor: moved onto the table in camera/xr, sits at the origin in studio. */
    const anchor: Group = new THREE.Group()
    scene.add(anchor)

    /** Spun by the turntable and by twist gestures. Holds the dish only. */
    const spin: Group = new THREE.Group()
    anchor.add(spin)

    // A shadow-only plane. In AR this darkens the real table under the dish,
    // which is what actually sells the illusion that it is sitting there.
    const shadowPlane: Mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2),
        new THREE.ShadowMaterial({ opacity: 0.32, transparent: true }),
    )
    shadowPlane.receiveShadow = true
    shadowPlane.position.y = 0.0005
    anchor.add(shadowPlane)

    // Static ambient-occlusion blob, so grounding survives even if the device
    // silently drops shadow map support.
    const contact: Mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(DISH_SIZE * 2.1, DISH_SIZE * 2.1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(radialShadowCanvas()),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
        }),
    )
    contact.position.y = 0.001
    contact.renderOrder = -1
    anchor.add(contact)

    const cardMesh: Mesh = makeCardMesh()
    cardMesh.visible = false
    anchor.add(cardMesh)

    /** What the studio camera looks at. Tracks the current dish's height. */
    const target = new THREE.Vector3(0, DISH_SIZE * 0.42, 0)

    const prevOrb = makeOrbMesh("‹", "prev")
    const nextOrb = makeOrbMesh("›", "next")
    prevOrb.visible = false
    nextOrb.visible = false
    anchor.add(prevOrb)
    anchor.add(nextOrb)

    const reticle: Mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.055, 0.075, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }),
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    // -------------------------------------------------------------------- load

    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)

    const cache = new Map<string, Object3D>()
    let dish: Object3D | null = null
    let dishToken = 0
    /** Real-world size of whatever is on screen, so the labels scale with it. */
    let dishSize = DISH_SIZE

    function fitDish(model: Object3D, sizeMeters: number) {
        model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const max = Math.max(size.x, size.y, size.z) || 1
        model.scale.setScalar(sizeMeters / max)

        // re-measure after scaling, then seat the model on y = 0
        const seated = new THREE.Box3().setFromObject(model)
        const centre = seated.getCenter(new THREE.Vector3())
        model.position.x -= centre.x
        model.position.z -= centre.z
        model.position.y -= seated.min.y

        // Remembered so the camera can aim at the model's real middle. A plated
        // dish is wide and flat, so a height guessed from `sizeMeters` — which is
        // the *widest* axis — sits well above the body and renders it low.
        model.userData.arHeight = seated.max.y - seated.min.y

        // Corners cached in the model's own space, so the AR label can be kept
        // clear of the dish every frame without rebuilding a bounding box.
        // Stored before the model is parented, so this box is already in the
        // coordinate space of the group that will hold it.
        model.userData.arCorners = [
            seated.min.x, seated.min.y, seated.min.z,
            seated.min.x, seated.min.y, seated.max.z,
            seated.min.x, seated.max.y, seated.min.z,
            seated.min.x, seated.max.y, seated.max.z,
            seated.max.x, seated.min.y, seated.min.z,
            seated.max.x, seated.min.y, seated.max.z,
            seated.max.x, seated.max.y, seated.min.z,
            seated.max.x, seated.max.y, seated.max.z,
        ]

        model.traverse((child: Object3D) => {
            const m = child as Mesh
            if (!m.isMesh) return
            m.castShadow = true
            m.receiveShadow = false
            m.frustumCulled = false
        })
    }

    async function showDish(url: string, card: ArCardInfo, sizeMeters = DISH_SIZE) {
        const token = ++dishToken
        dishSize = sizeMeters
        setCard(card)

        const cached = cache.get(url)
        if (cached) {
            swapDish(cached)
            hooks.onProgress(null)
            return
        }

        hooks.onProgress(0)
        try {
            const gltf = await loader.loadAsync(url, (ev) => {
                if (token !== dishToken) return
                // total is 0 when the server sends no content-length
                const ratio = ev.total > 0 ? ev.loaded / ev.total : Math.min(0.95, ev.loaded / 1.5e6)
                hooks.onProgress(Math.max(0.02, Math.min(0.99, ratio)))
            })
            if (disposed || token !== dishToken) return
            const model = gltf.scene
            fitDish(model, sizeMeters)
            cache.set(url, model)
            swapDish(model)
        } catch (err) {
            if (token !== dishToken) return
            hooks.onError(err instanceof Error ? err.message : "Could not load this dish")
        } finally {
            if (token === dishToken) hooks.onProgress(null)
        }
    }

    function swapDish(model: Object3D) {
        if (dish && dish !== model) spin.remove(dish)
        dish = model
        if (model.parent !== spin) spin.add(model)
        layoutOrbs()
        needsRecentre = true
    }

    function layoutOrbs() {
        const k = dishSize / DISH_SIZE
        contact.scale.setScalar(k)
        cardMesh.scale.setScalar(k)
        prevOrb.scale.setScalar(k)
        nextOrb.scale.setScalar(k)

        // Everything here draws with depthTest: false so it cannot be swallowed
        // by the dish — which also means overlap reads as the label punching
        // through the food. So keep real clearance rather than relying on depth.
        //
        // `dishSize` is the dish's full width, so its silhouette reaches
        // 0.5 * dishSize. Push each disc out by its own half-width plus a margin.
        const orbHalf = ORB_SIZE / 2
        const reach = dishSize * (0.5 + orbHalf + 0.08)
        const mid = dishHeight() / 2
        prevOrb.position.set(-reach, Math.max(mid, dishSize * 0.26), 0.02)
        nextOrb.position.set(reach, Math.max(mid, dishSize * 0.26), 0.02)

        // The card's position is recomputed every frame from the camera's up
        // axis — see keepCardClear(). This is only a sane starting point.
        cardMesh.position.set(0, dishHeight() + dishSize * (CARD_H / 2 + 0.2), 0)

        // aim at the body's middle so it lands centred in the framed gap
        target.set(0, mid, 0)
    }

    /**
     * Floats the label clear of the dish, whatever angle it is viewed from.
     *
     * The card is billboarded — always perpendicular to the view — so its extent
     * along the camera's *up* axis is exactly half its height. Measuring the
     * dish's extent along that same axis and adding the two gives separation that
     * holds in screen space from any angle, which a fixed world-space Y offset
     * does not: crouch to table level and a card sitting "above" the dish still
     * lands on top of it.
     */
    const camUp = new THREE.Vector3()
    const cardPos = new THREE.Vector3()

    function keepCardClear(viewQuaternion: { x: number; y: number; z: number; w: number }) {
        const corners = dish?.userData?.arCorners as number[] | undefined
        if (!corners || corners.length < 24) return

        camUp.set(0, 1, 0).applyQuaternion(viewQuaternion as never)

        // `spin` only ever yaws and scales uniformly, so apply that by hand
        // rather than paying for a matrix decomposition each frame.
        const s = spin.scale.x || 1
        const sin = Math.sin(spin.rotation.y)
        const cos = Math.cos(spin.rotation.y)

        let cx = 0
        let cy = 0
        let cz = 0
        for (let i = 0; i < 24; i += 3) {
            cx += corners[i]
            cy += corners[i + 1]
            cz += corners[i + 2]
        }
        cx /= 8
        cy /= 8
        cz /= 8

        let ext = 0
        for (let i = 0; i < 24; i += 3) {
            const dx = corners[i] - cx
            const dy = corners[i + 1] - cy
            const dz = corners[i + 2] - cz
            const rx = (dx * cos + dz * sin) * s
            const rz = (-dx * sin + dz * cos) * s
            const ry = dy * s
            const along = rx * camUp.x + ry * camUp.y + rz * camUp.z
            if (along > ext) ext = along
        }

        const centreX = (cx * cos + cz * sin) * s
        const centreZ = (-cx * sin + cz * cos) * s
        // world height = (DISH_SIZE * CARD_H) geometry * (dishSize / DISH_SIZE) scale
        const cardHalf = (dishSize * CARD_H) / 2
        cardPos
            .set(centreX, cy * s, centreZ)
            .addScaledVector(camUp, ext + cardHalf + dishSize * 0.16)
        cardMesh.position.copy(cardPos)
    }

    function dishHeight(): number {
        const h = dish?.userData?.arHeight
        return typeof h === "number" && h > 0 ? h : dishSize * 0.5
    }
    layoutOrbs()

    function setCard(card: ArCardInfo) {
        const tex = new THREE.CanvasTexture(drawArCard(card))
        tex.colorSpace = THREE.SRGBColorSpace
        const mat = cardMesh.material as { map?: { dispose: () => void } | null; needsUpdate: boolean }
        mat.map?.dispose()
        mat.map = tex as never
        mat.needsUpdate = true
    }

    // --------------------------------------------------------------- gestures

    type Pt = { x: number; y: number }
    const pointers = new Map<number, Pt>()
    let startPinch = 0
    let startTwist = 0
    let startScale = 1
    let startSpin = 0

    // studio orbit state
    let theta = Math.PI * 0.12
    let phi = Math.PI * 0.34
    /** Camera distance as a multiple of the dish's real size, not metres. */
    let zoom = STUDIO_ZOOM
    let userScale = 1
    let idleSince = performance.now()

    function onDown(e: PointerEvent) {
        canvas.setPointerCapture?.(e.pointerId)
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        idleSince = performance.now()
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()]
            startPinch = Math.hypot(a.x - b.x, a.y - b.y) || 1
            startTwist = Math.atan2(b.y - a.y, b.x - a.x)
            startScale = userScale
            startSpin = spin.rotation.y
        }
    }

    function onMove(e: PointerEvent) {
        const prev = pointers.get(e.pointerId)
        if (!prev) return
        const next = { x: e.clientX, y: e.clientY }
        pointers.set(e.pointerId, next)
        idleSince = performance.now()

        if (pointers.size >= 2) {
            const [a, b] = [...pointers.values()]
            const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
            const twist = Math.atan2(b.y - a.y, b.x - a.x)
            if (mode === "studio") {
                zoomTouched = true
                zoom = clamp(zoom * (startPinch / dist), 1.4, 6)
            } else {
                userScale = clamp(startScale * (dist / startPinch), 0.45, 3)
                spin.scale.setScalar(userScale)
                spinIdleSince = performance.now()
            }
            spin.rotation.y = startSpin + (twist - startTwist)
            if (mode !== "studio") placedYaw = spin.rotation.y - autoSpin
            return
        }

        const dx = next.x - prev.x
        const dy = next.y - prev.y

        if (mode === "studio") {
            theta -= dx * 0.008
            phi = clamp(phi - dy * 0.006, 0.12, Math.PI * 0.62)
        } else {
            // one finger spins the placed dish; pauses the turntable while held
            spin.rotation.y -= dx * 0.01
            placedYaw = spin.rotation.y - autoSpin
            spinIdleSince = performance.now()
        }
    }

    function onUp(e: PointerEvent) {
        pointers.delete(e.pointerId)
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault()
        idleSince = performance.now()
        if (mode === "studio") {
            zoomTouched = true
            zoom = clamp(zoom * (1 + Math.sign(e.deltaY) * 0.08), 1.4, 6)
        } else {
            userScale = clamp(userScale * (1 - Math.sign(e.deltaY) * 0.07), 0.45, 3)
            spin.scale.setScalar(userScale)
        }
    }

    const raycaster = new THREE.Raycaster()

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)
    canvas.addEventListener("wheel", onWheel, { passive: false })

    // ------------------------------------------------------------------ resize

    /**
     * Studio framing, driven by how much of the screen the UI covers.
     *
     * Two adjustments, both only in studio mode — in XR the projection has to
     * match the device's real camera or the dish will not line up with the room.
     *
     *   lift  a frustum offset, so the dish is centred in the free gap rather
     *         than in the raw viewport. Done as a lens shift rather than by
     *         moving the camera, so it composes off-centre without touching the
     *         orbit maths or lifting the dish off its shadow.
     *   zoom  pulled back until the dish spans a share of the *gap*, not of the
     *         viewport. Without this a short screen with a tall sheet still
     *         crops the dish, however far it is shifted up.
     */
    let frameTop = 0
    let frameBottom = 0
    let liftPx = 0
    /** Set when the framing changed and the measured recentre needs redoing. */
    let needsRecentre = false
    /** Once the viewer pinches, stop overriding their zoom. */
    let zoomTouched = false

    /** Share of the free gap the dish's largest axis should span. */
    const GAP_FILL = 0.76
    /**
     * Same, against width. `dishSize` is the largest bounding-box axis, which for
     * a plated dish is usually its width — so on a tall gap the horizontal edge
     * is what actually limits how big it can be drawn without cropping.
     */
    const WIDTH_FILL = 0.8

    function applyFraming() {
        const w = canvas.clientWidth || window.innerWidth
        const h = canvas.clientHeight || window.innerHeight
        const gap = Math.max(140, h - frameTop - frameBottom)

        // first approximation; recentreDish() then corrects it by measurement
        liftPx = (frameBottom - frameTop) / 2

        if (!zoomTouched) {
            const targetPx = Math.min(GAP_FILL * gap, WIDTH_FILL * w)
            const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)
            zoom = clamp(h / (2 * tanHalfFov * targetPx), 1.4, 6)
        }
        needsRecentre = true
        applyViewOffset()
    }

    function applyViewOffset() {
        const w = canvas.clientWidth || window.innerWidth
        const h = canvas.clientHeight || window.innerHeight
        if (mode === "studio" && Math.abs(liftPx) > 0.5) camera.setViewOffset(w, h, 0, liftPx, w, h)
        else camera.clearViewOffset()
    }

    /**
     * Centres the dish in the free gap by measuring where it actually lands.
     *
     * Aiming the camera at the model's mid-height gets close but stays ~45px top
     * heavy: a wide flat dish seen from above has a silhouette that is not
     * symmetric about its world-space centre, so the centre does not project to
     * the centre of the screen. Rather than model that, project the bounding box,
     * see where it really sits, and correct the lens shift by the difference.
     *
     * One pass converges, because a view offset translates the image by exactly
     * the offset — so the correction cannot overshoot.
     */
    const projected = new THREE.Vector3()

    function recentreDish() {
        if (mode !== "studio" || !dish) return
        const h = canvas.clientHeight || window.innerHeight
        const box = new THREE.Box3().setFromObject(spin)
        if (box.isEmpty()) return

        let minY = Infinity
        let maxY = -Infinity
        for (let i = 0; i < 8; i++) {
            projected.set(
                i & 1 ? box.max.x : box.min.x,
                i & 2 ? box.max.y : box.min.y,
                i & 4 ? box.max.z : box.min.z,
            )
            projected.project(camera)
            const py = (1 - projected.y) * 0.5 * h
            if (py < minY) minY = py
            if (py > maxY) maxY = py
        }

        const desired = (frameTop + (h - frameBottom)) / 2
        liftPx += (minY + maxY) / 2 - desired
        applyViewOffset()
    }

    function resize() {
        const w = canvas.clientWidth || window.innerWidth
        const h = canvas.clientHeight || window.innerHeight
        renderer.setSize(w, h, false)
        camera.aspect = w / Math.max(1, h)
        camera.updateProjectionMatrix()
        applyFraming()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // --------------------------------------------------------------------- xr

    let session: XrSession | null = null
    let hitSource: XrHitTestSource | null = null
    let xrRefSpace: unknown = null
    let controller: Object3D | null = null
    let placed = false
    /** Most recent hit-test result, kept so a tap can turn it into an anchor. */
    let lastHit: XrHitTestResult | null = null
    let xrAnchor: XrAnchor | null = null
    /** Yaw the dish was facing when placed; auto-rotation accumulates on top. */
    let placedYaw = 0
    let autoSpin = 0
    let spinIdleSince = 0
    /** Whether the runtime composited our HTML controls into the session. */
    let domOverlay = false

    async function enterXr() {
        const xr = xrSystem()
        if (!xr) throw new Error("WebXR is not available here")
        if (session) return

        const requested = await xr.requestSession("immersive-ar", {
            requiredFeatures: ["hit-test"],
            // `anchors` is what keeps a placed dish locked to the real table
            optionalFeatures: ["anchors", "dom-overlay", "local-floor", "light-estimation"],
            domOverlay: { root: overlay },
        })
        session = requested
        await renderer.xr.setSession(requested as never)

        mode = "xr"
        hooks.onMode(mode)
        applyViewOffset()
        placed = false
        anchor.visible = false
        userScale = 1
        spin.scale.setScalar(1)
        cardMesh.visible = true
        prevOrb.visible = false
        nextOrb.visible = false

        // `dom-overlay` is optional and runtimes may decline it. When it is
        // granted the HTML controls are composited over the session, so drawing
        // a second copy of the label and arrows into the scene only clutters the
        // view and — with depthTest off — covers the dish. Draw them only when
        // there is no HTML to rely on.
        domOverlay = Boolean(requested.domOverlayState?.type)
        cardMesh.visible = false
        hooks.onHint(
            domOverlay
                ? "Sweep the phone slowly, then tap the ring on your table"
                : "Sweep the phone slowly, then tap the ring. This phone shows the controls beside the dish.",
        )

        xrRefSpace = null
        try {
            const viewerSpace = await requested.requestReferenceSpace("viewer")
            if (typeof requested.requestHitTestSource === "function") {
                hitSource = await requested.requestHitTestSource({ space: viewerSpace })
            }
        } catch {
            hitSource = null
        }

        controller = renderer.xr.getController(0)
        scene.add(controller)
        listen(controller, "select", onXrSelect)
        requested.addEventListener("end", onXrEnd)
    }

    const rotM = new THREE.Matrix4()
    const poseM = new THREE.Matrix4()

    function onXrSelect() {
        if (!controller) return
        // the controller in AR is the screen-tap ray
        rotM.identity().extractRotation(controller.matrixWorld)
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotM)

        if (placed) {
            const hits = raycaster.intersectObjects([prevOrb, nextOrb], false)
            const name = hits[0]?.object.name || hits[0]?.object.parent?.name
            if (name === "prev") return opts.onSwipe(-1)
            if (name === "next") return opts.onSwipe(1)

            // tapping the dish itself toggles its detail card
            if (dish && raycaster.intersectObject(dish, true).length > 0) {
                cardMesh.visible = !cardMesh.visible
                if (cardMesh.visible) keepCardClear(renderer.xr.getCamera().quaternion)
                return
            }
            // otherwise ignore: a stray tap must not move a dish already placed
            return
        }
        if (!reticle.visible) return

        anchor.position.setFromMatrixPosition(reticle.matrix)
        // Rotation is deliberately left at identity and the facing yaw baked into
        // `spin` instead. The label and arrows are children of `anchor` and are
        // billboarded by copying the camera's world quaternion into their local
        // one, which is only correct while their parent is unrotated.
        anchor.quaternion.identity()
        anchor.visible = true
        placed = true
        const showDiscs = !domOverlay && opts.canSwitch
        prevOrb.visible = showDiscs
        nextOrb.visible = showDiscs
        autoSpin = 0
        spinIdleSince = performance.now()

        // face the dish towards the viewer at the moment of placing
        const toCam = renderer.xr.getCamera().position.clone().sub(anchor.position)
        placedYaw = Math.atan2(toCam.x, toCam.z)
        spin.rotation.y = placedYaw

        anchorTo(lastHit)
        hooks.onHint(
            domOverlay
                ? "Tap the dish for details · pinch to resize · Move to reposition"
                : "Tap the dish for details · tap ‹ › beside it to change dish",
        )
    }

    /**
     * Hands the placement over to an XRAnchor.
     *
     * A pose captured once and held in the reference space looks locked for a few
     * seconds and then slides, because ARCore keeps refining its estimate of the
     * room and the reference space shifts with it. An anchor is tracked against
     * the real feature points instead, so the runtime corrects the pose for us
     * every frame — this is what stops the dish drifting off the table.
     */
    function anchorTo(hit: XrHitTestResult | null) {
        releaseAnchor()
        if (!hit || typeof hit.createAnchor !== "function") return
        void hit
            .createAnchor()
            .then((created) => {
                if (mode === "xr" && placed) xrAnchor = created
                else created.delete?.()
            })
            .catch(() => {
                // no anchors on this runtime; the static pose above still stands
            })
    }

    function releaseAnchor() {
        xrAnchor?.delete?.()
        xrAnchor = null
    }

    function onXrEnd() {
        hitSource?.cancel()
        hitSource = null
        releaseAnchor()
        lastHit = null
        if (controller) {
            unlisten(controller, "select", onXrSelect)
            scene.remove(controller)
            controller = null
        }
        session?.removeEventListener("end", onXrEnd)
        session = null
        domOverlay = false
        reticle.visible = false
        toStudio()
    }

    function leaveXr() {
        if (!session) return
        const s = session
        void s.end().catch(() => undefined)
        onXrEnd()
    }

    // ----------------------------------------------------------------- studio

    function toStudio() {
        mode = "studio"
        hooks.onMode(mode)
        camera.fov = 52
        camera.updateProjectionMatrix()
        anchor.position.set(0, 0, 0)
        anchor.rotation.set(0, 0, 0)
        anchor.visible = true
        spin.scale.setScalar(1)
        spin.rotation.y = 0
        userScale = 1
        placed = false
        autoSpin = 0
        placedYaw = 0
        cardMesh.visible = false
        prevOrb.visible = false
        nextOrb.visible = false
        reticle.visible = false
        theta = Math.PI * 0.12
        phi = Math.PI * 0.34
        zoomTouched = false
        applyFraming()
        idleSince = performance.now()
        hooks.onHint("")
    }
    toStudio()

    function resetView() {
        if (mode === "studio") {
            theta = Math.PI * 0.12
            phi = Math.PI * 0.34
            spin.rotation.y = 0
            zoomTouched = false
            applyFraming()
            return
        }
        // in AR, reset means "let me put it somewhere else"
        releaseAnchor()
        placed = false
        anchor.visible = false
        prevOrb.visible = false
        nextOrb.visible = false
        userScale = 1
        autoSpin = 0
        spin.scale.setScalar(1)
        spin.rotation.y = 0
        hooks.onHint("Tap the ring to place the dish again")
    }

    // ------------------------------------------------------------------- loop

    renderer.setAnimationLoop((_time, frame) => {
        if (disposed) return

        if (mode === "studio") {
            if (performance.now() - idleSince > 2600) theta += 0.0032
            const radius = dishSize * zoom
            camera.position.set(
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi) + target.y,
                radius * Math.sin(phi) * Math.cos(theta),
            )
            camera.lookAt(target)

            if (needsRecentre) {
                needsRecentre = false
                camera.updateMatrixWorld()
                recentreDish()
            }
        }

        if (mode === "xr") {
            // keep the label and the arrows readable from wherever you stand.
            // Valid because `anchor` is left unrotated — see onXrSelect.
            const view = renderer.xr.getCamera()
            cardMesh.quaternion.copy(view.quaternion)
            prevOrb.quaternion.copy(view.quaternion)
            nextOrb.quaternion.copy(view.quaternion)
            if (cardMesh.visible) keepCardClear(view.quaternion)

            // a slow turntable once it is sitting on the table, paused while the
            // viewer is spinning it by hand
            if (placed && performance.now() - spinIdleSince > 1200) {
                autoSpin += AUTO_SPIN_RATE
                spin.rotation.y = placedYaw + autoSpin
            }
        }

        if (mode === "xr" && frame) {
            const ref = renderer.xr.getReferenceSpace()
            const xrFrame = frame as unknown as {
                getHitTestResults: (s: XrHitTestSource) => XrHitTestResult[]
                getPose?: (space: unknown, ref: unknown) => XrPose | null
            }

            if (ref) {
                if (!xrRefSpace) xrRefSpace = ref

                if (hitSource) {
                    const results = xrFrame.getHitTestResults(hitSource)
                    if (results.length) {
                        lastHit = results[0]
                        const pose = results[0].getPose(ref)
                        if (pose) {
                            reticle.visible = !placed
                            reticle.matrix.fromArray(pose.transform.matrix)
                        }
                    } else {
                        lastHit = null
                        if (!placed) reticle.visible = false
                    }
                }

                // Re-read the anchor every frame. The runtime adjusts anchor poses
                // as its map of the room improves, so following it is what keeps
                // the dish on the same spot of the real table.
                if (placed && xrAnchor && typeof xrFrame.getPose === "function") {
                    const pose = xrFrame.getPose(xrAnchor.anchorSpace, ref)
                    if (pose) {
                        poseM.fromArray(pose.transform.matrix)
                        anchor.position.setFromMatrixPosition(poseM)
                    }
                }
            }
        }

        renderer.render(scene, camera)
    })

    // --------------------------------------------------------------- snapshot

    async function snapshot(): Promise<Blob | null> {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (!w || !h) return null
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const out = document.createElement("canvas")
        out.width = Math.round(w * dpr)
        out.height = Math.round(h * dpr)
        const ctx = out.getContext("2d")
        if (!ctx) return null

        {
            const g = ctx.createLinearGradient(0, 0, 0, out.height)
            g.addColorStop(0, "#0b1220")
            g.addColorStop(1, "#04070c")
            ctx.fillStyle = g
            ctx.fillRect(0, 0, out.width, out.height)
        }

        renderer.render(scene, camera)
        ctx.drawImage(canvas, 0, 0, out.width, out.height)
        return await new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.92))
    }

    // ---------------------------------------------------------------- teardown

    function dispose() {
        disposed = true
        renderer.setAnimationLoop(null)
        leaveXr()
        ro.disconnect()
        canvas.removeEventListener("pointerdown", onDown)
        canvas.removeEventListener("pointermove", onMove)
        canvas.removeEventListener("pointerup", onUp)
        canvas.removeEventListener("pointercancel", onUp)
        canvas.removeEventListener("wheel", onWheel)
        cache.forEach((model) => {
            model.traverse((child: Object3D) => {
                const m = child as Mesh
                if (!m.isMesh) return
                m.geometry?.dispose()
                const mats = Array.isArray(m.material) ? m.material : [m.material]
                mats.forEach((mat) => {
                    const rec = mat as unknown as Record<string, { dispose?: () => void } | undefined>
                    Object.keys(rec).forEach((k) => {
                        if (k.endsWith("Map")) rec[k]?.dispose?.()
                    })
                    ;(mat as { dispose?: () => void }).dispose?.()
                })
            })
        })
        cache.clear()
        envRt.texture.dispose()
        pmrem.dispose()
        renderer.dispose()
    }

    // ----------------------------------------------------------------- helpers

    function makeCardMesh(): Mesh {
        const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            toneMapped: false,
        })
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(DISH_SIZE * CARD_W, DISH_SIZE * CARD_H),
            mat,
        )
        mesh.renderOrder = 20
        return mesh
    }

    function makeOrbMesh(glyph: string, name: string): Mesh {
        const tex = new THREE.CanvasTexture(drawArOrb(glyph))
        tex.colorSpace = THREE.SRGBColorSpace
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            toneMapped: false,
        })
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(DISH_SIZE * ORB_SIZE, DISH_SIZE * ORB_SIZE),
            mat,
        )
        mesh.name = name
        mesh.renderOrder = 21
        return mesh
    }

    return {
        showDish,
        setCard,
        setFrame: (top: number, bottom: number) => {
            frameTop = Math.max(0, top)
            frameBottom = Math.max(0, bottom)
            applyFraming()
        },
        enterXr,
        leaveImmersive: () => {
            leaveXr()
            toStudio()
        },
        resetView,
        snapshot,
        dispose,
    }
}

function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v))
}

/** three's Object3D event map does not include the XR controller events. */
type Emitter = { addEventListener: (t: string, fn: () => void) => void; removeEventListener: (t: string, fn: () => void) => void }

function listen(o: Object3D, type: string, fn: () => void) {
    ;(o as unknown as Emitter).addEventListener(type, fn)
}

function unlisten(o: Object3D, type: string, fn: () => void) {
    ;(o as unknown as Emitter).removeEventListener(type, fn)
}

function radialShadowCanvas(): HTMLCanvasElement {
    const s = 256
    const c = document.createElement("canvas")
    c.width = s
    c.height = s
    const ctx = c.getContext("2d")
    if (!ctx) return c
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, "rgba(0,0,0,0.55)")
    g.addColorStop(0.45, "rgba(0,0,0,0.28)")
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    return c
}

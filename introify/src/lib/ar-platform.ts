/**
 * Picks how to launch *surface-tracked* AR on the current device.
 *
 * Only three mechanisms on the web actually detect a real table and put the
 * model on it. A browser cannot do plane detection itself — there is no web API
 * for it outside WebXR — so anything else is a preview, not AR.
 *
 *   webxr         in-page `immersive-ar` with hit-testing. ARCore.
 *                 Android Chrome/Edge/Samsung Internet.
 *   scene-viewer  hands the .glb to Google's Scene Viewer app. ARCore.
 *                 Any Android browser, including ones without WebXR.
 *   quick-look    hands the .usdz to iOS AR Quick Look. ARKit.
 *                 Safari and every iOS browser (they all use WebKit).
 *
 * Anything else — desktop, a locked-down browser — gets `none`, and the viewer
 * stays on its turntable rather than pretending.
 */

export type ArLaunch = "webxr" | "scene-viewer" | "quick-look" | "none"

export function isAndroid(): boolean {
    if (typeof navigator === "undefined") return false
    return /android/i.test(navigator.userAgent)
}

export function isIos(): boolean {
    if (typeof navigator === "undefined") return false
    const ua = navigator.userAgent
    // iPadOS 13+ reports itself as a Mac, so also look for a touch-capable Mac
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Safari advertises AR Quick Look through the anchor's rel list. */
export function supportsQuickLook(): boolean {
    if (typeof document === "undefined") return false
    const a = document.createElement("a")
    return Boolean(a.relList?.supports?.("ar"))
}

export async function webXrSupported(): Promise<boolean> {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr
    if (!xr?.isSessionSupported) return false
    try {
        return await xr.isSessionSupported("immersive-ar")
    } catch {
        return false
    }
}

export async function detectArLaunch(assets: { glbAr?: string | null; usdz?: string | null }): Promise<ArLaunch> {
    if (await webXrSupported()) return "webxr"
    // Every iOS browser is WebKit, and Quick Look has shipped since iOS 12, so
    // having the asset is the real gate. `supportsQuickLook()` is only a
    // positive hint — treating it as required would strand iPhones whenever the
    // relList probe comes back false.
    if (isIos() && assets.usdz) return "quick-look"
    if (isAndroid() && assets.glbAr) return "scene-viewer"
    return "none"
}

/**
 * Scene Viewer and Quick Look both fetch the model themselves, from outside the
 * page — so a localhost or LAN address will not reach them.
 */
export function isPubliclyReachable(origin: string): boolean {
    try {
        const host = new URL(origin).hostname
        if (host === "localhost" || host.endsWith(".localhost")) return false
        if (/^127\./.test(host) || host === "::1" || host === "0.0.0.0") return false
        if (/^10\./.test(host)) return false
        if (/^192\.168\./.test(host)) return false
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
        return true
    } catch {
        return false
    }
}

export function absoluteUrl(path: string): string {
    if (typeof window === "undefined") return path
    if (/^https?:\/\//i.test(path)) return path
    return new URL(path, window.location.origin).toString()
}

/**
 * `mode=ar_preferred` opens straight into AR when ARCore is present and quietly
 * degrades to Scene Viewer's own 3D view when it is not.
 * `resizable=false` keeps the dish at the real size baked into the file, so a
 * burger stays burger-sized.
 */
export function sceneViewerHref(opts: { glbAr: string; title: string; fallbackUrl: string }): string {
    const file = encodeURIComponent(absoluteUrl(opts.glbAr))
    const title = encodeURIComponent(opts.title)
    const fallback = encodeURIComponent(opts.fallbackUrl)
    const params = `file=${file}&mode=ar_preferred&title=${title}&resizable=false`
    return (
        `intent://arvr.google.com/scene-viewer/1.0?${params}` +
        `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
        `S.browser_fallback_url=${fallback};end;`
    )
}

/**
 * `allowsContentScaling=0` is Quick Look's equivalent of resizable=false.
 *
 * Deliberately left relative: this href is rendered during SSR, and absolutising
 * it needs `window.location`, which would make the server and client markup
 * disagree. Safari resolves it against the page like any other link.
 */
export function quickLookHref(usdz: string): string {
    return `${usdz}#allowsContentScaling=0`
}

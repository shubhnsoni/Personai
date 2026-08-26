const SRC = "https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"

export function ensureModelViewer() {
    void loadModelViewer()
}

export function loadModelViewer(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve()
    if (window.customElements?.get("model-viewer")) return Promise.resolve()

    const existing = document.querySelector("script[data-model-viewer], script[src*='model-viewer']") as HTMLScriptElement | null
    if (!existing) {
        const script = document.createElement("script")
        script.type = "module"
        script.src = SRC
        script.async = true
        script.dataset.modelViewer = "1"
        document.head.appendChild(script)
    }

    return window.customElements.whenDefined("model-viewer").then(() => undefined)
}

export function isPhoneAr(): boolean {
    if (typeof navigator === "undefined") return false
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

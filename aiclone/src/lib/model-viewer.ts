const SRC = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"

export function ensureModelViewer() {
    if (typeof document === "undefined") return
    if (document.querySelector(`script[src="${SRC}"]`)) return
    const script = document.createElement("script")
    script.type = "module"
    script.src = SRC
    document.head.appendChild(script)
}

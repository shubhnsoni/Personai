"use client"

import { useEffect, useRef } from "react"
import type { AboutWalkIn } from "@/lib/walk-in"

export function WalkInStage({
    walkIn,
    photos,
    className,
}: {
    walkIn?: AboutWalkIn | null
    photos: string[]
    className?: string
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        let dead = false
        let raf = 0
        let renderer: { dispose: () => void; setSize: (w: number, h: number) => void; render: (s: unknown, c: unknown) => void; domElement: HTMLCanvasElement } | null = null

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const urls = photos.filter(Boolean).slice(0, 10)
        const mode = walkIn?.kind === "model" && walkIn.url
            ? "model"
            : walkIn?.kind === "sphere" && walkIn.url
                ? "sphere"
                : urls.length
                    ? "ring"
                    : null
        if (!mode) return

        let onMove: ((e: PointerEvent) => void) | null = null
        let onUp: (() => void) | null = null
        let onDown: ((e: PointerEvent) => void) | null = null
        let onResize: (() => void) | null = null

        void (async () => {
            const THREE = await import("three")
            if (dead) return
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
            renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
            renderer.setClearColor(0x000000, 0)
            const scene = new THREE.Scene()
            scene.fog = new THREE.FogExp2(0x050608, 0.045)
            const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 2000)
            const pivot = new THREE.Group()
            scene.add(pivot)

            const size = () => {
                const w = canvas.clientWidth || 1
                const h = canvas.clientHeight || 1
                renderer!.setSize(w, h, false)
                camera.aspect = w / h
                camera.updateProjectionMatrix()
            }
            size()
            onResize = size
            window.addEventListener("resize", size)

            const loader = new THREE.TextureLoader()
            loader.setCrossOrigin("anonymous")

            if (mode === "sphere" && walkIn?.url) {
                camera.position.set(0, 0, 0.01)
                const geo = new THREE.SphereGeometry(80, 64, 40)
                geo.scale(-1, 1, 1)
                const tex = await loader.loadAsync(walkIn.url)
                if (dead) { tex.dispose(); geo.dispose(); return }
                tex.colorSpace = THREE.SRGBColorSpace
                const mat = new THREE.MeshBasicMaterial({ map: tex })
                pivot.add(new THREE.Mesh(geo, mat))
            } else if (mode === "model" && walkIn?.url) {
                camera.position.set(0, 1.2, 3.4)
                scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.15))
                const key = new THREE.DirectionalLight(0x00d7ff, 0.55)
                key.position.set(2, 4, 3)
                scene.add(key)
                const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
                const gltf = await new GLTFLoader().loadAsync(walkIn.url)
                if (dead) return
                const model = gltf.scene
                const box = new THREE.Box3().setFromObject(model)
                const center = box.getCenter(new THREE.Vector3())
                const span = box.getSize(new THREE.Vector3()).length() || 1
                model.position.sub(center)
                model.scale.setScalar(1.8 / span)
                pivot.add(model)
            } else {
                camera.position.set(0, 0.15, 0.2)
                const n = Math.max(urls.length, 1)
                const radius = 3.2
                await Promise.all(urls.map(async (url, i) => {
                    try {
                        const tex = await loader.loadAsync(url)
                        if (dead) { tex.dispose(); return }
                        tex.colorSpace = THREE.SRGBColorSpace
                        const mat = new THREE.MeshBasicMaterial({ map: tex })
                        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.15), mat)
                        const a = (i / n) * Math.PI * 2
                        mesh.position.set(Math.sin(a) * radius, 0, -Math.cos(a) * radius)
                        mesh.lookAt(0, 0, 0)
                        pivot.add(mesh)
                    } catch { /* skip a broken photo */ }
                }))
            }

            let yaw = 0
            let pitch = 0
            let vel = reduce ? 0 : 0.0007
            let dragging = false
            let lastX = 0
            let lastY = 0

            onDown = (e) => {
                dragging = true
                lastX = e.clientX
                lastY = e.clientY
                vel = 0
                canvas.setPointerCapture(e.pointerId)
            }
            onMove = (e) => {
                if (!dragging) return
                const dx = e.clientX - lastX
                const dy = e.clientY - lastY
                lastX = e.clientX
                lastY = e.clientY
                yaw -= dx * 0.005
                pitch = Math.max(-0.6, Math.min(0.6, pitch - dy * 0.003))
                vel = -dx * 0.00012
            }
            onUp = () => { dragging = false }

            canvas.addEventListener("pointerdown", onDown)
            canvas.addEventListener("pointermove", onMove)
            canvas.addEventListener("pointerup", onUp)
            canvas.addEventListener("pointercancel", onUp)

            const tick = () => {
                if (dead) return
                if (!dragging && !reduce) yaw += vel
                vel *= 0.985
                if (mode === "sphere") {
                    camera.rotation.order = "YXZ"
                    camera.rotation.y = yaw
                    camera.rotation.x = pitch
                } else {
                    pivot.rotation.y = yaw
                    camera.position.y = mode === "model" ? 1.2 + pitch * 0.4 : 0.15 + pitch * 0.35
                    camera.lookAt(0, mode === "model" ? 0.4 : 0, 0)
                }
                renderer!.render(scene, camera)
                raf = window.requestAnimationFrame(tick)
            }
            tick()
        })()

        return () => {
            dead = true
            window.cancelAnimationFrame(raf)
            if (onResize) window.removeEventListener("resize", onResize)
            if (onDown) canvas.removeEventListener("pointerdown", onDown)
            if (onMove) canvas.removeEventListener("pointermove", onMove)
            if (onUp) {
                canvas.removeEventListener("pointerup", onUp)
                canvas.removeEventListener("pointercancel", onUp)
            }
            renderer?.dispose()
        }
    }, [walkIn?.kind, walkIn?.url, photos.join("|")])

    return (
        <div className={className ?? "relative h-full w-full overflow-hidden"}>
            <canvas ref={canvasRef} className="h-full w-full touch-none" />
        </div>
    )
}

/** A tilted orbit in normalized coordinates. Positive depth passes in front. */
export function profileOrbitPose(progress: number) {
    const angle = progress * Math.PI * 2
    const tilt = -22 * Math.PI / 180
    const x = Math.cos(angle) * 0.405
    const y = Math.sin(angle) * 0.19
    const depth = Math.sin(angle)
    return {
        x: x * Math.cos(tilt) - y * Math.sin(tilt),
        y: x * Math.sin(tilt) + y * Math.cos(tilt),
        scale: 0.88 + (depth + 1) * 0.12,
        front: depth >= 0,
    }
}

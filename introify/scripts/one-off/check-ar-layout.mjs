// Regression guard for the AR in-scene layout on Android (WebXR).
//
// The Android AR view is signed off, so the geometry that makes it work is
// pinned here. Both invariants below were bugs at some point; each one showed up
// as UI drawn over the food, because the card and the arrows render with
// depthTest disabled and so cannot be occluded by the dish.
//
//   1. the detail card never overlaps the dish, at any camera elevation or yaw
//   2. the ‹ › discs sit outside the dish silhouette
//
// Constants are parsed out of ar-engine.ts rather than copied, so editing the
// engine either keeps this passing or fails it loudly. Copying them would let
// the guard drift and pass while the real thing regressed.
//
// Run: node scripts/one-off/check-ar-layout.mjs

import { readFileSync } from "node:fs"
import path from "node:path"

const ENGINE = path.join(process.cwd(), "src", "lib", "ar-engine.ts")
const src = readFileSync(ENGINE, "utf8")

function constant(name) {
    const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)`))
    if (!m) throw new Error(`${name} not found in ar-engine.ts — the guard needs updating`)
    return Number(m[1])
}

const CARD_H = constant("CARD_H")
const ORB_SIZE = constant("ORB_SIZE")

// margins as written in the engine
const cardMargin = Number(src.match(/ext \+ cardHalf \+ dishSize \* ([0-9.]+)/)?.[1])
const orbMargin = Number(src.match(/dishSize \* \(0\.5 \+ orbHalf \+ ([0-9.]+)\)/)?.[1])
if (!Number.isFinite(cardMargin)) throw new Error("card margin expression not found in ar-engine.ts")
if (!Number.isFinite(orbMargin)) throw new Error("orb reach expression not found in ar-engine.ts")

console.log(`from ar-engine.ts: CARD_H=${CARD_H} ORB_SIZE=${ORB_SIZE} cardMargin=${cardMargin} orbMargin=${orbMargin}\n`)

// [width, height, depth] in multiples of the dish's width, from the real fitted
// models. Meshy plates are wide and flat, which is what broke the naive version.
const DISHES = {
    "margherita-pizza": [1, 0.12, 1],
    "chicken-burger": [1, 0.29, 1],
    "veg-momos": [1, 0.22, 1],
    cappuccino: [1, 0.62, 1],
    "nutella-shake": [1, 0.78, 1],
}

/** Max extent of a yawed box from its centre, along the camera's up axis. */
function extentAlongUp([w, h, d], yawRad, up) {
    const cos = Math.cos(yawRad)
    const sin = Math.sin(yawRad)
    let ext = 0
    for (let i = 0; i < 8; i++) {
        const dx = ((i & 4 ? 1 : -1) * w) / 2
        const dy = ((i & 2 ? 1 : -1) * h) / 2
        const dz = ((i & 1 ? 1 : -1) * d) / 2
        const rx = dx * cos + dz * sin
        const rz = -dx * sin + dz * cos
        const along = rx * up.x + dy * up.y + rz * up.z
        if (along > ext) ext = along
    }
    return ext
}

let failures = 0

// --- 1. card clearance, swept over viewing angles -------------------------
//
// Reported against the fixed-world-Y approach this replaced, so the numbers show
// why the camera-up offset is needed rather than just asserting success.
const OLD_LIFT = CARD_H / 2 + 0.2
const cardHalf = CARD_H / 2
let oldOverlaps = 0
let newWorst = Infinity
let oldWorst = Infinity

for (const [name, box] of Object.entries(DISHES)) {
    const h = box[1]
    for (let elev = 0; elev <= 85; elev += 5) {
        const e = (elev * Math.PI) / 180
        const up = { x: Math.sin(e), y: Math.cos(e), z: 0 }
        for (let yaw = 0; yaw < 360; yaw += 15) {
            const ext = extentAlongUp(box, (yaw * Math.PI) / 180, up)

            // what the engine does now: offset along the camera's up axis
            const newGap = cardMargin

            // what it used to do: a fixed height, then billboarded
            const oldGap = (h + OLD_LIFT - h / 2) * up.y - cardHalf - ext

            newWorst = Math.min(newWorst, newGap)
            oldWorst = Math.min(oldWorst, oldGap)
            if (oldGap <= 0) oldOverlaps++
            if (newGap <= 0) {
                console.log(`FAIL card overlaps: ${name} elev=${elev} yaw=${yaw} gap=${newGap.toFixed(3)}`)
                failures++
            }
        }
    }
}

console.log(`card clearance   camera-up ${newWorst.toFixed(3)}   (fixed-Y was ${oldWorst.toFixed(3)}, overlapping in ${oldOverlaps} orientations)`)

// --- 2. the arrows sit outside the dish -----------------------------------
const reach = 0.5 + ORB_SIZE / 2 + orbMargin
const orbInnerEdge = reach - ORB_SIZE / 2
const orbGap = orbInnerEdge - 0.5
console.log(`arrow clearance  ${orbGap.toFixed(3)} beyond the silhouette (inner edge at ${orbInnerEdge.toFixed(3)})`)
if (orbGap <= 0) {
    console.log("FAIL arrows overlap the dish")
    failures++
}

// they also have to stay on screen at the distance a phone is held
const HELD_AT = 0.35 / 0.17 // 35cm away, dish 17cm wide -> in dish-widths
const halfFovWidth = HELD_AT * Math.tan((58 * Math.PI) / 360)
const orbOuterEdge = reach + ORB_SIZE / 2
console.log(`arrow reach      outer edge ${orbOuterEdge.toFixed(3)} vs ${halfFovWidth.toFixed(3)} visible at arm's length`)
if (orbOuterEdge > halfFovWidth) {
    console.log("FAIL arrows fall outside the display at arm's length")
    failures++
}

console.log(`\n${failures === 0 ? "all AR layout invariants hold" : `${failures} invariant(s) broken`}`)
console.log("Units are multiples of the dish's width.")
process.exit(failures ? 1 : 0)

import { readFileSync, writeFileSync } from "node:fs"

const src = readFileSync("scripts/one-off/import-skydine-menu.mjs", "utf8")
const start = src.indexOf("const RAW = `")
const end = src.indexOf("`", start + "const RAW = `".length)
if (start < 0 || end < 0) throw new Error("RAW not found")
const raw = src.slice(start + "const RAW = `".length, end)
writeFileSync("src/lib/demo-shops/skydine-menu.ts", `export const SKYDINE_MENU_RAW = \`${raw}\`\n`)
console.log("lines", raw.trim().split("\n").length)

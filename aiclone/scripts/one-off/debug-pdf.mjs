import fs from "fs"

const s = fs.readFileSync("scripts/fixtures/import/jacky-smith-resume.pdf").toString("latin1")
let idx = 0
let n = 0
while ((idx = s.indexOf("beginbfrange", idx)) >= 0) {
    n += 1
    console.log("\n--- map", n, "---")
    console.log(s.slice(idx - 80, idx + 400))
    idx += 12
}
console.log("\nToUnicode snippets:")
idx = 0
while ((idx = s.indexOf("/ToUnicode", idx)) >= 0) {
    console.log(JSON.stringify(s.slice(idx, idx + 120)))
    idx += 10
}

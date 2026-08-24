import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import {
    bundleFromHtml,
    bundleFromText,
    extractPdfText,
    dedupeItems,
    looksLikeCatalog,
    type ImportBundle,
} from "../src/lib/import-extract.ts"
import { extractRupeeMenu } from "../src/lib/menu-import.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixtures = path.join(root, "scripts", "fixtures")

const RESUME = fs.readFileSync(path.join(fixtures, "resume-amina.txt"), "utf8")

type Expectation = {
    file: string
    url: string
    profile?: string
    services: string[]
    jobs: string[]
    projectsMin: number
    products?: string[]
    forbid: string[]
}

const SITES: Expectation[] = [
    {
        file: "scripts/fixtures/import/simone.html",
        url: "https://harnishdesign.net/demo/html/simone/",
        profile: "Simone Olivia",
        services: ["Graphic Design", "Web Design", "UI/UX Design", "App Design", "Business Analysis", "SEO Marketing"],
        jobs: ["Themeforest", "Dribbble", "Adobe"],
        projectsMin: 4,
        forbid: ["About Me", "Services", "Portfolio", "Summary", "Color Switcher", "Terms of Use", "Privacy Policy", "Know Me More"],
    },
    {
        file: "scripts/fixtures/import/callum.html",
        url: "https://harnishdesign.net/demo/html/callum/",
        profile: "Callum Smith",
        services: ["Graphic Design", "Web Design", "Web Development", "Brand Identity", "Business Analysis", "Digital Marketing"],
        jobs: ["Apple", "Dribbble", "Adobe"],
        projectsMin: 4,
        forbid: ["Color Switcher", "Living In", "Have any questions", "Know Me More"],
    },
    {
        file: "scripts/fixtures/import/namu.html",
        url: "https://harnishdesign.net/demo/html/namu/",
        profile: "Namu Watson",
        services: ["Graphic Design", "Web Design", "Web Development", "Brand Identity", "Business Analysis", "Digital Marketing"],
        jobs: [],
        projectsMin: 5,
        forbid: ["Client Speak", "Terms of Use", "Color Switcher", "Frequently Asked Questions"],
    },
    {
        file: "scripts/fixtures/import/josie.html",
        url: "https://html.bslthemes.com/josie/",
        profile: "Josie West",
        services: ["Design", "Develop", "Write", "Promote"],
        jobs: ["Pixel Pioneer", "Digital Artisan", "Code Connoisseur", "Brand Illuminator"],
        projectsMin: 3,
        forbid: ["Portfolio", "Blog", "Loading"],
    },
    {
        file: "scripts/fixtures/import/spoli.html",
        url: "https://html.bslthemes.com/spoli/",
        profile: "Alex",
        services: ["Figma", "Html", "Wordpress"],
        jobs: ["Product Glow", "Brand Aesthetics", "Right way to talk"],
        projectsMin: 2,
        products: ["Power Plan", "Pro Plan"],
        forbid: ["Our Portfolio", "Our Pricing", "Our Blogs"],
    },
    {
        file: "scripts/fixtures/import/treto.html",
        url: "https://html.bslthemes.com/treto/",
        profile: "Sophie Miller",
        services: ["Web Development", "Branding", "Server"],
        jobs: ["Freelance", "Agency MacLL", "Envato", "Themeforest"],
        projectsMin: 0,
        forbid: ["Testimonials", "Education"],
    },
    {
        file: "scripts/fixtures/import/kenil.html",
        url: "https://harnishdesign.net/demo/html/kenil/",
        profile: "Kenil Patel",
        services: ["Graphic Design", "Web Design", "Web Development", "Brand Identity", "Business Analysis", "Digital Marketing"],
        jobs: [],
        projectsMin: 6,
        forbid: ["Why I'm Different", "Unique Design", "Fully Customisable", "Work Process", "Color Switcher", "Our Services", "Start a project", "Conception", "Content"],
    },
]

let failed = 0

function titles(bundle: ImportBundle, kind?: string) {
    return bundle.items.filter((i) => !kind || i.kind === kind).map((i) => i.title)
}

function has(list: string[], needle: string) {
    const n = needle.toLowerCase()
    return list.some((t) => t.toLowerCase().includes(n))
}

function dump(label: string, bundle: ImportBundle) {
    console.log(`\n=== ${label} (${bundle.items.length} items) ===`)
    for (const it of bundle.items) {
        const extra = [it.fields.company, it.fields.price != null ? `$${it.fields.price}` : ""].filter(Boolean).join(" ")
        console.log(`  ${it.kind.padEnd(11)} ${it.title}${extra ? `  · ${extra}` : ""}`)
    }
}

function checkSite(spec: Expectation) {
    const html = fs.readFileSync(path.join(root, spec.file), "utf8")
    const bundle = bundleFromHtml(html, spec.url)
    dump(spec.file, bundle)
    const all = titles(bundle)
    const services = titles(bundle, "service")
    const jobs = titles(bundle, "experience")
    const projects = titles(bundle, "project")
    const products = titles(bundle, "product")
    const profiles = titles(bundle, "profile")

    if (profiles.length !== 1) {
        fail(spec.file, `expected 1 profile, got ${profiles.length}: ${profiles.join(" | ")}`)
    }
    if (spec.profile && !has(profiles, spec.profile)) {
        fail(spec.file, `missing profile ${spec.profile}`)
    }
    for (const s of spec.services) {
        if (!has(services, s)) fail(spec.file, `missing service ${s}`)
    }
    for (const j of spec.jobs) {
        if (!has(jobs, j)) fail(spec.file, `missing job ${j}`)
    }
    if (projects.length < spec.projectsMin) {
        fail(spec.file, `expected >= ${spec.projectsMin} projects, got ${projects.length}`)
    }
    for (const p of spec.products || []) {
        if (!has(products, p)) fail(spec.file, `missing product ${p}`)
    }
    for (const bad of spec.forbid) {
        if (has(all, bad)) fail(spec.file, `chrome leaked: ${bad}`)
    }
    const keyCount = new Map<string, number>()
    for (const it of bundle.items) {
        const k = `${it.kind}:${it.title.toLowerCase()}`
        keyCount.set(k, (keyCount.get(k) || 0) + 1)
    }
    for (const [k, n] of keyCount) {
        if (n > 1) fail(spec.file, `repeat ${k} x${n}`)
    }
}

function fail(where: string, msg: string) {
    failed += 1
    console.log(`FAIL ${where}: ${msg}`)
}

function checkMenu() {
    const text = fs.readFileSync(path.join(fixtures, "import", "menu-rupee.txt"), "utf8")
    if (!looksLikeCatalog(text)) fail("menu", "rupee list should look like a catalog")
    const dishes = extractRupeeMenu(text)
    dump("rupee menu", { sourceLabel: "menu", sourceKind: "text", items: dishes })
    if (!has(titles({ sourceLabel: "menu", sourceKind: "text", items: dishes }, "product"), "Butter Chicken")) {
        fail("menu", "missing Butter Chicken")
    }
    if (!dishes.some((d) => d.fields.diet === "VEG" && /paneer/i.test(d.title))) {
        fail("menu", "paneer should be veg")
    }
    if (dishes.length < 5) fail("menu", `expected 5+ dishes, got ${dishes.length}`)
}

function checkResume() {
    const bundle = bundleFromText(RESUME, "resume-amina.txt")
    dump("resume text", bundle)
    if (!has(titles(bundle, "profile"), "Amina")) fail("resume", "missing Amina profile")
    if (!has(titles(bundle, "experience"), "Northstar")) fail("resume", "missing Northstar job")
    if (!has(titles(bundle, "experience"), "Helio")) fail("resume", "missing Helio job")
    if (!has(titles(bundle, "project"), "Playbook")) fail("resume", "missing Playbook project")
    if (!has(titles(bundle, "service"), "Ops Sprint")) fail("resume", "missing Ops Sprint")
}

async function checkPdfs() {
    const resumePdf = writeResumePdf(path.join(fixtures, "resume-amina.pdf"))
    const text = await extractPdfText(fs.readFileSync(resumePdf))
    console.log("\n=== resume PDF text ===\n", text.slice(0, 400))
    if (!/Amina Rao/i.test(text)) fail("pdf", "resume PDF missing name")
    if (!/Northstar/i.test(text)) fail("pdf", "resume PDF missing company")
    const fromPdf = bundleFromText(text, "resume-amina.pdf", "pdf")
    dump("resume PDF parse", fromPdf)
    if (!has(titles(fromPdf, "experience"), "Northstar")) fail("pdf", "parsed PDF missing Northstar")

    for (const name of ["first-90-days-workbook.pdf", "first-hire-checklist.pdf", "scorecard-pack.pdf"]) {
        const buf = fs.readFileSync(path.join(root, "public", "shop", name))
        const extracted = await extractPdfText(buf)
        if (!extracted || extracted.length < 10) fail("shop-pdf", `${name} extracted empty`)
        else console.log(`OK shop pdf ${name} chars=${extracted.length}`)
    }

    const jackyPath = path.join(fixtures, "import", "jacky-smith-resume.pdf")
    if (fs.existsSync(jackyPath)) {
        const jackyText = await extractPdfText(fs.readFileSync(jackyPath))
        console.log("\n=== jacky resume PDF ===\n", jackyText.slice(0, 500))
        if (!/jacky|smith|project|profile/i.test(jackyText)) {
            fail("jacky-pdf", "compressed resume still unreadable")
        } else {
            const parsed = bundleFromText(jackyText, "jacky.pdf", "pdf")
            dump("jacky resume PDF parse", parsed)
            if (!parsed.items.some((i) => i.kind === "profile" || i.kind === "experience")) {
                fail("jacky-pdf", "no profile/experience from real resume PDF")
            }
        }
    }
}

function writeResumePdf(out: string) {
    const lines = [
        "Amina Rao",
        "Fractional COO for first-time founders",
        "EXPERIENCE",
        "Fractional COO - Northstar Labs (2023 - Present)",
        "Head of Operations at Helio (2020 - 2023)",
        "PROJECTS",
        "First 90 Days Playbook 2024",
        "SERVICES",
        "Ops Sprint - $2400",
    ]
    const ops = ["BT", "/F1 12 Tf", "50 760 Td"]
    lines.forEach((line, i) => {
        if (i) ops.push("0 -18 Td")
        ops.push(`(${line.replace(/[()\\]/g, "\\$&")}) Tj`)
    })
    ops.push("ET")
    const stream = ops.join("\n")
    const objects = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
        `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    ]
    let body = "%PDF-1.1\n"
    const offsets = [0]
    for (const obj of objects) {
        offsets.push(body.length)
        body += obj + "\n"
    }
    const xrefAt = body.length
    body += `xref\n0 6\n0000000000 65535 f \n`
    for (let i = 1; i <= 5; i++) {
        body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
    }
    body += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
    fs.writeFileSync(out, body)
    return out
}

async function main() {
    for (const spec of SITES) checkSite(spec)
    checkMenu()
    checkResume()
    await checkPdfs()
    const merged = dedupeItems([
        ...bundleFromText(RESUME).items,
        ...bundleFromText(RESUME).items,
    ])
    if (merged.filter((i) => i.kind === "profile").length !== 1) fail("dedupe", "profiles not collapsed")
    if (failed) {
        console.log(`\n${failed} checks failed`)
        process.exit(1)
    }
    console.log("\nAll import fixture checks passed")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})

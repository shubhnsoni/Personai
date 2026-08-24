"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
    bundleFromHtml,
    bundleFromText,
    detectCommunity,
    extractPageText,
    extractPdfText,
    relatedPageUrls,
    item,
    mergeBundles,
    mergeModelItems,
    parseCsv,
    parseIcs,
    type ImportBundle,
    type ImportItem,
    type ImportKind,
} from "@/lib/import-extract"
import { classifyFile, classifyUrl, type SourceHint } from "@/lib/import-classify"
import { extractWithModel } from "@/lib/import-llm"
import { createCourse, createCourseLesson, createCourseModule } from "@/app/actions/courses"
import { createProduct } from "@/app/actions/products"
import { createEvent } from "@/app/actions/events"
import { createCommunity } from "@/app/actions/communities"
import { createLeadMagnet } from "@/app/actions/lead-magnets"
import { addContent } from "@/app/actions/content"
import { addService } from "@/app/actions/services"

export type ApplyResult = {
    wrote: Partial<Record<ImportKind, number>>
    skipped: number
    destinations: string[]
}

export async function ingestText(raw: string, hint: SourceHint = "auto"): Promise<ImportBundle> {
    const text = raw.trim()
    if (!text) throw new Error("Paste some text first.")
    let bundle = bundleFromText(text, hint === "auto" ? "Pasted text" : `${hint} paste`)
    if (/(?:₹|Rs\.?|INR)\s*\d/i.test(text)) {
        const { extractRupeeMenu } = await import("@/lib/menu-import")
        const dishes = extractRupeeMenu(text)
        if (dishes.length >= 2) {
            bundle = {
                ...bundle,
                items: [...dishes, ...bundle.items.filter((i) => i.kind !== "product")],
            }
        }
    }
    if (hint === "shop") bundle = preferKinds(bundle, ["product", "leadMagnet"])
    if (hint === "course") bundle = preferKinds(bundle, ["course"])
    if (hint === "events") bundle = preferKinds(bundle, ["event"])
    if (hint === "services") bundle = preferKinds(bundle, ["service"])
    if (hint === "cv" || hint === "site") bundle = preferKinds(bundle, ["profile", "experience", "project", "service"])
    return serializeBundle(await enrichWithModel(bundle, text))
}

export async function ingestUrl(url: string): Promise<ImportBundle> {
    try {
        const target = normalizeUrl(url)
        const kind = classifyUrl(target)
        if (kind === "youtube") {
            const yt = await fetchYoutube(target)
            return serializeBundle(yt)
        }
        const community = detectCommunity(target)
        let html = ""
        try {
            const res = await fetch(target, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; PersonaLinkImporter/1.0)",
                    Accept: "text/html,application/xhtml+xml",
                },
                redirect: "follow",
                signal: AbortSignal.timeout(8000),
            })
            if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`)
            const type = res.headers.get("content-type") || ""
            if (!/html|xml|text|json/i.test(type) && type) {
                throw new Error("That link is not a readable page.")
            }
            html = (await res.text()).slice(0, 500_000)
        } catch (e) {
            if (community) {
                return serializeBundle({
                    sourceLabel: community.title,
                    sourceKind: "url",
                    items: [community],
                    warning: "Page blocked. Imported the invite link only.",
                })
            }
            const msg = e instanceof Error ? e.message : "Could not fetch that page"
            throw new Error(/abort|timeout/i.test(msg) ? "That page took too long. Paste the text instead." : `${msg} Paste the text if the site is private.`)
        }
        let bundle = bundleFromHtml(html, target)
        const { extractMenuFromHtml, isMenuHost, MENU_IMPORT_WARNING } = await import("@/lib/menu-import")
        if (isMenuHost(target)) {
            const dishes = extractMenuFromHtml(html, target)
            if (!dishes.length && !bundle.items.some((i) => i.kind === "product")) {
                throw new Error("That page is blocked. Paste the menu or upload a CSV.")
            }
            if (dishes.length) {
                bundle = {
                    sourceLabel: bundle.sourceLabel,
                    sourceKind: "url",
                    items: dishes,
                    warning: MENU_IMPORT_WARNING,
                }
            } else {
                bundle = { ...bundle, warning: MENU_IMPORT_WARNING }
            }
        }
        const extras = isMenuHost(target) ? [] : relatedPageUrls(html, target)
        if (extras.length) {
            const pages = await Promise.all(extras.slice(0, 5).map((href) => fetchPageHtml(href)))
            for (const page of pages) {
                if (!page) continue
                const more = bundleFromHtml(page.html, page.url)
                bundle = mergeBundles(bundle, more.items)
            }
        }
        if (!bundle.items.length) {
            throw new Error("Nothing we could map. Paste the page text instead.")
        }
        const excerpt = [
            extractPageText(html, 5000),
            ...bundle.items.map((i) => `${i.kind}: ${i.title} ${i.fields.description || ""}`),
        ].join("\n").slice(0, 9000)
        console.info("[import]", target, "items", bundle.items.length, "related", extras.length)
        return serializeBundle(await enrichWithModel(bundle, excerpt))
    } catch (e) {
        if (e instanceof Error) throw e
        throw new Error("Could not read that link. Paste the text instead.")
    }
}

export async function ingestFile(formData: FormData, hint: SourceHint = "auto"): Promise<ImportBundle> {
    const file = formData.get("file")
    if (!(file instanceof File)) throw new Error("No file")
    const buf = Buffer.from(await file.arrayBuffer())
    const name = file.name || "upload"
    const source = classifyFile(name, file.type)
    if (source === "docx") {
        throw new Error("Save that as PDF or TXT, then drop it here.")
    }
    if (source === "pdf") {
        const text = await extractPdfText(buf)
        if (!text.trim()) throw new Error("Could not read text from that PDF. Paste the CV instead.")
        return serializeBundle(await enrichWithModel(bundleFromText(text, name, "pdf"), text))
    }
    const text = buf.toString("utf8")
    if (!text.trim()) throw new Error("That file was empty.")
    if (source === "ics") {
        const items = parseIcs(text)
        if (!items.length) throw new Error("No events in that calendar file.")
        return serializeBundle({ sourceLabel: name, sourceKind: "ics", items })
    }
    if (source === "csv") {
        const items = parseCsv(text)
        if (items.length) return serializeBundle({ sourceLabel: name, sourceKind: "csv", items })
    }
    return ingestText(text, hint)
}

export async function applyImportBundle(profileId: string, items: ImportItem[]): Promise<ApplyResult> {
    const selected = items.filter((i) => i.selected)
    if (!selected.length) throw new Error("Select at least one item.")

    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: {
            workExperiences: true,
            projects: true,
            serviceOfferings: true,
            digitalProducts: true,
            courses: true,
            events: true,
            communities: true,
            leadMagnets: true,
            documents: { select: { title: true }, take: 80 },
        },
    })
    if (!profile) throw new Error("Profile not found")

    const wrote: Partial<Record<ImportKind, number>> = {}
    let skipped = 0
    const bump = (kind: ImportKind) => { wrote[kind] = (wrote[kind] || 0) + 1 }

    const have = {
        experience: new Set(profile.workExperiences.map((e) => norm(`${e.role}${e.company}`))),
        project: new Set(profile.projects.map((p) => norm(p.title))),
        service: new Set(profile.serviceOfferings.map((s) => norm(s.name))),
        product: new Set(profile.digitalProducts.map((p) => norm(p.title))),
        course: new Set(profile.courses.map((c) => norm(c.title))),
        event: new Set(profile.events.map((e) => norm(e.title))),
        community: new Set(profile.communities.map((c) => norm(c.name))),
        leadMagnet: new Set(profile.leadMagnets.map((m) => norm(m.title))),
        knowledge: new Set(profile.documents.map((d) => norm(d.title))),
    }

    for (const it of selected) {
        const title = it.title.trim()
        if (!title) { skipped += 1; continue }
        const fields = it.fields || {}

        if (it.kind === "profile") {
            await prisma.profile.update({
                where: { id: profileId },
                data: {
                    displayName: pickField(profile.displayName, fields.displayName, fields.overwrite) || profile.displayName,
                    headline: pickField(profile.headline, fields.headline, fields.overwrite) ?? profile.headline,
                    bio: pickField(profile.bio, fields.bio, fields.overwrite) ?? profile.bio,
                },
            })
            bump("profile")
            continue
        }

        if (it.kind === "experience") {
            const role = fields.role || title
            const company = fields.company
            if (!company) { skipped += 1; continue }
            const key = norm(`${role}${company}`)
            if (have.experience.has(key)) { skipped += 1; continue }
            await prisma.workExperience.create({
                data: {
                    profileId,
                    company,
                    role,
                    startDate: fields.startDate || "",
                    endDate: fields.endDate || null,
                    description: fields.description || null,
                },
            })
            have.experience.add(key)
            bump("experience")
            continue
        }

        if (it.kind === "project") {
            if (have.project.has(norm(title))) { skipped += 1; continue }
            await prisma.project.create({
                data: {
                    profileId,
                    title,
                    description: fields.description || null,
                    year: fields.year || null,
                    client: fields.client || null,
                    link: fields.link || fields.url || null,
                    imageUrl: fields.thumbnailUrl || null,
                },
            })
            have.project.add(norm(title))
            bump("project")
            continue
        }

        if (it.kind === "service") {
            if (have.service.has(norm(title))) { skipped += 1; continue }
            await addService(profileId, {
                name: title,
                description: fields.description || "",
                price: fields.price || 0,
                duration: fields.durationMinutes || 30,
            })
            have.service.add(norm(title))
            bump("service")
            continue
        }

        if (it.kind === "product") {
            if (have.product.has(norm(title))) { skipped += 1; continue }
            const digital = fields.productType === "PDF" || fields.productType === "VIDEO" || fields.productType === "AUDIO"
            await createProduct(profileId, {
                title,
                description: fields.description,
                type: fields.productType || "OTHER",
                price: fields.price || 0,
                fileUrl: fields.fileUrl || fields.url,
                thumbnailUrl: fields.thumbnailUrl,
                isActive: true,
                fulfillment: fields.fulfillment || (digital ? "DIGITAL" : "PHYSICAL"),
                category: fields.category,
                diet: fields.diet,
                spiceLevel: fields.spiceLevel,
            })
            have.product.add(norm(title))
            bump("product")
            continue
        }

        if (it.kind === "course") {
            if (have.course.has(norm(title))) { skipped += 1; continue }
            const course = await createCourse(profileId, {
                title,
                description: fields.description || undefined,
                price: fields.price || 0,
                thumbnailUrl: fields.thumbnailUrl,
                isActive: true,
                isPublished: false,
            })
            for (const mod of fields.modules || []) {
                const created = await createCourseModule(course.id, { title: mod.title, description: mod.description })
                for (const lesson of mod.lessons || []) {
                    await createCourseLesson(created.id, {
                        title: lesson.title,
                        contentType: lesson.contentType || "TEXT",
                        durationMinutes: lesson.durationMinutes || 10,
                        isFree: Boolean(lesson.isFree),
                    })
                }
            }
            have.course.add(norm(title))
            bump("course")
            continue
        }

        if (it.kind === "event") {
            if (!fields.startTime) { skipped += 1; continue }
            if (have.event.has(norm(title))) { skipped += 1; continue }
            const start = new Date(fields.startTime)
            if (Number.isNaN(start.getTime())) { skipped += 1; continue }
            const end = fields.endTime ? new Date(fields.endTime) : new Date(start.getTime() + 60 * 60 * 1000)
            await createEvent(profileId, {
                title,
                description: fields.description,
                eventType: fields.eventType || "WEBINAR",
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                timezone: fields.timezone || profile.timezone || "UTC",
                location: fields.location,
                meetingUrl: fields.meetingUrl || fields.url,
                price: fields.price || 0,
                isFree: !fields.price,
                thumbnailUrl: fields.thumbnailUrl,
                isActive: true,
            })
            have.event.add(norm(title))
            bump("event")
            continue
        }

        if (it.kind === "community") {
            if (have.community.has(norm(title))) { skipped += 1; continue }
            await createCommunity(profileId, {
                name: title,
                description: fields.description,
                platform: fields.platform || "TELEGRAM",
                inviteLink: fields.inviteLink || fields.url,
                price: fields.price || 0,
                billingCycle: fields.billingCycle || "MONTHLY",
                isActive: true,
            })
            have.community.add(norm(title))
            bump("community")
            continue
        }

        if (it.kind === "leadMagnet") {
            if (have.leadMagnet.has(norm(title))) { skipped += 1; continue }
            await createLeadMagnet(profileId, {
                title,
                description: fields.description,
                type: fields.magnetType || "DOWNLOAD",
                fileUrl: fields.fileUrl || fields.url,
                isActive: true,
            })
            have.leadMagnet.add(norm(title))
            bump("leadMagnet")
            continue
        }

        if (it.kind === "knowledge") {
            if (have.knowledge.has(norm(title))) { skipped += 1; continue }
            await addContent(profileId, {
                type: "TEXT",
                title,
                content: fields.body || fields.description || title,
            })
            have.knowledge.add(norm(title))
            bump("knowledge")
        }
    }

    const destinations = destLabels(wrote)
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/import")
    revalidatePath(`/${profile.slug}`)
    return { wrote, skipped, destinations }
}

async function enrichWithModel(bundle: ImportBundle, text: string): Promise<ImportBundle> {
    try {
        const extra = await extractWithModel(text)
        if (extra.length) bundle = { ...bundle, items: mergeModelItems(bundle.items, extra) }
    } catch {
        // deterministic result is enough
    }
    if (!bundle.items.length) {
        throw new Error("Nothing we could map. Paste the text or try a public URL.")
    }
    return bundle
}

async function fetchPageHtml(url: string): Promise<{ url: string; html: string } | null> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; PersonaLinkImporter/1.0)",
                Accept: "text/html,application/xhtml+xml",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) return null
        return { url, html: (await res.text()).slice(0, 350_000) }
    } catch {
        return null
    }
}

function serializeBundle(bundle: ImportBundle): ImportBundle {
    const items = (bundle.items || []).slice(0, 60).map((it) => ({
        id: String(it.id || ""),
        kind: it.kind,
        title: String(it.title || "Untitled").slice(0, 160),
        confidence: Number(it.confidence) || 0.5,
        selected: Boolean(it.selected),
        fields: {
            displayName: strField(it.fields?.displayName),
            headline: strField(it.fields?.headline),
            bio: strField(it.fields?.bio),
            overwrite: Boolean(it.fields?.overwrite) || undefined,
            company: strField(it.fields?.company),
            role: strField(it.fields?.role),
            startDate: strField(it.fields?.startDate),
            endDate: strField(it.fields?.endDate),
            description: strField(it.fields?.description),
            year: strField(it.fields?.year),
            client: strField(it.fields?.client),
            link: strField(it.fields?.link),
            price: numField(it.fields?.price),
            durationMinutes: numField(it.fields?.durationMinutes),
            productType: it.fields?.productType,
            fileUrl: strField(it.fields?.fileUrl),
            thumbnailUrl: strField(it.fields?.thumbnailUrl),
            url: strField(it.fields?.url),
            startTime: strField(it.fields?.startTime),
            endTime: strField(it.fields?.endTime),
            timezone: strField(it.fields?.timezone),
            location: strField(it.fields?.location),
            meetingUrl: strField(it.fields?.meetingUrl),
            eventType: it.fields?.eventType,
            platform: it.fields?.platform,
            inviteLink: strField(it.fields?.inviteLink),
            billingCycle: it.fields?.billingCycle,
            magnetType: it.fields?.magnetType,
            body: strField(it.fields?.body),
            modules: Array.isArray(it.fields?.modules) ? it.fields.modules.slice(0, 20) : undefined,
        },
    }))
    return {
        sourceLabel: String(bundle.sourceLabel || "Import").slice(0, 120),
        sourceKind: bundle.sourceKind,
        items,
        warning: bundle.warning ? String(bundle.warning) : undefined,
    }
}

function strField(v: unknown) {
    if (typeof v !== "string") return undefined
    const s = v.trim()
    return s ? s.slice(0, 4000) : undefined
}

function numField(v: unknown) {
    if (v == null || v === "") return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
}

async function fetchYoutube(url: string): Promise<ImportBundle> {
    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error("oembed")
        const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string }
        const title = data.title || "Video"
        return {
            sourceLabel: title,
            sourceKind: "youtube",
            items: [
                item("product", title, 0.8, {
                    description: data.author_name ? `Video by ${data.author_name}` : undefined,
                    productType: "VIDEO",
                    url,
                    thumbnailUrl: data.thumbnail_url,
                    price: 0,
                }),
                item("knowledge", title, 0.5, {
                    body: `${title}\n${url}`,
                    description: url,
                    url,
                }),
            ],
        }
    } catch {
        return {
            sourceLabel: "Video",
            sourceKind: "youtube",
            items: [item("product", "Imported video", 0.6, { productType: "VIDEO", url, price: 0 })],
            warning: "Could not read the video page. Title is a placeholder.",
        }
    }
}

function preferKinds(bundle: ImportBundle, kinds: ImportKind[]): ImportBundle {
    const prefer = new Set(kinds)
    return {
        ...bundle,
        items: bundle.items.map((it) => prefer.has(it.kind) ? it : { ...it, selected: false, confidence: Math.min(it.confidence, 0.5) }),
    }
}

function pickField(current: string | null | undefined, incoming: string | undefined, overwrite?: boolean) {
    if (overwrite && incoming) return incoming
    if (current && current.trim()) return current
    return incoming
}

function destLabels(wrote: Partial<Record<ImportKind, number>>) {
    const map: Record<ImportKind, string> = {
        profile: "Profile",
        experience: "jobs",
        project: "projects",
        service: "services",
        product: "Shop",
        course: "Courses",
        event: "Events",
        community: "Community",
        leadMagnet: "Downloads",
        knowledge: "Knowledge",
    }
    return (Object.entries(wrote) as [ImportKind, number][])
        .filter(([, n]) => n > 0)
        .map(([k, n]) => (k === "profile" ? map[k] : `${n} ${map[k]}`))
}

function normalizeUrl(input: string) {
    const trimmed = input.trim()
    if (!trimmed) throw new Error("URL required")
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

function htmlToText(html: string) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12000)
}

function norm(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

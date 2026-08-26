import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const USER_ID = "cmsvh9izg0000bwji3oipg9im"
const img = (name) => `/uploads/${name}`

async function wipe(profileId) {
    await prisma.booking.deleteMany({ where: { profileId } })
    await prisma.payment.deleteMany({ where: { profileId } })
    await prisma.serviceOffering.deleteMany({ where: { profileId } })
    await prisma.availabilitySchedule.deleteMany({ where: { profileId } })
    await prisma.workExperience.deleteMany({ where: { profileId } })
    await prisma.project.deleteMany({ where: { profileId } })
    await prisma.profileDocument.deleteMany({ where: { profileId } })
    await prisma.digitalProduct.deleteMany({ where: { profileId } })
    await prisma.course.deleteMany({ where: { profileId } })
    await prisma.event.deleteMany({ where: { profileId } })
    await prisma.leadMagnet.deleteMany({ where: { profileId } })
    await prisma.community.deleteMany({ where: { profileId } })
    await prisma.shortLink.deleteMany({ where: { profileId } })
}

async function hours(profileId, start = "10:00", end = "18:00", days = [1, 2, 3, 4, 5]) {
    await prisma.availabilitySchedule.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            profileId,
            dayOfWeek,
            startTime: start,
            endTime: end,
            isEnabled: days.includes(dayOfWeek),
        })),
    })
}

async function upsertKit(slug, role, goal, data) {
    const existing = await prisma.profile.findFirst({ where: { userId: USER_ID, slug } })
    if (existing) {
        await prisma.profile.update({ where: { id: existing.id }, data: { ...data, roleTemplate: role, primaryGoal: goal, isPublic: true, timezone: "Asia/Kolkata", language: "en" } })
        return existing.id
    }
    const clash = await prisma.profile.findUnique({ where: { slug } })
    const useSlug = clash ? `${slug}-${USER_ID.slice(-6).toLowerCase()}` : slug
    const created = await prisma.profile.create({
        data: {
            userId: USER_ID,
            slug: useSlug,
            roleTemplate: role,
            primaryGoal: goal,
            isPublic: true,
            timezone: "Asia/Kolkata",
            language: "en",
            ...data,
        },
    })
    return created.id
}

async function main() {
    const blob = await prisma.welcomeAnimationPreset.findFirst({ where: { name: { in: ["Blob", "Bloub"] } } })
    const anim = blob?.id || undefined

    // SHOP — Mira, Kala Home
    {
        const id = await upsertKit("try-shop", "SHOP", "SELL_PRODUCTS", {
            displayName: "Kala Home",
            headline: "Handmade ceramics from Pune",
            bio: "Small-batch cups, vases, and lamps. Thrown in Pune, shipped across India. COD on most pieces.",
            imageUrl: img("try-mira.jpg"),
            shopLogoUrl: img("try-mira.jpg"),
            chatAvatarMode: "IMAGE",
            whatsapp: "919876543210",
            upiId: "kala@okaxis",
            deliveryNote: "Packed in recycled paper. Ships in 3–5 days.",
            welcomeMessageOverride: "Ask about stock, sizes, or custom glazes.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "warm", customInstructions: "You run Kala Home. Talk about ceramics, glazes, shipping, and COD. Keep it short." }),
        })
        await wipe(id)
        await prisma.digitalProduct.createMany({
            data: [
                { profileId: id, title: "Speckled mug", description: "Oatmeal glaze. Holds 280ml. Dishwasher safe.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-mug.jpg"), galleryUrls: JSON.stringify([img("try-mug.jpg")]), priceCents: 89000, currency: "INR", stock: 12, allowCod: true, shipMode: "BOTH", category: "Tableware", sku: "MUG-01", isActive: true },
                { profileId: id, title: "Sage vase", description: "Tall thrown vase. Matte sage. For dried stems.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-vase.jpg"), galleryUrls: JSON.stringify([img("try-vase.jpg")]), priceCents: 240000, currency: "INR", stock: 5, allowCod: true, shipMode: "BOTH", category: "Home", sku: "VAS-02", isActive: true },
                { profileId: id, title: "Linen lamp", description: "Ceramic base, linen shade. Warm 2700K bulb included.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-lamp.jpg"), galleryUrls: JSON.stringify([img("try-lamp.jpg")]), priceCents: 420000, currency: "INR", stock: 3, allowCod: false, shipMode: "DELIVER", category: "Lighting", sku: "LMP-03", isActive: true },
                { profileId: id, title: "Botanical tote", description: "Heavy canvas. One print per batch.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-tote.jpg"), galleryUrls: JSON.stringify([img("try-tote.jpg")]), priceCents: 69000, currency: "INR", stock: 20, allowCod: true, shipMode: "BOTH", category: "Goods", sku: "TOT-04", isActive: true },
                { profileId: id, title: "Glaze recipe card pack", description: "PDF of 8 studio glazes Mira actually uses.", type: "PDF", fulfillment: "DIGITAL", thumbnailUrl: img("try-brand.jpg"), priceCents: 49000, currency: "INR", isActive: true },
            ],
        })
        await prisma.profileDocument.createMany({
            data: [
                { profileId: id, type: "BIO", title: "About Kala Home", sourceType: "TEXT", rawText: "Kala Home is Mira's Pune studio. She throws stoneware in small batches. Pieces ship in 3–5 days. COD on mugs, vases, and totes. Lamps go prepaid because of the shade." },
                { profileId: id, type: "FAQ", title: "Shipping", sourceType: "TEXT", rawText: "Pan-India shipping. Fragile wrap is included. If a piece arrives cracked, send a photo and we remake it." },
            ],
        })
        console.log("filled shop")
    }

    // RESTAURANT — Ghar Kitchen
    {
        const id = await upsertKit("try-restaurant", "RESTAURANT", "BOOK_TABLE", {
            displayName: "Ghar Kitchen",
            headline: "Home-style North Indian, Bandra",
            bio: "Twelve tables. Butter chicken, dal tadka, garlic naan. Walk in or reserve. WhatsApp for the day's specials.",
            imageUrl: img("try-arjun.jpg"),
            shopLogoUrl: img("try-storefront.jpg"),
            chatAvatarMode: "IMAGE",
            whatsapp: "919820011223",
            upiId: "gharkitchen@upi",
            welcomeMessageOverride: "Ask for the menu, spice, or a table tonight.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "warm", customInstructions: "You are Ghar Kitchen. Help with menu, diet, spice, and table booking. Never upsell wine." }),
        })
        await wipe(id)
        await prisma.serviceOffering.create({ data: { profileId: id, name: "Reserve a table", description: "90 minutes, up to 4 covers. Tell us if you need more.", priceCents: 0, isFree: true, durationMinutes: 90, kind: "TABLE", covers: 24, isActive: true, currency: "INR" } })
        await hours(id, "12:00", "23:00", [0, 2, 3, 4, 5, 6])
        await prisma.digitalProduct.createMany({
            data: [
                { profileId: id, title: "Butter chicken", description: "Tomato-cashew gravy, charcoal chicken. Serves 2.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-butter.jpg"), galleryUrls: JSON.stringify([img("try-butter.jpg")]), priceCents: 48000, currency: "INR", category: "Mains", diet: "Non-veg", spiceLevel: 2, serveWindow: "12:00–23:00", isActive: true },
                { profileId: id, title: "Dal tadka", description: "Yellow dal, ghee tadka. Homestyle.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-dal.jpg"), galleryUrls: JSON.stringify([img("try-dal.jpg")]), priceCents: 28000, currency: "INR", category: "Mains", diet: "Veg", spiceLevel: 1, serveWindow: "12:00–23:00", isActive: true },
                { profileId: id, title: "Garlic naan", description: "Tandoor, butter, extra garlic if you ask.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-naan.jpg"), galleryUrls: JSON.stringify([img("try-naan.jpg")]), priceCents: 9000, currency: "INR", category: "Breads", diet: "Veg", spiceLevel: 0, isActive: true },
                { profileId: id, title: "Mango lassi", description: "Alphonso when in season. Otherwise Kesar.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-lassi.jpg"), galleryUrls: JSON.stringify([img("try-lassi.jpg")]), priceCents: 14000, currency: "INR", category: "Drinks", diet: "Veg", spiceLevel: 0, isActive: true },
            ],
        })
        await prisma.profileDocument.createMany({
            data: [
                { profileId: id, type: "BIO", title: "House notes", sourceType: "TEXT", rawText: "Ghar Kitchen is Chef Arjun's 12-table room in Bandra. Closed Monday. Reservations via chat. Vegetarian and Jain on request. No pork, no alcohol." },
                { profileId: id, type: "FAQ", title: "Reservations", sourceType: "TEXT", rawText: "Tables are 90 minutes. Weekend dinner fills by 7pm. Walk-ins after 9:30. Kids welcome. High chairs on request." },
            ],
        })
        console.log("filled restaurant")
    }

    // CONSULTANT — Nia Brooks
    {
        const id = await upsertKit("try-consultant", "CONSULTANT", "TAKE_APPOINTMENTS", {
            displayName: "Nia Brooks",
            headline: "Ops consultant for small SaaS teams",
            bio: "I help 8–40 person product companies unstick hiring, cadence, and the first sales motion. Based between London and Goa.",
            imageUrl: img("try-nia.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about a fit call or a two-week sprint.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "direct", customInstructions: "You are Nia Brooks. Be clear. Offer a free fit call. Do not do therapy." }),
        })
        await wipe(id)
        await prisma.serviceOffering.createMany({
            data: [
                { profileId: id, name: "Fit call", description: "25 minutes. We see if a sprint is worth it.", priceCents: 0, isFree: true, durationMinutes: 25, isActive: true },
                { profileId: id, name: "Two-week sprint", description: "Cadence, scorecards, and a hiring plan you can run.", priceCents: 280000, isFree: false, durationMinutes: 50, isActive: true },
            ],
        })
        await hours(id)
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Independent", role: "Principal consultant", startDate: "2021", endDate: null, description: "Sprints for SaaS operators.", achievements: JSON.stringify(["40+ sprints", "Mostly first sales hire and weekly cadence"]) },
                { profileId: id, company: "Northline", role: "Head of operations", startDate: "2016", endDate: "2021", description: "Scaled a 12-person product team to 45." },
            ],
        })
        await prisma.project.createMany({
            data: [
                { profileId: id, title: "First sales hire kit", description: "Scorecard, loop, and 90-day plan.", year: "2025", imageUrl: img("try-workshop.jpg") },
                { profileId: id, title: "Weekly stack", description: "A one-page operating review founders actually keep.", year: "2024", imageUrl: img("try-course.jpg") },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Cadence one-pager", description: "A free PDF of the weekly stack.", type: "DOWNLOAD", isActive: true } })
        await prisma.profileDocument.create({ data: { profileId: id, type: "BIO", title: "Who Nia works with", sourceType: "TEXT", rawText: "SaaS teams of 8–40 people. Not a fit for idea-stage founders with no customers." } })
        console.log("filled consultant")
    }

    // CA — Kabir Shah
    {
        const id = await upsertKit("try-ca", "CA", "TAKE_APPOINTMENTS", {
            displayName: "Kabir Shah, CA",
            headline: "GST, books, and filings for small firms",
            bio: "Practice in Andheri. Monthly books, GST, and a 30-minute consult if you are stuck. UPI on the invoice.",
            imageUrl: img("try-kabir.jpg"),
            chatAvatarMode: "IMAGE",
            whatsapp: "919820045001",
            upiId: "kabirshah@okicici",
            gstin: "27AABCU9603R1ZX",
            welcomeMessageOverride: "Ask about GST, books, or a consult slot.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "calm", customInstructions: "You are Kabir Shah, CA. Be precise. Never give legal advice. Offer a paid consult for filings." }),
        })
        await wipe(id)
        await prisma.serviceOffering.createMany({
            data: [
                { profileId: id, name: "30-min consult", description: "One question, one next step.", priceCents: 150000, currency: "INR", isFree: false, durationMinutes: 30, isActive: true },
                { profileId: id, name: "Monthly books", description: "Bank rec, GST, and a one-page close.", priceCents: 800000, currency: "INR", isFree: false, durationMinutes: 60, isActive: true, isRecurring: true },
            ],
        })
        await hours(id, "10:00", "18:00", [1, 2, 3, 4, 5])
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Shah & Co.", role: "Partner", startDate: "2019", endDate: null, description: "Small-firm practice. GST, tax, and books." },
                { profileId: id, company: "Big Four", role: "Audit associate", startDate: "2014", endDate: "2019", description: "Learned how not to bury a client in paper." },
            ],
        })
        await prisma.profileDocument.create({ data: { profileId: id, type: "FAQ", title: "What Kabir does", sourceType: "TEXT", rawText: "GST returns, monthly books, ITR for proprietors and private limited companies under 5 crore turnover. Not a fit for listed companies." } })
        console.log("filled ca")
    }

    // COACH — Leela Rao
    {
        const id = await upsertKit("try-coach", "COACH", "SELL_PRODUCTS", {
            displayName: "Leela Rao",
            headline: "Career coach for operators who want out",
            bio: "I help mid-career operators leave a job they have outgrown. Fit call, a six-week course, and a private room.",
            imageUrl: img("try-leela.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about the course or a fit call.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "warm", customInstructions: "You are Leela Rao. Direct, kind. Offer a free fit call. You are not a therapist." }),
        })
        await wipe(id)
        await prisma.serviceOffering.createMany({
            data: [
                { profileId: id, name: "Fit call", description: "20 minutes to see if coaching is the next step.", priceCents: 0, isFree: true, durationMinutes: 20, isActive: true },
                { profileId: id, name: "Six-week sprint", description: "Weekly sessions plus the course.", priceCents: 480000, currency: "INR", isFree: false, durationMinutes: 50, isActive: true },
            ],
        })
        await hours(id)
        const course = await prisma.course.create({
            data: {
                profileId: id,
                title: "Leave well",
                description: "Six weeks to a clean exit and a job you chose.",
                subtitle: "From stuck to a written plan.",
                thumbnailUrl: img("try-course.jpg"),
                body: "A working course: score the job, write the story, run the search without blowing up your week.",
                outcomes: JSON.stringify(["A written 90-day exit plan", "A story you can say out loud", "A search cadence that fits a full-time job"]),
                level: "ALL",
                priceCents: 120000,
                compareAtCents: 180000,
                currency: "INR",
                isActive: true,
                isPublished: true,
                totalModules: 2,
                totalLessons: 4,
            },
        })
        const m1 = await prisma.courseModule.create({ data: { courseId: course.id, title: "See the job clearly", orderIndex: 0 } })
        const m2 = await prisma.courseModule.create({ data: { courseId: course.id, title: "Leave without drama", orderIndex: 1 } })
        await prisma.courseLesson.createMany({
            data: [
                { moduleId: m1.id, title: "The stuck test", contentType: "TEXT", body: "Five questions. If you score 4, you are leaving.", orderIndex: 0, isFree: true, durationMinutes: 12 },
                { moduleId: m1.id, title: "Write the story", contentType: "TEXT", body: "One page. What you did, what you want, what you will not do.", orderIndex: 1, durationMinutes: 18 },
                { moduleId: m2.id, title: "The notice week", contentType: "TEXT", body: "How to tell your manager without a speech.", orderIndex: 0, durationMinutes: 15 },
                { moduleId: m2.id, title: "First 30 days out", contentType: "TEXT", body: "A calendar, not a vision board.", orderIndex: 1, durationMinutes: 20 },
            ],
        })
        await prisma.digitalProduct.create({ data: { profileId: id, title: "Exit workbook", description: "Printable PDF that rides with the course.", type: "PDF", fulfillment: "DIGITAL", thumbnailUrl: img("try-course.jpg"), priceCents: 19000, currency: "INR", isActive: true } })
        await prisma.event.create({
            data: {
                profileId: id,
                title: "Office hours: leaving well",
                description: "Live hour. Bring one question.",
                eventType: "WEBINAR",
                thumbnailUrl: img("try-workshop.jpg"),
                startTime: new Date("2026-09-12T11:00:00+05:30"),
                endTime: new Date("2026-09-12T12:00:00+05:30"),
                timezone: "Asia/Kolkata",
                meetingUrl: "https://example.com/leela-hours",
                priceCents: 0,
                isFree: true,
                isActive: true,
            },
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Stuck test", description: "Five questions as a PDF.", type: "DOWNLOAD", isActive: true } })
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Leave Well", role: "Coach", startDate: "2022", endDate: null, description: "1:1 and the six-week course." },
                { profileId: id, company: "A series B SaaS", role: "Head of people", startDate: "2017", endDate: "2022", description: "Learned how people actually quit." },
            ],
        })
        console.log("filled coach")
    }

    // CREATOR — Theo Park
    {
        const id = await upsertKit("try-creator", "CREATOR", "COLLECT_LEADS", {
            displayName: "Theo Park",
            headline: "Photo notes and film presets",
            bio: "I shoot on film and publish a weekly note. Presets, zines, and a free lighting cheat sheet.",
            imageUrl: img("try-theo.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask for the free cheat sheet or the preset pack.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "casual", customInstructions: "You are Theo Park. Talk about film, light, and the weekly note. Offer the free cheat sheet." }),
        })
        await wipe(id)
        await prisma.digitalProduct.createMany({
            data: [
                { profileId: id, title: "Night film presets", description: "12 Lightroom presets from the rainy-street series.", type: "OTHER", fulfillment: "DIGITAL", thumbnailUrl: img("try-presets.jpg"), priceCents: 2900, isActive: true },
                { profileId: id, title: "Zine 03", description: "A 24-page printed-look PDF.", type: "PDF", fulfillment: "DIGITAL", thumbnailUrl: img("try-zine.jpg"), priceCents: 1200, isActive: true },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Lighting cheat sheet", description: "One page. Window, night, mixed.", type: "DOWNLOAD", isActive: true } })
        await prisma.profileDocument.create({ data: { profileId: id, type: "BIO", title: "About Theo", sourceType: "TEXT", rawText: "Theo Park shoots 35mm and publishes a weekly note on light. The preset pack is digital. The zine is a PDF that looks like print." } })
        console.log("filled creator")
    }

    // DESIGNER — Anika Iyer
    {
        const id = await upsertKit("try-designer", "DESIGNER", "SHOW_PORTFOLIO", {
            displayName: "Anika Iyer",
            headline: "Brand systems for small product companies",
            bio: "Identity, packaging, and the first website. I work with 4–6 clients a year.",
            imageUrl: img("try-anika.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about a project or the lead form.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "calm", customInstructions: "You are Anika Iyer. Talk about brand work. Collect a lead if they want to hire." }),
        })
        await wipe(id)
        await prisma.project.createMany({
            data: [
                { profileId: id, title: "Kala Home identity", description: "Name, type, and a two-colour system for a ceramics studio.", year: "2025", imageUrl: img("try-brand.jpg"), client: "Kala Home" },
                { profileId: id, title: "Packaging for a tea company", description: "Boxes, sleeves, and a unboxing that does not use plastic.", year: "2024", imageUrl: img("try-packaging.jpg"), client: "Private" },
                { profileId: id, title: "Studio site", description: "A one-page site that books calls.", year: "2024", imageUrl: img("try-app.jpg") },
            ],
        })
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Independent", role: "Brand designer", startDate: "2020", endDate: null, description: "Identity and packaging." },
                { profileId: id, company: "Atelier", role: "Designer", startDate: "2016", endDate: "2020", description: "Brand teams for consumer goods." },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Project enquiry", description: "A short form. Budget, timeline, files.", type: "FORM", isActive: true } })
        console.log("filled designer")
    }

    // DEVELOPER — Rohan Sen
    {
        const id = await upsertKit("try-developer", "DEVELOPER", "SHOW_PORTFOLIO", {
            displayName: "Rohan Sen",
            headline: "Full-stack for small product teams",
            bio: "Next.js, Postgres, and the boring parts that keep a product up. Available for 3-month builds.",
            imageUrl: img("try-rohan.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about a build or the stack.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "direct", customInstructions: "You are Rohan Sen. Talk about builds. Collect a lead if they want to hire." }),
        })
        await wipe(id)
        await prisma.project.createMany({
            data: [
                { profileId: id, title: "Ops dashboard", description: "A weekly review that sales actually opens.", year: "2025", imageUrl: img("try-app.jpg"), client: "SaaS, 20 people" },
                { profileId: id, title: "Member library", description: "Login, lessons, and a download that does not leak.", year: "2024", imageUrl: img("try-course.jpg") },
            ],
        })
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Independent", role: "Full-stack", startDate: "2022", endDate: null, description: "3-month product builds." },
                { profileId: id, company: "A fintech", role: "Engineer", startDate: "2018", endDate: "2022", description: "Payments and ledgers." },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Start a build", description: "Tell me the stack and the date.", type: "FORM", isActive: true } })
        console.log("filled developer")
    }

    // EDITOR — Priya Nair
    {
        const id = await upsertKit("try-editor", "EDITOR", "SHOW_PORTFOLIO", {
            displayName: "Priya Nair",
            headline: "Film editor. Colour and cut.",
            bio: "Commercials, shorts, and the odd music video. I cut in Premiere and grade in Resolve.",
            imageUrl: img("try-priya.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about a cut or a grade.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "calm", customInstructions: "You are Priya Nair. Talk about edit and colour. Collect a lead for paid work." }),
        })
        await wipe(id)
        await prisma.project.createMany({
            data: [
                { profileId: id, title: "Rain street", description: "A 40-second night piece. Cut and grade.", year: "2025", imageUrl: img("try-film.jpg"), client: "Independent" },
                { profileId: id, title: "Zine teaser", description: "Still sequence for a photo zine launch.", year: "2024", imageUrl: img("try-zine.jpg"), client: "Theo Park" },
            ],
        })
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Independent", role: "Editor", startDate: "2021", endDate: null, description: "Cut and grade." },
                { profileId: id, company: "A Bombay house", role: "Assistant editor", startDate: "2018", endDate: "2021", description: "Learned how not to overcut." },
            ],
        })
        console.log("filled editor")
    }

    // JOB SEEKER — Samir Dutt
    {
        const id = await upsertKit("try-job", "JOB_SEEKER", "HIRE_ME", {
            displayName: "Samir Dutt",
            headline: "Product designer. Open to work.",
            bio: "Five years on B2B tools. Looking for a senior IC seat. Bangalore or remote.",
            imageUrl: img("try-samir.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask about work, or leave a role.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "direct", customInstructions: "You are Samir Dutt. Talk about product design work. Collect a lead if they want to hire you." }),
        })
        await wipe(id)
        await prisma.workExperience.createMany({
            data: [
                { profileId: id, company: "Northline", role: "Product designer", startDate: "2022", endDate: "2026", description: "Self-serve onboarding and the first mobile app." },
                { profileId: id, company: "A seed startup", role: "Designer", startDate: "2020", endDate: "2022", description: "Everything: brand, product, the deck." },
            ],
        })
        await prisma.project.createMany({
            data: [
                { profileId: id, title: "Onboarding rewrite", description: "Cut time-to-value from 14 days to 2.", year: "2025", imageUrl: img("try-app.jpg") },
                { profileId: id, title: "Workshop kit", description: "A physical kit for sales kickoffs.", year: "2024", imageUrl: img("try-workshop.jpg") },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Leave a role", description: "Company, seat, and a link.", type: "FORM", isActive: true } })
        await prisma.profileDocument.create({ data: { profileId: id, type: "BIO", title: "What Samir wants", sourceType: "TEXT", rawText: "Senior product designer. B2B. Bangalore or remote. Not looking for agency work or founding-designer-only seats." } })
        console.log("filled job")
    }

    // CUSTOM — Atlas Studio
    {
        const id = await upsertKit("try-custom", "CUSTOM", "BOOK_CALL", {
            displayName: "Atlas Studio",
            headline: "A small studio that does a bit of everything",
            bio: "Photos, a shop, a workshop, and a page that talks. Use this kit when you want every surface on.",
            imageUrl: img("try-atlas.jpg"),
            chatAvatarMode: "IMAGE",
            welcomeMessageOverride: "Ask for the shop, a booking, or the free note.",
            animationStyleId: anim,
            personalityConfig: JSON.stringify({ tone: "warm", customInstructions: "You are Atlas Studio. Help with shop, bookings, and the free note." }),
        })
        await wipe(id)
        await prisma.serviceOffering.create({ data: { profileId: id, name: "Studio hour", description: "A paid hour in the room.", priceCents: 250000, currency: "INR", isFree: false, durationMinutes: 60, isActive: true } })
        await hours(id, "11:00", "19:00", [1, 2, 3, 4, 5, 6])
        await prisma.digitalProduct.createMany({
            data: [
                { profileId: id, title: "Print: rain street", description: "A3, signed, edition of 20.", type: "PHYSICAL", fulfillment: "PHYSICAL", thumbnailUrl: img("try-film.jpg"), priceCents: 450000, currency: "INR", stock: 8, allowCod: false, shipMode: "DELIVER", isActive: true },
                { profileId: id, title: "Studio notes PDF", description: "A short digital zine.", type: "PDF", fulfillment: "DIGITAL", thumbnailUrl: img("try-zine.jpg"), priceCents: 90000, currency: "INR", isActive: true },
            ],
        })
        await prisma.leadMagnet.create({ data: { profileId: id, title: "Free lighting note", description: "One page from Theo's cheat sheet, reused here.", type: "DOWNLOAD", isActive: true } })
        await prisma.project.create({ data: { profileId: id, title: "The room", description: "How the studio is laid out.", year: "2025", imageUrl: img("try-workshop.jpg") } })
        console.log("filled custom")
    }

    console.log("done")
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SLUG = "skydine-cafe"
const asset = (name: string) => `/uploads/blu-cafe/${name}`

async function main() {
    const profile = await prisma.profile.findFirst({
        where: { slug: { in: ["skydine-cafe", "blu-cafe"] } },
    })
    if (!profile) throw new Error("SkyDine Cafe profile not found")

    const ice = await prisma.welcomeAnimationPreset.findFirst({ where: { name: { in: ["Ice", "Aqua", "Blob"] } } })
    const blob = await prisma.welcomeAnimationPreset.findFirst({ where: { name: "Blob" } })

    const personality = {
        tone: "warm",
        responseLength: "medium",
        language: "en",
        customInstructions:
            "You are SkyDine Cafe on Hill Road, Bandra. Help with the menu, diet, spice, AR plates, takeaway, and table booking. Prices are in rupees. Closed nothing — open 8am–9pm every day. Vegetarian, vegan, and a few chicken plates. No alcohol. Offer a window two-top, a booth for four, or the garden six. If they want to see a dish, mention they can place it on the table in AR.",
        orb: { shape: "goutte", expression: "heureux", color: "turquoise" },
        extras: {
            surfaces: [],
            packs: ["menuDish", "ar", "tableBook", "whatsappUpi"],
            addons: ["menu"],
        },
    }

    await prisma.profile.update({
        where: { id: profile.id },
        data: {
            displayName: "SkyDine Cafe",
            headline: "All-day cafe on Hill Road, Bandra",
            bio: "Navy walls, cyan cups, and a marble counter that opens at eight. We roast a house blend, smash avocado to order, and keep the waffles coming through last seating. Twelve tables, a garden six, and takeaway from the side window. Ask the chat for the menu, a table, or to put a plate on your table in AR.",
            roleTemplate: "RESTAURANT",
            primaryGoal: "BOOK_TABLE",
            language: "en",
            timezone: "Asia/Kolkata",
            themeColor: "#00D7FF",
            imageUrl: asset("cafe.jpg"),
            shopLogoUrl: asset("logo.jpg"),
            whatsapp: "919820011334",
            slug: SLUG,
            upiId: "skydine@okaxis",
            gstin: "27AADCB4281F1Z3",
            deliveryNote: "Pickup at the Hill Road window in about 12 minutes. We do not deliver after 8:30pm. COD on takeaway over ₹200.",
            chatAvatarMode: "ORB",
            animationStyleId: blob?.id || ice?.id || profile.animationStyleId,
            isPublic: true,
            showInDirectory: true,
            welcomeMessageOverride: "Ask for the menu, a table tonight, or tap a dish to place it on the table.",
            contentDisplayMode: "POPUP",
            personalityConfig: JSON.stringify(personality),
            aiModel: "gpt-4o-mini",
            autoMemoryEnabled: true,
            liveChatEnabled: true,
            liveChatSlaMinutes: 8,
            bufferMinutes: 15,
        },
    })

    await prisma.booking.deleteMany({ where: { profileId: profile.id } })
    await prisma.payment.deleteMany({ where: { profileId: profile.id } })
    await prisma.serviceOffering.deleteMany({ where: { profileId: profile.id } })
    await prisma.availabilitySchedule.deleteMany({ where: { profileId: profile.id } })
    await prisma.digitalProduct.deleteMany({ where: { profileId: profile.id } })
    await prisma.profileDocument.deleteMany({ where: { profileId: profile.id } })
    await prisma.workExperience.deleteMany({ where: { profileId: profile.id } })
    await prisma.project.deleteMany({ where: { profileId: profile.id } })
    await prisma.event.deleteMany({ where: { profileId: profile.id } })
    await prisma.leadMagnet.deleteMany({ where: { profileId: profile.id } })
    await prisma.shortLink.deleteMany({ where: { profileId: profile.id } })

    await prisma.serviceOffering.createMany({
        data: [
            {
                profileId: profile.id,
                name: "Window two-top",
                description: "Street-facing two-seat. 75 minutes. Best for a coffee and a plate.",
                priceCents: 0,
                isFree: true,
                durationMinutes: 75,
                currency: "INR",
                isActive: true,
                kind: "TABLE",
                covers: 2,
                maxBookingsPerDay: 12,
            },
            {
                profileId: profile.id,
                name: "Booth for four",
                description: "Padded booth. 90 minutes. High chair on request.",
                priceCents: 0,
                isFree: true,
                durationMinutes: 90,
                currency: "INR",
                isActive: true,
                kind: "TABLE",
                covers: 4,
                maxBookingsPerDay: 8,
            },
            {
                profileId: profile.id,
                name: "Garden six",
                description: "Back garden table under the neem. 2 hours. Evenings fill first.",
                priceCents: 0,
                isFree: true,
                durationMinutes: 120,
                currency: "INR",
                isActive: true,
                kind: "TABLE",
                covers: 6,
                maxBookingsPerDay: 4,
            },
        ],
    })

    await prisma.availabilitySchedule.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            profileId: profile.id,
            dayOfWeek,
            startTime: "08:00",
            endTime: "21:00",
            isEnabled: true,
        })),
    })

    const dishes = [
        {
            file: "cup-coffee",
            title: "Blu house latte",
            subtitle: "House blend, steamed milk, cyan cup",
            description: "Double shot of our Bandra roast with microfoam. Oat and almond on the side.",
            body: "We pull the house espresso on a Linea and stretch milk to a tight foam. Regular is 180ml, large is 270ml. Decaf on request before 4pm.",
            category: "Coffee",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "ALL",
            priceCents: 18000,
            compareAtCents: 22000,
            sku: "BLU-LT",
            stock: null,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["House roast", "Oat or almond", "Decaf till 4pm"],
            variants: [{ name: "Regular" }, { name: "Large +₹40" }, { name: "Oat milk" }],
        },
        {
            file: "frappe",
            title: "Sea-salt frappe",
            subtitle: "Iced house blend, cream, a pinch of salt",
            description: "Blended cold brew, a ribbon of cream, and sea salt on top. The afternoon drink.",
            body: "Cold brew steeped 16 hours, blended with ice and a little condensed milk. Whipped cream, flaky salt. Not too sweet.",
            category: "Coffee",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "ALL",
            priceCents: 24000,
            sku: "BLU-FR",
            stock: null,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["16-hour cold brew", "Not too sweet", "Whipped cream"],
        },
        {
            file: "croissant",
            title: "Butter croissant",
            subtitle: "Laminated overnight, baked at 7am",
            description: "72-layer croissant. Shatter, then butter. We bake two trays; when they are gone, they are gone.",
            body: "Dough rests overnight. Baked at seven, out by eight. Eat it plain or with the house honey.",
            category: "Bakery",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "BREAKFAST",
            priceCents: 16000,
            sku: "BLU-CR",
            stock: 24,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["Baked at 7am", "72 layers", "Honey on the side"],
        },
        {
            file: "muffin",
            title: "Blueberry muffin",
            subtitle: "Burst berries, sugared lid",
            description: "A high-domed muffin with frozen Alphonso-season blueberries when we can, else Chilean. Breakfast till they sell out.",
            body: "Batter mixed the night before. Sugared top. One to a guest with coffee is the move.",
            category: "Bakery",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "BREAKFAST",
            priceCents: 14000,
            sku: "BLU-MF",
            stock: 18,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["Sugared top", "Sells out by noon"],
        },
        {
            file: "avocado-half",
            title: "Avocado smash",
            subtitle: "Sourdough, lime, chilli, olive oil",
            description: "Ripe Hass on toasted country sourdough. Lime, chilli flakes, flaky salt. Vegan.",
            body: "Bread from the bakery downstairs. Avocado smashed, not sliced. Add a soft egg if you want it richer — tell the chat.",
            category: "Plates",
            diet: "VEGAN",
            spiceLevel: 1,
            serveWindow: "BREAKFAST",
            priceCents: 28000,
            sku: "BLU-AV",
            stock: null,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["Vegan", "Sourdough from downstairs", "Chilli optional"],
        },
        {
            file: "pancakes",
            title: "Buttermilk pancakes",
            subtitle: "Three-stack, maple, berries",
            description: "A short stack with butter and real maple. Berries when they look right.",
            body: "Batter rested 20 minutes. Three cakes, a knob of butter, maple from Quebec. Breakfast only — last stack at 11:30.",
            category: "Breakfast",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "BREAKFAST",
            priceCents: 32000,
            compareAtCents: 36000,
            sku: "BLU-PK",
            stock: null,
            shipMode: "NONE",
            allowCod: false,
            highlights: ["Last stack 11:30", "Real maple", "Dine-in"],
        },
        {
            file: "waffle",
            title: "Belgian waffle",
            subtitle: "Deep grid, berries, cream",
            description: "Ironed to order. Powdered sugar, strawberries, a pot of cream.",
            body: "Yeast batter, 24-hour ferment. Crisp outside, custard inside. Breakfast and lazy lunch.",
            category: "Breakfast",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "BREAKFAST",
            priceCents: 30000,
            sku: "BLU-WF",
            stock: null,
            shipMode: "NONE",
            allowCod: false,
            highlights: ["Ironed to order", "24-hour batter"],
        },
        {
            file: "sandwich",
            title: "Herb chicken sandwich",
            subtitle: "Grilled thigh, lettuce, tomato, aioli",
            description: "The one non-veg plate. Charred chicken thigh, soft country loaf, herb aioli.",
            body: "Thigh marinated in garlic, thyme, and lemon. Grilled, sliced, stacked. A little messy. Comes with pickle.",
            category: "Plates",
            diet: "NONVEG",
            spiceLevel: 1,
            serveWindow: "LUNCH",
            priceCents: 34000,
            sku: "BLU-SW",
            stock: null,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["Only chicken on the board", "Herb aioli", "Pickle on the side"],
            variants: [{ name: "As is" }, { name: "No aioli" }, { name: "Extra pickle" }],
        },
        {
            file: "salad",
            title: "Garden salad",
            subtitle: "Greens, cucumber, tomato, lemon",
            description: "Crisp leaves, cucumber, cherry tomato, toasted seeds, lemon-olive oil. Vegan.",
            body: "Leaves washed twice. Dressing on the side if you want it that way. A light lunch or a side to the sandwich.",
            category: "Plates",
            diet: "VEGAN",
            spiceLevel: 0,
            serveWindow: "LUNCH",
            priceCents: 26000,
            sku: "BLU-SL",
            stock: null,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["Vegan", "Dressing on the side", "Toasted seeds"],
        },
        {
            file: "cookie-chocolate",
            title: "Dark chocolate cookie",
            subtitle: "Sea salt, still warm at 4pm",
            description: "A thick cookie with 70% chocolate and flaky salt. We bake a four o'clock tray.",
            body: "Dough rests 48 hours. Baked to a soft centre. One is never enough; we will not judge two.",
            category: "Bakery",
            diet: "VEG",
            spiceLevel: 0,
            serveWindow: "ALL",
            priceCents: 9000,
            sku: "BLU-CK",
            stock: 40,
            shipMode: "PICKUP",
            allowCod: true,
            highlights: ["70% chocolate", "4pm tray", "Soft centre"],
        },
    ]

    for (const d of dishes) {
        const photo = asset(`${d.file}.jpg`)
        const created = await prisma.digitalProduct.create({
            data: {
                profileId: profile.id,
                title: d.title,
                subtitle: d.subtitle,
                description: d.description,
                body: d.body,
                type: "PHYSICAL",
                fulfillment: "PHYSICAL",
                thumbnailUrl: photo,
                galleryUrls: JSON.stringify([photo]),
                priceCents: d.priceCents,
                compareAtCents: d.compareAtCents ?? null,
                currency: "INR",
                category: d.category,
                diet: d.diet,
                spiceLevel: d.spiceLevel,
                serveWindow: d.serveWindow,
                sku: d.sku,
                stock: d.stock,
                shipMode: d.shipMode,
                shipFeeCents: 0,
                allowCod: d.allowCod,
                isActive: true,
                arModelUrl: asset(`${d.file}.glb`),
                highlights: JSON.stringify(d.highlights),
                variantsJson: d.variants ? JSON.stringify(d.variants) : null,
            },
        })
        await prisma.offerReview.createMany({
            data: [
                {
                    productId: created.id,
                    rating: 5,
                    visitorName: "Meera K.",
                    text: "Came for the latte, stayed for the smash. The AR plate is a nice trick for the kids.",
                    imageUrl: photo,
                },
                {
                    productId: created.id,
                    rating: 4,
                    visitorName: "Arun P.",
                    text: "Hill Road is loud; the garden six is the one to book. Food is clean and not too sweet.",
                    imageUrl: asset(`${d.file}.png`),
                },
            ],
        })
    }

    await prisma.profileDocument.createMany({
        data: [
            {
                profileId: profile.id,
                type: "BIO",
                title: "House notes",
                sourceType: "TEXT",
                rawText:
                    "SkyDine Cafe is on Hill Road, Bandra West. Open 8am to 9pm every day including Monday. Founder Maya Rao opened it in 2022 after a decade in hotel pastry. Twelve tables inside, a garden six at the back, takeaway from the side window. Vegetarian-first kitchen. One chicken sandwich. No pork, no alcohol, no delivery after 8:30pm. UPI at the counter. GSTIN 27AADCB4281F1Z3.",
            },
            {
                profileId: profile.id,
                type: "FAQ",
                title: "Reservations and takeaway",
                sourceType: "TEXT",
                rawText:
                    "Book a window two-top (75 min), a booth for four (90 min), or the garden six (2 hours). Weekend brunch fills by 10am. Walk-ins after 3pm on weekdays. Takeaway ready in about 12 minutes. High chairs on request. Strollers ok. Last kitchen ticket 8:30pm. Pancakes stop at 11:30am.",
            },
            {
                profileId: profile.id,
                type: "FAQ",
                title: "Menu and diet",
                sourceType: "TEXT",
                rawText:
                    "Coffee all day. Bakery from 8am. Breakfast plates till noon. Lunch plates from 12. Avocado smash and garden salad are vegan. Herb chicken sandwich is the only non-veg. Spice is mild; chilli is on the smash if you ask. Oat and almond milk for coffee. AR models sit on every dish — tap Place on table.",
            },
        ],
    })

    await prisma.workExperience.createMany({
        data: [
            {
                profileId: profile.id,
                company: "SkyDine Cafe",
                role: "Founder & pastry lead",
                startDate: "2022",
                endDate: null,
                description: "Opened the Hill Road room. Menu, roast, and the garden six.",
                achievements: JSON.stringify([
                    "Built a 12-table all-day cafe from a shuttered bakery",
                    "House blend roasted weekly in Vasai",
                    "Kept a vegetarian-first kitchen with one chicken plate",
                ]),
            },
            {
                profileId: profile.id,
                company: "The Sea Lounge",
                role: "Pastry sous",
                startDate: "2016",
                endDate: "2022",
                description: "Hotel pastry. Learned how a breakfast rush actually works.",
                achievements: JSON.stringify(["Ran morning pastry for 180 covers", "Set the laminated dough program"]),
            },
        ],
    })

    await prisma.project.create({
        data: {
            profileId: profile.id,
            title: "House blend",
            description: "A chocolate-orange espresso roasted in Vasai every Thursday. The latte and the frappe both run on it.",
            client: "SkyDine Cafe",
            year: "2024",
            imageUrl: asset("cup-coffee.jpg"),
        },
    })

    const start = new Date()
    start.setDate(start.getDate() + ((7 - start.getDay()) % 7 || 7))
    start.setHours(11, 0, 0, 0)
    const end = new Date(start)
    end.setHours(13, 0, 0, 0)
    await prisma.event.create({
        data: {
            profileId: profile.id,
            title: "Sunday cupping",
            description: "An hour with Maya on the house blend. Six seats. Coffee included, pastry extra.",
            eventType: "WORKSHOP",
            thumbnailUrl: asset("cup-coffee.jpg"),
            startTime: start,
            endTime: end,
            timezone: "Asia/Kolkata",
            location: "SkyDine Cafe, Hill Road, Bandra West",
            priceCents: 0,
            currency: "INR",
            isFree: true,
            maxAttendees: 6,
            isActive: true,
        },
    })

    await prisma.leadMagnet.create({
        data: {
            profileId: profile.id,
            title: "House blend tasting notes",
            description: "A one-pager on the Thursday roast — origin, grind, and how we pull it.",
            type: "DOWNLOAD",
            isActive: true,
        },
    })

    const taken = await prisma.shortLink.findUnique({ where: { code: "blu" } })
    await prisma.shortLink.create({
        data: {
            profileId: profile.id,
            code: taken ? `blu-${profile.id.slice(-4)}` : "blu",
            targetUrl: "/skydine-cafe",
            title: "SkyDine Cafe",
            isActive: true,
        },
    })

    const ready = await prisma.profile.findUnique({
        where: { id: profile.id },
        include: {
            digitalProducts: { select: { title: true, arModelUrl: true, diet: true, priceCents: true } },
            serviceOfferings: { select: { name: true, covers: true } },
        },
    })
    console.log(JSON.stringify({
        slug: SLUG,
        dishes: ready?.digitalProducts.length,
        tables: ready?.serviceOfferings,
        menu: ready?.digitalProducts,
    }, null, 2))
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

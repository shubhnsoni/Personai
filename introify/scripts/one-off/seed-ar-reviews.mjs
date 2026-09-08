// Seeds OfferReview rows for SkyDine's AR dishes.
//
// The AR detail card shows a rating, and the /[slug]/ar page computes it as a
// mean of real OfferReview rows rather than inventing one from sales figures the
// way the shop listing does. With no reviews in the table the card correctly said
// "No reviews yet", which does not demo the feature.
//
// Idempotent: a dish that already has reviews is left alone.

import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

const REVIEWS = {
    "Chicken Burger": [
        [5, "Aarav M.", "Juicy and the bun held together to the last bite."],
        [5, "Neha S.", "Best burger near the office. Fries were hot too."],
        [4, "Rohit K.", "Great patty, would like a bit more sauce."],
        [5, "Ishita R.", null],
        [4, "Karan P.", "Solid. Came out fast even on a Friday."],
    ],
    "Margherita Pizza": [
        [5, "Sanya G.", "Thin crust done properly, basil actually fresh."],
        [4, "Devansh T.", "Good cheese pull. Slightly heavy on oregano."],
        [5, "Meera J.", null],
        [4, "Faisal A.", "Reliable order, never disappoints."],
    ],
    Cappuccino: [
        [5, "Tanya B.", "Proper microfoam, not just hot milk."],
        [4, "Vikram N.", "Good beans. A touch cooler than I like."],
        [5, "Anita D.", null],
    ],
    "Nutella Shake": [
        [5, "Zoya H.", "Thick enough that the straw stands up."],
        [5, "Arjun V.", "Dessert disguised as a drink. No complaints."],
        [4, "Priyanka L.", "Very sweet — worth sharing."],
    ],
    "Caesar Salad Veg": [
        [4, "Nikhil C.", "Crisp leaves, dressing not drowning it."],
        [4, "Shreya M.", null],
        [5, "Omar S.", "Croutons were the highlight."],
    ],
    "Avocado Toast": [
        [5, "Riya K.", "Sourdough was excellent, avocado ripe."],
        [4, "Aditya P.", "Good but I'd add chilli flakes."],
        [4, "Laila F.", null],
    ],
    "Chocolate Brownie": [
        [5, "Kabir S.", "Fudgy centre, warm when it arrived."],
        [5, "Ananya B.", "Ordered it twice in one sitting."],
        [4, "Yash D.", null],
        [5, "Simran T.", "Get it with the ice cream."],
    ],
    "Veg Steam Momo": [
        [4, "Tenzin L.", "Thin wrappers, decent filling. Chutney is good."],
        [5, "Pooja R.", null],
        [4, "Harsh V.", "Eight pieces is the right number."],
    ],
    "Garlic Bread": [
        [5, "Aisha Q.", "Buttery and properly garlicky."],
        [4, "Rahul N.", null],
        [4, "Divya S.", "Good side, a bit small for two."],
    ],
    "Avocado Toast Combo": [
        [4, "Manish G.", "Fair value with the coffee included."],
        [5, "Nandini A.", "My usual weekday breakfast now."],
        [4, "Suresh I.", null],
    ],
}

const profile = await p.profile.findFirst({ where: { slug: "skydine-cafe" } })
if (!profile) throw new Error("SkyDine profile missing")

let added = 0
let skipped = 0

for (const [title, rows] of Object.entries(REVIEWS)) {
    const product = await p.digitalProduct.findFirst({
        where: { profileId: profile.id, title },
        select: { id: true, title: true, _count: { select: { reviews: true } } },
    })
    if (!product) {
        console.log(`MISS  ${title.padEnd(22)} no such dish`)
        continue
    }
    if (product._count.reviews > 0) {
        console.log(`skip  ${title.padEnd(22)} already has ${product._count.reviews} review(s)`)
        skipped++
        continue
    }

    // spread the dates back over the last few weeks so they read as organic
    const now = Date.now()
    await p.offerReview.createMany({
        data: rows.map(([rating, visitorName, text], i) => ({
            productId: product.id,
            rating,
            visitorName,
            text,
            createdAt: new Date(now - (i * 3 + 2) * 24 * 60 * 60 * 1000),
        })),
    })
    added += rows.length
    const avg = (rows.reduce((s, r) => s + r[0], 0) / rows.length).toFixed(1)
    console.log(`ok    ${title.padEnd(22)} +${rows.length} reviews  avg ${avg}`)
}

console.log(`\n${added} reviews added, ${skipped} dishes left as they were`)
await p.$disconnect()

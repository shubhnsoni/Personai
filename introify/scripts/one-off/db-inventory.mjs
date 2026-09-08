// What is in the local database that exists nowhere else.
//
// The code is on GitHub; the content is not. Every profile, menu item, review and
// conversation lives only in local Postgres — which is set to Manual start and has
// already stopped mid-session once. This prints what a lost volume would cost.
//
// Run: node --env-file=.env scripts/one-off/db-inventory.mjs

import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

const counts = {
    users: () => p.user.count(),
    profiles: () => p.profile.count(),
    digitalProducts: () => p.digitalProduct.count(),
    offerReviews: () => p.offerReview.count(),
    conversations: () => p.conversation.count(),
    messages: () => p.message.count(),
    visitorLeads: () => p.visitorLead.count(),
    bookings: () => p.booking.count(),
    payments: () => p.payment.count(),
    productPurchases: () => p.productPurchase.count(),
    courses: () => p.course.count(),
    events: () => p.event.count(),
    members: () => p.member.count(),
    profileDocuments: () => p.profileDocument.count(),
    welcomeAnimationPresets: () => p.welcomeAnimationPreset.count(),
}

let total = 0
for (const [name, fn] of Object.entries(counts)) {
    try {
        const n = await fn()
        total += n
        console.log(`${name.padEnd(24)} ${n}`)
    } catch (err) {
        console.log(`${name.padEnd(24)} n/a  ${String(err.message).split("\n")[0].slice(0, 50)}`)
    }
}
console.log(`${"".padEnd(24)} ----\n${"rows counted".padEnd(24)} ${total}`)

const profiles = await p.profile.findMany({
    select: {
        slug: true,
        roleTemplate: true,
        isPublic: true,
        _count: { select: { digitalProducts: true, conversations: true } },
    },
    orderBy: { createdAt: "asc" },
})

console.log(`\nprofiles (${profiles.length}):`)
for (const pr of profiles) {
    console.log(
        `  ${pr.slug.padEnd(20)} ${(pr.roleTemplate || "-").padEnd(12)}` +
            ` ${pr._count.digitalProducts.toString().padStart(3)} items` +
            ` ${pr._count.conversations.toString().padStart(3)} chats`,
    )
}

const ar = await p.digitalProduct.count({ where: { arModelUrl: { not: null } } })
console.log(`\ndishes with an AR model: ${ar}`)

await p.$disconnect()

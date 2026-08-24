const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
    const profile = await prisma.profile.findFirst({ where: { slug: "sylvie" } })
    if (!profile) return console.log("no sylvie")
    const [pays, products, courses, events, rooms, books] = await Promise.all([
        prisma.payment.findMany({ where: { profileId: profile.id } }),
        prisma.productPurchase.findMany({ where: { product: { profileId: profile.id } }, include: { product: true } }),
        prisma.courseEnrollment.findMany({ where: { course: { profileId: profile.id } }, include: { course: true } }),
        prisma.eventRegistration.findMany({ where: { event: { profileId: profile.id } }, include: { event: true } }),
        prisma.communityMember.findMany({ where: { community: { profileId: profile.id } }, include: { community: true } }),
        prisma.booking.findMany({ where: { profileId: profile.id }, include: { serviceOffering: true } }),
    ])
    console.log("PAYMENTS", pays.map((p) => ({ amount: p.amountCents, status: p.status, cur: p.currency })))
    console.log("PRODUCTS", products.map((p) => ({ email: p.visitorEmail, name: p.visitorName, title: p.product.title, price: p.product.priceCents, status: p.status })))
    console.log("COURSES", courses.map((e) => ({ email: e.visitorEmail, name: e.visitorName, title: e.course.title, price: e.course.priceCents, status: e.status })))
    console.log("EVENTS", events.map((e) => ({ email: e.visitorEmail, name: e.visitorName, title: e.event.title, price: e.event.priceCents, status: e.status })))
    console.log("ROOMS", rooms.map((m) => ({ email: m.visitorEmail, name: m.visitorName, title: m.community.name, price: m.community.priceCents, status: m.status })))
    console.log("BOOKINGS", books.map((b) => ({ email: b.visitorEmail, name: b.visitorName, title: b.serviceOffering.name, price: b.serviceOffering.priceCents, status: b.status })))
}

main().finally(() => prisma.$disconnect())

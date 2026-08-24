import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const profile = await prisma.profile.findUnique({ where: { slug: "sylvie" } })
    if (!profile) throw new Error("Sylvie profile not found")

    const pixel = await prisma.welcomeAnimationPreset.findFirst({
        where: { name: { in: ["8-Bit", "8-Bit Slime", "Bit Slime"] } },
    })
    const forest = await prisma.welcomeAnimationPreset.findFirst({ where: { name: "Forest" } })

    await prisma.profile.update({
        where: { id: profile.id },
        data: {
            displayName: "Sylvie Chen",
            headline: "Executive coach for first-time founders",
            bio: "I help operators become the kind of founder people want to follow. Ten years in product, six years coaching founders through first hires, first raise, and first real team. Based in Kolkata, working with founders worldwide.",
            roleTemplate: "COACH",
            primaryGoal: "BOOK_CALL",
            language: "en",
            timezone: "Asia/Kolkata",
            isPublic: true,
            showInDirectory: true,
            welcomeMessageOverride: "Ask about coaching or book a call.",
            contentDisplayMode: "POPUP",
            imageUrl: "/sylvie.jpg",
            chatAvatarMode: "ORB",
            personalityConfig: JSON.stringify({
                tone: "warm",
                responseLength: "medium",
                language: "en",
                customInstructions: "Speak like Sylvie: direct, kind, no fluff. Offer a fit call when someone is ready.",
            }),
            aiModel: "gpt-4o-mini",
            animationStyleId: pixel?.id || forest?.id || profile.animationStyleId,
        },
    })

    await prisma.workExperience.deleteMany({ where: { profileId: profile.id } })
    await prisma.workExperience.createMany({
        data: [
            {
                profileId: profile.id,
                company: "Founder Lab",
                role: "Founder & head coach",
                startDate: "2021",
                endDate: null,
                description: "1:1 and small-group coaching for first-time founders. Fit calls, 90-day sprints, and a private room.",
                achievements: JSON.stringify([
                    "Coached 80+ first-time founders through first hire or first raise",
                    "Ran 12 cohorts of the Founder Lab",
                    "Kept a 4.9/5 post-engagement score",
                ]),
            },
            {
                profileId: profile.id,
                company: "Northline",
                role: "Head of product",
                startDate: "2018",
                endDate: "2021",
                description: "Built the first self-serve product line and hired the product trio.",
                achievements: JSON.stringify([
                    "Shipped self-serve that became 40% of new revenue",
                    "Hired and managed a 6-person product team",
                ]),
            },
            {
                profileId: profile.id,
                company: "Atelier",
                role: "Product designer",
                startDate: "2014",
                endDate: "2018",
                description: "Design for early B2B tools. Learned how founders actually decide.",
                achievements: JSON.stringify([
                    "Shipped design for 4 early B2B products",
                    "Sat in founder sales calls to learn how buyers decide",
                ]),
            },
        ],
    })

    await prisma.project.deleteMany({ where: { profileId: profile.id } })
    await prisma.project.createMany({
        data: [
            {
                profileId: profile.id,
                title: "Founder Lab curriculum",
                description: "A 6-week path from messy idea to a weekly operating cadence.",
                client: "Founder Lab",
                year: "2024",
                link: "https://example.com/founder-lab",
            },
            {
                profileId: profile.id,
                title: "First-hire playbook",
                description: "Scorecards, interview loops, and the first 90 days for role #1.",
                client: "Independent",
                year: "2023",
            },
        ],
    })

    await prisma.booking.deleteMany({ where: { profileId: profile.id } })
    await prisma.payment.deleteMany({ where: { profileId: profile.id } })
    await prisma.serviceOffering.deleteMany({ where: { profileId: profile.id } })
    const fitCall = await prisma.serviceOffering.create({
        data: {
            profileId: profile.id,
            name: "Fit call",
            description: "25 minutes to see if coaching is the right next step.",
            priceCents: 0,
            isFree: true,
            durationMinutes: 25,
            isActive: true,
        },
    })
    await prisma.serviceOffering.create({
        data: {
            profileId: profile.id,
            name: "90-day sprint",
            description: "Weekly 50-minute sessions plus async notes for one quarter.",
            priceCents: 360000,
            isFree: false,
            durationMinutes: 50,
            isActive: true,
        },
    })

    await prisma.availabilitySchedule.deleteMany({ where: { profileId: profile.id } })
    await prisma.availabilitySchedule.createMany({
        data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            profileId: profile.id,
            dayOfWeek,
            startTime: "10:00",
            endTime: "17:00",
            isEnabled: true,
        })),
    })
    await prisma.availabilitySchedule.createMany({
        data: [0, 6].map((dayOfWeek) => ({
            profileId: profile.id,
            dayOfWeek,
            startTime: "10:00",
            endTime: "13:00",
            isEnabled: false,
        })),
    })

    await prisma.profileDocument.deleteMany({ where: { profileId: profile.id } })
    await prisma.profileDocument.createMany({
        data: [
            {
                profileId: profile.id,
                type: "BIO",
                title: "How Sylvie coaches",
                sourceType: "TEXT",
                rawText: "Sylvie works in 90-day sprints. She starts with a fit call, then weekly sessions. She is not a therapist and not a fractional CEO. She helps founders make the next hire, the next raise, or the next operating cadence.",
            },
            {
                profileId: profile.id,
                type: "FAQ",
                title: "Pricing FAQ",
                sourceType: "TEXT",
                rawText: "Fit call is free. The 90-day sprint is $3,600. The Founder Lab cohort is $1,200. The private room is $49/month.",
            },
            {
                profileId: profile.id,
                type: "FAQ",
                title: "Who Sylvie works with",
                sourceType: "TEXT",
                rawText: "First-time founders after first revenue or first hire. Usually operators who just became the CEO. Not a fit for idea-stage founders who have not talked to customers, or for teams larger than 25.",
            },
            {
                profileId: profile.id,
                type: "TEXT",
                title: "Founder Lab outline",
                sourceType: "TEXT",
                rawText: "Week 1 cadence. Week 2 scorecards. Week 3 first hire. Week 4 1:1s. Week 5 raise or no-raise. Week 6 operating review. Live office hours in week 3.",
            },
        ],
    })

    await prisma.digitalProduct.deleteMany({ where: { profileId: profile.id } })
    const workbook = await prisma.digitalProduct.create({
        data: {
            profileId: profile.id,
            title: "First 90 days workbook",
            description: "A PDF to plan your first hire, first raise, or first operating cadence.",
            subtitle: "Plan the quarter before you hire.",
            highlights: JSON.stringify(["90-day map", "Hire / raise / cadence tracks", "Printable PDF"]),
            type: "PDF",
            fileUrl: "/shop/first-90-days-workbook.pdf",
            thumbnailUrl: "/shop/first-90-days-workbook.png",
            priceCents: 2900,
            isActive: true,
        },
    })
    await prisma.digitalProduct.create({
        data: {
            profileId: profile.id,
            title: "Scorecard pack",
            description: "Printable hiring scorecards for operator, seller, and maker seats.",
            type: "PDF",
            fileUrl: "/shop/scorecard-pack.pdf",
            thumbnailUrl: "/shop/scorecard-pack.png",
            priceCents: 1900,
            isActive: true,
        },
    })
    await prisma.digitalProduct.create({
        data: {
            profileId: profile.id,
            title: "Office hours replay",
            subtitle: "Last live session, no slides.",
            description: "A recording of the last Founder Lab office hours.",
            type: "VIDEO",
            priceCents: 0,
            isActive: true,
        },
    })
    await prisma.digitalProduct.create({
        data: {
            profileId: profile.id,
            title: "Weekly stack voice note",
            subtitle: "12 minutes on cadence.",
            description: "Sylvie walks the weekly stack out loud.",
            type: "AUDIO",
            priceCents: 900,
            isActive: true,
        },
    })

    await prisma.course.deleteMany({ where: { profileId: profile.id } })
    const course = await prisma.course.create({
        data: {
            profileId: profile.id,
            title: "Founder Lab",
            description: "Six weeks to a weekly cadence you can keep.",
            subtitle: "From messy idea to a week you can repeat.",
            body: "A working founder course: cadence, scorecards, and the first hire. Built for operators who just became CEO.",
            outcomes: JSON.stringify([
                "Run a weekly stack you will actually keep",
                "Write a scorecard before you post a role",
                "Pick the first hire without wrecking the company",
            ]),
            level: "BEGINNER",
            compareAtCents: 180000,
            priceCents: 120000,
            isActive: true,
            isPublished: true,
            totalModules: 2,
            totalLessons: 4,
        },
    })
    const mod = await prisma.courseModule.create({
        data: {
            courseId: course.id,
            title: "Cadence",
            description: "What you actually do each week",
            orderIndex: 0,
        },
    })
    await prisma.courseLesson.createMany({
        data: [
            {
                moduleId: mod.id,
                title: "The weekly stack",
                description: "# After the video\n\nWrite your four standing blocks before Friday.\n\n1. Monday plan — 25 minutes\n2. Midweek review — 15 minutes\n3. Friday write-up — 20 minutes\n4. People loop — 30 minutes\n\nIf you cannot keep these four, drop a promise instead of adding a tool.",
                contentType: "VIDEO",
                contentUrl: null,
                durationMinutes: 12,
                orderIndex: 0,
                isFree: true,
            },
            {
                moduleId: mod.id,
                title: "Hiring scorecards",
                description: "Write the scorecard before the job post.",
                contentType: "TEXT",
                contentUrl: "# Hiring scorecards\n\nA scorecard has four parts: outcomes for the first 90 days, skills you can test, values you will not compromise, and a must-have vs nice-to-have split.\n\nDo not post the role until the scorecard is written. That is the whole lesson.",
                durationMinutes: 18,
                orderIndex: 1,
                isFree: false,
            },
        ],
    })
    const hireMod = await prisma.courseModule.create({
        data: {
            courseId: course.id,
            title: "The first hire",
            description: "Role #1 without wrecking the company",
            orderIndex: 1,
        },
    })
    await prisma.courseLesson.createMany({
        data: [
            {
                moduleId: hireMod.id,
                title: "Who to hire first",
                description: "Operator, seller, or maker — pick one.",
                contentType: "TEXT",
                contentUrl: "# Who to hire first\n\nHire the person who removes the work you are worst at, not the work you enjoy. If you are a builder, hire a seller or an operator. If you are a seller, hire a maker.\n\nWrite the 90-day outcomes first. Then write the scorecard.",
                durationMinutes: 14,
                orderIndex: 0,
                isFree: false,
            },
            {
                moduleId: hireMod.id,
                title: "The first 90 days",
                description: "A plan you can both see.",
                contentType: "TEXT",
                contentUrl: "# The first 90 days\n\nDay 1–30: learn the product and the buyer. Day 31–60: own one metric. Day 61–90: hire or document the next seat.\n\nMeet weekly. Write it down. Do not invent a new process mid-sprint.",
                durationMinutes: 16,
                orderIndex: 1,
                isFree: false,
            },
        ],
    })
    await prisma.course.update({
        where: { id: course.id },
        data: { totalModules: 2, totalLessons: 4 },
    })

    await prisma.event.deleteMany({ where: { profileId: profile.id } })
    const start = new Date()
    start.setDate(start.getDate() + 21)
    start.setHours(15, 0, 0, 0)
    await prisma.event.create({
        data: {
            profileId: profile.id,
            title: "Office hours: first hire",
            description: "Live workshop on scorecards and the first 90 days.",
            eventType: "WORKSHOP",
            startTime: start,
            endTime: new Date(start.getTime() + 90 * 60 * 1000),
            timezone: "Asia/Kolkata",
            meetingUrl: "https://example.com/meet/sylvie",
            priceCents: 0,
            isFree: true,
            isActive: true,
            maxAttendees: 40,
        },
    })

    await prisma.community.deleteMany({ where: { profileId: profile.id } })
    await prisma.community.create({
        data: {
            profileId: profile.id,
            name: "Founder room",
            description: "A small Telegram room for operators in a 90-day sprint.",
            platform: "TELEGRAM",
            inviteLink: "https://t.me/+sylvie-lab",
            priceCents: 4900,
            billingCycle: "MONTHLY",
            isActive: true,
            memberCount: 18,
        },
    })

    await prisma.leadMagnet.deleteMany({ where: { profileId: profile.id } })
    await prisma.leadMagnet.create({
        data: {
            profileId: profile.id,
            title: "Free: first-hire checklist",
            description: "A one-page checklist before you post the role.",
            type: "DOWNLOAD",
            fileUrl: "/shop/first-hire-checklist.pdf",
            formFields: JSON.stringify([
                { id: "email", label: "Email", type: "email", required: true },
                { id: "role", label: "What are you hiring for?", type: "text", required: false },
            ]),
            isActive: true,
        },
    })

    await prisma.shortLink.deleteMany({ where: { profileId: profile.id } })
    await prisma.shortLink.create({
        data: {
            profileId: profile.id,
            code: "sylvie-lab",
            targetUrl: "/sylvie",
            title: "Founder Lab",
            clicks: 42,
            isActive: true,
        },
    })

    await prisma.visitorLead.deleteMany({ where: { profileId: profile.id } })
    await prisma.visitorLead.create({
        data: {
            profileId: profile.id,
            name: "Amina Rao",
            email: "amina@example.com",
            company: "Northline",
            budgetRange: "$3–5k",
            status: "NEW",
        },
    })

    const soon = new Date()
    soon.setDate(soon.getDate() + 4)
    soon.setHours(11, 0, 0, 0)
    await prisma.booking.deleteMany({ where: { profileId: profile.id } })
    await prisma.booking.create({
        data: {
            profileId: profile.id,
            visitorName: "Amina Rao",
            visitorEmail: "amina@example.com",
            serviceOfferingId: fitCall.id,
            startTime: soon,
            endTime: new Date(soon.getTime() + 25 * 60 * 1000),
            status: "CONFIRMED",
        },
    })

    await prisma.payment.deleteMany({ where: { profileId: profile.id } })
    await prisma.payment.create({
        data: {
            profileId: profile.id,
            amountCents: 2900,
            currency: "USD",
            status: "SUCCEEDED",
        },
    })

    await prisma.productPurchase.create({
        data: {
            productId: workbook.id,
            visitorEmail: "amina@example.com",
            visitorName: "Amina Rao",
            status: "COMPLETED",
        },
    })

    await prisma.courseEnrollment.deleteMany({ where: { courseId: course.id } })
    await prisma.courseEnrollment.create({
        data: {
            courseId: course.id,
            visitorEmail: "amina@example.com",
            visitorName: "Amina Rao",
            status: "ACTIVE",
        },
    })

    const event = await prisma.event.findFirst({ where: { profileId: profile.id } })
    if (event) {
        await prisma.eventRegistration.deleteMany({ where: { eventId: event.id } })
        await prisma.eventRegistration.create({
            data: {
                eventId: event.id,
                visitorEmail: "amina@example.com",
                visitorName: "Amina Rao",
                status: "REGISTERED",
            },
        })
    }

    const community = await prisma.community.findFirst({ where: { profileId: profile.id } })
    if (community) {
        await prisma.communityMember.deleteMany({ where: { communityId: community.id } })
        await prisma.communityMember.create({
            data: {
                communityId: community.id,
                visitorEmail: "amina@example.com",
                visitorName: "Amina Rao",
                status: "ACTIVE",
            },
        })
    }

    const magnet = await prisma.leadMagnet.findFirst({ where: { profileId: profile.id } })
    if (magnet) {
        await prisma.leadMagnetSubmission.deleteMany({ where: { leadMagnetId: magnet.id } })
        await prisma.leadMagnetSubmission.create({
            data: {
                leadMagnetId: magnet.id,
                visitorEmail: "amina@example.com",
                visitorName: "Amina Rao",
                formData: JSON.stringify({ email: "amina@example.com", role: "First operator" }),
            },
        })
    }

    const member = await prisma.member.upsert({
        where: { email: "amina@example.com" },
        create: { email: "amina@example.com", name: "Amina Rao" },
        update: { name: "Amina Rao" },
    })
    await prisma.productPurchase.updateMany({
        where: { visitorEmail: "amina@example.com" },
        data: { memberId: member.id },
    })
    await prisma.courseEnrollment.updateMany({
        where: { visitorEmail: "amina@example.com" },
        data: { memberId: member.id },
    })
    await prisma.eventRegistration.updateMany({
        where: { visitorEmail: "amina@example.com" },
        data: { memberId: member.id },
    })
    await prisma.communityMember.updateMany({
        where: { visitorEmail: "amina@example.com" },
        data: { memberId: member.id },
    })
    await prisma.booking.updateMany({
        where: { visitorEmail: "amina@example.com" },
        data: { memberId: member.id },
    })

    console.log("Filled Sylvie profile", profile.id)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

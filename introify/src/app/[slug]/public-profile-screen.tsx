import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProfileView } from "@/components/profile/profile-view"
import { AdoptOwnedTryKit } from "@/components/profile/adopt-owned-try-kit"
import { configuredProfileAnimation, publicAnimationConfig } from "@/lib/profile-branding"
import { listShowcaseCreations } from "@/lib/creations"
import { guestChatExpertise, guestChatHasExpertiseChrome } from "@/lib/guest-chat-expertise"
import { syncUser } from "@/lib/auth-sync"

export async function PublicProfileScreen({
    slug,
    hotelRoom,
    stayToken,
    stayPhase,
}: {
    slug: string
    hotelRoom?: string | null
    stayToken?: string | null
    stayPhase?: "pre_arrival" | "during" | "checkout" | "after" | null
}) {
    if (slug === "en") notFound()

    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            user: true,
            animationStyle: true,
            serviceOfferings: {
                where: { isActive: true },
            },
            workExperiences: true,
            projects: true,
            digitalProducts: {
                where: { isActive: true },
            },
            courses: {
                where: { isActive: true, isPublished: true },
                include: {
                    modules: {
                        include: { lessons: true },
                    },
                },
            },
            events: {
                where: { isActive: true, startTime: { gte: new Date() } },
                orderBy: { startTime: "asc" },
            },
            communities: {
                where: { isActive: true },
            },
            leadMagnets: {
                where: { isActive: true },
            },
        },
    })

    if (!profile || !profile.isPublic) {
        notFound()
    }

    if (profile.roleTemplate === "RESTAURANT" && !profile.serviceOfferings.some((s) => (s as { kind?: string }).kind === "TABLE")) {
        const { ensureTableService } = await import("@/app/actions/bookings")
        const table = await ensureTableService(profile.id)
        profile.serviceOfferings = [table, ...profile.serviceOfferings]
    }

    const animationConfig = await publicAnimationConfig(profile.id, configuredProfileAnimation(profile))
    const colors = animationConfig.colors || ["#00D7FF", "#07104D"]
    const story = await import("@/app/actions/story").then((m) => m.publishedStoryForSlug(slug))

    const introductions = await prisma.profileIntroduction.findMany({
        where: { profileId: profile.id, status: "PUBLISHED" },
        select: { id: true, intent: true, text: true },
        orderBy: { createdAt: "asc" },
    })
    const showcase = await listShowcaseCreations(profile.id)
    const ownerOnTryKit = profile.slug.startsWith("try-")
        && Boolean((await syncUser())?.profiles.some((item) => item.slug === profile.slug))
    const showcaseLinks = showcase.length ? (
        <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">AIs on this page</div>
            {showcase.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/70 px-3 py-2">
                    <a href={`/${profile.slug}/ai/${item.slug}`} className="block">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.purpose || item.description}</div>
                        {item.allowVisitorChat ? <div className="text-xs">Ask this AI</div> : null}
                    </a>
                </div>
            ))}
        </div>
    ) : null
    const expertiseInput = {
        introductionCount: introductions.length,
        showcaseCount: showcase.length,
    }
    const chrome = guestChatExpertise(expertiseInput)
    const expertiseLinks = guestChatHasExpertiseChrome(expertiseInput) ? (
        <div className="space-y-2">
            {chrome.showIntroduction ? (
                <div className="text-sm text-muted-foreground">
                    {introductions[0]?.text}
                </div>
            ) : null}
            {chrome.showShowcase ? showcaseLinks : null}
        </div>
    ) : undefined

    return (
        <>
            {ownerOnTryKit ? <AdoptOwnedTryKit slug={profile.slug} /> : null}
            <ProfileView
                expertiseLinks={expertiseLinks}
                hotelRoom={hotelRoom || undefined}
                stayToken={stayToken || undefined}
                stayPhase={stayPhase || undefined}
                profile={{
                    ...profile,
                    hasStory: Boolean(story?.frames.length),
                    events: profile.events.map((event) => ({
                        ...event,
                        startTime: event.startTime.toISOString(),
                        endTime: event.endTime.toISOString(),
                    })),
                }}
                animationConfig={animationConfig}
                colors={colors}
            />
        </>
    )
}

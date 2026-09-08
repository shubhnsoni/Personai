import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { publishedStoryForSlug } from "@/app/actions/story"
import { StoryMagazine } from "@/components/profile/story-magazine"
import { hoursToday } from "@/lib/menu"
import { storyLabel } from "@/lib/story"
import { walkInFromConfig } from "@/lib/walk-in"
import { socialsFromConfig } from "@/lib/socials"

export const dynamic = "force-dynamic"

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const story = await publishedStoryForSlug(slug)
    if (!story || story.frames.length === 0) notFound()
    const { profile, frames } = story
    const hoursLabel = profile.availability.length ? hoursToday(profile.availability) : null
    return (
        <StoryMagazine
            slug={profile.slug}
            name={profile.displayName}
            headline={profile.headline}
            bio={profile.bio}
            role={profile.roleTemplate}
            logoUrl={profile.shopLogoUrl || profile.imageUrl}
            whatsapp={profile.whatsapp}
            frames={frames}
            walkIn={walkInFromConfig(profile.personalityConfig)}
            socials={socialsFromConfig(profile.personalityConfig)}
            personalityConfig={profile.personalityConfig}
            hoursLabel={hoursLabel}
        />
    )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const story = await publishedStoryForSlug(slug)
    if (!story) return { title: "Story" }
    const label = storyLabel(story.profile.roleTemplate)
    return {
        title: `${label.page} · ${story.profile.displayName}`,
        description: story.profile.headline || story.profile.bio || `${label.page} at ${story.profile.displayName}`,
        openGraph: {
            title: `${label.page} · ${story.profile.displayName}`,
            images: story.frames[0] ? [{ url: story.frames[0].url }] : undefined,
        },
    }
}

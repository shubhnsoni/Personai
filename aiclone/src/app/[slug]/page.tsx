import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProfileView } from "@/components/profile/profile-view"
import { Metadata } from "next"

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            user: true,
            animationStyle: true,
            serviceOfferings: true,
            workExperiences: true,
            projects: true,
        }
    })

    if (!profile || !profile.isPublic) {
        notFound()
    }

    let animationConfig: any = {}
    try {
        animationConfig = typeof profile.animationStyle?.config === 'string'
            ? JSON.parse(profile.animationStyle.config)
            : (profile.animationStyle?.config || {})
    } catch (e) {
        console.error("Failed to parse animation config", e)
    }
    const colors = animationConfig.colors || ["#A855F7", "#EC4899"]

    return (
        <ProfileView
            profile={profile}
            animationConfig={animationConfig}
            colors={colors}
        />
    )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, headline: true, bio: true }
    })

    if (!profile) {
        return {
            title: "Profile Not Found",
        }
    }

    return {
        title: `${profile.displayName} | PersonaLink`,
        description: profile.headline || profile.bio || "Check out my AI-powered profile.",
    }
}

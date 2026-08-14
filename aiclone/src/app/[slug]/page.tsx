import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProfileView } from "@/components/profile/profile-view"
import { Metadata } from "next"

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        include: {
            user: true,
            animationStyle: true,
            serviceOfferings: {
                where: { isActive: true }
            },
            workExperiences: true,
            projects: true,
            digitalProducts: {
                where: { isActive: true }
            },
            courses: {
                where: { isActive: true, isPublished: true },
                include: {
                    modules: {
                        include: { lessons: true }
                    }
                }
            },
            events: {
                where: { isActive: true, startTime: { gte: new Date() } },
                orderBy: { startTime: 'asc' }
            },
            communities: {
                where: { isActive: true }
            },
            leadMagnets: {
                where: { isActive: true }
            }
        }
    })

    if (!profile || !profile.isPublic) {
        notFound()
    }

    let animationConfig: { speed?: number; intensity?: number; colors?: string[] } = {}
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
            profile={profile as any}
            animationConfig={animationConfig}
            colors={colors}
        />
    )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const profile = await prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, headline: true, bio: true, slug: true }
    })

    if (!profile) {
        return {
            title: "Profile Not Found",
        }
    }

    const description = profile.headline || profile.bio || `Chat with ${profile.displayName}'s AI clone on PersonaLink.`
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const profileUrl = `${baseUrl}/${profile.slug}`

    return {
        title: `${profile.displayName} | PersonaLink`,
        description,
        openGraph: {
            title: `${profile.displayName} — PersonaLink`,
            description,
            url: profileUrl,
            siteName: "PersonaLink",
            type: "profile",
        },
        twitter: {
            card: "summary_large_image",
            title: `${profile.displayName} — PersonaLink`,
            description,
        },
        alternates: {
            canonical: profileUrl,
        },
    }
}

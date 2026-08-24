import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const alt = "PersonaLink profile"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const FALLBACK_NAME = "PersonaLink"
const FALLBACK_HEADLINE = "Your AI clone that sells, books & engages 24/7"

function clip(value: string, max: number) {
    const trimmed = value.trim()
    if (trimmed.length <= max) return trimmed
    return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    let displayName = FALLBACK_NAME
    let headline = FALLBACK_HEADLINE
    let handle = slug

    try {
        const profile = await prisma.profile.findUnique({
            where: { slug },
            select: { displayName: true, headline: true, slug: true, isPublic: true },
        })
        if (profile?.isPublic) {
            displayName = profile.displayName
            headline = profile.headline?.trim() || `Chat with ${profile.displayName}'s AI clone`
            handle = profile.slug
        }
    } catch {
        // Render the branded fallback if the database is unavailable.
    }

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0c0912",
                    color: "#f5f2f7",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        width: 560,
                        height: 560,
                        top: -40,
                        borderRadius: 9999,
                        background: "radial-gradient(circle, rgba(168,85,247,0.42) 0%, rgba(236,72,153,0.16) 42%, transparent 70%)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        width: 420,
                        height: 420,
                        bottom: -80,
                        right: -40,
                        borderRadius: 9999,
                        background: "radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 68%)",
                    }}
                />

                <div
                    style={{
                        width: 148,
                        height: 148,
                        borderRadius: 9999,
                        background: "linear-gradient(135deg, #52E8FF 0%, #1A4DFF 100%)",
                        boxShadow: "0 0 90px rgba(82,232,255,0.45)",
                        display: "flex",
                    }}
                />

                <div
                    style={{
                        marginTop: 40,
                        fontSize: 64,
                        fontWeight: 700,
                        letterSpacing: -1.6,
                        lineHeight: 1.05,
                        display: "flex",
                    }}
                >
                    {clip(displayName, 36)}
                </div>
                <div
                    style={{
                        marginTop: 16,
                        fontSize: 28,
                        color: "#b4aebb",
                        display: "flex",
                        textAlign: "center",
                        maxWidth: 880,
                    }}
                >
                    {clip(headline, 90)}
                </div>

                <div
                    style={{
                        position: "absolute",
                        bottom: 42,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: "#C084FC",
                            display: "flex",
                        }}
                    >
                        PersonaLink
                    </div>
                    <div
                        style={{
                            marginLeft: 14,
                            fontSize: 20,
                            color: "#6b6573",
                            display: "flex",
                        }}
                    >
                        {`personalink.com/${handle}`}
                    </div>
                </div>
            </div>
        ),
        { ...size }
    )
}

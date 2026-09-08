"use client"
import { useId, useRef, useState } from "react"
import Link from "next/link"
import {
    ArrowUpRight,
    Check,
    Coffee,
    Layers3,
    MessageCircle,
    Palette,
    ShoppingBag,
    Sparkles,
    Users,
} from "lucide-react"

const audiences = [
    {
        name: "Creators",
        icon: Palette,
        eyebrow: "FOR PEOPLE WHO MAKE THINGS",
        title: "Your ideas deserve more than a scroll.",
        description:
            "Give your audience a place to explore your work, discover a digital guide or find your next workshop. Let a passing interest become a deeper connection.",
        items: [
            "A profile that tells your story",
            "Digital products, courses and events",
            "Your most important links, together",
        ],
        label: "Build your creative home",
        preview: "The next thing you’ll love making.",
        offerings: [
            {
                title: "The creative field guide",
                note: "Digital product",
                icon: Layers3,
            },
            { title: "A hands-on workshop", note: "Event", icon: Sparkles },
        ],
        color: "peach",
    },
    {
        name: "Consultants & coaches",
        icon: Users,
        eyebrow: "FOR PEOPLE WHO SHARE EXPERTISE",
        title: "Make the right introduction before the first call.",
        description:
            "Explain who you help, show the experience behind your work and make your services easy to understand. Give prospective clients a clear route to a conversation.",
        items: [
            "Experience and services in one place",
            "Available slots for consultations",
            "Lead notes and follow-up management",
        ],
        label: "Introduce your expertise",
        preview: "Fresh perspective. Clear next steps.",
        offerings: [
            {
                title: "An introductory conversation",
                note: "Consultation",
                icon: MessageCircle,
            },
            {
                title: "A focused strategy session",
                note: "Service",
                icon: Users,
            },
        ],
        color: "blue",
    },
    {
        name: "Local businesses",
        icon: Coffee,
        eyebrow: "FOR PEOPLE WHO BUILD COMMUNITY",
        title: "A local favorite. An easier way to find you.",
        description:
            "Put the details customers look for in one place. Share your products, present your menu or make room for a reservation—then bring your page to your counter with a QR card.",
        items: [
            "Product catalogs and restaurant menus",
            "Service bookings and reservations",
            "A shareable link and QR card",
        ],
        label: "Give your business a home",
        preview: "Something good, around the corner.",
        offerings: [
            {
                title: "Explore the collection",
                note: "Product catalog",
                icon: ShoppingBag,
            },
            {
                title: "A seat at your favorite table",
                note: "Reservation",
                icon: Coffee,
            },
        ],
        color: "green",
    },
] as const

export function AudienceExplorer() {
    const [active, setActive] = useState(0)
    const id = useId()
    const tabs = useRef<Array<HTMLButtonElement | null>>([])
    const audience = audiences[active]
    return (
        <div className="mk-audience-explorer">
            <div
                role="tablist"
                aria-label="Find Introify for your work"
                className="mk-audience-tabs"
            >
                {audiences.map((item, index) => (
                    <button
                        key={item.name}
                        ref={(el) => {
                            tabs.current[index] = el
                        }}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${index}`}
                        aria-controls={`${id}-panel`}
                        aria-selected={active === index}
                        tabIndex={active === index ? 0 : -1}
                        onClick={() => setActive(index)}
                        onKeyDown={(event) => {
                            let next = index
                            if (event.key === "ArrowRight")
                                next = (index + 1) % audiences.length
                            else if (event.key === "ArrowLeft")
                                next =
                                    (index + audiences.length - 1) %
                                    audiences.length
                            else if (event.key === "Home") next = 0
                            else if (event.key === "End")
                                next = audiences.length - 1
                            else return
                            event.preventDefault()
                            setActive(next)
                            tabs.current[next]?.focus()
                        }}
                    >
                        <item.icon size={18} />
                        {item.name}
                        <ArrowUpRight size={17} />
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-tab-${active}`}
                tabIndex={0}
                className={`mk-audience-panel mk-audience-${audience.color}`}
            >
                <div className="mk-audience-copy">
                    <span className="mk-eyebrow">{audience.eyebrow}</span>
                    <h3>{audience.title}</h3>
                    <p>{audience.description}</p>
                    <ul>
                        {audience.items.map((item) => (
                            <li key={item}>
                                <Check size={16} />
                                {item}
                            </li>
                        ))}
                    </ul>
                    <Link href="/sign-up" className="mk-text-link">
                        {audience.label}
                        <ArrowUpRight size={17} />
                    </Link>
                </div>
                <div className="mk-audience-preview">
                    <span className="mk-audience-asterisk" aria-hidden="true">
                        ✳
                    </span>
                    <span className="mk-small-label">
                        YOUR WORK, WITH ROOM TO GROW
                    </span>
                    <h4>{audience.preview}</h4>
                    {audience.offerings.map((offering) => (
                        <div className="mk-offering" key={offering.title}>
                            <span>
                                <offering.icon size={21} />
                            </span>
                            <div>
                                <strong>{offering.title}</strong>
                                <span>{offering.note}</span>
                            </div>
                            <ArrowUpRight size={17} />
                        </div>
                    ))}
                    <span className="mk-art-label">ILLUSTRATIVE EXAMPLE</span>
                </div>
            </div>
        </div>
    )
}

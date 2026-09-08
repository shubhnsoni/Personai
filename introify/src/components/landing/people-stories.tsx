import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Coffee, Palette, Plus, Users } from "lucide-react"
import "./people-stories.css"

const stories = [
    {
        name: "Mira",
        role: "The independent maker",
        icon: Palette,
        image: "/marketing/ceramic-artist.png",
        alt: "Illustrative portrait of Mira, a ceramic artist in her pottery studio",
        imageClass: "mk-story-portrait-mira",
        title: "A little clay. A lot of possibility.",
        story: "Mira’s day starts at the pottery wheel. Between making a new collection and planning a workshop, she needs a simple place to introduce both sides of her creative practice.",
        next: "Her example page gives a curious visitor a place to explore the ceramics, learn about her process and discover a workshop.",
        tools: [
            "A story and a product collection",
            "Workshop listings with the practical details",
            "One link to share from her social bio",
        ],
        cta: "Make a home for your craft",
    },
    {
        name: "Arjun",
        role: "The independent consultant",
        icon: Users,
        image: "/marketing/design-consultant.png",
        alt: "Illustrative portrait of Arjun, an independent consultant at his studio desk",
        imageClass: "mk-story-portrait-arjun",
        title: "Good conversations start with context.",
        story: "A potential client arrives with a big idea and a few questions. Arjun wants them to understand his approach before they make time for a conversation.",
        next: "His example page puts his experience, services and booking options together. A visitor can see what fits and choose a clear next step.",
        tools: [
            "Experience and a focused introduction",
            "Clearly described consulting services",
            "Available consultation slots",
        ],
        cta: "Introduce your expertise",
    },
    {
        name: "Leela",
        role: "The neighborhood café owner",
        icon: Coffee,
        image: "/marketing/cafe-owner.png",
        alt: "Illustrative portrait of Leela, a café owner welcoming visitors at her counter",
        imageClass: "mk-story-portrait-leela",
        title: "A familiar face. A new way to find her.",
        story: "Leela knows her regulars by their coffee orders. For someone discovering the café for the first time, she wants the menu and reservation information to be just as easy to find.",
        next: "Her example page brings those details together. A QR card at the counter gives visitors a link they can keep and share with a friend.",
        tools: [
            "A menu customers can browse",
            "Reservation details in one place",
            "A QR card for the counter",
        ],
        cta: "Bring your business closer",
    },
] as const

export function PeopleStories() {
    return (
        <section
            className="mk-people-section"
            id="stories"
            aria-labelledby="mk-stories-title"
        >
            <div className="mk-container">
                <div className="mk-section-heading">
                    <div>
                        <span className="mk-eyebrow">
                            MANY WAYS TO MAKE IT YOURS
                        </span>
                        <h2 id="mk-stories-title">
                            Behind every page,
                            <br />
                            <em>there’s a person.</em>
                        </h2>
                    </div>
                    <p>
                        Three imagined businesses. Three different workdays. A
                        few ways Introify can help people introduce what they
                        do.
                    </p>
                </div>
                <p className="mk-stories-disclosure">
                    Illustrative stories and generated portraits—not customer
                    testimonials.
                </p>
                <div className="mk-stories-grid">
                    {stories.map((story, index) => (
                        <article className="mk-story" key={story.name}>
                            <div
                                className={`mk-story-photo ${story.imageClass}`}
                            >
                                <Image
                                    src={story.image}
                                    alt={story.alt}
                                    fill
                                    sizes="(max-width: 650px) calc(100vw - 40px), (max-width: 900px) calc((100vw - 82px) / 2), (max-width: 1336px) calc((100vw - 144px) / 3), 397px"
                                />
                                <span className="mk-story-photo-label">
                                    EXAMPLE STORY / 0{index + 1}
                                </span>
                            </div>
                            <div className="mk-story-content">
                                <div className="mk-story-person">
                                    <span>
                                        <story.icon size={16} />
                                    </span>
                                    <div>
                                        <strong>{story.name}</strong>
                                        <span>{story.role}</span>
                                    </div>
                                </div>
                                <h3>{story.title}</h3>
                                <p>{story.story}</p>
                                <details className="mk-story-details">
                                    <summary>
                                        Inside this example{" "}
                                        <Plus size={16} aria-hidden="true" />
                                    </summary>
                                    <div>
                                        <p>{story.next}</p>
                                        <ul>
                                            {story.tools.map((tool) => (
                                                <li key={tool}>{tool}</li>
                                            ))}
                                        </ul>
                                        <Link
                                            href="/sign-up"
                                            className="mk-text-link"
                                        >
                                            {story.cta}
                                            <ArrowUpRight size={16} />
                                        </Link>
                                    </div>
                                </details>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}

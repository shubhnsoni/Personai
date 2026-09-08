"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { LandingAuthCta, LandingAuthLinks } from "@/components/landing/landing-auth"
import { WelcomeOrb } from "@/components/welcome-orb"
import { ORB_VARIANTS, type OrbVariantId } from "@/lib/orb-variants"
import "./landing.css"

const SCRIPT = [
    { who: "ai" as const, text: "Riley is away. I can still help." },
    { who: "you" as const, text: "Can she design a brand?" },
    { who: "card" as const, title: "Brand Strategy", meta: "₹45,000+ · 2–3 weeks" },
    { who: "you" as const, text: "Tuesday?" },
    { who: "card" as const, title: "Tuesday 11:00", meta: "Held on her calendar" },
]

const TILES = [
    { name: "AI Chat", copy: "Answers in your voice, any hour.", wide: true, variant: "aqua" as const },
    { name: "Booking", copy: "Qualify, then hold the slot.", wide: false, variant: "ember" as const },
    { name: "Products", copy: "Sell what you make.", wide: false, variant: "violet" as const },
    { name: "Courses", copy: "Turn knowledge into a class.", wide: false, variant: "forest" as const },
    { name: "Events", copy: "Hosts and waitlists.", wide: false, variant: "sunrise" as const },
    { name: "Community", copy: "A room that stays open.", wide: false, variant: "ice" as const },
    { name: "Lead magnets", copy: "Capture the visit.", wide: false, variant: "aqua" as const },
    { name: "Short links", copy: "One URL, everywhere.", wide: false, variant: "ember" as const },
    { name: "Train it", copy: "Files, FAQs, links.", wide: false, variant: "violet" as const },
    { name: "Analytics", copy: "Who came. What converted.", wide: false, variant: "forest" as const },
    { name: "Payments", copy: "UPI, cards, payouts.", wide: true, variant: "sunrise" as const },
] as const

const STEPS = [
    { n: "01", title: "Create your page", body: "Name, photo, and an orb. The page exists.", variant: "aqua" as const },
    { n: "02", title: "Train your AI", body: "Links, docs, products, calendar. It gets brighter.", variant: "ember" as const },
    { n: "03", title: "Go live & share", body: "personal.link/you — then leads, meetings, sales.", variant: "violet" as const },
] as const

const STATS = [
    ["24/7", "Always on"],
    ["10x", "More chats"],
    ["+40%", "More paid work"],
] as const

export function HomeLanding() {
    const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null)
    const [variant, setVariant] = useState<OrbVariantId>("aqua")
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState(1)
    const [tab, setTab] = useState<"chat" | "book" | "sell">("chat")
    const [tile, setTile] = useState(0)
    const [react, setReact] = useState(0)
    const phoneRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const move = (e: PointerEvent) => {
            setGaze({
                x: (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1,
                y: -((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1),
            })
        }
        const leave = () => setGaze(null)
        window.addEventListener("pointermove", move, { passive: true })
        window.addEventListener("pointerleave", leave)
        return () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerleave", leave)
        }
    }, [])

    useEffect(() => {
        if (!open) return
        const id = window.setInterval(() => setStep((s) => Math.min(SCRIPT.length, s + 1)), 1400)
        return () => window.clearInterval(id)
    }, [open])

    const talk = () => {
        setTab("chat")
        setOpen(true)
        setStep(1)
        setReact((n) => n + 1)
        phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    return (
        <div className="ln-page">
            <nav className="ln-nav">
                <Logo />
                <div className="ln-nav-side">
                    <a href="#product" className="ln-hide-sm">Product</a>
                    <Link href="/demo" className="ln-hide-xs">Demo</Link>
                    <LandingAuthLinks />
                </div>
                <LandingAuthCta />
            </nav>

            <div className="ln-board">
                <section className="ln-col ln-hero">
                    <p className="ln-kicker">Personal / AI</p>
                    <h1>
                        Your AI that talks, books, and sells
                        <br />
                        while you’re offline.
                    </h1>
                    <p className="ln-lede">
                        One page that talks like you, books meetings, and sells — even at 2 AM.
                    </p>

                    <div className="ln-well">
                        <button type="button" className="ln-orb-hit" onClick={talk} aria-label="Talk to Riley">
                            <WelcomeOrb
                                size={220}
                                variant={variant}
                                speed={0.9}
                                intensity={1.15}
                                gaze={gaze}
                                mood={open ? "speaking" : "idle"}
                                reactToken={react}
                            />
                        </button>
                        <p className="ln-hand">Ready when you are</p>
                    </div>

                    <div className="ln-swatches" role="radiogroup" aria-label="Choose an orb">
                        {ORB_VARIANTS.map((orb) => (
                            <button
                                key={orb.id}
                                type="button"
                                role="radio"
                                aria-checked={variant === orb.id}
                                aria-label={orb.name}
                                className={variant === orb.id ? "ln-swatch is-on" : "ln-swatch"}
                                onClick={() => setVariant(orb.id)}
                            >
                                <WelcomeOrb size={38} variant={orb.id} speed={0.7} still />
                            </button>
                        ))}
                    </div>

                    <div className="ln-row">
                        <Link href="/sign-up" className="ln-btn ln-fill">Create your page</Link>
                        <button type="button" className="ln-btn ln-ghost" onClick={talk}>
                            Talk to Riley
                        </button>
                    </div>

                    <ul className="ln-stats">
                        {STATS.map(([n, l]) => (
                            <li key={n}>
                                <b>{n}</b>
                                <span>{l}</span>
                            </li>
                        ))}
                    </ul>

                    <p className="ln-caption">Same knowledge. More possibilities.</p>
                </section>

                <section className="ln-col ln-product" id="product" ref={phoneRef}>
                    <p className="ln-kicker">Product in action</p>
                    <h2>Meet Riley. Your AI, on your page.</h2>
                    <p className="ln-note">Live conversations. Real answers. Real results.</p>

                    <div className="ln-phone">
                        <div className="ln-phone-top">
                            <WelcomeOrb
                                size={36}
                                variant={variant}
                                mood={open ? "speaking" : "greeting"}
                                gaze={gaze}
                            />
                            <div>
                                <strong>Riley Vale</strong>
                                <span>personal.link/demo · available</span>
                            </div>
                        </div>

                        <div className="ln-tabs" role="tablist">
                            {(["chat", "book", "sell"] as const).map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === id}
                                    className={tab === id ? "is-on" : undefined}
                                    onClick={() => setTab(id)}
                                >
                                    {id === "chat" ? "Chat" : id === "book" ? "Book" : "Sell"}
                                </button>
                            ))}
                        </div>

                        {tab === "chat" ? (
                            <div className="ln-thread">
                                {(open ? SCRIPT.slice(0, step) : SCRIPT.slice(0, 1)).map((m, i) =>
                                    m.who === "card" ? (
                                        <div key={i} className="ln-sheet">
                                            <strong>{m.title}</strong>
                                            <span>{m.meta}</span>
                                        </div>
                                    ) : (
                                        <p key={i} className={m.who === "ai" ? "ln-bubble ln-ai" : "ln-bubble ln-me"}>
                                            {m.text}
                                        </p>
                                    ),
                                )}
                                {!open ? (
                                    <button type="button" className="ln-play" onClick={talk}>
                                        Play a visitor conversation
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {tab === "book" ? (
                            <div className="ln-thread">
                                <p className="ln-bubble ln-ai">Wednesday still has a 4:30. Want me to hold it?</p>
                                <div className="ln-sheet">
                                    <strong>Wednesday 4:30 PM</strong>
                                    <span>Held · 30 min</span>
                                </div>
                            </div>
                        ) : null}

                        {tab === "sell" ? (
                            <div className="ln-thread">
                                <div className="ln-sheet">
                                    <strong>Brand Strategy</strong>
                                    <span>₹45,000+</span>
                                </div>
                                <div className="ln-sheet">
                                    <strong>Product Design Sprint</strong>
                                    <span>₹32,000 · 2 weeks</span>
                                </div>
                            </div>
                        ) : null}

                        <Link href="/demo" className="ln-more">Open Riley’s live page →</Link>
                    </div>

                    <blockquote className="ln-quote">
                        Riley feels like me — but available 24/7. It’s a game change for my business.
                    </blockquote>
                </section>

                <section className="ln-col ln-eco">
                    <p className="ln-kicker">Everything you need</p>
                    <h2>A complete ecosystem, around you.</h2>
                    <p className="ln-note">Your knowledge into conversations, customers, and continuity — on one page.</p>

                    <div className="ln-bento">
                        {TILES.map((item, i) => (
                            <button
                                key={item.name}
                                type="button"
                                className={`ln-tile${item.wide ? " is-wide" : ""}${tile === i ? " is-on" : ""}`}
                                onClick={() => setTile(i)}
                            >
                                <i className={`ln-pip is-${item.variant}`} />
                                <b>{item.name}</b>
                                <em>{item.copy}</em>
                            </button>
                        ))}
                    </div>

                    <div className="ln-leverage">
                        <WelcomeOrb size={120} variant={variant} gaze={gaze} mood="idle" />
                        <p>More than a tool. It’s your leverage.</p>
                    </div>
                </section>

                <section className="ln-col ln-start">
                    <p className="ln-kicker">Get started</p>
                    <h2>Clone the busy work. Keep what matters.</h2>
                    <p className="ln-note">Go live in minutes. A lifetime of leverage.</p>

                    <ol className="ln-steps">
                        {STEPS.map((s) => (
                            <li key={s.n}>
                                <WelcomeOrb size={56} variant={s.variant} speed={0.75} still />
                                <div>
                                    <p className="ln-n">{s.n} / {s.title}</p>
                                    <p>{s.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="ln-price">
                        <p className="ln-kicker">Early access</p>
                        <h3>Free while we build.</h3>
                        <p>Be an early creator and get full access while we’re in growth mode. No credit card.</p>
                        <ul>
                            <li>Unlimited visitor chats</li>
                            <li>Bookings + payments</li>
                            <li>Products, courses, events</li>
                            <li>Analytics and inbox</li>
                        </ul>
                        <Link href="/sign-up" className="ln-btn ln-fill">Create your page</Link>
                        <Link href="/demo" className="ln-text">See the live demo →</Link>
                    </div>

                    <div className="ln-close">
                        <WelcomeOrb size={96} variant={variant} gaze={gaze} mood="greeting" />
                        <p className="ln-kicker">There should be two of you.</p>
                        <p className="ln-end-line">One living. One working.</p>
                    </div>
                </section>
            </div>

            <footer className="ln-foot">
                <Logo href={null} />
                <span>© {new Date().getFullYear()} Introify</span>
            </footer>
        </div>
    )
}

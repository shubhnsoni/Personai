"use client"

import { useId, useRef, useState } from "react"
import { ArrowRight, Coffee, CornerDownRight, Palette, RotateCcw, Users } from "lucide-react"
import "./chat-showcase.css"

const scenarios = [
    {
        label: "Creator workshop",
        icon: Palette,
        description: "Turn curiosity into a little creative courage.",
        profile: "Studio Notes",
        initials: "sn",
        category: "Creative workshops",
        takeaway: "Help someone understand the experience before they explore an event.",
        exchanges: [
            {
                visitor: "I love your sketches, but I’ve never drawn before. Is this workshop for me?",
                assistant: "Absolutely. Sketchbook Sunday starts with simple shapes and everyday objects. It’s a relaxed introduction, so you don’t need any drawing experience.",
            },
            {
                visitor: "Do I need to buy lots of materials?",
                assistant: "A pencil, an eraser and a few sheets of paper are enough to get started. Bring a sketchbook if you already have one—no special kit needed.",
            },
            {
                visitor: "That sounds like my kind of Sunday. Where can I find the details?",
                assistant: "The workshop listing brings together the format, date and joining details. Check those details and any price shown before deciding whether to join.",
            },
        ],
    },
    {
        label: "Service consultation",
        icon: Users,
        description: "Make a first conversation feel less like a cold start.",
        profile: "Arjun Studio",
        initials: "as",
        category: "Brand strategy",
        takeaway: "Give a prospective client enough context to choose a useful next step.",
        exchanges: [
            {
                visitor: "I’m opening a small bakery. Can you help me with the brand?",
                assistant: "Arjun Studio works with small businesses on brand direction, messaging and visual identity. A first conversation can help you work out which parts you need for your launch.",
            },
            {
                visitor: "What should I prepare for that conversation?",
                assistant: "Bring a short description of the bakery, who you hope to reach and your target opening date. A few references you like can also help explain the feeling you’re after.",
            },
            {
                visitor: "How do I take the next step?",
                assistant: "Open the consultation details to review the session format and any available slots. You can check the terms there before submitting a booking request.",
            },
        ],
    },
    {
        label: "Local café",
        icon: Coffee,
        description: "Answer the small questions behind a good visit.",
        profile: "Corner Table",
        initials: "ct",
        category: "Neighbourhood café",
        takeaway: "Make the menu easier to explore and point people toward the business for details.",
        exchanges: [
            {
                visitor: "I’m meeting a friend for lunch. Do you have vegetarian options?",
                assistant: "The menu includes a roasted vegetable sandwich and a seasonal salad. You can explore the menu for descriptions and prices before planning your visit.",
            },
            {
                visitor: "My friend has a nut allergy. Is the salad suitable?",
                assistant: "Please check directly with the café about ingredients and cross-contact before ordering. A menu description can’t confirm that a dish is safe for an allergy.",
            },
            {
                visitor: "Can we ask about a table for two?",
                assistant: "Use the café’s reservation or contact option to check your preferred time. The café will need to confirm availability; this conversation doesn’t reserve a table.",
            },
        ],
    },
] as const

export function ChatShowcase() {
    const id = useId()
    const tabs = useRef<Array<HTMLButtonElement | null>>([])
    const [active, setActive] = useState(0)
    const [step, setStep] = useState(0)
    const scenario = scenarios[active]
    const exchange = scenario.exchanges[step]
    const finished = step === scenario.exchanges.length - 1

    function selectScenario(index: number) {
        setActive(index)
        setStep(0)
    }

    return (
        <section id="conversations" className="mk-section mk-chat-section" aria-labelledby={`${id}-heading`}>
            <div className="mk-container">
                <div className="mk-section-heading mk-chat-heading">
                    <div>
                        <span className="mk-eyebrow">A LITTLE CONTEXT GOES A LONG WAY</span>
                        <h2 id={`${id}-heading`}>Good introductions<br /> start <em>conversations.</em></h2>
                    </div>
                    <p>Explore how an assistant could help visitors understand your work. These are scripted, illustrative examples. AI chat is not currently active.</p>
                </div>

                <div className="mk-chat-layout">
                    <div className="mk-chat-scenarios">
                        <span className="mk-chat-label">CHOOSE A CONVERSATION</span>
                        <div role="tablist" aria-label="Example conversation" aria-orientation="vertical" className="mk-chat-tabs">
                            {scenarios.map((item, index) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    role="tab"
                                    id={`${id}-tab-${index}`}
                                    aria-label={item.label}
                                    aria-describedby={`${id}-description-${index}`}
                                    aria-controls={`${id}-panel`}
                                    aria-selected={active === index}
                                    tabIndex={active === index ? 0 : -1}
                                    ref={(element) => { tabs.current[index] = element }}
                                    onClick={() => selectScenario(index)}
                                    onKeyDown={(event) => {
                                        let next = index
                                        if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % scenarios.length
                                        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index + scenarios.length - 1) % scenarios.length
                                        else if (event.key === "Home") next = 0
                                        else if (event.key === "End") next = scenarios.length - 1
                                        else return
                                        event.preventDefault()
                                        selectScenario(next)
                                        tabs.current[next]?.focus()
                                    }}
                                >
                                    <span className="mk-chat-tab-icon"><item.icon size={21} aria-hidden="true" /></span>
                                    <span className="mk-chat-tab-copy"><strong>{item.label}</strong><span id={`${id}-description-${index}`}>{item.description}</span></span>
                                    <ArrowRight size={18} aria-hidden="true" className="mk-chat-tab-arrow" />
                                </button>
                            ))}
                        </div>
                        <div className="mk-chat-aside">
                            <CornerDownRight size={22} aria-hidden="true" />
                            <p>Your story gives a conversation its starting point.</p>
                        </div>
                    </div>

                    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} className="mk-chat-panel">
                        <div className="mk-chat-profile">
                            <span className="mk-chat-monogram" aria-hidden="true">{scenario.initials}<span>✳</span></span>
                            <div className="mk-chat-profile-copy"><h3>{scenario.profile}</h3><span>{scenario.category} · Fictional profile</span></div>
                            <span className="mk-chat-script-badge">SCRIPTED PREVIEW</span>
                        </div>
                        <div className="mk-chat-body">
                            <p className="mk-chat-context">{scenario.takeaway}</p>
                            <div className="mk-chat-exchange" aria-live="polite" aria-atomic="true">
                                <div className="mk-chat-message mk-chat-visitor">
                                    <span className="mk-chat-speaker">Visitor</span>
                                    <p>{exchange.visitor}</p>
                                </div>
                                <div className="mk-chat-message mk-chat-assistant">
                                    <span className="mk-chat-speaker"><span aria-hidden="true">✳</span> Example assistant</span>
                                    <p>{exchange.assistant}</p>
                                </div>
                            </div>
                            <div className="mk-chat-progress" aria-label={`Exchange ${step + 1} of ${scenario.exchanges.length}`}>
                                <span className="mk-chat-progress-dots" aria-hidden="true">{scenario.exchanges.map((_, index) => <span key={index} className={index <= step ? "is-shown" : ""} />)}</span>
                                <span>Exchange {step + 1} of {scenario.exchanges.length}</span>
                            </div>
                        </div>
                        <div className="mk-chat-controls">
                            <button type="button" className="mk-chat-replay" onClick={() => setStep(0)}><RotateCcw size={15} aria-hidden="true" /> Replay</button>
                            <button type="button" className="mk-chat-next" disabled={finished} onClick={() => setStep((current) => Math.min(current + 1, scenario.exchanges.length - 1))}>
                                {finished ? "Example complete" : "Next exchange"}<ArrowRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                        <p className="mk-chat-disclosure">Preview only. Nothing is sent, booked or purchased.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}

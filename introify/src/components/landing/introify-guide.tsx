"use client"

import Link from "@/components/navigation/transition-link"
import { useState } from "react"
import { ArrowUpRight, ArrowDownLeft, Sparkles } from "lucide-react"
import { BrandOrb } from "./brand-orb"

const questions = [
    { question: "What should I put on my page?", answer: "Start with what makes you, you: a photo, a short introduction and a few things you’re proud of. Add your links or an offering, then give visitors one clear next step.", link: "Let’s make your page", href: "/sign-up" },
    { question: "Can people book time with me?", answer: "Yes. Add a service, explain what’s included and set your available slots. Visitors can explore the details and send a booking request, all from your page.", link: "Make room for a conversation", href: "/sign-up" },
    { question: "Where can I share my intro?", answer: "Anywhere a good introduction happens. Put your link in a social bio, send it in a message or share your QR card in person. One address brings people back to your latest work.", link: "Find your starting point", href: "/sign-up" },
] as const

export function IntroifyGuide() {
    const [selected, setSelected] = useState(0)
    const current = questions[selected]
    return <section className="fh-guide-section" id="conversations" aria-labelledby="fh-guide-title"><div className="fh-container fh-guide-grid">
        <div className="fh-guide-intro" data-reveal><p className="fh-eyebrow">A FRIENDLY PLACE TO START</p><h2 id="fh-guide-title">A little curious?<br /><em>You’re in good company.</em></h2><p>Pick a question. Find your starting point.</p><BrandOrb className="fh-guide-orb" /><span className="fh-orb-caption"><Sparkles size={13} /> A SMALL HELLO. A WORLD OF POSSIBILITIES.</span></div>
        <div className="fh-guide-chat" data-reveal><div className="fh-guide-chat-top"><span className="fh-guide-avatar" aria-hidden="true">i.</span><div><strong>Your Introify guide</strong><span>Let’s find your next step.</span></div><Sparkles size={20} /></div><div className="fh-guide-conversation" aria-live="polite" aria-atomic="true"><p className="fh-guide-question">{current.question}</p><div className="fh-guide-answer" key={selected}><span><ArrowDownLeft size={16} /> A GOOD PLACE TO BEGIN</span><p>{current.answer}</p><Link href={current.href}>{current.link} <ArrowUpRight size={17} /></Link></div></div><div className="fh-guide-choices" role="group" aria-label="Questions about Introify"><p>WHAT’S ON YOUR MIND?</p>{questions.map((item, index) => <button type="button" key={item.question} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.question}<ArrowUpRight size={15} /></button>)}</div></div>
    </div></section>
}

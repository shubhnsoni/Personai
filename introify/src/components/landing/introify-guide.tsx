"use client"

import Link from "@/components/navigation/transition-link"
import { useState } from "react"
import { ArrowUpRight, ArrowDownLeft, Sparkles } from "lucide-react"
import { BrandOrb } from "./brand-orb"
import { messagesFor, type UiMessages } from "@/lib/ui-messages"

export function IntroifyGuide({ copy = messagesFor("en").guide }: { copy?: UiMessages["guide"] }) {
    const [selected, setSelected] = useState(0)
    const current = copy.questions[selected]
    return <section className="fh-guide-section" id="conversations" aria-labelledby="fh-guide-title"><div className="fh-container fh-guide-grid">
        <div className="fh-guide-intro" data-reveal><p className="fh-eyebrow">{copy.eyebrow}</p><h2 id="fh-guide-title">{copy.title}<br /><em>{copy.titleEm}</em></h2><p>{copy.lead}</p><BrandOrb className="fh-guide-orb" /><span className="fh-orb-caption"><Sparkles size={13} /> {copy.orbCaption}</span></div>
        <div className="fh-guide-chat" data-reveal><div className="fh-guide-chat-top"><span className="fh-guide-avatar" aria-hidden="true">i.</span><div><strong>{copy.name}</strong><span>{copy.subtitle}</span></div><Sparkles size={20} /></div><div className="fh-guide-conversation" aria-live="polite" aria-atomic="true"><p className="fh-guide-question">{current.question}</p><div className="fh-guide-answer" key={selected}><span><ArrowDownLeft size={16} /> {copy.begin}</span><p>{current.answer}</p><Link href="/sign-up">{current.link} <ArrowUpRight size={17} /></Link></div></div><div className="fh-guide-choices" role="group" aria-label={copy.questionsAria}><p>{copy.mind}</p>{copy.questions.map((item, index) => <button type="button" key={item.question} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.question}<ArrowUpRight size={15} /></button>)}</div></div>
    </div></section>
}

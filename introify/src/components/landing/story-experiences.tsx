"use client"
import { useState } from "react"
import { ArrowUpRight, RotateCcw } from "lucide-react"
import Link from "@/components/navigation/transition-link"
import { StoryBot, type StoryBotName } from "./story-bot"
const characters: StoryBotName[] = ["Nyx", "Ion", "Azure", "Doodle", "Pearl"]
const personalities = { Nyx: "A little cosmic curiosity.", Ion: "A bright spark for every question.", Azure: "A world of possibilities.", Doodle: "A hand-drawn hello.", Pearl: "A softer side of smart." }
export function CharacterChooser() {
    const [selected, setSelected] = useState<keyof typeof personalities>("Ion")
    return <div className="ps-character-picker"><div className="ps-character-row" role="group" aria-label="Choose a character to preview">{characters.map(name => <button type="button" key={name} aria-pressed={selected === name} onClick={() => setSelected(name as keyof typeof personalities)}><StoryBot name={name} expression={selected === name ? "heureux" : "centre"} /><span>{name}</span></button>)}</div><p className="ps-character-caption" aria-live="polite">{personalities[selected]}</p><p className="ps-fine">Character and customization availability depends on your plan.</p><Link className="ps-text-link" href="/sign-up">Find your character <ArrowUpRight size={18} /></Link></div>
}
export function ConversationPreview() {
    const [answer, setAnswer] = useState(false)
    return <div className="ps-conversation"><div className="ps-conversation-stage"><StoryBot name="Nyx" expression={answer ? "heureux" : "curieux"} /></div><div className="ps-chat-card"><div className="ps-chat-identity"><StoryBot name="Nyx" /><div><strong>Maya’s guide</strong><small>Here to help you explore</small></div></div><button className="ps-question" type="button" onClick={() => setAnswer(true)}>Can you help with a new website? <ArrowUpRight size={17} /></button>{answer ? <div className="ps-chat-answer" aria-live="polite"><p>Maya designs brand identities and websites. Explore her selected projects, or send a brief to discuss your idea.</p><Link className="ps-button" href="/sign-up">Make a page like this <ArrowUpRight size={17} /></Link><button className="ps-replay" onClick={() => setAnswer(false)} type="button"><RotateCcw size={14} /> Try again</button></div> : <p className="ps-muted">Choose the question above. See how a conversation can open a door.</p>}</div></div>
}

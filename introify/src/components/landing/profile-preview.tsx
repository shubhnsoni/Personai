"use client"

import Image from "next/image"
import Link from "@/components/navigation/transition-link"
import { useId, useRef, useState, type KeyboardEvent } from "react"
import { ArrowUpRight, ArrowRight, Globe2, Sparkles, CalendarDays } from "lucide-react"

const tabs = ["About", "My work", "Let’s connect"] as const

export function ProfilePreview() {
    const id = useId()
    const [active, setActive] = useState(0)
    const refs = useRef<Array<HTMLButtonElement | null>>([])
    function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        let next = index
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length
        else if (event.key === "Home") next = 0
        else if (event.key === "End") next = tabs.length - 1
        else return
        event.preventDefault()
        setActive(next)
        refs.current[next]?.focus()
    }
    return <div className="fh-profile-scene">
        <span className="fh-profile-sticker"><Sparkles size={21} /> A LITTLE<br /><strong>MORE YOU.</strong></span>
        <div className="fh-profile-window">
            <div className="fh-profile-address"><span><i /><i /><i /></span><Globe2 size={12} /> introify.com/yourname <ArrowUpRight size={13} /></div>
            <div className="fh-profile-cover"><Image src="/marketing/ceramic-artist.png" alt="A ceramic artist in a sunlit pottery studio" fill priority sizes="(max-width: 600px) 88vw, (max-width: 1000px) 42vw, 405px" /><span>THE INDEPENDENT STUDIO</span></div>
            <div className="fh-profile-intro"><div><h2>Good things,<br /><em>made by hand.</em></h2><p>Ceramics. Slow mornings. Room to create.</p></div><span className="fh-profile-spark" aria-hidden="true">✳</span></div>
            <div className="fh-profile-tabs" role="tablist" aria-label="Explore profile sections">{tabs.map((tab, index) => <button key={tab} type="button" id={`${id}-tab-${index}`} role="tab" aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} ref={el => { refs.current[index] = el }} onKeyDown={event => navigate(event, index)} onClick={() => setActive(index)}>{tab}</button>)}</div>
            <div className="fh-profile-panels">
                <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={active !== 0} tabIndex={0}><p>Everyday objects with a little character. A space to share the process, explore the collection and make something of your own.</p><Link href="/sign-up">Make a page that feels like you <ArrowRight size={16} /></Link></div>
                <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={active !== 1} tabIndex={0}><div className="fh-profile-work"><Image src="/marketing/ceramic-vase.jpg" alt="Ceramic vase collection" width={62} height={66} /><span><strong>Objects for everyday rituals.</strong><small>Collections & creative workshops</small></span></div><Link href="/sign-up">Give your work a home <ArrowRight size={16} /></Link></div>
                <div role="tabpanel" id={`${id}-panel-2`} aria-labelledby={`${id}-tab-2`} hidden={active !== 2} tabIndex={0}><div className="fh-profile-connect"><CalendarDays size={24} /><span><strong>Something worth making time for.</strong><small>Services, workshops and a way to connect.</small></span></div><Link href="/sign-up">Create your own starting point <ArrowRight size={16} /></Link></div>
            </div>
        </div>
        <div className="fh-profile-note"><span><ArrowUpRight size={21} /></span><div><strong>There’s more to your story.</strong><p>Give people a place to discover it.</p></div></div>
    </div>
}

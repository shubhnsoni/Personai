"use client"

import { useId, useRef, useState } from "react"
import { ArrowRight, RotateCcw, Store, Users, Coffee } from "lucide-react"
import { fill, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

const ICONS = [Store, Users, Coffee] as const

export function FeaturePlay({ locale = "en" }: { locale?: UiLocale }) {
    const id = useId()
    const copy = messagesFor(locale).home.action
    const tabs = useRef<Array<HTMLButtonElement | null>>([])
    const [active, setActive] = useState(0)
    const [step, setStep] = useState(0)
    const scene = copy.scenes[active]
    const exchange = scene.exchanges[step]
    const last = step === scene.exchanges.length - 1

    function select(index: number) {
        setActive(index)
        setStep(0)
    }

    return (
        <section className="fh-action fh-section" id="in-action" aria-labelledby="fh-action-title">
            <div className="fh-container">
                <div className="fh-section-heading" data-reveal>
                    <div>
                        <p className="fh-eyebrow">{copy.eyebrow}</p>
                        <h2 id="fh-action-title">{copy.title}<br /><em>{copy.titleEm}</em></h2>
                    </div>
                    <p>{copy.lead}</p>
                </div>
                <div className="fh-action-layout">
                    <div className="fh-action-scenes">
                        <p className="fh-action-label">{copy.choose}</p>
                        <div role="tablist" aria-label={copy.choose} aria-orientation="vertical" className="fh-action-tabs">
                            {copy.scenes.map((item, index) => {
                                const Icon = ICONS[index] || Store
                                return (
                                    <button
                                        key={item.label}
                                        type="button"
                                        role="tab"
                                        id={`${id}-tab-${index}`}
                                        aria-selected={active === index}
                                        aria-controls={`${id}-panel`}
                                        tabIndex={active === index ? 0 : -1}
                                        ref={(el) => { tabs.current[index] = el }}
                                        onClick={() => select(index)}
                                        onKeyDown={(event) => {
                                            let next = index
                                            if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % copy.scenes.length
                                            else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index + copy.scenes.length - 1) % copy.scenes.length
                                            else if (event.key === "Home") next = 0
                                            else if (event.key === "End") next = copy.scenes.length - 1
                                            else return
                                            event.preventDefault()
                                            select(next)
                                            tabs.current[next]?.focus()
                                        }}
                                    >
                                        <span className="fh-action-icon"><Icon size={18} aria-hidden="true" /></span>
                                        <span>
                                            <strong>{item.label}</strong>
                                            <small>{item.blurb}</small>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} className="fh-action-panel">
                        <div className="fh-action-profile">
                            <span aria-hidden="true">{scene.profile.slice(0, 1)}</span>
                            <div>
                                <p>{scene.profile}</p>
                                <small>{scene.category}</small>
                            </div>
                        </div>
                        <p className="fh-action-takeaway">{scene.takeaway}</p>
                        <div className="fh-action-exchange" aria-live="polite" aria-atomic="true">
                            <div className="fh-action-bubble is-visitor">
                                <span>{copy.visitor}</span>
                                <p>{exchange.visitor}</p>
                            </div>
                            <div className="fh-action-bubble is-page">
                                <span>{copy.page}</span>
                                <p>{exchange.assistant}</p>
                            </div>
                        </div>
                        {last ? (
                            <p className="fh-action-result"><strong>{copy.nextStep}</strong> {scene.result}</p>
                        ) : null}
                        <div className="fh-action-bar">
                            <span>{fill(copy.progress, { n: step + 1, total: scene.exchanges.length })}</span>
                            <div>
                                <button type="button" onClick={() => setStep(0)}><RotateCcw size={14} aria-hidden="true" /> {copy.replay}</button>
                                <button type="button" disabled={last} onClick={() => setStep((n) => Math.min(n + 1, scene.exchanges.length - 1))}>
                                    {last ? copy.done : copy.next} <ArrowRight size={15} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <p className="fh-action-foot">{copy.foot}</p>
                    </div>
                </div>
            </div>
        </section>
    )
}

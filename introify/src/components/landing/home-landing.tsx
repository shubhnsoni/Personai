import Image from "next/image"
import Link from "@/components/navigation/transition-link"
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CalendarDays, Link2, Plus, ScanLine, Sparkles } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { IntroifyWordmark } from "@/components/brand/wordmark"
import { PricingTeaser } from "@/components/billing/pricing-teaser"
import { LandingMotion, MotionToggle } from "./brand-motion"
import { ProfilePreview } from "./profile-preview"
import { IntroifyGuide } from "./introify-guide"
import { type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"
import "./forest-home.css"

function Flower({ className = "" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" fill="none"><path d="M50 4v92M4 50h92M17.5 17.5l65 65m0-65-65 65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /></svg>
}

export function HomeLanding({ locale = "en" }: { locale?: UiLocale }) {
    const home = messagesFor(locale).home
    const { hero, product, share, people, how, faq, final: closing, possibilities } = home
    return (
        <MarketingShell className="brand-home" locale={locale}>
            <LandingMotion>
                <main id="main-content">
                    <section className="fh-hero" aria-labelledby="fh-hero-title">
                        <div className="fh-container fh-hero-grid">
                            <div className="fh-hero-copy">
                                <p className="fh-eyebrow"><span className="fh-status-dot" /> {hero.eyebrow}</p>
                                <h1 id="fh-hero-title">{hero.title}<br />{hero.titleMid}<br /><em>{hero.titleEm}</em><Flower className="fh-heading-flower" /></h1>
                                <p className="fh-hero-description">{hero.description}<br className="fh-desktop-break" /> {hero.descriptionMore}</p>
                                <div className="fh-hero-actions"><Link className="fh-button" href="/sign-up">{hero.cta} <ArrowUpRight size={19} /></Link><Link className="fh-text-link" href="#product">{hero.secondary} <ArrowDown size={17} /></Link></div>
                                <div className="fh-hero-notes"><span><Check size={13} /> {hero.free}</span><span><Check size={13} /> {hero.noCard}</span><span><Check size={13} /> {hero.yours}</span></div>
                            </div>
                            <div className="fh-hero-art"><ProfilePreview /><div className="fh-art-caption"><span>{hero.caption}</span><MotionToggle pause={home.pauseAnimations} resume={home.resumeAnimations} /></div></div>
                        </div>
                    </section>
                    <div className="fh-possibilities"><div className="fh-container"><p>{possibilities.lead}<br /><strong>{possibilities.em}</strong></p><div><span>{possibilities.story}</span><Flower /><span>{possibilities.services}</span><Flower /><span>{possibilities.products}</span><Flower /><span>{possibilities.chapter}</span></div></div></div>
                    <section className="fh-product fh-section" id="product" aria-labelledby="fh-product-title">
                        <div className="fh-container">
                            <div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">{product.eyebrow}</p><h2 id="fh-product-title">{product.title}<br /><em>{product.titleEm}</em></h2></div><p>{product.lead}</p></div>
                            <div className="fh-feature-grid">
                                <article className="fh-feature fh-feature-story" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">{product.storyIndex}</span><Link2 size={21} /></div>
                                    <h3>{product.storyTitle}<br />{product.storyTitle2}</h3><p>{product.storyBody}</p>
                                    <div className="fh-link-stack" aria-hidden="true"><div><span className="fh-stack-icon">a.</span><span><strong>{product.about}</strong><small>{product.aboutSub}</small></span><ArrowUpRight size={18} /></div><div><span className="fh-stack-icon"><Sparkles size={19} /></span><span><strong>{product.made}</strong><small>{product.madeSub}</small></span><ArrowUpRight size={18} /></div><div><span className="fh-stack-icon"><Link2 size={19} /></span><span><strong>{product.find}</strong><small>{product.findSub}</small></span><ArrowUpRight size={18} /></div></div>
                                    <span className="fh-feature-end">{product.storyEnd}</span>
                                </article>
                                <article className="fh-feature fh-feature-bookings" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">{product.timeIndex}</span><CalendarDays size={21} /></div><h3>{product.timeTitle}<br />{product.timeTitle2}</h3><p>{product.timeBody}</p>
                                    <div className="fh-calendar" aria-hidden="true"><div><strong>{product.calendar}</strong><span>{product.duration}</span></div><div className="fh-calendar-days">{product.days.map((day, i) => <div className={i === 2 ? "is-chosen" : ""} key={`${day}-${i}`}><span>{day}</span><b>{12 + i}</b></div>)}</div><div className="fh-slots">{product.slots.map(slot => <span key={slot}>{slot}</span>)}</div></div>
                                </article>
                                <article className="fh-feature fh-feature-offers" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">{product.offerIndex}</span><ArrowUpRight size={21} /></div><h3>{product.offerTitle}<br />{product.offerTitle2}</h3><p>{product.offerBody}</p>
                                    <div className="fh-offer-visual"><div className="fh-offer-photo"><Image src="/marketing/ceramic-vase.jpg" alt={product.vaseAlt} fill sizes="(max-width: 700px) 60vw, 260px" /></div><div className="fh-offer-label"><span>{product.offerKicker}</span><strong>{product.offerName}</strong><ArrowUpRight size={18} /></div></div>
                                </article>
                            </div>
                        </div>
                    </section>
                    <section className="fh-share-section" aria-labelledby="fh-share-title">
                        <div className="fh-container fh-share-grid">
                            <div className="fh-share-copy" data-reveal><p className="fh-eyebrow">{share.eyebrow}</p><h2 id="fh-share-title">{share.title}<br />{share.titleMid}<br /><em>{share.titleEm}</em></h2><p>{share.body}</p><Link className="fh-button fh-button-lime" href="/sign-up">{share.cta} <ArrowUpRight size={19} /></Link></div>
                            <div className="fh-share-art" data-reveal aria-hidden="true"><div className="fh-share-orbit" /><div className="fh-share-orbit fh-share-orbit-two" /><span className="fh-share-chip fh-share-chip-top"><Link2 size={16} /> {share.social}</span><div className="fh-name-card"><IntroifyWordmark decorative /><span>{share.hello}</span><strong>{share.happen}<br />{share.happen2}</strong><div className="fh-name-card-bottom"><span>{share.cardWork}<br />{share.cardLink}</span><ScanLine size={43} strokeWidth={1.4} /></div></div><span className="fh-share-chip fh-share-chip-bottom"><ArrowUpRight size={16} /> {share.next}</span><Flower className="fh-share-flower" /></div>
                        </div>
                    </section>
                    <section className="fh-people fh-section" id="stories" aria-labelledby="fh-people-title">
                        <div className="fh-container"><div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">{people.eyebrow}</p><h2 id="fh-people-title">{people.title}<br /><em>{people.titleEm}</em></h2></div><p>{people.lead}</p></div>
                            <div className="fh-people-grid">{home.audiences.map((audience, i) => <article className="fh-person" key={audience.group} data-reveal><div className={`fh-person-photo fh-person-photo-${i}`}><Image src={audience.image} alt={audience.alt} fill sizes="(max-width: 700px) 92vw, (max-width: 1000px) 45vw, 390px" /><span>0{i + 1}</span><div className="fh-person-tags">{audience.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div><p className="fh-eyebrow">{audience.group}</p><h3>{audience.title}</h3><p className="fh-person-description">{audience.text}</p><Link href="/sign-up" className="fh-text-link">{audience.cta} <ArrowUpRight size={17} /></Link></article>)}</div>
                        </div>
                    </section>
                    <IntroifyGuide copy={messagesFor(locale).guide} />
                    <PricingTeaser locale={locale} />
                    <section className="fh-how fh-section" id="how-it-works" aria-labelledby="fh-how-title"><div className="fh-container"><div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">{how.eyebrow}</p><h2 id="fh-how-title">{how.title}<br /><em>{how.titleEm}</em></h2></div><Link href="/sign-up" className="fh-text-link">{how.cta} <ArrowUpRight size={19} /></Link></div><div className="fh-steps">{how.steps.map(([number, title, text]) => <article key={number} data-reveal><span>{number}<ArrowRight size={25} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
                    <section className="fh-faq fh-section" id="faq" aria-labelledby="fh-faq-title"><div className="fh-container fh-faq-grid"><div data-reveal><p className="fh-eyebrow">{faq.eyebrow}</p><h2 id="fh-faq-title">{faq.title}<br /><em>{faq.titleEm}</em></h2><p>{faq.lead}</p><Flower className="fh-faq-flower" /></div><div className="fh-faq-list">{faq.items.map(([question, answer], i) => <details key={question} data-reveal><summary><span>0{i + 1}</span><h3>{question}</h3><Plus size={20} /></summary><p>{answer}</p></details>)}</div></div></section>
                    <section className="fh-final" aria-labelledby="fh-final-title"><div className="fh-container" data-reveal><p className="fh-eyebrow">{closing.eyebrow}</p><h2 id="fh-final-title">{closing.title}<br /><em>{closing.titleEm}</em></h2><Link className="fh-button fh-button-lime" href="/sign-up">{closing.cta} <ArrowUpRight size={20} /></Link><p className="fh-final-note">{closing.note}</p><Flower className="fh-final-flower" /></div></section>
                </main>
            </LandingMotion>
        </MarketingShell>
    )
}

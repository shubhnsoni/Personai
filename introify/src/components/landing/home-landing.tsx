import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CalendarDays, Link2, Plus, ScanLine, Sparkles } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { IntroifyWordmark } from "@/components/brand/wordmark"
import { PricingTeaser } from "@/components/billing/pricing-teaser"
import { LandingMotion, MotionToggle } from "./brand-motion"
import { ProfilePreview } from "./profile-preview"
import { IntroifyGuide } from "./introify-guide"
import "./forest-home.css"

const faqs = [
    ["What is Introify?", "Introify is a home for your work on the web. Bring your profile, links, services, products and bookings into one shareable page, so visitors can understand what you do and find their next step."],
    ["Who can make an Introify page?", "Creators, independent professionals, consultants, coaches and local businesses. Whether you’re sharing a portfolio, offering a service or building a shop, start with the parts that fit your work."],
    ["Do I need a website or coding experience?", "Neither. Create your account, choose your page name and add your content from the dashboard. If you already have a website, link to it from your page. Introify works as a focused starting point alongside the places you already share your work."],
    ["How much does it cost?", "Start on Free with no card required. Paid plans are listed from $10 per month, with 10% off annual billing. Each plan has clear AI, 3D and business limits. Compare prices and check purchase availability in your billing dashboard before upgrading. What customers pay your business is separate."],
    ["Can visitors pay or book through my page?", "You can add services and let visitors request available booking slots. Product pages can offer payment and fulfillment methods enabled by the page owner, including manual UPI, cash on delivery or WhatsApp ordering. Online checkout depends on the business’s enabled payment methods. Each offering’s details and terms apply."],
    ["Does the page include an AI assistant?", "Each plan includes a monthly AI credit allowance: Free starts with 50 credits for Fast replies. Starter adds Smart mode, and Pro and above add Reasoning. Your assistant uses the information you provide; check replies for accuracy. AI availability, mode access and the remaining balance are shown in your billing dashboard."],
    ["Can I update my page later?", "Of course. Edit your introduction, links and offerings from your dashboard as your work evolves. Keep sharing the same page address—your latest updates are there when visitors arrive."],
] as const

const audiences = [
    { title: "For the things you make.", group: "CREATORS & MAKERS", image: "/marketing/ceramic-artist.png", alt: "A ceramic artist shaping clay in her studio", text: "Give your craft a space of its own. Bring your portfolio, collections and workshops together, so people can explore more of what you do.", tags: ["Portfolio", "Collections", "Workshops"], cta: "Make room for your craft" },
    { title: "For the expertise you share.", group: "CONSULTANTS & INDEPENDENTS", image: "/marketing/design-consultant.png", alt: "An independent professional working at a studio desk", text: "Let a potential client get to know your approach before the first call. Put your experience, services and booking options in one place.", tags: ["Services", "Experience", "Bookings"], cta: "Introduce your expertise" },
    { title: "For your corner of the world.", group: "LOCAL BUSINESSES", image: "/marketing/cafe-owner.png", alt: "A café owner welcoming visitors at the counter", text: "Make it easy to find the details that bring people through your door. Share a menu, a catalog or your contact links from one familiar address.", tags: ["Menus", "Catalogs", "Contact"], cta: "Bring your business closer" },
] as const

function Flower({ className = "" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" fill="none"><path d="M50 4v92M4 50h92M17.5 17.5l65 65m0-65-65 65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /></svg>
}

export function HomeLanding() {
    return (
        <MarketingShell className="brand-home">
            <LandingMotion>
                <main id="main-content">
                    <section className="fh-hero" aria-labelledby="fh-hero-title">
                        <div className="fh-container fh-hero-grid">
                            <div className="fh-hero-copy">
                                <p className="fh-eyebrow"><span className="fh-status-dot" /> YOUR WORK, OPEN TO THE WORLD</p>
                                <h1 id="fh-hero-title">Big things<br />start with a<br /><em>good intro.</em><Flower className="fh-heading-flower" /></h1>
                                <p className="fh-hero-description">Your story. Your work. Your next opportunity.<br className="fh-desktop-break" /> Bring them together in one beautiful page—with a clear way to explore, book or get in touch.</p>
                                <div className="fh-hero-actions"><Link className="fh-button" href="/sign-up">Make your intro <ArrowUpRight size={19} /></Link><Link className="fh-text-link" href="#product">See what’s possible <ArrowDown size={17} /></Link></div>
                                <div className="fh-hero-notes"><span><Check size={13} /> Start on Free</span><span><Check size={13} /> No card needed</span><span><Check size={13} /> Yours to make</span></div>
                            </div>
                            <div className="fh-hero-art"><ProfilePreview /><div className="fh-art-caption"><span>ONE LINK. A LITTLE MORE YOU.</span><MotionToggle /></div></div>
                        </div>
                    </section>
                    <div className="fh-possibilities"><div className="fh-container"><p>All the parts of you.<br /><strong>Finally, together.</strong></p><div><span>Your story</span><Flower /><span>Your services</span><Flower /><span>Your products</span><Flower /><span>Your next chapter</span></div></div></div>
                    <section className="fh-product fh-section" id="product" aria-labelledby="fh-product-title">
                        <div className="fh-container">
                            <div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">A PAGE THAT OPENS DOORS</p><h2 id="fh-product-title">Less scattered.<br /><em>More connected.</em></h2></div><p>A bio here. A booking link there. Give people one place to understand your work—and a reason to take the next step.</p></div>
                            <div className="fh-feature-grid">
                                <article className="fh-feature fh-feature-story" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">01 / YOUR STORY</span><Link2 size={21} /></div>
                                    <h3>More than a list of links.<br />A sense of who you are.</h3><p>Put your experience, best work and important links in context. Make the first impression feel like you.</p>
                                    <div className="fh-link-stack" aria-hidden="true"><div><span className="fh-stack-icon">a.</span><span><strong>A little about me</strong><small>The story behind the work</small></span><ArrowUpRight size={18} /></div><div><span className="fh-stack-icon"><Sparkles size={19} /></span><span><strong>Things I’ve made</strong><small>A few favourites, all in one place</small></span><ArrowUpRight size={18} /></div><div><span className="fh-stack-icon"><Link2 size={19} /></span><span><strong>Find me around the web</strong><small>Everywhere else we can connect</small></span><ArrowUpRight size={18} /></div></div>
                                    <span className="fh-feature-end">YOUR WORLD, WITH A FRONT DOOR.</span>
                                </article>
                                <article className="fh-feature fh-feature-bookings" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">02 / YOUR TIME</span><CalendarDays size={21} /></div><h3>From “I’m interested”<br />to “let’s talk.”</h3><p>Describe your services and open up your availability. Help the right people find a time to connect.</p>
                                    <div className="fh-calendar" aria-hidden="true"><div><strong>Make a little time.</strong><span>30 MIN</span></div><div className="fh-calendar-days">{["M", "T", "W", "T", "F"].map((day, i) => <div className={i === 2 ? "is-chosen" : ""} key={i}><span>{day}</span><b>{12 + i}</b></div>)}</div><div className="fh-slots"><span>10:00 am</span><span>11:30 am</span><span>2:00 pm</span></div></div>
                                </article>
                                <article className="fh-feature fh-feature-offers" data-reveal>
                                    <div className="fh-feature-top"><span className="fh-index">03 / YOUR OFFERINGS</span><ArrowUpRight size={21} /></div><h3>Make space for<br />your next good thing.</h3><p>A collection, a course, a workshop. Give every offering the details and attention it deserves.</p>
                                    <div className="fh-offer-visual"><div className="fh-offer-photo"><Image src="/marketing/ceramic-vase.jpg" alt="Handcrafted ceramic vase" fill sizes="(max-width: 700px) 60vw, 260px" /></div><div className="fh-offer-label"><span>MADE WITH INTENTION</span><strong>Objects with a story.</strong><ArrowUpRight size={18} /></div></div>
                                </article>
                            </div>
                        </div>
                    </section>
                    <section className="fh-share-section" aria-labelledby="fh-share-title">
                        <div className="fh-container fh-share-grid">
                            <div className="fh-share-copy" data-reveal><p className="fh-eyebrow">MEET THEM WHERE THEY ARE</p><h2 id="fh-share-title">In your bio.<br />On your card.<br /><em>Out in the world.</em></h2><p>Share your Introify link anywhere a good introduction can happen. On a screen, across a counter or at the end of a conversation.</p><Link className="fh-button fh-button-lime" href="/sign-up">Find your starting point <ArrowUpRight size={19} /></Link></div>
                            <div className="fh-share-art" data-reveal aria-hidden="true"><div className="fh-share-orbit" /><div className="fh-share-orbit fh-share-orbit-two" /><span className="fh-share-chip fh-share-chip-top"><Link2 size={16} /> YOUR SOCIAL BIO</span><div className="fh-name-card"><IntroifyWordmark decorative /><span>GOOD TO MEET YOU.</span><strong>Let’s make<br />something happen.</strong><div className="fh-name-card-bottom"><span>YOUR WORK.<br />ONE LINK.</span><ScanLine size={43} strokeWidth={1.4} /></div></div><span className="fh-share-chip fh-share-chip-bottom"><ArrowUpRight size={16} /> YOUR NEXT OPPORTUNITY</span><Flower className="fh-share-flower" /></div>
                        </div>
                    </section>
                    <section className="fh-people fh-section" id="stories" aria-labelledby="fh-people-title">
                        <div className="fh-container"><div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">MANY WAYS TO MAKE IT YOURS</p><h2 id="fh-people-title">Built for people<br /><em>doing their thing.</em></h2></div><p>The side project becoming something bigger. The independent practice. The little shop with a big personality. There’s room for all of it.</p></div>
                            <div className="fh-people-grid">{audiences.map((audience, i) => <article className="fh-person" key={audience.group} data-reveal><div className={`fh-person-photo fh-person-photo-${i}`}><Image src={audience.image} alt={audience.alt} fill sizes="(max-width: 700px) 92vw, (max-width: 1000px) 45vw, 390px" /><span>0{i + 1}</span><div className="fh-person-tags">{audience.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div><p className="fh-eyebrow">{audience.group}</p><h3>{audience.title}</h3><p className="fh-person-description">{audience.text}</p><Link href="/sign-up" className="fh-text-link">{audience.cta} <ArrowUpRight size={17} /></Link></article>)}</div>
                        </div>
                    </section>
                    <IntroifyGuide />
                    <PricingTeaser />
                    <section className="fh-how fh-section" id="how-it-works" aria-labelledby="fh-how-title"><div className="fh-container"><div className="fh-section-heading" data-reveal><div><p className="fh-eyebrow">FROM “ONE DAY” TO DAY ONE</p><h2 id="fh-how-title">A little setup.<br /><em>A lot of you.</em></h2></div><Link href="/sign-up" className="fh-text-link">Let’s get you started <ArrowUpRight size={19} /></Link></div><div className="fh-steps">{[
                        ["01", "Say a proper hello.", "Choose your page name. Add a photo and an introduction that tells people what you do and why it matters."],
                        ["02", "Bring your good stuff.", "Add the links, services and offerings that fit your work. Start with one clear next step. Build from there."],
                        ["03", "Put yourself out there.", "Share your link in your bio, messages or QR card. Keep it fresh from your dashboard as your work grows."],
                    ].map(([number, title, text]) => <article key={number} data-reveal><span>{number}<ArrowRight size={25} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
                    <section className="fh-faq fh-section" id="faq" aria-labelledby="fh-faq-title"><div className="fh-container fh-faq-grid"><div data-reveal><p className="fh-eyebrow">A LITTLE CLARITY</p><h2 id="fh-faq-title">Good questions.<br /><em>Clear answers.</em></h2><p>Before your next chapter begins.</p><Flower className="fh-faq-flower" /></div><div className="fh-faq-list">{faqs.map(([question, answer], i) => <details key={question} data-reveal><summary><span>0{i + 1}</span><h3>{question}</h3><Plus size={20} /></summary><p>{answer}</p></details>)}</div></div></section>
                    <section className="fh-final" aria-labelledby="fh-final-title"><div className="fh-container" data-reveal><p className="fh-eyebrow">YOU’VE GOT SOMETHING GOOD GOING.</p><h2 id="fh-final-title">Let’s make<br /><em>the introduction.</em></h2><Link className="fh-button fh-button-lime" href="/sign-up">Make your intro <ArrowUpRight size={20} /></Link><p className="fh-final-note">Start on Free. No card needed. A page that’s yours.</p><Flower className="fh-final-flower" /></div></section>
                </main>
            </LandingMotion>
        </MarketingShell>
    )
}

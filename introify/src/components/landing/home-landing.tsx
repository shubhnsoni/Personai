import Image from "next/image"
import Link from "next/link"
import {
    ArrowDown,
    ArrowRight,
    ArrowUpRight,
    CalendarDays,
    Check,
    ChevronRight,
    CircleUserRound,
    Globe2,
    Layers3,
    Link2,
    QrCode,
    ShoppingBag,
    Sparkles,
} from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { AudienceExplorer } from "./audience-explorer"
import { ChatShowcase } from "./chat-showcase"
import { PeopleStories } from "./people-stories"

const faqs = [
    [
        "What is Introify?",
        "Introify brings your public profile, links and business offerings into one shareable page. Depending on what you do, you can add services and bookings, a product catalog, digital products, courses, events or a restaurant menu.",
    ],
    [
        "Who is it for?",
        "Independent professionals, consultants, coaches, creators and local businesses. Start with the information your visitors need most: who you are, what you offer and how to take the next step.",
    ],
    [
        "Do I need to know how to code?",
        "No. Create an account, set up your profile and add your offerings from your dashboard. You can update your page as your work changes, without editing a website.",
    ],
    [
        "How much does it cost?",
        "Introify is currently in free early access. You can create your page without a card. Future paid plans, limits and any applicable charges will be shown before you choose a paid service. Prices set by individual page owners for their own offerings are separate.",
    ],
    [
        "Can visitors pay or book through my page?",
        "You can list services and let visitors request available booking slots. Product pages can support page-owner-provided payment and fulfillment options, such as manual UPI, cash on delivery or WhatsApp ordering. Online card checkout is not currently enabled. Visitors should check each offering’s terms before ordering.",
    ],
    [
        "Does the page include an AI assistant?",
        "AI features are planned as part of Introify’s broader product, but an AI assistant is not currently active in this early-access release. Your profile, links and supported business tools can be used without it.",
    ],
    [
        "Can I use Introify alongside my existing website?",
        "Yes. Add your website and other links to your Introify page, then share the page in your social bio, messages or QR card. It can be a focused starting point for visitors alongside your existing website.",
    ],
    [
        "What should I put on my page first?",
        "Use a clear headline that says what you do and who you help. Add a short introduction, a few strong examples of your work and one primary offering. Make the next step specific: view a collection, explore a service or choose a booking slot.",
    ],
] as const

function ProfilePreview() {
    return (
        <div
            className="mk-hero-visual"
            aria-label="Illustrative Introify profile preview"
        >
            <div className="mk-orbit mk-orbit-one" />
            <div className="mk-orbit mk-orbit-two" />
            <span className="mk-visual-caption">
                <span /> A LITTLE MORE YOU. A LOT MORE POSSIBLE.
            </span>
            <div className="mk-profile-card">
                <div className="mk-profile-url">
                    <span className="mk-url-dots">
                        <i />
                        <i />
                        <i />
                    </span>
                    <Link2 size={11} />
                    <span>introify.com/yourname</span>
                    <ArrowUpRight size={13} />
                </div>
                <div className="mk-profile-photo">
                    <Image
                        src="/marketing/ceramic-artist.png"
                        alt="Illustrative ceramic artist in a sunlit pottery studio"
                        fill
                        priority
                        sizes="(max-width: 600px) 80vw, 390px"
                    />
                    <span className="mk-photo-tag">
                        MADE BY HAND. SHARED WITH YOU.
                    </span>
                </div>
                <div className="mk-profile-info">
                    <div className="mk-profile-title">
                        <h2>
                            Mira Studio<span>✳</span>
                        </h2>
                        <span className="mk-profile-category">
                            CERAMICS & CREATIVE WORKSHOPS
                        </span>
                    </div>
                    <p>
                        Everyday objects.
                        <br />A little out of the ordinary.
                    </p>
                    <Link href="/demo" className="mk-profile-action">
                        Explore an example page <ArrowUpRight size={16} />
                    </Link>
                    <div className="mk-profile-bottom">
                        <span>
                            <Globe2 size={12} /> Made for the curious
                        </span>
                        <span>introify.</span>
                    </div>
                </div>
            </div>
            <div className="mk-floating-card mk-booking-card">
                <span className="mk-float-icon">
                    <CalendarDays size={20} />
                </span>
                <div>
                    <span className="mk-small-label">
                        MAKE TIME FOR YOUR WORK
                    </span>
                    <strong>A visit. A call. A new start.</strong>
                    <span>Give visitors a way to book.</span>
                </div>
                <ArrowUpRight size={16} />
            </div>
            <div className="mk-floating-card mk-link-card">
                <span className="mk-lime-icon">
                    <Link2 size={20} />
                </span>
                <div>
                    <strong>Everything, connected.</strong>
                    <span>One link that opens doors.</span>
                </div>
            </div>
            <span className="mk-preview-disclaimer">
                Illustrative profile · Explore the demo to try Introify
            </span>
        </div>
    )
}

export function HomeLanding() {
    return (
        <MarketingShell>
            <main id="main-content">
                <section
                    className="mk-hero mk-container"
                    aria-labelledby="hero-title"
                >
                    <div className="mk-hero-copy">
                        <span className="mk-eyebrow">
                            <span className="mk-live-dot" /> YOUR NEXT CHAPTER
                            STARTS HERE
                        </span>
                        <h1 id="hero-title">
                            One home for
                            <br />
                            <em>what you do.</em>
                        </h1>
                        <p className="mk-hero-description">
                            Bring your profile, services, products and bookings
                            together. Give every visitor a clear next step.
                        </p>
                        <div className="mk-hero-ctas">
                            <Link className="mk-button" href="/sign-up">
                                Create your page <ArrowUpRight size={19} />
                            </Link>
                            <Link className="mk-text-link" href="/demo">
                                Explore the demo <ArrowRight size={17} />
                            </Link>
                        </div>
                        <p className="mk-hero-note">
                            <Check size={14} /> Free early access <span /> No
                            card required
                        </p>
                        <div className="mk-hero-footnote">
                            <span className="mk-tiny-rule" />
                            <p>
                                Less “find me everywhere.”
                                <br />
                                <strong>More “start right here.”</strong>
                            </p>
                        </div>
                    </div>
                    <ProfilePreview />
                </section>
                <div className="mk-audience-strip">
                    <div className="mk-container">
                        <span>
                            A SPACE FOR YOUR
                            <br />
                            <strong>KIND OF WORK.</strong>
                        </span>
                        <p>
                            <Sparkles size={19} /> Creators
                        </p>
                        <p>
                            <CircleUserRound size={19} /> Consultants
                        </p>
                        <p>
                            <ShoppingBag size={19} /> Independent shops
                        </p>
                        <p>
                            <Globe2 size={19} /> Local businesses
                        </p>
                        <a href="#product" aria-label="Explore the product">
                            <ArrowDown size={20} />
                        </a>
                    </div>
                </div>
                <section className="mk-section mk-container" id="product">
                    <div className="mk-section-heading">
                        <div>
                            <span className="mk-eyebrow">
                                A GOOD INTRODUCTION GOES FURTHER
                            </span>
                            <h2>
                                More than a link.
                                <br />
                                <em>A place to begin.</em>
                            </h2>
                        </div>
                        <p>
                            Your best work shouldn’t get lost between a social
                            bio, a booking link and a dozen messages. Bring the
                            important parts together.
                        </p>
                    </div>
                    <div className="mk-feature-grid">
                        <article className="mk-feature mk-feature-profile">
                            <div className="mk-feature-art mk-mini-profile">
                                <div className="mk-mini-avatar">
                                    m<span>✳</span>
                                </div>
                                <div className="mk-mini-lines">
                                    <strong>A clear first impression.</strong>
                                    <span>Your story, in your words.</span>
                                </div>
                                <div className="mk-mini-link">
                                    <span>01</span> About my work{" "}
                                    <ArrowUpRight size={14} />
                                </div>
                                <div className="mk-mini-link">
                                    <span>02</span> Selected projects{" "}
                                    <ArrowUpRight size={14} />
                                </div>
                                <div className="mk-mini-link">
                                    <span>03</span> Let’s work together{" "}
                                    <ArrowUpRight size={14} />
                                </div>
                            </div>
                            <span className="mk-feature-number">
                                01 / INTRODUCE YOURSELF
                            </span>
                            <h3>Let your work do the talking.</h3>
                            <p>
                                A considered profile with your story,
                                experience, work and links. Give people a reason
                                to stay—and a way to explore.
                            </p>
                        </article>
                        <article className="mk-feature mk-feature-booking">
                            <div className="mk-feature-art mk-mini-calendar">
                                <div className="mk-calendar-top">
                                    <CalendarDays size={17} />
                                    <strong>
                                        Make room for a conversation
                                    </strong>
                                </div>
                                <div className="mk-calendar-days">
                                    {["M", "T", "W", "T", "F", "S", "S"].map(
                                        (day, i) => (
                                            <span key={i}>{day}</span>
                                        ),
                                    )}
                                    {Array.from({ length: 14 }, (_, i) => (
                                        <span
                                            className={
                                                i === 9
                                                    ? "mk-calendar-selected"
                                                    : ""
                                            }
                                            key={`day-${i}`}
                                        >
                                            {i + 8}
                                        </span>
                                    ))}
                                </div>
                                <div className="mk-mini-slots">
                                    <span>10:00 AM</span>
                                    <span>11:30 AM</span>
                                    <span>2:00 PM</span>
                                </div>
                                <span className="mk-art-label">
                                    EXAMPLE AVAILABILITY
                                </span>
                            </div>
                            <span className="mk-feature-number">
                                02 / OPEN THE CONVERSATION
                            </span>
                            <h3>Turn interest into a next step.</h3>
                            <p>
                                Show your services and available booking slots.
                                Help visitors find the right offering and make
                                time to connect.
                            </p>
                        </article>
                        <article className="mk-feature mk-feature-shop">
                            <div className="mk-feature-art mk-mini-shop">
                                <div className="mk-shop-heading">
                                    <ShoppingBag size={17} />
                                    <strong>
                                        A collection of possibilities
                                    </strong>
                                </div>
                                <div className="mk-shop-items">
                                    <div>
                                        <span className="mk-shop-tile mk-tile-course">
                                            <Layers3 size={33} />
                                        </span>
                                        <strong>Digital guides</strong>
                                        <span>Ideas worth sharing</span>
                                    </div>
                                    <div>
                                        <span className="mk-shop-tile mk-tile-event">
                                            <Sparkles size={33} />
                                        </span>
                                        <strong>Workshops</strong>
                                        <span>Bring people together</span>
                                    </div>
                                </div>
                                <span className="mk-art-label">
                                    ILLUSTRATIVE OFFERINGS
                                </span>
                            </div>
                            <span className="mk-feature-number">
                                03 / SHARE WHAT YOU OFFER
                            </span>
                            <h3>Give every offering a home.</h3>
                            <p>
                                Present products, courses and events in context.
                                Make it easier for visitors to understand what
                                you offer before they decide.
                            </p>
                        </article>
                    </div>
                </section>
                <section className="mk-audience-section" id="for-you">
                    <div className="mk-container">
                        <div className="mk-section-heading">
                            <div>
                                <span className="mk-eyebrow">
                                    AS INDIVIDUAL AS YOUR AMBITION
                                </span>
                                <h2>
                                    Your work doesn’t fit a box.
                                    <br />
                                    <em>Your page shouldn’t either.</em>
                                </h2>
                            </div>
                            <p>
                                A creative practice. An independent business.
                                Your next big idea. Start with the tools that
                                make sense for you.
                            </p>
                        </div>
                        <AudienceExplorer />
                    </div>
                </section>
                <ChatShowcase />
                <PeopleStories />
                <section className="mk-studio-section mk-container">
                    <div className="mk-studio-copy">
                        <span className="mk-eyebrow">BEHIND YOUR PAGE</span>
                        <h2>
                            A little less admin.
                            <br />
                            <em>A little more doing.</em>
                        </h2>
                        <p>
                            Keep your profile, offerings and business activity
                            close at hand. Your dashboard gives you a place to
                            update your page, manage bookings and organize
                            leads.
                        </p>
                        <ul>
                            <li>
                                <Check size={17} /> Update your content as your
                                work evolves.
                            </li>
                            <li>
                                <Check size={17} /> Keep lead notes and
                                follow-ups in one place.
                            </li>
                            <li>
                                <Check size={17} /> See visitor activity and
                                share your QR card.
                            </li>
                        </ul>
                        <Link href="/sign-up" className="mk-text-link">
                            Find your starting point <ArrowRight size={17} />
                        </Link>
                    </div>
                    <div className="mk-studio-preview">
                        <div className="mk-studio-top">
                            <span className="mk-studio-logo">i.</span>
                            <span>Your studio</span>
                            <span className="mk-example-pill">EXAMPLE</span>
                        </div>
                        <div className="mk-studio-body">
                            <div className="mk-studio-greeting">
                                <span>A little space for the big picture.</span>
                                <h3>Make it yours.</h3>
                            </div>
                            {[
                                {
                                    icon: CircleUserRound,
                                    title: "Your profile",
                                    note: "A story only you can tell",
                                },
                                {
                                    icon: CalendarDays,
                                    title: "Services & bookings",
                                    note: "Good conversations start here",
                                },
                                {
                                    icon: ShoppingBag,
                                    title: "Products & offerings",
                                    note: "Bring your ideas into the world",
                                },
                            ].map((item) => (
                                <div className="mk-studio-row" key={item.title}>
                                    <span className="mk-studio-row-icon">
                                        <item.icon size={19} />
                                    </span>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <span>{item.note}</span>
                                    </div>
                                    <ChevronRight size={16} />
                                </div>
                            ))}
                            <div className="mk-studio-share">
                                <QrCode size={39} strokeWidth={1.4} />
                                <div>
                                    <strong>
                                        One page. Many possibilities.
                                    </strong>
                                    <span>Share your link or QR card.</span>
                                </div>
                                <ArrowUpRight size={19} />
                            </div>
                        </div>
                    </div>
                </section>
                <section className="mk-how-section" id="how-it-works">
                    <div className="mk-container">
                        <div className="mk-section-heading">
                            <div>
                                <span className="mk-eyebrow">
                                    FROM AN IDEA TO AN INTRODUCTION
                                </span>
                                <h2>
                                    Make it yours.
                                    <br />
                                    <em>Then put it out there.</em>
                                </h2>
                            </div>
                            <Link
                                href="/sign-up"
                                className="mk-button mk-button-outline"
                            >
                                Let’s get started <ArrowUpRight size={18} />
                            </Link>
                        </div>
                        <ol className="mk-steps">
                            <li>
                                <span>01</span>
                                <h3>Tell your story.</h3>
                                <p>
                                    Choose your page name. Add a photo, a clear
                                    introduction and the links that matter.
                                </p>
                            </li>
                            <li>
                                <span>02</span>
                                <h3>Bring your work.</h3>
                                <p>
                                    Add your services, products or other
                                    offerings. Give each one a clear description
                                    and next step.
                                </p>
                            </li>
                            <li>
                                <span>03</span>
                                <h3>Make the introduction.</h3>
                                <p>
                                    Share your link in your bio, send it in a
                                    message or bring your QR card into the real
                                    world.
                                </p>
                            </li>
                        </ol>
                    </div>
                </section>
                <section className="mk-faq-section mk-container" id="faq">
                    <div>
                        <span className="mk-eyebrow">A FEW GOOD QUESTIONS</span>
                        <h2>
                            Before you
                            <br />
                            <em>make your intro.</em>
                        </h2>
                        <p>A little clarity for your next chapter.</p>
                        <Link href="/about" className="mk-text-link">
                            Get to know Introify <ArrowUpRight size={16} />
                        </Link>
                    </div>
                    <div className="mk-faq-list">
                        {faqs.map(([question, answer], index) => (
                            <details key={question}>
                                <summary>
                                    <span className="mk-faq-number">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <h3>{question}</h3>
                                    <span
                                        className="mk-faq-plus"
                                        aria-hidden="true"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p>{answer}</p>
                            </details>
                        ))}
                    </div>
                </section>
                <section className="mk-final-cta">
                    <div className="mk-container">
                        <div>
                            <span className="mk-eyebrow">
                                THERE’S MORE TO YOU. SHOW IT.
                            </span>
                            <h2>
                                Good work deserves
                                <br />
                                <em>a great introduction.</em>
                            </h2>
                            <p>Give what you do a place to grow.</p>
                            <Link
                                className="mk-button mk-button-lime"
                                href="/sign-up"
                            >
                                Create your page <ArrowUpRight size={19} />
                            </Link>
                            <span className="mk-cta-note">
                                Free early access. Yours to make.
                            </span>
                        </div>
                        <div className="mk-cta-art" aria-hidden="true">
                            <span className="mk-cta-star">✳</span>
                            <span className="mk-cta-link">
                                <Link2 size={25} /> introify.com/you{" "}
                                <ArrowUpRight size={20} />
                            </span>
                            <span className="mk-cta-handwriting">
                                start something.
                            </span>
                        </div>
                    </div>
                </section>
            </main>
        </MarketingShell>
    )
}

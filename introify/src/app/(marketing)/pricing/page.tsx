import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { marketingMetadata } from "@/lib/marketing-seo"

export const metadata = marketingMetadata({
    title: "Pricing & early access",
    description: "Create your Introify page during free early access. Understand platform access, merchant prices and currently available payment options.",
    path: "/pricing",
    index: false,
})

export default function PricingPage() {
    return (
        <MarketingShell>
            <main id="main-content" className="mk-policy-main">
                <div className="mk-container">
                    <Link href="/" className="mk-back"><ArrowLeft size={15} /> Back to Introify</Link>
                    <div className="mk-policy-heading">
                        <span className="mk-eyebrow">A place to start</span>
                        <h1>Free early access.</h1>
                        <p>Create a page for your work and bring your offerings together. No card required to get started.</p>
                        <div className="mk-policy-meta"><span>Current platform access: free</span><span>No paid Introify plans are currently offered.</span></div>
                    </div>

                    <div className="mk-draft-notice">
                        <strong>Room to begin. Clear choices as we grow.</strong>
                        <p>Early access is the current stage of Introify. It is not a promise of permanent free access or unlimited usage. If paid services are introduced, the price, applicable limits, billing terms and cancellation conditions will be shown before you choose a paid service.</p>
                    </div>

                    <section aria-labelledby="early-access-tools">
                        <div className="mk-section-heading">
                            <div><span className="mk-eyebrow">Your starting point</span><h2 id="early-access-tools">Bring your work together.</h2></div>
                            <p>Start with the tools that fit your work. Add and update information from your dashboard.</p>
                        </div>
                        <div className="mk-feature-grid">
                            <article className="mk-feature mk-feature-profile">
                                <span className="mk-feature-number">01 / YOUR PAGE</span>
                                <h3>Introduce yourself.</h3>
                                <p>Create your profile, add your story and links, and share your page or QR card.</p>
                            </article>
                            <article className="mk-feature mk-feature-booking">
                                <span className="mk-feature-number">02 / YOUR OFFERINGS</span>
                                <h3>Show what you do.</h3>
                                <p>Present services, product catalogs, digital products, courses, events or a restaurant menu, depending on your business.</p>
                            </article>
                            <article className="mk-feature mk-feature-shop">
                                <span className="mk-feature-number">03 / YOUR DASHBOARD</span>
                                <h3>Keep the next step in view.</h3>
                                <p>Manage available booking slots, lead notes and follow-ups, and review activity on your page.</p>
                            </article>
                        </div>
                    </section>

                    <div className="mk-policy-article mk-section">
                        <section aria-labelledby="merchant-prices">
                            <h2 id="merchant-prices">A page owner’s prices are separate.</h2>
                            <p>Free platform access does not make every product, course, event or service on Introify free. Individual page owners set prices for their own offerings. Check the amount, currency, what is included, and that business’s delivery and cancellation terms before placing an order or booking.</p>
                            <p>Where a business enables them, product orders may use manual UPI, cash on delivery or WhatsApp arrangements. A merchant confirms a manual payment separately. Introify does not currently provide active online card checkout.</p>
                        </section>
                        <section aria-labelledby="feature-availability">
                            <h2 id="feature-availability">Features depend on what is available.</h2>
                            <p>The AI assistant is not currently active in this early-access release. Payment-gateway and automated SMS activation are also pending. Free early access does not include a guarantee of these integrations, automated payouts or message delivery.</p>
                        </section>
                        <section aria-labelledby="commercial-details">
                            <h2 id="commercial-details">Know the terms before you pay.</h2>
                            <p>Future Introify subscription prices, billing periods and own-service refund conditions have not been announced. Public business and policy details are still being completed. The current draft pages do not establish a paid offer or a refund deadline.</p>
                            <p>Read the <Link href="/terms">terms of service</Link> and <Link href="/refund-policy">cancellation and refund policy</Link>, or visit <Link href="/contact">contact details</Link>. For an offering from a page owner, use that business’s published contact information.</p>
                        </section>
                    </div>

                    <div className="mk-hero-ctas">
                        <Link href="/sign-up" className="mk-button">Create your page <ArrowUpRight size={18} /></Link>
                        <Link href="/demo" className="mk-text-link">Explore an example page <ArrowUpRight size={16} /></Link>
                    </div>
                </div>
            </main>
        </MarketingShell>
    )
}

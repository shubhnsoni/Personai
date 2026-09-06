import type { ReactNode } from "react"
import Link from "next/link"
import { PdpGallery } from "@/components/shop/pdp-gallery"
import { PdpBuy, type PdpBuyAction } from "@/components/shop/pdp-buy"
import { PdpReviewPanel } from "@/components/shop/pdp-review-panel"
import { PdpThemeLock } from "@/components/shop/pdp-theme-lock"
import { PdpMoreDeck } from "@/components/shop/pdp-more-deck"
import {
    PDP_LIFESTYLE,
    type PdpContent,
    type PdpQuote,
} from "@/lib/shop/pdp-content"
import "./pdp-light.css"

function Stars({ count = 5 }: { count?: number }) {
    const n = Math.max(0, Math.min(5, Math.round(count)))
    return (
        <span className="stars" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i}>{i < n ? "★" : "☆"}</span>
            ))}
        </span>
    )
}

export function PdpLight({
    slug,
    shopName,
    catalogLabel,
    logoUrl,
    title,
    content,
    photos,
    lifestyleUrl,
    priceLabel,
    compareAtLabel,
    stockLabel,
    inStock,
    ratingAvg,
    ratingCount,
    quotes,
    productId,
    buy,
    notice,
    extraLine,
    extraHref,
    extraHrefLabel,
}: {
    slug: string
    shopName: string
    catalogLabel: string
    logoUrl?: string | null
    title: string
    content: PdpContent
    photos: string[]
    lifestyleUrl?: string | null
    priceLabel: string
    compareAtLabel?: string | null
    stockLabel?: string | null
    inStock?: boolean
    ratingAvg?: number | null
    ratingCount?: number | null
    quotes: PdpQuote[]
    productId: string
    buy: PdpBuyAction
    notice?: ReactNode
    extraLine?: string | null
    extraHref?: string | null
    extraHrefLabel?: string | null
}) {
    const life = lifestyleUrl || photos[1] || PDP_LIFESTYLE
    const blister = photos.length === 0

    return (
        <div
            className="pdp-v13 light"
            style={{ ["--pdp-life" as string]: `url("${life}")` }}
        >
            <PdpThemeLock />
            <header className="shop-header">
                <Link href={`/${slug}/shop`} className="shop-brand">
                    <div className="shop-mark" aria-hidden="true">
                        {logoUrl ? <img src={logoUrl} alt="" /> : null}
                    </div>
                    <div>
                        <span className="shop-name">{shopName}</span>
                        <span className="shop-pipe">|</span>
                        <span className="shop-cat">{catalogLabel}</span>
                    </div>
                </Link>
                <Link href={`/${slug}/shop`} className="ghost-btn">
                    Cart · 0
                </Link>
            </header>

            {notice ? <div className="notice">{notice}</div> : null}

            <main className="wrap">
                <div className="pdp">
                    <PdpGallery photos={photos} title={title} blister={blister} />

                    <section className="info">
                        <div className="kicker">{content.kicker}</div>
                        <h1 className="title">{title}</h1>
                        {ratingCount != null && ratingAvg != null ? (
                            <div className="rating" aria-label={`${ratingAvg.toFixed(1)} stars, ${ratingCount} reviews`}>
                                <Stars count={ratingAvg} />
                                <span className="rating-count">{ratingCount} reviews</span>
                            </div>
                        ) : null}
                        <div className="price">
                            {priceLabel}
                            {compareAtLabel ? <span className="price-was">{compareAtLabel}</span> : null}
                        </div>
                        {stockLabel ? (
                            <div className="stock">
                                <span className={inStock ? "stock-dot" : "stock-dot out"} />
                                {stockLabel}
                            </div>
                        ) : null}
                        {extraLine ? <p className="blurb" style={{ marginBottom: 14 }}>{extraLine}</p> : null}
                        <PdpBuy action={buy} />
                        <p className="blurb">{content.blurb}</p>
                        {content.specs.length > 0 ? (
                            <div className="meta">
                                {content.specs.map((row) => (
                                    <div key={row.label} className="meta-row">
                                        <span className="meta-label">{row.label}</span>
                                        <span className="meta-value">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <a className="review-link" href="#leave-review">
                            Leave a review
                        </a>
                        {extraHref && extraHrefLabel ? (
                            <Link className="quiet-link" href={extraHref}>
                                {extraHrefLabel}
                            </Link>
                        ) : null}
                    </section>
                </div>
            </main>

            <section className="story" aria-label="Brand story">
                <div className="section-label">More details</div>
                <PdpMoreDeck
                    images={[life, photos[1] || life, photos[2] || photos[0] || life]}
                    storyTitle={content.storyTitle}
                    storyBody={content.storyBody}
                />

                <div className="section-label">From the brand</div>
                <div className="brand-mods">
                    <div className="a-full">
                        <div className="a-full-copy">
                            <span className="tag">{content.brandTag}</span>
                            <h3>{content.brandTitle}</h3>
                            <p>{content.brandBody}</p>
                        </div>
                    </div>

                    <div className="a-two">
                        <div className="a-two-media" aria-hidden="true" />
                        <div className="a-two-copy">
                            <span className="tag">{content.sellTag}</span>
                            <h3>{content.sellTitle}</h3>
                            <p>{content.sellBody}</p>
                        </div>
                    </div>

                    <div className="a-three">
                        {content.tiles.map((tile) => (
                            <div key={tile} className="a-tile">
                                <span>{tile}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {quotes.length > 0 ? (
                <section className="reviews" aria-label="Customer reviews">
                    <div className="section-label">Reviews</div>
                    <div className="reviews-grid">
                        {quotes.map((q) => (
                            <div key={q.who + q.text} className="review-card">
                                <Stars count={q.rating} />
                                <p>“{q.text}”</p>
                                <div className="who">{q.who}</div>
                            </div>
                        ))}
                    </div>
                    <PdpReviewPanel productId={productId} />
                </section>
            ) : (
                <section className="reviews" aria-label="Leave a review">
                    <PdpReviewPanel productId={productId} />
                </section>
            )}
            <PdpBuy action={buy} sticky />
        </div>
    )
}

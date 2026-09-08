import type { ReactNode } from "react"
import Link from "next/link"
import { PdpGallery } from "@/components/shop/pdp-gallery"
import { PdpBuy, type PdpBuyAction } from "@/components/shop/pdp-buy"
import { PdpReviewPanel } from "@/components/shop/pdp-review-panel"
import { PdpMoreDeck } from "@/components/shop/pdp-more-deck"
import {
    PDP_LIFESTYLE,
    type PdpContent,
    type PdpQuote,
} from "@/lib/shop/pdp-content"
import { extraDetailPhotos } from "@/lib/shop/pdp-display"
import "./pdp-v13.css"

export type PdpRailItem = {
    id: string
    title: string
    href: string
    photo: string | null
    priceLabel: string
}

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
    showMore,
    related,
    bestsellers,
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
    showMore?: boolean
    related?: PdpRailItem[]
    bestsellers?: PdpRailItem[]
}) {
    const life = lifestyleUrl || photos[1] || photos[0] || PDP_LIFESTYLE
    const moreImages = extraDetailPhotos(photos)
    const showDetails = Boolean(showMore) && moreImages.length > 0
    const blister = photos.length === 0

    return (
        <div
            className="pdp-v13"
            style={{ ["--pdp-life" as string]: `url("${life}")` }}
        >
            <header className="shop-header">
                <div className="shop-header-bar">
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
                </div>
                {notice ? <div className="notice">{notice}</div> : null}
            </header>

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

            {showDetails ? (
            <section className="story" aria-label="More details">
                <div className="section-label">More details</div>
                <PdpMoreDeck
                    images={moreImages}
                    storyTitle={content.storyTitle}
                    storyBody={content.storyBody}
                />
            </section>
            ) : null}

            <PdpRail title="From this category" items={related || []} />
            <PdpRail title="Best sellers" items={bestsellers || []} />

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

function PdpRail({ title, items }: { title: string; items: PdpRailItem[] }) {
    if (!items.length) return null
    return (
        <section className="pdp-rail" aria-label={title}>
            <div className="section-label">{title}</div>
            <div className="pdp-rail-row">
                {items.map((item) => (
                    <Link key={item.id} href={item.href} className="pdp-rail-card">
                        <span className="pdp-rail-photo">
                            {item.photo ? <img src={item.photo} alt="" /> : null}
                        </span>
                        <span className="pdp-rail-title">{item.title}</span>
                        <span className="pdp-rail-price">{item.priceLabel}</span>
                    </Link>
                ))}
            </div>
        </section>
    )
}

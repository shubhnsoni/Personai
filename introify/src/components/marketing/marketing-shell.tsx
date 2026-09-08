import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"
import { ThemeToggle } from "./theme-toggle"
import { MobileNav } from "./mobile-nav"
import "./marketing.css"
import "./marketing-theme.css"

export function BrandMark() {
    return (
        <Link href="/" className="mk-brand" aria-label="Introify home">
            <svg viewBox="0 0 32 32" aria-hidden="true">
                <path
                    d="M6 5h8v8H6zM18 5h8v8h-8zM6 17h8v10H6zM18 17h8v10h-8z"
                    fill="currentColor"
                />
                <path d="M14 13h4v4h-4z" fill="currentColor" />
            </svg>
            introify<span className="mk-brand-dot">.</span>
        </Link>
    )
}

const navigation = [
    ["Product", "/#product"],
    ["Conversations", "/#conversations"],
    ["Stories", "/#stories"],
    ["Pricing", "/pricing"],
    ["FAQ", "/#faq"],
] as const

export function MarketingHeader() {
    return (
        <header className="mk-header">
            <div className="mk-container mk-header-inner">
                <BrandMark />
                <nav className="mk-desktop-nav" aria-label="Main navigation">
                    {navigation.map(([label, href]) => (
                        <Link key={label} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="mk-header-actions">
                    <ThemeToggle />
                    <Link className="mk-sign-in" href="/sign-in">
                        Sign in
                    </Link>
                    <Link className="mk-button mk-button-small" href="/sign-up">
                        Get started <ArrowUpRight size={15} />
                    </Link>
                </div>
                <MobileNav links={navigation} />
            </div>
        </header>
    )
}

const footerGroups = [
    {
        title: "Explore",
        links: [
            ["Product", "/#product"],
            ["Chat examples", "/#conversations"],
            ["Stories", "/#stories"],
            ["Pricing", "/pricing"],
            ["Example page", "/demo"],
            ["Create your page", "/sign-up"],
            ["Sign in", "/sign-in"],
        ],
    },
    {
        title: "Introify",
        links: [
            ["About", "/about"],
            ["Contact", "/contact"],
            ["Acceptable use", "/acceptable-use"],
            ["SMS policy", "/sms-policy"],
        ],
    },
    {
        title: "Policies",
        links: [
            ["Privacy policy", "/privacy"],
            ["Terms & conditions", "/terms"],
            ["Refunds & cancellations", "/refund-policy"],
            ["Delivery & fulfillment", "/delivery-policy"],
            ["Cookie policy", "/cookie-policy"],
        ],
    },
]

export function MarketingFooter() {
    return (
        <footer className="mk-footer">
            <div className="mk-container">
                <div className="mk-footer-top">
                    <div className="mk-footer-brand">
                        <BrandMark />
                        <p>
                            Good work deserves
                            <br />a great introduction.
                        </p>
                        <span className="mk-small-label">
                            YOUR WORK. ONE LINK.
                        </span>
                    </div>
                    {footerGroups.map((group) => (
                        <nav
                            key={group.title}
                            aria-label={`${group.title} footer links`}
                        >
                            <h2>{group.title}</h2>
                            {group.links.map(([label, href]) => (
                                <Link key={href} href={href}>
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    ))}
                </div>
                <div className="mk-footer-bottom">
                    <span>© {new Date().getFullYear()} Introify</span>
                    <span>
                        Made for people building something of their own.
                    </span>
                    <Link href="/#top">Back to top ↑</Link>
                </div>
            </div>
        </footer>
    )
}

export function MarketingShell({ children }: { children: ReactNode }) {
    return (
        <div className="mk-page" id="top">
            <a className="mk-skip-link" href="#main-content">
                Skip to content
            </a>
            <MarketingHeader />
            {children}
            <MarketingFooter />
        </div>
    )
}

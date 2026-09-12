import Link from "@/components/navigation/transition-link"
import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"
import { ThemeToggle } from "./theme-toggle"
import { MobileNav } from "./mobile-nav"
import { LanguageSwitcher } from "./language-switcher"
import { IntroifyWordmark } from "@/components/brand/wordmark"
import { cn } from "@/lib/utils"
import { homeHash, localeHomePath, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"
import "./marketing.css"
import "./marketing-theme.css"
import "./public-blue.css"

export function BrandMark({ locale = "en" }: { locale?: UiLocale }) {
    const chrome = messagesFor(locale).chrome
    return (
        <Link href={localeHomePath(locale)} className="mk-brand" aria-label={chrome.home}>
            <IntroifyWordmark decorative />
        </Link>
    )
}

function marketingNav(locale: UiLocale) {
    const nav = messagesFor(locale).chrome.nav
    return [
        [nav.product, homeHash(locale, "product")],
        [nav.forYou, homeHash(locale, "stories")],
        [nav.how, homeHash(locale, "how-it-works")],
        [nav.pricing, "/pricing"],
        [nav.faq, homeHash(locale, "faq")],
    ] as [string, string][]
}

export function MarketingHeader({ locale = "en" }: { locale?: UiLocale }) {
    const chrome = messagesFor(locale).chrome
    const navigation = marketingNav(locale)
    return (
        <header className="mk-header">
            <div className="mk-container mk-header-inner">
                <BrandMark locale={locale} />
                <nav className="mk-desktop-nav" aria-label="Main navigation">
                    {navigation.map(([label, href]) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="mk-header-actions">
                    <LanguageSwitcher locale={locale} label={chrome.language} />
                    <ThemeToggle />
                    <Link className="mk-sign-in" href="/sign-in">
                        {chrome.signIn}
                    </Link>
                    <Link className="mk-button mk-button-small" href="/sign-up">
                        {chrome.getStarted} <ArrowUpRight size={15} />
                    </Link>
                </div>
                <MobileNav
                    links={navigation}
                    getStarted={chrome.getStarted}
                    signIn={chrome.signIn}
                    menuLabel={chrome.menu}
                />
            </div>
        </header>
    )
}

export function MarketingFooter({ locale = "en" }: { locale?: UiLocale }) {
    const chrome = messagesFor(locale).chrome
    const footerGroups = [
        {
            title: chrome.footer.explore,
            links: [
                ...marketingNav(locale),
                [chrome.footer.demo, "/demo"],
                [chrome.footer.create, "/sign-up"],
                [chrome.signIn, "/sign-in"],
            ],
        },
        {
            title: chrome.footer.introify,
            links: [
                [chrome.footer.about, "/about"],
                [chrome.footer.contact, "/contact"],
                [chrome.footer.acceptableUse, "/acceptable-use"],
                [chrome.footer.sms, "/sms-policy"],
            ],
        },
        {
            title: chrome.footer.policies,
            links: [
                [chrome.footer.privacy, "/privacy"],
                [chrome.footer.terms, "/terms"],
                [chrome.footer.refunds, "/refund-policy"],
                [chrome.footer.delivery, "/delivery-policy"],
                [chrome.footer.cookies, "/cookie-policy"],
            ],
        },
    ]
    const [taglineLead, taglineTail] = chrome.tagline.split("\n")
    return (
        <footer className="mk-footer">
            <div className="mk-container">
                <div className="mk-footer-top">
                    <div className="mk-footer-brand">
                        <BrandMark locale={locale} />
                        <p>
                            {taglineLead}
                            <br />
                            {taglineTail}
                        </p>
                        <span className="mk-small-label">
                            {chrome.kicker}
                        </span>
                    </div>
                    {footerGroups.map((group) => (
                        <nav
                            key={group.title}
                            aria-label={`${group.title} footer links`}
                        >
                            <h2>{group.title}</h2>
                            {group.links.map(link => {
                                const [label, href] = link
                                return (
                                    <Link key={`${group.title}:${href}`} href={href}>
                                        {label}
                                    </Link>
                                )
                            })}
                        </nav>
                    ))}
                </div>
                <div className="mk-footer-bottom">
                    <span>© {new Date().getFullYear()} Introify</span>
                    <span>{chrome.madeFor}</span>
                    <Link href="#top">{chrome.backToTop}</Link>
                </div>
            </div>
        </footer>
    )
}

export function MarketingShell({ children, className, locale = "en" }: { children: ReactNode; className?: string; locale?: UiLocale }) {
    const chrome = messagesFor(locale).chrome
    return (
        <div className={cn("mk-page", className)} id="top" lang={locale === "hi" ? "hi" : undefined}>
            <a className="mk-skip-link" href="#main-content">
                {chrome.skip}
            </a>
            <MarketingHeader locale={locale} />
            {children}
            <MarketingFooter locale={locale} />
        </div>
    )
}

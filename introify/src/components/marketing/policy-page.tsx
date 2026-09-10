import Link from "@/components/navigation/transition-link"
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react"
import { MarketingShell } from "./marketing-shell"
import type { PolicyDocument } from "@/lib/marketing-policies"
import { fill, localeHomePath, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

export function PolicyPage({ document, locale = "en" }: { document: PolicyDocument; locale?: UiLocale }) {
    const policy = messagesFor(locale).chrome.policy
    return (
        <MarketingShell locale={locale}>
            <main id="main-content" className="mk-policy-main">
                <div className="mk-container">
                    <Link href={localeHomePath(locale)} className="mk-back">
                        <ArrowLeft size={15} /> {policy.back}
                    </Link>
                    <div className="mk-policy-heading">
                        <span className="mk-eyebrow">{document.kicker}</span>
                        <h1>{document.title}</h1>
                        <p>{document.description}</p>
                        <div className="mk-policy-meta">
                            <span>
                                <FileText size={14} />{" "}
                                {document.draft
                                    ? policy.draftBadge
                                    : policy.publishedBadge}
                            </span>
                            <span>{fill(policy.updated, { date: document.updatedOn })}</span>
                        </div>
                    </div>
                    {document.draft && (
                        <div className="mk-draft-notice">
                            <strong>{policy.draftTitle}</strong>
                            <p>{policy.draftBody}</p>
                        </div>
                    )}
                    <div className="mk-policy-layout">
                        <aside>
                            <nav aria-label={policy.onThisPage}>
                                <h2>{policy.onThisPage}</h2>
                                {document.sections.map((section, index) => (
                                    <a key={section.id} href={`#${section.id}`}>
                                        <span>
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        {section.title}
                                    </a>
                                ))}
                            </nav>
                            <Link href="/contact" className="mk-policy-help">
                                {policy.contactCta} <ArrowUpRight size={16} />
                            </Link>
                        </aside>
                        <article className="mk-policy-article">
                            {document.sections.map((section, index) => (
                                <section id={section.id} key={section.id}>
                                    <span className="mk-section-number">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <h2>{section.title}</h2>
                                    {section.paragraphs?.map((paragraph, i) => (
                                        <p key={i}>{paragraph}</p>
                                    ))}
                                    {section.bullets && (
                                        <ul>
                                            {section.bullets.map(
                                                (bullet, i) => (
                                                    <li key={i}>{bullet}</li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                                    {section.fields && (
                                        <dl className="mk-policy-fields">
                                            {section.fields.map((field) => (
                                                <div key={field.label}>
                                                    <dt>{field.label}</dt>
                                                    <dd>
                                                        {field.value || (
                                                            <span className="mk-blank-field">
                                                                <span className="sr-only">
                                                                    {policy.notProvided}
                                                                </span>
                                                                &nbsp;
                                                            </span>
                                                        )}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                </section>
                            ))}
                        </article>
                    </div>
                </div>
            </main>
        </MarketingShell>
    )
}

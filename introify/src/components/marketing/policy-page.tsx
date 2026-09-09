import Link from "@/components/navigation/transition-link"
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react"
import { MarketingShell } from "./marketing-shell"
import type { PolicyDocument } from "@/lib/marketing-policies"

export function PolicyPage({ document }: { document: PolicyDocument }) {
    return (
        <MarketingShell>
            <main id="main-content" className="mk-policy-main">
                <div className="mk-container">
                    <Link href="/" className="mk-back">
                        <ArrowLeft size={15} /> Back to Introify
                    </Link>
                    <div className="mk-policy-heading">
                        <span className="mk-eyebrow">{document.kicker}</span>
                        <h1>{document.title}</h1>
                        <p>{document.description}</p>
                        <div className="mk-policy-meta">
                            <span>
                                <FileText size={14} />{" "}
                                {document.draft
                                    ? "Draft for review"
                                    : "Published policy"}
                            </span>
                            <span>Updated {document.updatedOn}</span>
                        </div>
                    </div>
                    {document.draft && (
                        <div className="mk-draft-notice">
                            <strong>Details are still being completed.</strong>
                            <p>
                                This page is a draft. Blank business and policy
                                fields will be completed before payment or SMS
                                services are activated.
                            </p>
                        </div>
                    )}
                    <div className="mk-policy-layout">
                        <aside>
                            <nav aria-label="On this page">
                                <h2>On this page</h2>
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
                                Need to get in touch? <ArrowUpRight size={16} />
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
                                                                    Not yet
                                                                    provided
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

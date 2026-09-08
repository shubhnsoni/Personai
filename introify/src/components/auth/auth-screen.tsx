"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Link2, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/marketing/marketing-shell";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import "./auth.css";

const copy = {
  "sign-in": {
    eyebrow: "YOUR NEXT CHAPTER IS WAITING",
    title: "Good to have",
    emphasis: "you back.",
    description:
      "A new idea. A small update. A conversation worth starting. Pick up where you left off.",
    sectionLabel: "Sign in to Introify",
  },
  "sign-up": {
    eyebrow: "A LITTLE MORE YOU. A LOT MORE POSSIBLE.",
    title: "There’s more to you.",
    emphasis: "Let’s show it.",
    description:
      "Give your story, services and ideas a place of their own. Start with a page. Make it yours.",
    sectionLabel: "Create your Introify account",
  },
} as const;

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = pathname.startsWith("/sign-up") ? "sign-up" : "sign-in";
  const current = copy[mode];

  return (
    <div className="mk-page au-page">
      <a className="mk-skip-link" href="#auth-content">
        Skip to account form
      </a>
      <header className="au-header">
        <BrandMark />
        <div className="au-header-actions">
          <ThemeToggle />
          <Link href="/" className="au-home">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to home</span>
          </Link>
        </div>
      </header>

      <main className="au-main">
        <aside
          className="au-editorial"
          aria-label="Your next chapter with Introify"
        >
          <span className="au-eyebrow">{current.eyebrow}</span>
          <p className="au-editorial-title">
            {current.title}
            <br />
            <em>{current.emphasis}</em>
          </p>
          <p className="au-description">{current.description}</p>
          <div className="au-story" aria-label="Illustrative creator page">
            <div className="au-story-photo">
              <Image
                src="/marketing/ceramic-artist.png"
                alt="Illustrative portrait of a ceramic artist in her studio"
                fill
                sizes="(max-width: 900px) 1px, (max-width: 1200px) 36vw, 440px"
              />
              <span className="au-story-label">A SPACE FOR WHAT YOU DO</span>
            </div>
            <div className="au-story-caption">
              <div>
                <strong>
                  Mira Studio <span aria-hidden="true">✳</span>
                </strong>
                <span>CERAMICS & CREATIVE WORKSHOPS</span>
              </div>
              <ArrowUpRight size={22} aria-hidden="true" />
            </div>
            <div className="au-story-note">
              <Link2 size={17} aria-hidden="true" />
              <span>
                Your work. Your story.
                <br />
                <strong>One place to begin.</strong>
              </span>
            </div>
          </div>
          <p className="au-example-note">
            Illustrative profile and generated portrait.
          </p>
        </aside>

        <section className="au-form-column" aria-label={current.sectionLabel}>
          <div className="au-form-card" id="auth-content" tabIndex={-1}>
            <div className="au-card-kicker">
              <Sparkles size={15} aria-hidden="true" />
              <span>
                {mode === "sign-up"
                  ? "MAKE YOUR INTRO"
                  : "YOUR SPACE, RIGHT HERE"}
              </span>
            </div>
            <div className="au-clerk">{children}</div>
            <div className="au-card-note">
              <Check size={14} aria-hidden="true" />
              <span>
                {mode === "sign-up"
                  ? "Free early access. No card required."
                  : "Your page and dashboard are a sign-in away."}
              </span>
            </div>
          </div>
          <p className="au-policy-note">
            Learn how Introify works in our <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy policy</Link>.
          </p>
        </section>
      </main>

      <footer className="au-footer">
        <span>Good work deserves a great introduction.</span>
        <nav aria-label="Account page links">
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}

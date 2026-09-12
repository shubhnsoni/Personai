"use client";

import { StoryBot } from "@/components/landing/story-bot";
import Link from "@/components/navigation/transition-link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
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
          <div className="au-bot-scene">
            <p>Your page. With a voice.</p>
            <StoryBot name={mode === "sign-up" ? "Pearl" : "Ion"} />
            <p>{mode === "sign-up" ? "A little personality. A place of your own." : "Ready when you are."}</p>
          </div>
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
                  ? "Start on Free. No card required."
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
          <Link href="/pricing">Compare plans</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}

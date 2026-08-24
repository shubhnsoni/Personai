"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { ProfileFrame } from "@/components/brand/profile-frame"
import { WelcomeOrb } from "@/components/welcome-orb"
import {
  ArrowRight,
  MessageSquare,
  Calendar,
  Package,
  GraduationCap,
  CalendarDays,
  UsersRound,
  Gift,
  Link2,
  TrendingUp,
  FileText,
  CreditCard,
  Check,
} from "lucide-react"
import { motion } from "framer-motion"
import { fadeUp } from "@/lib/motion"

const features = [
  { icon: MessageSquare, title: "AI chat", copy: "A clone that answers like you, 24/7." },
  { icon: Calendar, title: "Booking", copy: "Visitors pick a slot. You get the calendar invite." },
  { icon: Package, title: "Products", copy: "Sell downloads without leaving the chat." },
  { icon: GraduationCap, title: "Courses", copy: "Modules and lessons behind one checkout." },
  { icon: CalendarDays, title: "Events", copy: "Webinars and workshops, registered in-page." },
  { icon: UsersRound, title: "Community", copy: "Paid rooms on Telegram or Discord." },
  { icon: Gift, title: "Lead magnets", copy: "Forms and giveaways that capture email." },
  { icon: Link2, title: "Short links", copy: "Trackable /you/x links for every drop." },
  { icon: FileText, title: "Train it", copy: "Docs and URLs become the clone’s memory." },
  { icon: TrendingUp, title: "Analytics", copy: "Chats, leads, and revenue on one canvas." },
  { icon: CreditCard, title: "Payments", copy: "Stripe checkout for calls, files, and classes." },
]

const steps = [
  { n: "01", t: "Make the page", d: "Name, bio, look. Two minutes." },
  { n: "02", t: "Train the clone", d: "Drop docs, services, products." },
  { n: "03", t: "Share /you", d: "It chats, books, and sells." },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:h-16 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link href="#features" className="hidden text-sm text-zinc-400 hover:text-white sm:inline">
              Features
            </Link>
            <Link href="/demo" className="hidden text-sm text-zinc-400 hover:text-white sm:inline">
              Demo
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="px-2 text-zinc-400 hover:text-white sm:px-3">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" variant="pill" className="h-8 px-3 text-xs sm:h-9 sm:px-5 sm:text-sm">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative flex flex-col items-center px-3 pt-24 pb-16 text-center sm:px-4 sm:pt-32 sm:pb-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[18%] left-1/2 h-[620px] w-[620px] -translate-x-1/2 opacity-25">
            <div className="h-full w-full rounded-full bg-gradient-to-br from-orb-from to-orb-to blur-[130px]" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative mb-8"
        >
          <WelcomeOrb size={200} variant="aqua" speed={0.85} intensity={1.15} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-300/80"
        >
          PersonaLink
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6 }}
          className="relative mt-3 max-w-4xl text-[1.85rem] leading-[1.12] font-semibold tracking-tight sm:text-6xl lg:text-7xl"
        >
          Your AI that{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            talks, books, and sells
          </span>{" "}
          while you&apos;re offline.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="relative mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          Your public page chats like you, books the call, and takes the payment — while you stay offline.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.55 }}
          className="relative mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
        >
          <Link href="/sign-up">
            <Button size="lg" variant="pill" className="h-12 w-full gap-2 px-8 text-base sm:w-auto">
              Create your page <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" size="lg" pill className="h-12 w-full border-zinc-700 px-8 text-base text-zinc-300 hover:bg-zinc-900 sm:w-auto">
              Talk to Riley
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.7 }}
          className="relative mt-14 w-full max-w-5xl"
        >
          <ProfileFrame />
        </motion.div>
      </section>

      <section className="border-t border-white/5 px-3 py-14 sm:px-4 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">A visitor lands</p>
            <div className="mt-4 space-y-2">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-zinc-300">
                Can you do a 30-min strategy call next week?
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                Yes — Tuesday 2pm or Thursday 11am. I&apos;ll send the invite.
              </div>
            </div>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">You see it in Studio</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Chats", "24"],
                ["Leads", "8"],
                ["Booked", "3"],
                ["Revenue", "$420"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-black/40 px-3 py-2">
                  <p className="text-[10px] text-zinc-500">{k}</p>
                  <p className="text-lg font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="border-t border-white/5 px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10"
          >
            <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              The page does the work
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Everything behind /you
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i % 6}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:p-4"
              >
                <f.icon className="mb-3 h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-medium">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{f.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-8 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300"
          >
            Live in minutes
          </motion.p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="bg-black p-6 sm:p-8"
              >
                <div className="font-mono text-xs text-zinc-600">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-zinc-500">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-3 py-16 sm:px-4 sm:py-24">
        <div className="mx-auto max-w-lg text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.p variants={fadeUp} custom={0} className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              Pricing
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="mt-2 text-3xl font-semibold sm:text-4xl">
              Free while we build.
            </motion.h2>
            <motion.ul variants={fadeUp} custom={2} className="mx-auto mt-8 space-y-2 text-left text-sm text-zinc-400">
              {["Unlimited visitor chats", "Booking + leads", "Products, courses, events", "Analytics"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                  {item}
                </li>
              ))}
            </motion.ul>
            <motion.div variants={fadeUp} custom={3} className="mt-8">
              <Link href="/sign-up">
                <Button variant="pill" className="h-12 px-8">
                  Start free
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/5 px-3 py-20 sm:px-4 sm:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/2 h-[360px] w-[720px] -translate-x-1/2 opacity-15">
            <div className="h-full w-full rounded-full bg-gradient-to-t from-orb-from to-orb-to blur-[120px]" />
          </div>
        </div>
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Clone the busy work.</h2>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">
            Creators and consultants who want the page to handle the first conversation.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" variant="pill" className="h-12 gap-2 px-8">
                Create your PersonaLink <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="lg" pill className="h-12 border-zinc-700 px-8 text-zinc-300 hover:bg-zinc-900">
                See the live demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-3 py-8 sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-600 sm:flex-row">
          <Logo href={null} />
          <span>&copy; {new Date().getFullYear()} PersonaLink</span>
        </div>
      </footer>
    </div>
  )
}

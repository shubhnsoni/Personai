"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { ProfileFrame } from "@/components/brand/profile-frame"
import { ArrowRight, MessageSquare, Zap, Sparkles, Check } from "lucide-react"
import { motion } from "framer-motion"
import { fadeUp } from "@/lib/motion"

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/demo" className="hidden sm:inline-flex text-sm text-zinc-400 hover:text-white transition-colors">
              Live demo
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" variant="pill" className="px-5">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 flex flex-col items-center text-center px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-orb-from to-orb-to blur-[120px]" />
          </div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="relative text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]"
        >
          Your AI clone that{" "}
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            sells, books & engages
          </span>{" "}
          24/7
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="relative mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl leading-relaxed"
        >
          One public page that chats with visitors, showcases your work, books calls,
          and sells your products — while you sleep.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link href="/sign-up">
            <Button size="lg" variant="pill" className="px-8 h-14 text-base gap-2 w-full sm:w-auto">
              Create Your PersonaLink <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" size="lg" pill className="px-8 h-14 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-900 w-full sm:w-auto">
              Talk to the live demo
            </Button>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="relative mt-6 text-sm text-zinc-600"
        >
          Free to start · No credit card required
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="relative mt-14 w-full max-w-5xl"
        >
          <ProfileFrame />
        </motion.div>
      </section>

      <section id="how-it-works" className="py-20 sm:py-32 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-purple-400 font-medium text-sm uppercase tracking-wider mb-3">
              How It Works
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold">
              Live in 3 minutes
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "01",
                title: "Create your profile",
                description: "Sign up, pick your role, add your bio and work history. Our wizard guides you through everything.",
                icon: <Sparkles className="w-6 h-6" />,
              },
              {
                step: "02",
                title: "Train your AI",
                description: "Upload documents, add services & products. Your AI learns everything about you automatically.",
                icon: <Zap className="w-6 h-6" />,
              },
              {
                step: "03",
                title: "Share your link",
                description: "Get your personalink.com/you URL. Visitors chat with your AI, book calls, and buy your products.",
                icon: <MessageSquare className="w-6 h-6" />,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="relative group"
              >
                <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-all hover:bg-zinc-900/50">
                  <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6">
                    {item.icon}
                  </div>
                  <div className="text-xs font-mono text-zinc-600 mb-2">{item.step}</div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-32 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.p variants={fadeUp} custom={0} className="text-purple-400 font-medium text-sm uppercase tracking-wider mb-3">
              Pricing
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold mb-6">
              Start free, scale when ready
            </motion.h2>
            <motion.div variants={fadeUp} custom={2} className="inline-block rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 sm:p-10 w-full max-w-md">
              <div className="text-sm text-purple-400 font-medium mb-2">Free Plan</div>
              <div className="text-5xl font-bold mb-1">$0</div>
              <div className="text-zinc-500 text-sm mb-2">forever · upgrade anytime</div>
              <p className="text-zinc-500 text-sm mb-6">Pro coming later. No paywall today.</p>
              <ul className="space-y-3 text-left text-sm text-zinc-300 mb-8">
                {[
                  "1 AI profile page",
                  "Unlimited visitor chats",
                  "Service booking",
                  "Lead capture",
                  "Basic analytics",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button variant="pill" className="w-full h-12">
                  Get Started Free
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-32 px-4 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10">
            <div className="w-full h-full rounded-full bg-gradient-to-t from-orb-from to-orb-to blur-[120px]" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            Ready to clone yourself?
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
            Join creators, consultants, and freelancers who let their AI handle the busy work.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="pill" className="px-10 h-14 text-base gap-2">
                Create Your PersonaLink <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="lg" pill className="px-10 h-14 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-900">
                See Riley&apos;s live page
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <Logo href={null} />
          <span>&copy; {new Date().getFullYear()} PersonaLink. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

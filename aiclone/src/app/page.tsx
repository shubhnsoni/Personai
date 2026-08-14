"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { WelcomeOrb } from "@/components/welcome-orb"
import { ArrowRight, MessageSquare, Zap, DollarSign, Calendar, Users, BarChart3, Sparkles, Check } from "lucide-react"
import { motion } from "framer-motion"
import { fadeUp } from "@/lib/motion"

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500 rounded-full px-5">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 flex flex-col items-center text-center px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-pink-600 blur-[120px]" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative mb-8"
        >
          <WelcomeOrb size={140} colors={["#A855F7", "#EC4899"]} speed={0.8} intensity={1.2} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]"
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
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl leading-relaxed"
        >
          Create an AI-powered profile page that knows everything about you.
          It chats with visitors, showcases your work, books calls, and sells your products — while you sleep.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link href="/sign-up">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-500 rounded-full px-8 h-14 text-base gap-2 w-full sm:w-auto">
              Create Your PersonaLink <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button variant="outline" size="lg" className="rounded-full px-8 h-14 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-900 w-full sm:w-auto">
              See How It Works
            </Button>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-6 text-sm text-zinc-600"
        >
          Free to start · No credit card required
        </motion.p>
      </section>

      {/* How It Works */}
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

      {/* Features */}
      <section className="py-20 sm:py-32 px-4 border-t border-white/5 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-purple-400 font-medium text-sm uppercase tracking-wider mb-3">
              Features
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold">
              Everything you need to scale yourself
            </motion.h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <MessageSquare className="w-5 h-5" />, title: "AI Chat Agent", desc: "GPT-4o powered chatbot that knows your entire professional history and engages visitors naturally." },
              { icon: <Calendar className="w-5 h-5" />, title: "Smart Booking", desc: "Visitors book calls directly through your AI. Integrated calendar with availability management." },
              { icon: <DollarSign className="w-5 h-5" />, title: "Sell Products", desc: "Digital products, courses, events, and community memberships — all with Stripe checkout built in." },
              { icon: <Users className="w-5 h-5" />, title: "Lead Capture", desc: "Your AI collects contact info from interested visitors. Never miss a potential client again." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Analytics Dashboard", desc: "Track conversations, leads, bookings, and revenue. See your conversion funnel in real time." },
              { icon: <Zap className="w-5 h-5" />, title: "Instant Setup", desc: "Pick a template, add your info, and you're live. No coding required, ever." },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Hint */}
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
              <div className="text-zinc-500 text-sm mb-6">forever · upgrade anytime</div>
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
                <Button className="w-full bg-purple-600 hover:bg-purple-500 rounded-full h-12">
                  Get Started Free
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 px-4 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10">
            <div className="w-full h-full rounded-full bg-gradient-to-t from-purple-600 to-pink-600 blur-[120px]" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            Ready to clone yourself?
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
            Join creators, consultants, and freelancers who let their AI handle the busy work.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-500 rounded-full px-10 h-14 text-base gap-2">
              Create Your PersonaLink <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <Logo href={null} />
          <span>&copy; {new Date().getFullYear()} PersonaLink. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}

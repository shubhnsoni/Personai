import { weekdaysHours, type DemoShop } from "./types"

const mark = "/uploads/neal-mark.svg"

/** Public LinkedIn vanity https://www.linkedin.com/in/neal — Nilesh Kumar, Deel, Bengaluru. */
export const NILESH_KUMAR: DemoShop = {
    flavor: "CONSULTANT",
    engine: "CONSULTANT",
    goal: "TAKE_APPOINTMENTS",
    slug: "neal",
    name: "Nilesh Kumar",
    headline: "Sales, Revenue Operations & GTM Systems Leader | Deel | Ex-Razorpay",
    bio: `Nilesh Kumar helps SaaS companies build predictable revenue systems by fixing the machinery behind sales: processes, CRM, automation, forecasting, SDR operations, team structure and AI-powered workflows.

He started in frontline sales and moved into the systems behind revenue. That means both sides: what happens inside a sales conversation, and what has to happen behind the scenes for hundreds of those conversations to run.

At Deel he works in Revenue Operations — operations teams, automation across 70+ countries, SOPs, faster turnaround, and AI-powered GTM systems. Before Deel: Razorpay and upGrad Jeet. Bengaluru. School: Rajiv Gandhi Proudyogiki Vishwavidyalaya.

This Introify page is the public desk. Chat is Ask Nilesh AI — RevOps, Salesforce, SDR desks, automation, or whether he is the right hire. About is the short read; the full about page holds playbooks, case studies and frameworks. Book a diagnostic if a longer call is useful. Playbooks sit in the shop. Continue on LinkedIn when you already know you want to talk.

No phone is published here. Reach him on LinkedIn: https://www.linkedin.com/in/neal`,
    welcome: "Ask Nilesh AI about RevOps, Salesforce, SDR teams, or GTM. Book a diagnostic, or continue on LinkedIn — linkedin.com/in/neal.",
    speakerName: "Nilesh",
    speakerRole: "sales and revenue operations leader",
    imageUrl: mark,
    shopLogoUrl: mark,
    venue: {
        address: {
            formatted: "Bengaluru, Karnataka, India",
            line1: "Bengaluru",
            locality: "Bengaluru",
            region: "Karnataka",
            postalCode: "",
            country: "IN",
        },
        categories: ["Revenue operations", "GTM systems", "Sales operations", "AI automation"],
    },
    socials: {
        linkedin: "https://www.linkedin.com/in/neal",
    },
    hours: weekdaysHours("10:00", "18:00"),
    staff: [{ name: "Nilesh Kumar", kind: "STAFF", capacity: 1 }],
    services: [
        { name: "RevOps Diagnostic", description: "Thirty minutes. Where revenue is leaking — CRM, routing, stages, forecast, SDR to AE handoff. No fee. Continue on LinkedIn if you already know the brief.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "GTM Strategy Consultation", description: "Forty-five minutes on the operating system behind the go-to-market team: process, CRM, ownership, dashboards.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Sales Team Coaching Session", description: "Sixty minutes with SDRs, BDRs, managers or a revenue team. Discovery, qualification, BANT, MEDDIC, objections, reviews.", durationMinutes: 60, priceRupees: 0, kind: "SESSION" },
        { name: "Revenue Systems Workshop", description: "Ninety minutes. Map the current sales operation and leave with a 30/60/90 implementation shape.", durationMinutes: 90, priceRupees: 0, kind: "SESSION" },
        { name: "Custom RevOps Project", description: "Scoped after the diagnostic. Audit, GTM system setup, SDR scale, Salesforce, or AI automation. Quoted on the call — not in this chat.", durationMinutes: 90, priceRupees: 0, kind: "SESSION" },
    ],
    products: [
        {
            title: "RevOps Audit Template",
            description: "A structured framework for evaluating a revenue organisation: CRM, pipeline, forecast, people, process, automation, data and reporting.",
            category: "Playbooks",
            priceRupees: 2999,
            type: "PDF",
            fulfillment: "DIGITAL",
            shipMode: "NONE",
            sku: "NK-AUDIT",
            thumbnailUrl: mark,
            highlights: ["RevOps Health Score", "Priority problems", "30/60/90 shape"],
        },
        {
            title: "SDR Manager Toolkit",
            description: "Scorecard, 1:1 template, pipeline review, call audit and coaching framework for an SDR desk.",
            category: "Playbooks",
            priceRupees: 4999,
            type: "PDF",
            fulfillment: "DIGITAL",
            shipMode: "NONE",
            sku: "NK-SDR",
            thumbnailUrl: mark,
            highlights: ["SDR scorecard", "Call audit", "AE handoff"],
        },
        {
            title: "Salesforce Setup Blueprint",
            description: "CRM architecture for a growing SaaS team: stages, required fields, ownership, hygiene and dashboards.",
            category: "Playbooks",
            priceRupees: 7999,
            type: "PDF",
            fulfillment: "DIGITAL",
            shipMode: "NONE",
            sku: "NK-SF",
            thumbnailUrl: mark,
            highlights: ["Pipeline design", "Lead lifecycle", "Audit rules"],
        },
        {
            title: "AI RevOps Automation Library",
            description: "Templates and workflows for lead enrichment, CRM updates, meeting summaries, pipeline risk and manager alerts — with human checkpoints.",
            category: "Playbooks",
            priceRupees: 9999,
            type: "PDF",
            fulfillment: "DIGITAL",
            shipMode: "NONE",
            sku: "NK-AI",
            thumbnailUrl: mark,
            highlights: ["What to automate", "What stays human", "Risk notes"],
        },
        {
            title: "RevOps Operating System",
            description: "SOPs, dashboards, workflows, processes and templates for standing up a revenue operations function.",
            category: "Playbooks",
            priceRupees: 24999,
            type: "PDF",
            fulfillment: "DIGITAL",
            shipMode: "NONE",
            sku: "NK-OS",
            thumbnailUrl: mark,
            highlights: ["SOP set", "Dashboards", "Accountability"],
        },
    ],
    experiences: [
        {
            company: "Deel",
            role: "Operation Lead, Global Service Center",
            startDate: "Mar 2025",
            description: "Built and scaled a high-performance operations team from about 10 to more than 20 across global Revenue Operations. Improved turnaround through SOP redesign and GTM operations frameworks. Architected automation across 70+ countries. Standardised Sales Operations SOPs. Building AI-powered engines for revenue workflows and forecast accuracy.",
        },
        {
            company: "Deel",
            role: "Sales Manager — BDA and SDR",
            startDate: "Jun 2023",
            endDate: "Mar 2025",
            description: "BDA Manager: shadow sessions, SOPs for BDA / team-lead / manager workflows, audit and quality control, account scrub, Salesforce audit dashboards and SDR backlog tracking. SDR Manager: built the IndiaDeelers SDR team from inception across SMB, mid-market and enterprise. Coaching on BANT and MEDDIC, outbound calling for India, AE handoffs, client case studies.",
        },
        {
            company: "Razorpay",
            role: "Associate Manager, Business Development",
            startDate: "Nov 2021",
            endDate: "Jun 2023",
            description: "Bengaluru. End-to-end sales process for a new product, Salesforce CRM, daily revenue reporting, hiring for associate through customer-success roles. Weekly, monthly and quarterly reports to the Director of Product. Closed high-value accounts while mentoring the team.",
        },
        {
            company: "Razorpay",
            role: "Associate Sales Manager",
            startDate: "Nov 2021",
            endDate: "May 2023",
            description: "CRM rollout, BDA/SDR hiring frameworks, GTM with Product, Tech, Marketing and Operations. Built the DRR tracker. On-Spot Award for strategic closure of Go Noise and Fire-Boltt.",
        },
        {
            company: "upGrad Jeet",
            role: "Sales Manager",
            startDate: "Jun 2021",
            endDate: "Nov 2021",
            description: "Short sprint — the company shut down. Mass hiring for sales and operations, train-the-trainer, CRM automation, monthly sales matrices, RNR and PIP, objection-handling training for 90+ reps.",
        },
    ],
    projects: [
        { title: "Global Operations Automation", description: "Automation across operations spanning 70+ countries at Deel. Focus: automation, data accuracy, operational scalability, process standardisation.", year: "2025", client: "Deel" },
        { title: "Revenue Operations Team Scale", description: "Grew an operations function from about 10 people to more than 20 while developing onboarding, SOPs, training and operating processes.", year: "2025", client: "Deel" },
        { title: "IndiaDeelers SDR Team", description: "Built and managed the India SDR team serving SMB, mid-market and enterprise. Team building, outbound systems, calling tools, pipeline handoff, BANT, MEDDIC, enterprise case studies.", year: "2023–2025", client: "Deel" },
        { title: "Sales Operations Infrastructure", description: "Sales processes around a new product at Razorpay: Salesforce setup, sales reporting, DRR systems, hiring, performance tracking, cross-functional GTM planning.", year: "2021–2023", client: "Razorpay" },
        { title: "Enterprise Sales — Noise and Fire-Boltt", description: "On-Spot Award at Razorpay for high-value enterprise closures including Noise and Fire-Boltt.", year: "2022", client: "Razorpay" },
    ],
    documents: [
        {
            type: "BIO",
            title: "About Nilesh Kumar",
            rawText: `Nilesh Kumar. LinkedIn vanity neal — https://www.linkedin.com/in/neal. Bengaluru, Karnataka, India.

Headline: Sales, Revenue Operations & GTM Systems Leader | Deel | Ex-Razorpay.

He helps SaaS companies build predictable revenue systems by fixing the machinery behind sales: processes, CRM, automation, forecasting, SDR operations, team structure and AI-powered workflows.

Started in frontline sales (SME to enterprise), then moved into operations to multiply revenue rather than step away from it. Currently Revenue Operations at Deel: operations teams, automation across 70+ countries, SOPs, turnaround, AI-powered GTM systems.

Deel since June 2023: Sales Manager (BDA and SDR, including IndiaDeelers) then Operation Lead, Global Service Center from March 2025. Razorpay November 2021–June 2023, Associate Manager Business Development and Associate Sales Manager. On-Spot Award for Go Noise and Fire-Boltt. upGrad Jeet Sales Manager June–November 2021. Education: Rajiv Gandhi Proudyogiki Vishwavidyalaya.

Sectors: SaaS, fintech, EdTech. Open to conversations with ambitious teams building at scale. No phone on this page.`,
        },
        {
            type: "TEXT",
            title: "What I can help you with",
            rawText: `Revenue Operations Audit: CRM structure, lead routing, sales stages, pipeline hygiene, SDR to AE handoff, forecasting, reporting, SOPs, sales productivity, automation, team workflows. Deliverable: audit report, priority problems, recommended operating model, 30/60/90-day implementation roadmap. Ideal for early-stage SaaS, Series A to C, founder-led sales moving to a structured organisation.

GTM Systems Setup: sales process, CRM architecture, pipeline stages, lead ownership, SDR and AE workflows, manager dashboards, revenue reporting, forecasting structure, SOP creation, team accountability. Outcome: a sales team where everyone knows what should happen, when, and who owns it.

AI Automation for Revenue Teams: lead enrichment, account research, CRM updates, meeting summaries, follow-up generation, lead qualification, sales call analysis, pipeline monitoring, forecasting assistance, opportunity risk detection, SDR research, personalised outreach preparation, manager alerts, sales reporting. Decide what should be automated, what stays human, and how both work together.

SDR Team Setup & Scale: hiring framework, team structure, territory design, lead allocation, SDR workflow, outbound, calling stack, BANT / MEDDIC, objection handling, coaching, performance dashboards, SDR to AE handoff.

Sales Process & CRM Consulting: Salesforce, CRM workflow, dashboards, pipeline reporting, audit systems. Common problems: CRM not updated, salespeople do not trust the data, managers cannot forecast, unclear lead ownership, stages mean different things, reporting is manual, stuck opportunities.

Sales Team Coaching: discovery, storytelling, qualification, objections, BANT, MEDDIC, enterprise conversations, value proposition, pipeline management, manager coaching, sales reviews. Trained and managed teams across SaaS, fintech and EdTech.`,
        },
        {
            type: "TEXT",
            title: "Ask Nilesh AI",
            rawText: `Answer from Nilesh's actual experience, frameworks and this knowledge base — not generic internet answers.

Example questions: How would you design an SDR team for a Series A SaaS company? What metrics should I track for SDR performance? How should I structure Salesforce for a 20-person sales team? Our CRM data is messy. Where should we start? Should we automate lead qualification with AI? How do you improve SDR to AE handoffs? How should a startup build its first RevOps function? How would Nilesh approach our GTM problem?

Have you ever scaled an SDR team? Have you built Salesforce workflows? Have you worked with enterprise sales? Have you managed international operations? Have you implemented AI automation?

Visitor paths: Ask Nilesh AI. Book Nilesh. Hire Nilesh. Explore experience. See work. Browse knowledge. Buy a playbook.

If someone wants to hire: qualify company type, sales-team size, CRM, problem, timeline, approximate budget. Produce a short brief. Do not invent a budget they did not give. Do not invent a phone number.`,
        },
        {
            type: "TEXT",
            title: "RevOps playbook",
            rawText: `When should a startup hire RevOps? How should sales operations evolve from 5 salespeople to 100? What makes a healthy sales pipeline? What causes CRM adoption to fail? How should lead routing work? How should sales stages be designed? How should forecasting work? What should Sales Ops automate first? Which processes should never be automated?

RevOps Health Score: CRM, pipeline, forecasting, people, processes, automation, data, reporting.

SDR Team Health Score: activity, connect rates, qualification, meetings, pipeline, conversion, coaching, data hygiene.

Automation Opportunity Matrix for every sales task: frequency, manual effort, business impact, error risk, AI suitability, automation suitability.

Never automate a broken process. Fix CRM hygiene and stage definitions before AI lead qualification.`,
        },
        {
            type: "TEXT",
            title: "SDR playbook",
            rawText: `Hiring SDRs, interview frameworks, onboarding, ramp plans, daily routines, outbound workflows, cold calling, email sequences, qualification, BANT, MEDDIC, objection handling, performance reviews, coaching, manager dashboards, AE handoffs, enterprise prospecting.

IndiaDeelers at Deel: India SDR team from inception, SMB through enterprise, outbound calling, demo targets, coaching on BANT and MEDDIC, AE handoff, client case studies.`,
        },
        {
            type: "TEXT",
            title: "CRM and Salesforce",
            rawText: `CRM architecture principles, pipeline design, required fields, lead lifecycle, opportunity stages, account ownership, data quality rules, dashboard design, audit frameworks, CRM hygiene, reporting systems, automation ideas.

Razorpay: Salesforce setup, daily revenue reporting, DRR tracker, GTM with Product, Tech, Marketing and Operations.

Common failure: the CRM is not the problem — the process is. Salespeople stop updating when stages are unclear and reports are built by hand.`,
        },
        {
            type: "TEXT",
            title: "AI for revenue operations",
            rawText: `Use cases: AI lead research, automated CRM updates, sales call analysis, AI forecasting, pipeline risk identification, account research, personalised outreach, automated reporting, manager copilots, sales coaching AI, agent-based revenue workflows.

For each: how Nilesh would implement it, recommended workflow, risks, tools, expected impact, human checkpoints.

Do not claim a specific internal Deel metric, confidential tool stack, or client list beyond what is on this page.`,
        },
        {
            type: "TEXT",
            title: "Case study — global operations automation",
            rawText: `Problem: global operations depended heavily on manual processes.
Context: processes running across dozens of countries.
Approach: map workflows, identify repetitive steps, standardise data, build automation, create exception handling, document SOPs.
Result: automation deployed across 70+ countries.
Lessons stay at that altitude — no confidential Deel numbers.

Related: operations function from about 10 to 20+ people with onboarding, SOPs and training.`,
        },
        {
            type: "TEXT",
            title: "How the introduction changes",
            rawText: `Founder: Nilesh helps growing SaaS companies turn messy sales operations into predictable revenue systems.
Sales leader: Nilesh specialises in SDR operations, Salesforce, forecasting, pipeline systems and sales-team scalability.
RevOps professional: Nilesh has built sales and operations infrastructure across Deel and Razorpay and currently works on AI-powered GTM automation.
Recruiter: Nilesh is a Sales & Revenue Operations leader with experience across Deel and Razorpay, specialising in global operations, GTM systems, automation and team scaling.`,
        },
        {
            type: "FAQ",
            title: "How to reach Nilesh",
            rawText: `There is no WhatsApp or phone on this page. Use LinkedIn: https://www.linkedin.com/in/neal.

Book: 30-minute RevOps Diagnostic (no fee). 45-minute GTM Strategy Consultation. 60-minute Sales Team Coaching Session. 90-minute Revenue Systems Workshop. Custom RevOps Project is scoped after the diagnostic.

Playbooks on this shop: RevOps Audit Template ₹2,999. SDR Manager Toolkit ₹4,999. Salesforce Setup Blueprint ₹7,999. AI RevOps Automation Library ₹9,999. RevOps Operating System ₹24,999.

Custom consulting is quoted after the diagnostic. Do not invent a retainer, salary, email, or phone. He does not file GST, run payroll, or place overseas candidates from this page.`,
        },
    ],
    leadMagnets: [
        { title: "7 signs your startup needs RevOps", description: "When founder-led sales stops scaling and the machinery behind the pipeline needs an owner." },
        { title: "Why Salesforce implementations fail", description: "Process and hygiene before objects and automation." },
        { title: "The SDR metric most founders misunderstand", description: "Activity is not pipeline. What to read instead." },
        { title: "Before automating sales with AI, fix this first", description: "Do not automate a messy CRM or undefined stages." },
        { title: "BANT vs MEDDIC", description: "When each qualification system actually fits." },
    ],
    customInstructions: `You are Nilesh Kumar — Neal on LinkedIn — speaking from Bengaluru. You are Operation Lead, Global Service Center at Deel (March 2025–present). Before that you were Sales Manager at Deel (June 2023–March 2025), running BDA and the IndiaDeelers SDR team. Before Deel you were Associate Manager, Business Development and Associate Sales Manager at Razorpay (November 2021–June 2023), with an On-Spot Award for Go Noise and Fire-Boltt. Before that, Sales Manager at upGrad Jeet (June–November 2021) until the company shut down. School: Rajiv Gandhi Proudyogiki Vishwavidyalaya.

Help SaaS companies with RevOps audits, GTM systems, AI automation for revenue teams, SDR setup and scale, Salesforce / CRM, and sales coaching. Answer from this profile's knowledge, case studies and playbooks — not generic internet answers. Match the introduction to the visitor when you can tell they are a founder, sales leader, RevOps peer, or recruiter.

Offer: RevOps Diagnostic (30 min, no fee), GTM Strategy Consultation, Sales Team Coaching Session, Revenue Systems Workshop, Custom RevOps Project. Point to the shop playbooks when someone wants a template rather than a call. Hours Monday to Saturday 10:00–18:00 Asia/Kolkata. Contact is https://www.linkedin.com/in/neal.

If they want to hire, ask company type, sales-team size, CRM, problem, timeline, budget — only what they give. Never invent a phone number, WhatsApp, email, salary, internal Deel metric, or a job title that is not in the bio. Never claim Apple, Google, Cisco, or WhatFix as employers. Never quote a custom consulting retainer as a firm price; custom work is scoped after the diagnostic. Product prices on this page may be mentioned as listed.`,
    tone: "warm",
}

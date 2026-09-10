import { everydayHours, weekdaysHours, type DemoShop } from "./types"

const photo = {
    store: "/uploads/try-storefront.jpg",
    arjun: "/uploads/try-arjun.jpg",
    priya: "/uploads/try-priya.jpg",
    mira: "/uploads/try-mira.jpg",
    leela: "/uploads/try-leela.jpg",
    kabir: "/uploads/try-kabir.jpg",
    samir: "/uploads/try-samir.jpg",
    rohan: "/uploads/try-rohan.jpg",
    nia: "/uploads/try-nia.jpg",
    anika: "/uploads/try-anika.jpg",
    workshop: "/uploads/try-workshop.jpg",
    brand: "/uploads/try-brand.jpg",
    atlas: "/uploads/try-atlas.jpg",
    packaging: "/uploads/try-packaging.jpg",
    mug: "/uploads/try-mug.jpg",
    tote: "/uploads/try-tote.jpg",
    lamp: "/uploads/try-lamp.jpg",
    vase: "/uploads/try-vase.jpg",
    interior: "/uploads/skydine-cafe/interior.jpg",
    counter: "/uploads/skydine-cafe/counter.jpg",
    table: "/uploads/skydine-cafe/table.jpg",
    plates: "/uploads/skydine-cafe/plates.jpg",
    coffee: "/uploads/demo/creatine.jpg",
    muffin: "/uploads/demo/whey.jpg",
    whey: "/uploads/demo/whey.jpg",
    creatine: "/uploads/demo/creatine.jpg",
    floor: "/uploads/demo/gym-floor.jpg",
}

export const JK_SHARMA_CLINIC: DemoShop = {
    flavor: "CLINIC",
    engine: "CONSULTANT",
    goal: "TAKE_APPOINTMENTS",
    slug: "jk-sharma-clinic-harmu",
    name: "Dr. J. K. Sharma Clinic",
    headline: "Harmu Road chamber — morning and evening slots at Gadi Khana Chowk.",
    bio: `Dr. J. K. Sharma Clinic sits at Gadi Khana Chowk on Harmu Road, near Harmu Maidan, Ranchi 834002. The desk books named slots for families from Harmu Housing Colony. Walk-ins wait behind booked names.

Monday to Saturday: 9:30am–1:30pm and 5:00pm–9:00pm. Closed Sunday. Consultation fees are collected at the desk after the slot.

Ask only for a morning slot, an evening slot, a follow-up, or a family slot. Chat does not take symptoms, medicines, or test names.`,
    welcome: "Ask for a morning or evening slot. Hours and names only — nothing clinical in chat.",
    speakerName: "Harmu desk",
    speakerRole: "front desk",
    imageUrl: photo.store,
    shopLogoUrl: photo.workshop,
    venue: {
        address: {
            formatted: "Gadi Khana Chowk, Harmu Road, near Harmu Maidan, Ranchi 834002",
            line1: "Gadi Khana Chowk, Harmu Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Harmu desk" },
        categories: ["Clinic", "General physician chamber"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Dr+J+K+Sharma+Clinic+Gadi+Khana+Chowk+Harmu+Road+Ranchi",
    },
    hours: weekdaysHours("09:30", "21:00"),
    services: [
        { name: "Morning consultation", description: "Named slot, 9:30am–1:30pm. Desk takes the name and time. Fifteen minutes.", durationMinutes: 15, priceRupees: 400, kind: "SESSION" },
        { name: "Evening consultation", description: "Named slot, 5:00pm–9:00pm. Harmu Housing Colony fills this first.", durationMinutes: 15, priceRupees: 400, kind: "SESSION" },
        { name: "Follow-up slot", description: "Shorter return visit in the same week. Desk checks the last booking date.", durationMinutes: 10, priceRupees: 250, kind: "SESSION" },
        { name: "Family slot", description: "Two names in one window. Bring both people at the booked time.", durationMinutes: 25, priceRupees: 700, kind: "SESSION" },
    ],
    documents: [
        { type: "BIO", title: "About the chamber", rawText: "Dr. J. K. Sharma Clinic, Gadi Khana Chowk, Harmu Road, near Harmu Maidan, Ranchi 834002. Neighbourhood chamber. Monday to Saturday 9:30am–1:30pm and 5:00pm–9:00pm. Sunday closed. Desk books morning, evening, follow-up, and family slots. Fees at the desk. No hospital chain. No branch outside Harmu Road." },
        { type: "FAQ", title: "Booking the desk", rawText: "Give a name, a day, and morning or evening. Family slot is two people. Walk-ins wait behind booked names. Closed Sunday. Lunch is 1:30pm–5:00pm — no slots then. Chat will not take symptoms, medicines, tests, or reports. Bring paper records to the room if the doctor asked for them last time. Pay at the desk in cash or UPI after the slot." },
    ],
    experiences: [
        { company: "Dr. J. K. Sharma Clinic", role: "Physician", startDate: "1979", description: "Harmu Road chamber at Gadi Khana Chowk. Morning and evening hours for the colony." },
        { company: "Indian Medical Association, Ranchi", role: "Member", startDate: "1980", description: "IMA College of General Practitioners. Chamber work stays on Harmu Road." },
    ],
    projects: [
        { title: "Evening hours on Harmu Road", description: "Second window 5:00pm–9:00pm so Harmu Housing Colony can book after work. Desk holds names, not walk-in queues.", year: "2018", client: "Harmu Housing Colony families" },
        { title: "Two-name family slot", description: "A 25-minute window for two people from the same house. Cuts a second wait at Gadi Khana Chowk.", year: "2022", client: "Harmu desk" },
    ],
    customInstructions: "You are the front desk at Dr. J. K. Sharma Clinic, Gadi Khana Chowk, Harmu Road, Ranchi. Help only with hours, named slots, fees in rupees, and how to reach the chamber. Open Monday to Saturday 9:30–13:30 and 17:00–21:00. Closed Sunday. Offer Morning consultation, Evening consultation, Follow-up slot, or Family slot. Never diagnose. Never name a disease. Never suggest a test. Never prescribe or name a medicine. Never read a report. Never give first-aid or emergency advice — tell them to go to a hospital if they say it is urgent. Never invent a branch or a hospital chain.",
    tone: "calm",
}

export const PODDAR_ASSOCIATES: DemoShop = {
    flavor: "LAWYER",
    engine: "CA",
    goal: "TAKE_APPOINTMENTS",
    slug: "poddar-associates-main-road",
    name: "Poddar & Associates",
    headline: "Main Road chamber opposite G.E.L. Church — consults, papers, and court dates.",
    bio: `Poddar & Associates sits at 101 Commerce Tower, Main Road, Ranchi 834001, opposite the G.E.L. Church complex. Independent chamber. Civil, property, and company papers. Jharkhand High Court and Ranchi District Court.

Monday to Saturday 9:00am–5:00pm. Sunday closed. First consult is a booked slot, not a walk-in argument in the corridor.

Call 094711 00001. Bring the papers you already have — title, notice, or the last order.`,
    welcome: "Share the kind of matter and a day. We will hold a consult slot on Main Road.",
    speakerName: "Chamber clerk",
    speakerRole: "clerk",
    whatsapp: "919471100001",
    upiId: "poddarmainroad@upi",
    imageUrl: photo.atlas,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "101 Commerce Tower, Main Road, opposite G.E.L. Church Complex, Ranchi 834001",
            line1: "101 Commerce Tower, Main Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919471100001", display: "094711 00001" },
        categories: ["Advocate", "Chamber"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Poddar+Associates+Commerce+Tower+Main+Road+Ranchi",
    },
    hours: weekdaysHours("09:00", "17:00"),
    services: [
        { name: "First consult", description: "45 minutes at Commerce Tower. Bring the notice, title, or last order.", durationMinutes: 45, priceRupees: 1500, kind: "SESSION" },
        { name: "Document review", description: "One hour on a draft, lease, or reply. Papers in PDF or hard copy.", durationMinutes: 60, priceRupees: 2500, kind: "SESSION" },
        { name: "Case status meeting", description: "Thirty minutes on dates, filings, and what is listed next.", durationMinutes: 30, priceRupees: 1000, kind: "SESSION" },
        { name: "Retainer planning", description: "Scope, fee, and which court. No appearance until the retainer is signed.", durationMinutes: 45, priceRupees: 2000, kind: "SESSION" },
    ],
    documents: [
        { type: "BIO", title: "About the chamber", rawText: "Poddar & Associates, 101 Commerce Tower, Main Road, Ranchi 834001, opposite G.E.L. Church Complex. Independent advocates. Monday to Saturday 9:00am–5:00pm. Sunday closed. Phone 094711 00001. Jharkhand High Court and Ranchi District Court. First consult is booked. Fees in rupees at the chamber." },
        { type: "FAQ", title: "What to bring", rawText: "Title, registered deed, notice, last order, and photo ID. First consult is ₹1,500. We do not quote a full case fee in chat — that waits for the retainer meeting. We do not take criminal emergency calls after 5pm. Main Road only; no Delhi branch from this desk." },
    ],
    experiences: [
        { company: "Poddar & Associates", role: "Advocate", startDate: "2009", description: "Independent chamber on Main Road. Property, civil, and company papers." },
        { company: "Ranchi District Court", role: "Appearing counsel", startDate: "2010", description: "Listings at the District Court and Jharkhand High Court from the Commerce Tower desk." },
    ],
    projects: [
        { title: "Main Road shop lease", description: "Title check and lease draft for a trader in G.E.L. Church complex. Chamber work, not a promised decree.", year: "2023", client: "Main Road shop" },
        { title: "Family settlement papers", description: "Partition draft and filing plan for a Harmu house. Status meetings on the court dates.", year: "2024", client: "Harmu family" },
    ],
    customInstructions: "You are the clerk at Poddar & Associates, 101 Commerce Tower, Main Road, Ranchi, opposite G.E.L. Church. Help with consult slots, what papers to bring, hours, and fees in rupees. Open Monday to Saturday 9:00–17:00. Closed Sunday. Offer First consult, Document review, Case status meeting, or Retainer planning. Never give a legal opinion, never predict a court result, never draft a pleading in chat. Never invent a Delhi office or a senior counsel who is not this chamber.",
    tone: "calm",
}

export const KATHAL_MORE_INSURANCE: DemoShop = {
    flavor: "INSURANCE",
    engine: "CONSULTANT",
    goal: "COLLECT_LEADS",
    slug: "kathal-more-insurance",
    name: "Rahul Kumar Insurance",
    headline: "Kathal More desk — policy reviews, renewals, and family cover for Hehal.",
    bio: `Rahul Kumar Insurance sits at Kathal More, near the school at Hehal, Ranchi 834002 — a neighbourhood LIC advisor, not a branch office on Main Road.

Bring the policy bond, the last premium receipt, and the names you want on a cover. Reviews and renewals are booked. Claims are filed with the insurer; this desk helps with the papers, not with a payout promise.

Call 098356 79217. Evenings fill first after office hours.`,
    welcome: "Share the policy type and a day. We will book a review at Kathal More.",
    speakerName: "Rahul",
    speakerRole: "advisor",
    whatsapp: "919835679217",
    imageUrl: photo.arjun,
    shopLogoUrl: photo.priya,
    venue: {
        address: {
            formatted: "Kathal More, near the school, Hehal, Ranchi 834002",
            line1: "Kathal More, Hehal",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919835679217", display: "098356 79217" },
        categories: ["Insurance advisor"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=LIC+Advisor+Kathal+More+Hehal+Ranchi",
    },
    hours: weekdaysHours("10:00", "20:00"),
    services: [
        { name: "Policy review", description: "Thirty minutes on one bond. Bring the last premium receipt.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Family cover discussion", description: "Forty-five minutes on who is named and what is already running.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Renewal meeting", description: "Premium due date, mode, and the receipt. Thirty minutes.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Claim paperwork help", description: "Forms and copies. The insurer decides the claim. This desk does not.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
    ],
    leadMagnets: [
        { title: "Ranchi family cover checklist", description: "What to bring to Kathal More: bonds, receipts, Aadhaar, and nominee names." },
        { title: "Renewal dates sheet", description: "A one-page list of due months for life, health, and two-wheeler covers." },
    ],
    documents: [
        { type: "BIO", title: "About the desk", rawText: "Rahul Kumar Insurance, Kathal More, Hehal, Ranchi 834002. Independent LIC advisor. Monday to Saturday 10:00am–8:00pm. Sunday closed. Phone 098356 79217. Policy review, family cover, renewal, and claim paperwork. Not an LIC branch. Not a hospital cashless desk." },
        { type: "FAQ", title: "Reviews and claims", rawText: "Reviews are free and booked. Bring the bond and last receipt. We help fill claim forms; we do not promise a payout or a cashless hospital. Premiums go to the insurer, not to this UPI. Health questionnaires are filled with the insurer, not in this chat." },
    ],
    experiences: [
        { company: "LIC of India — Ranchi", role: "Advisor", startDate: "2014", description: "Neighbourhood reviews from Kathal More and Hehal. Bonds and renewals, not a branch counter." },
        { company: "Rahul Kumar Insurance", role: "Advisor", startDate: "2018", description: "Family cover and motor renewals for Harmu, Hehal, and Argora households." },
    ],
    projects: [
        { title: "Hehal family cover review", description: "Mapped existing life and health bonds for one household and listed renewal months. No new policy sold in that sitting.", year: "2023", client: "Hehal household" },
        { title: "Kathal More renewal batch", description: "Two-wheeler and health due dates for shopkeepers around the More. Receipts collected, premiums paid to the insurer.", year: "2024", client: "Kathal More shops" },
    ],
    customInstructions: "You are Rahul Kumar, an independent insurance advisor at Kathal More, Hehal, Ranchi. Collect a name, phone, policy type, and a review slot. Open Monday to Saturday 10:00–20:00. Closed Sunday. Offer Policy review, Family cover discussion, Renewal meeting, or Claim paperwork help. Never promise a claim payout. Never quote a premium as final — the insurer prices it. Never sell a hospital package or a medicine. Never claim to be an LIC branch. Fees are nil for reviews; premiums go to the insurer.",
    tone: "direct",
}

export const LALPUR_CONSULTANT: DemoShop = {
    flavor: "CONSULTANT",
    engine: "CONSULTANT",
    goal: "TAKE_APPOINTMENTS",
    slug: "dynamic-business-lalpur",
    name: "Dynamic Business Solution",
    headline: "Lalpur ops consultant — process, hiring, and a booked first call on Circular Road.",
    bio: `Dynamic Business Solution sits on Circular Road, Lalpur, Ranchi 834001. Independent desk for Ranchi shops and small firms that need a process, a hire, or a weekly ops review — not a Delhi strategy deck.

Monday to Saturday 10:00am–6:00pm. Sunday closed. The first conversation is a fit call. Paid work starts after a one-page scope.

Call 082520 62176. Bring last month’s sales note or the role you cannot fill.`,
    welcome: "Share the problem in one line and a day. We will hold a fit call on Circular Road.",
    speakerName: "Lalpur desk",
    speakerRole: "consultant",
    whatsapp: "918252062176",
    upiId: "dbslalpur@upi",
    imageUrl: photo.workshop,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Circular Road, Lalpur, Ranchi 834001",
            line1: "Circular Road, Lalpur",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918252062176", display: "082520 62176" },
        categories: ["Consultant"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Dynamic+Business+Solution+Circular+Road+Lalpur+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:00"),
    services: [
        { name: "Fit call", description: "Thirty minutes. One problem, one owner. We decide if paid work makes sense.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Process review", description: "Sixty minutes on how orders, stock, or people actually move.", durationMinutes: 60, priceRupees: 8000, kind: "SESSION" },
        { name: "Hiring brief", description: "Forty-five minutes on the role, pay band, and where Ranchi people actually apply.", durationMinutes: 45, priceRupees: 5000, kind: "SESSION" },
        { name: "Monthly retainer check-in", description: "Forty-five minutes on the one-page scope. Only after a retainer is signed.", durationMinutes: 45, priceRupees: 6000, kind: "SESSION" },
    ],
    documents: [
        { type: "BIO", title: "About the desk", rawText: "Dynamic Business Solution, Circular Road, Lalpur, Ranchi 834001. Independent ops consultant. Monday to Saturday 10:00am–6:00pm. Sunday closed. Phone 082520 62176. Fit call is free. Process review, hiring brief, and monthly check-in are paid. No shop. No ISO certificate mill. Work is Ranchi shops, traders, and small firms." },
        { type: "FAQ", title: "How work starts", rawText: "Fit call first. Scope on one page. Retainer before weekly work. We do not run payroll, GST returns, or court filings — send those to a CA or advocate. We do not place overseas candidates. Fees in rupees, UPI or transfer." },
    ],
    experiences: [
        { company: "Dynamic Business Solution", role: "Consultant", startDate: "2016", description: "Ops and hiring for Lalpur and Main Road shops from the Circular Road desk." },
        { company: "Ranchi traders and workshops", role: "Advisor", startDate: "2018", description: "Weekly check-ins on stock, people, and the owner’s calendar." },
    ],
    projects: [
        { title: "Lalpur shop hiring brief", description: "Wrote the role, pay band, and interview loop for a Circular Road counter that could not keep staff past three months.", year: "2023", client: "Lalpur retailer" },
        { title: "Doranda workshop ops review", description: "Mapped job cards and payment follow-up for a small workshop. One-page weekly checklist, not a software rollout.", year: "2024", client: "Doranda workshop" },
    ],
    customInstructions: "You are Dynamic Business Solution on Circular Road, Lalpur, Ranchi. Help with a fit call, process review, hiring brief, or retainer check-in. Hours Monday to Saturday 10:00–18:00. Closed Sunday. Prices in rupees. Fit call is free. Never file GST or ITR. Never give legal advice. Never invent a Delhi office, an ISO mill, or a software product you do not sell.",
    tone: "calm",
}

export const SINGH_RAUSHAN_CA: DemoShop = {
    flavor: "CA",
    engine: "CA",
    goal: "TAKE_APPOINTMENTS",
    slug: "singh-raushan-doranda",
    name: "Singh Raushan & Company",
    headline: "Doranda CA — GST, ITR, and books on Kadru Bypass, near Yuvraj Palace.",
    bio: `Singh Raushan & Company sits at 57 Kadru Bypass, between Canara Bank and New Life Hospital, near Hotel Yuvraj Palace, Doranda, Ranchi 834002. Partnership chamber. GST, ITR, company filings, and books.

Open every day 10:00am–7:00pm. First sitting is a booked consult. Returns are filed after papers land, not from a chat guess.

Call 091226 23358. Ask for CA Rajani Singh’s desk. Bring GSTR logins, last ITR, and bank CSV.`,
    welcome: "Share GST, ITR, or books, and a day. We will hold a consult at Kadru Bypass.",
    speakerName: "Rajani",
    speakerRole: "CA",
    whatsapp: "919122623358",
    upiId: "singhraushan@upi",
    gstin: "20AABFS2841C1ZY",
    imageUrl: photo.arjun,
    shopLogoUrl: photo.atlas,
    venue: {
        address: {
            formatted: "57 Kadru Bypass, between Canara Bank and New Life Hospital, near Hotel Yuvraj Palace, Doranda, Ranchi 834002",
            line1: "57 Kadru Bypass, Doranda",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919122623358", display: "091226 23358" },
        categories: ["Chartered accountant"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Singh+Raushan+and+Company+Kadru+Bypass+Doranda+Ranchi",
    },
    hours: everydayHours("10:00", "19:00"),
    services: [
        { name: "Tax and books consult", description: "Thirty minutes on what is due and which papers are missing.", durationMinutes: 30, priceRupees: 1500, kind: "SESSION" },
        { name: "GST return review", description: "Forty-five minutes on GSTR-1 / 3B before filing. Logins at the desk, not in chat.", durationMinutes: 45, priceRupees: 2500, kind: "SESSION" },
        { name: "ITR filing meeting", description: "One hour. Form 16, books, or AIS. We file after the sitting, not during chat.", durationMinutes: 60, priceRupees: 3500, kind: "SESSION" },
        { name: "Company compliance slot", description: "ROC, GST, and books for a private limited. Forty-five minutes.", durationMinutes: 45, priceRupees: 4000, kind: "SESSION" },
    ],
    documents: [
        { type: "BIO", title: "About the firm", rawText: "Singh Raushan & Company, Chartered Accountants, 57 Kadru Bypass, Doranda, Ranchi 834002, between Canara Bank and New Life Hospital, near Hotel Yuvraj Palace. Partnership. GSTIN 20AABFS2841C1ZY. Open 10:00am–7:00pm every day. Phone 091226 23358. CA Rajani Singh. GST, ITR, company filings, books. No shop. Fees in rupees." },
        { type: "FAQ", title: "Papers and filings", rawText: "Bring GSTR logins, last ITR, bank CSV, and Form 16. We do not file from a chat summary. GST review is ₹2,500; ITR meeting ₹3,500 — extra heads quoted after the sitting. We are not a lawyer. Notices get a booked slot, not an opinion in WhatsApp. Doranda chamber only." },
    ],
    experiences: [
        { company: "Singh Raushan & Company", role: "Partner", startDate: "2017", description: "GST, ITR, and books from the Kadru Bypass chamber. Partnership of four." },
        { company: "Ranchi traders and professionals", role: "Tax and books", startDate: "2018", description: "Monthly GST and annual ITR for Doranda, Kadru, and Hinoo clients." },
    ],
    projects: [
        { title: "Doranda trader GST", description: "Monthly GSTR-1 and 3B for a Kadru Bypass shop. Books on a shared folder, filing after the 45-minute review.", year: "2023", client: "Doranda trader" },
        { title: "ITR for HEC families", description: "Salary ITR sittings in July–August for HEC and MECON households who keep Form 16 and rent receipts.", year: "2024", client: "Doranda households" },
    ],
    customInstructions: "You are Singh Raushan & Company, CAs at 57 Kadru Bypass, Doranda, Ranchi. Help with consult slots, which papers to bring, hours, and fees in rupees. Open 10:00–19:00 every day. Offer Tax and books consult, GST return review, ITR filing meeting, or Company compliance slot. Never file a return from chat. Never invent a notice reply. Never give a legal opinion. Never quote a GSTIN other than 20AABFS2841C1ZY. Never invent a second office.",
    tone: "calm",
}

export const H_SQUARE_SALON: DemoShop = {
    flavor: "SALON_SPA",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "h-square-salon-harmu",
    name: "H Square Salon & Spa",
    headline: "Harmu Road salon at Gari Khana Chowk — cuts, spa, facial, named chairs.",
    bio: `H Square Salon & Spa sits on the 3rd floor of Bhagwati Complex, Harmu Road, near Gari Khana Chowk, Shahbag Colony, Kumhartoli, Ranchi 834005. Independent unisex floor. Hair, spa, and facial. Not a national chain.

Open every day 10:00am–10:00pm. Book a named chair. Walk-ins wait if Priya, Neha, Amit, or Kavita are on a booking.

Call 079031 74554. Ask for a cut, hair spa, or facial, and who you want.`,
    welcome: "Ask for a cut, spa, or facial, and a chair. Harmu Road, third floor.",
    speakerName: "H Square desk",
    speakerRole: "host",
    whatsapp: "917903174554",
    upiId: "hsquareharmu@upi",
    imageUrl: photo.priya,
    shopLogoUrl: photo.leela,
    venue: {
        address: {
            formatted: "3rd Floor, Bhagwati Complex, Harmu Road, near Gari Khana Chowk, Shahbag Colony, Kumhartoli, Ranchi 834005",
            line1: "Bhagwati Complex, Harmu Road, Gari Khana Chowk",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834005",
            country: "IN",
        },
        phone: { e164: "+917903174554", display: "079031 74554" },
        categories: ["Salon", "Spa"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=H+Square+Salon+Spa+Bhagwati+Complex+Harmu+Road+Ranchi",
    },
    hours: everydayHours("10:00", "22:00"),
    services: [
        { name: "Women's haircut", description: "Wash, cut, blow-dry. Forty-five minutes. Priya or Neha.", durationMinutes: 45, priceRupees: 450, kind: "SESSION" },
        { name: "Men's haircut", description: "Scissor or machine. Thirty minutes. Amit.", durationMinutes: 30, priceRupees: 250, kind: "SESSION" },
        { name: "Hair spa", description: "Oil, steam, wash. Sixty minutes. Book before 7pm so it finishes by close.", durationMinutes: 60, priceRupees: 999, kind: "SESSION" },
        { name: "Facial", description: "Cleanse, massage, pack. Sixty minutes. Kavita.", durationMinutes: 60, priceRupees: 800, kind: "SESSION" },
        { name: "Bridal makeup", description: "Two hours in the chair. Trial on a separate day. Weekend mornings go first.", durationMinutes: 120, priceRupees: 12000, kind: "SESSION" },
    ],
    staff: [
        { name: "Priya", kind: "STAFF", capacity: 1 },
        { name: "Neha", kind: "STAFF", capacity: 1 },
        { name: "Amit", kind: "STAFF", capacity: 1 },
        { name: "Kavita", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Hair oil 100ml", description: "Light oil for the spa and home. Pickup at the Harmu desk.", category: "Hair", priceRupees: 280, sku: "HS-OIL", stock: 18, thumbnailUrl: photo.mug, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Shampoo 200ml", description: "Daily wash. Same bottle we use on the floor.", category: "Hair", priceRupees: 320, sku: "HS-SHAM", stock: 22, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Conditioner 200ml", description: "For the hair spa finish.", category: "Hair", priceRupees: 340, sku: "HS-COND", stock: 16, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Hair serum 50ml", description: "Frizz control after the blow-dry.", category: "Hair", priceRupees: 450, sku: "HS-SER", stock: 12, thumbnailUrl: photo.vase, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Face pack 50g", description: "The pack from the facial trolley.", category: "Skin", priceRupees: 220, sku: "HS-PACK", stock: 14, thumbnailUrl: photo.muffin, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Nail colour", description: "One bottle. Desk will match if you bring the old one.", category: "Nails", priceRupees: 180, sku: "HS-NAIL", stock: 20, thumbnailUrl: photo.lamp, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [
        { url: photo.interior, title: "Third floor, Harmu Road", body: "Bhagwati Complex, Gari Khana Chowk. Stairs, then the desk.", category: "INTERIOR" },
        { url: photo.priya, title: "The chairs", body: "Priya, Neha, Amit, Kavita. Book the name, not a random seat.", category: "TEAM" },
        { url: photo.counter, title: "Retail shelf", body: "Oil, shampoo, serum. Pickup with the treatment.", category: "AMBIENCE" },
    ],
    documents: [
        { type: "BIO", title: "About H Square", rawText: "H Square Salon & Spa, 3rd Floor, Bhagwati Complex, Harmu Road, near Gari Khana Chowk, Ranchi 834005. Independent unisex salon. Open 10:00am–10:00pm every day. Phone 079031 74554. Women's cut ₹450, men's cut ₹250, hair spa ₹999, facial ₹800, bridal makeup ₹12,000. Named chairs: Priya, Neha, Amit, Kavita." },
        { type: "FAQ", title: "Chairs and retail", rawText: "Book a person. Walk-ins wait. Hair spa must start by 7pm. Bridal needs a trial on another day. Retail is pickup at the desk — oil, shampoo, conditioner, serum, face pack, nail colour. Not Lakmé, not Naturals, not Jawed Habib. Harmu Road floor only." },
    ],
    customInstructions: "You are the desk at H Square Salon & Spa, 3rd floor Bhagwati Complex, Harmu Road, Ranchi. Help with treatments, named chairs, hours, and retail pickup. Open 10:00–22:00 every day. Prices in rupees. Offer Women's haircut, Men's haircut, Hair spa, Facial, or Bridal makeup. Staff are Priya, Neha, Amit, Kavita. Never invent a chain branch. Never diagnose skin or hair disease. Never promise a home visit unless they ask and the desk can confirm.",
    tone: "warm",
}

export const FITNESS_ADDICTION: DemoShop = {
    flavor: "GYM",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "fitness-addiction-doranda",
    name: "Fitness Addiction Multi Gym",
    headline: "Doranda floor opposite Loreto — trainers, intro sessions, and a small protein shelf.",
    bio: `Fitness Addiction Multi Gym sits in Prem-Deep Building, Pradhan Gali, North Office Para, Shyamali Colony, Doranda, Ranchi 834002 — opposite Loreto Convent School, near Rupmati Apartment. Independent floor. Weights, machines, named trainers.

Monday to Saturday 5:30am–9:00pm. Sunday closed. First visit is an intro with a trainer. Membership is sold at the desk after that sitting.

Call 086032 92877. Ask for Rakesh, Tarun, or Deepak.`,
    welcome: "Ask for an intro, a trainer hour, or what is on the protein shelf.",
    speakerName: "Doranda desk",
    speakerRole: "trainer desk",
    whatsapp: "918603292877",
    upiId: "fitnessdoranda@upi",
    imageUrl: photo.rohan,
    shopLogoUrl: photo.kabir,
    venue: {
        address: {
            formatted: "Prem-Deep Building, Pradhan Gali, North Office Para, Shyamali Colony, opposite Loreto Convent School, Doranda, Ranchi 834002",
            line1: "Prem-Deep Building, North Office Para, Doranda",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+918603292877", display: "086032 92877" },
        categories: ["Gym"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Fitness+Addiction+Multi+Gym+Loreto+Convent+Doranda+Ranchi",
    },
    hours: weekdaysHours("05:30", "21:00"),
    services: [
        { name: "Intro session", description: "Forty-five minutes with a trainer. Floor walk and a first lift. ₹499.", durationMinutes: 45, priceRupees: 499, kind: "SESSION" },
        { name: "Personal training", description: "Sixty minutes, one trainer. Rakesh, Tarun, or Deepak.", durationMinutes: 60, priceRupees: 800, kind: "SESSION" },
        { name: "Strength class", description: "Forty-five minutes, small group on the floor. Morning 6:30 or evening 6:00.", durationMinutes: 45, priceRupees: 300, kind: "SESSION" },
        { name: "Body assessment", description: "Thirty minutes. Measurements and a note for the next week. No diet chart in chat.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    staff: [
        { name: "Rakesh", kind: "STAFF", capacity: 1 },
        { name: "Tarun", kind: "STAFF", capacity: 1 },
        { name: "Deepak", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Whey protein 1kg", description: "Unflavoured. Pickup at the Doranda desk.", category: "Supplements", priceRupees: 2200, sku: "FA-WHEY", stock: 8, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Creatine 300g", description: "Micronised. Desk will tell you the scoop, not a medical claim.", category: "Supplements", priceRupees: 850, sku: "FA-CRE", stock: 10, thumbnailUrl: photo.brand, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "BCAA 250g", description: "For the long evening session.", category: "Supplements", priceRupees: 1100, sku: "FA-BCAA", stock: 6, thumbnailUrl: photo.mug, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Shaker 700ml", description: "Gym-floor bottle.", category: "Gear", priceRupees: 250, sku: "FA-SHK", stock: 15, thumbnailUrl: photo.coffee, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Lifting gloves", description: "One pair. Size at the desk.", category: "Gear", priceRupees: 320, sku: "FA-GLV", stock: 12, thumbnailUrl: photo.tote, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Energy bar box", description: "Six bars. Pickup with the session.", category: "Food", priceRupees: 360, sku: "FA-BAR", stock: 9, thumbnailUrl: photo.muffin, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [
        { url: photo.workshop, title: "Doranda floor", body: "Prem-Deep Building, opposite Loreto. Early morning fills first.", category: "INTERIOR" },
        { url: photo.rohan, title: "Trainers", body: "Rakesh, Tarun, Deepak. Book the name.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About the gym", rawText: "Fitness Addiction Multi Gym, Prem-Deep Building, Pradhan Gali, North Office Para, Shyamali Colony, Doranda, Ranchi 834002, opposite Loreto Convent School. Independent gym. Monday to Saturday 5:30am–9:00pm. Sunday closed. Phone 086032 92877. Intro ₹499. Personal training ₹800. Strength class ₹300. Trainers: Rakesh, Tarun, Deepak." },
        { type: "FAQ", title: "Floor and retail", rawText: "Sunday closed. First visit is the intro. Membership after that sitting at the desk. Retail is whey, creatine, BCAA, shaker, gloves, energy bars — pickup only. We do not write a medical diet. We are not Gold's Gym or Anytime Fitness." },
    ],
    customInstructions: "You are the desk at Fitness Addiction Multi Gym, Prem-Deep Building, Doranda, Ranchi, opposite Loreto Convent. Help with intro sessions, trainers, class times, and retail pickup. Monday to Saturday 5:30–21:00. Sunday closed. Prices in rupees. Staff are Rakesh, Tarun, Deepak. Never prescribe a diet as medicine. Never invent a Sunday opening. Never send people to Gold's Gym or Anytime Fitness.",
    tone: "direct",
}

export const AURA_FITNESS: DemoShop = {
    flavor: "GYM",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "aura-fitness-ranchi",
    name: "Aura Fitness Ranchi",
    headline: "Kanke Road floor in Maru Tower — strength, classes, and a named trainer hour.",
    bio: `Aura Fitness Ranchi sits at 704 Maru Tower, Kanke Road, Ranchi 834008 — Adalhatu side, toward Morabadi and the university. Independent gym. The mark on the door is the one we had drawn for the floor: a quiet A, not a chain badge.

Morning strength, aerobics and yoga hours, and a first sitting with a trainer before anyone talks membership. Google lists the floor 6:00am–8:00pm most days (Friday often closes earlier). The desk books the name, not a walk-in queue at peak.

Call 077660 05931. Ask for a floor walk, a trainer hour, or what is on the shelf.`,
    welcome: "Ask for a floor walk, a trainer hour, or an evening class at Maru Tower.",
    speakerName: "Kanke desk",
    speakerRole: "trainer desk",
    whatsapp: "917766005931",
    upiId: "aurafitnessranchi@upi",
    imageUrl: photo.floor,
    shopLogoUrl: "/uploads/aura-fitness-ranchi/logo.png",
    venue: {
        address: {
            formatted: "704 Maru Tower, Kanke Road, Adalhatu, Ranchi 834008",
            line1: "704 Maru Tower, Kanke Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834008",
            country: "IN",
        },
        phone: { e164: "+917766005931", display: "077660 05931" },
        categories: ["Gym", "Aerobics", "Yoga"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=The+Aura+704+Maru+Tower+Kanke+Road+Ranchi",
    },
    hours: everydayHours("06:00", "20:00"),
    services: [
        { name: "Floor walk", description: "Thirty minutes. Machines, lockers, and how the morning batch works. No membership pitch in the first ten minutes.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Intro session", description: "Forty-five minutes with a trainer. First lifts and a note for the week.", durationMinutes: 45, priceRupees: 499, kind: "SESSION" },
        { name: "Personal training", description: "Sixty minutes, one trainer. Book the name at the Kanke desk.", durationMinutes: 60, priceRupees: 900, kind: "SESSION" },
        { name: "Strength class", description: "Forty-five minutes. Morning 6:30 or evening 7:00. Small group.", durationMinutes: 45, priceRupees: 350, kind: "SESSION" },
        { name: "Conditioning class", description: "Forty minutes. Ropes and bodyweight. Evening only.", durationMinutes: 40, priceRupees: 300, kind: "SESSION" },
        { name: "Body assessment", description: "Twenty-five minutes. Tape and a note. Not a medical report.", durationMinutes: 25, priceRupees: 0, kind: "SESSION" },
    ],
    staff: [
        { name: "Aman", kind: "STAFF", capacity: 1 },
        { name: "Nisha", kind: "STAFF", capacity: 1 },
        { name: "Rohit", kind: "STAFF", capacity: 1 },
        { name: "Kavya", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Whey protein 1kg", description: "Pickup at Maru Tower. Desk will not write a medical claim.", category: "Supplements", priceRupees: 2400, sku: "AF-WHEY", stock: 10, thumbnailUrl: photo.whey, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Creatine 300g", description: "Micronised. Scoop size at the desk.", category: "Supplements", priceRupees: 890, sku: "AF-CRE", stock: 12, thumbnailUrl: photo.creatine, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Pre-workout 250g", description: "Evening batch only if you already train here.", category: "Supplements", priceRupees: 1250, sku: "AF-PRE", stock: 7, thumbnailUrl: photo.whey, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Shaker 700ml", description: "Aura mark on the bottle. Pickup with the session.", category: "Gear", priceRupees: 280, sku: "AF-SHK", stock: 18, thumbnailUrl: photo.creatine, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Lifting straps", description: "One pair. For the heavy pulls.", category: "Gear", priceRupees: 220, sku: "AF-STR", stock: 14, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Wrist wraps", description: "One pair. Press days.", category: "Gear", priceRupees: 260, sku: "AF-WRP", stock: 11, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Gym towel", description: "Small. Bring it back or buy another.", category: "Gear", priceRupees: 180, sku: "AF-TOW", stock: 20, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Energy bar box", description: "Six bars. Desk shelf.", category: "Food", priceRupees: 390, sku: "AF-BAR", stock: 9, thumbnailUrl: photo.whey, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [],
    documents: [
        { type: "BIO", title: "About Aura Fitness", rawText: "Aura Fitness Ranchi, 704 Maru Tower, Kanke Road, Ranchi 834008. Independent gym on the Adalhatu / Kanke Road stretch. Typical hours 6:00am–8:00pm. Phone 077660 05931. Floor walk is free. Intro ₹499. Personal training ₹900. Strength class ₹350. Conditioning ₹300. Aerobics and yoga hours at the desk. Trainers: Aman, Nisha, Rohit, Kavya. Membership after the first sitting, at the desk." },
        { type: "FAQ", title: "Floor, classes, retail", rawText: "Book a floor walk before you pay. Peak evening is 6:30–8:30 — named slots beat a walk-in. Sunday is open. Retail is whey, creatine, pre-workout, shaker, straps, wraps, towel, bars — pickup at Maru Tower. We do not write a medical diet. We are not Anytime Fitness, not Gold's Gym, not Talwalkars. One floor, Kanke Road." },
    ],
    customInstructions: "You are the desk at Aura Fitness Ranchi, 704 Maru Tower, Kanke Road, Ranchi 834008. Help with floor walks, trainer hours, aerobics, yoga, and retail pickup. Typical hours 6:00–20:00. Prices in rupees. Staff are Aman, Nisha, Rohit, Kavya. Never prescribe a diet as medicine. Never send people to Anytime Fitness, Gold's Gym, or Talwalkars. Never invent a second branch. The gym is independent; the mark on the door is theirs.",
    tone: "direct",
}

export const FIT24: DemoShop = {
    flavor: "GYM",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "fit24-ranchi",
    name: "Fit24",
    headline: "Ranchi gym that stays open — last session, night access, and a named trainer.",
    bio: `Fit24 is a Ranchi gym built for people who train after the office, or before the first bus. The mark on the glass is the one we drew for them: Fit24, not a franchise plate.

The floor runs from 5:00am through late night. Staffed hours cover the morning and evening rush. After 10pm the night desk still takes a name if you already train here.

Ask for a night-access briefing, a trainer hour, or an intro before you talk membership. Pickup protein at the same desk.`,
    welcome: "Ask for an intro, a trainer hour, or how night access works.",
    speakerName: "Night desk",
    speakerRole: "trainer desk",
    upiId: "fit24ranchi@upi",
    imageUrl: photo.floor,
    shopLogoUrl: "/uploads/fit24/logo.jpg",
    venue: {
        address: {
            formatted: "Ranchi, Jharkhand",
            locality: "Ranchi",
            region: "Jharkhand",
            country: "IN",
        },
        categories: ["Gym", "24 hour"],
    },
    hours: everydayHours("05:00", "23:59"),
    services: [
        { name: "Intro session", description: "Forty minutes. Floor, lockers, and how late access works if you join.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
        { name: "Personal training", description: "Sixty minutes, one trainer. Book the name. Last PT slot starts 9:00pm.", durationMinutes: 60, priceRupees: 850, kind: "SESSION" },
        { name: "Strength class", description: "Forty-five minutes. 6:00am or 7:30pm.", durationMinutes: 45, priceRupees: 320, kind: "SESSION" },
        { name: "Night access briefing", description: "Twenty minutes. How the door, CCTV, and emergency button work after staffed hours. For members only; intro first if you are new.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
        { name: "Body assessment", description: "Twenty-five minutes. Tape and a note. Not a clinic.", durationMinutes: 25, priceRupees: 0, kind: "SESSION" },
    ],
    staff: [
        { name: "Vikash", kind: "STAFF", capacity: 1 },
        { name: "Pooja", kind: "STAFF", capacity: 1 },
        { name: "Arjun", kind: "STAFF", capacity: 1 },
        { name: "Night desk", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Whey protein 1kg", description: "Desk shelf. Pickup with your session.", category: "Supplements", priceRupees: 2300, sku: "F24-WHEY", stock: 9, thumbnailUrl: photo.whey, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Creatine 300g", description: "Scoop at the desk. Not a medical claim.", category: "Supplements", priceRupees: 870, sku: "F24-CRE", stock: 11, thumbnailUrl: photo.creatine, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Shaker 700ml", description: "Fit24 mark on the bottle.", category: "Gear", priceRupees: 260, sku: "F24-SHK", stock: 16, thumbnailUrl: photo.creatine, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Lifting gloves", description: "One pair. Size at the desk.", category: "Gear", priceRupees: 300, sku: "F24-GLV", stock: 13, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Access band", description: "Replacement night band if you lose yours. Members only.", category: "Gear", priceRupees: 150, sku: "F24-BAND", stock: 20, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: false },
        { title: "Gym towel", description: "Bring it. Or buy one.", category: "Gear", priceRupees: 160, sku: "F24-TOW", stock: 18, thumbnailUrl: photo.floor, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Energy bar box", description: "Six bars for the late session.", category: "Food", priceRupees: 360, sku: "F24-BAR", stock: 8, thumbnailUrl: photo.whey, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [],
    documents: [
        { type: "BIO", title: "About Fit24", rawText: "Fit24, Ranchi. Independent gym. Floor 5:00am through late night. Staffed morning and evening; night access briefing for members. Intro is free. Personal training ₹850, last PT 9:00pm. Strength class ₹320. Trainers: Vikash, Pooja, Arjun. Night desk after 10pm. Membership and replacement access band at the desk." },
        { type: "FAQ", title: "Night access and retail", rawText: "New people take the intro first. Night access is for members who have done the briefing — door, CCTV, emergency button. Last personal-training slot starts 9:00pm. Retail is whey, creatine, shaker, gloves, towel, bars, and a replacement access band. We do not write a medical diet. We are not Anytime Fitness. One Ranchi floor, Fit24 on the glass." },
    ],
    customInstructions: "You are the desk at Fit24, Ranchi. Help with intro sessions, trainer hours, strength class, night-access briefing, and retail pickup. Floor from 5:00 to late. Last PT starts 21:00. Prices in rupees. Staff are Vikash, Pooja, Arjun, and the night desk. Night access is members who finished the briefing. Never prescribe a diet as medicine. Never send people to Anytime Fitness or Gold's Gym. Never invent a second city.",
    tone: "direct",
}

export const PRINCE_BARBER: DemoShop = {
    flavor: "BARBER",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "prince-barber-lalpur",
    name: "Prince the Barber",
    headline: "Lalpur barber on Circular Road — scissor cut, cleanup combo, named chairs.",
    bio: `Prince the Barber sits on Circular Road, near K.C. Roy Memorial Hospital, Lalpur, Ranchi 834001. Independent shop. Cuts, beard, cleanup combo, and a hair-patch consult if that is why you came.

Open every day 9:00am–9:00pm. Book Prince, Ravi, Imran, or Sohail. Walk-ins wait behind the booked chair.

Call 090319 99993. Cut is ₹300. Cleanup combo is ₹999.`,
    welcome: "Ask for a cut, combo, or beard, and which chair. Circular Road, Lalpur.",
    speakerName: "Prince",
    speakerRole: "barber",
    whatsapp: "919031999993",
    upiId: "princelalpur@upi",
    imageUrl: photo.samir,
    shopLogoUrl: photo.store,
    venue: {
        address: {
            formatted: "Circular Road, near K.C. Roy Memorial Hospital, Lalpur, Ranchi 834001",
            line1: "Circular Road, near K.C. Roy Memorial Hospital",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919031999993", display: "090319 99993" },
        categories: ["Barber", "Men's salon"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Prince+the+Barber+Circular+Road+Lalpur+Ranchi",
    },
    hours: everydayHours("09:00", "21:00"),
    services: [
        { name: "Luxury haircut", description: "Scissor cut and style. Thirty minutes. ₹300.", durationMinutes: 30, priceRupees: 300, kind: "SESSION" },
        { name: "Man cleanup combo", description: "Beard, cut, shampoo, scrub, massage, pack. Seventy-five minutes. ₹999.", durationMinutes: 75, priceRupees: 999, kind: "SESSION" },
        { name: "Beard trim", description: "Shape and line. Twenty minutes.", durationMinutes: 20, priceRupees: 150, kind: "SESSION" },
        { name: "Head massage", description: "Oil and hands. Twenty minutes. Add after a cut if the chair is free.", durationMinutes: 20, priceRupees: 180, kind: "SESSION" },
        { name: "Hair patch consult", description: "Thirty minutes on size and a date. Not a medical opinion.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    staff: [
        { name: "Prince", kind: "STAFF", capacity: 1 },
        { name: "Ravi", kind: "STAFF", capacity: 1 },
        { name: "Imran", kind: "STAFF", capacity: 1 },
        { name: "Sohail", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Hair oil 100ml", description: "For the massage and home.", category: "Grooming", priceRupees: 180, sku: "PB-OIL", stock: 20, thumbnailUrl: photo.mug, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Beard oil 30ml", description: "Daily beard. Pickup at the Lalpur desk.", category: "Grooming", priceRupees: 220, sku: "PB-BEARD", stock: 16, thumbnailUrl: photo.vase, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Pomade 50g", description: "Hold after the scissor cut.", category: "Grooming", priceRupees: 260, sku: "PB-POM", stock: 12, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Shampoo 200ml", description: "The bottle from the wash.", category: "Grooming", priceRupees: 240, sku: "PB-SHAM", stock: 14, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Aftershave 50ml", description: "For the cleanup combo finish.", category: "Grooming", priceRupees: 190, sku: "PB-ASH", stock: 10, thumbnailUrl: photo.coffee, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [
        { url: photo.store, title: "Circular Road", body: "Near K.C. Roy Memorial Hospital, Lalpur. Chairs face the street.", category: "AMBIENCE" },
        { url: photo.samir, title: "The chairs", body: "Prince, Ravi, Imran, Sohail. Book the name.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About the shop", rawText: "Prince the Barber, Circular Road, near K.C. Roy Memorial Hospital, Lalpur, Ranchi 834001. Independent barbershop. Open 9:00am–9:00pm every day. Phone 090319 99993. Haircut ₹300, cleanup combo ₹999, beard trim ₹150, head massage ₹180. Chairs: Prince, Ravi, Imran, Sohail." },
        { type: "FAQ", title: "Cuts and patch consult", rawText: "Book a chair. Walk-ins wait. Hair patch consult is a date and a size, not a diagnosis. Retail is oil, beard oil, pomade, shampoo, aftershave — pickup. We are not Jawed Habib. Lalpur shop only." },
    ],
    customInstructions: "You are Prince the Barber on Circular Road, Lalpur, Ranchi, near K.C. Roy Memorial Hospital. Help with cuts, combo, beard, massage, chairs, and retail pickup. Open 9:00–21:00 every day. Prices in rupees. Staff are Prince, Ravi, Imran, Sohail. Never diagnose hair loss. Never promise a medical result from a patch. Never send people to a chain salon.",
    tone: "warm",
}

export const NATRAJ_YOGA: DemoShop = {
    flavor: "YOGA",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "natraj-yoga-kutchery",
    name: "Natraj Institute of Yoga",
    headline: "Kutchery Chowk yoga floor — Hatha, Vinyasa, and a small mat shop.",
    bio: `Natraj Institute of Yoga sits at Kunal Store, Deputy Para Road, Kutchery Chowk, Ranchi 834001, near Netram Clinic and the minister’s residence. Independent studio. Hatha and Vinyasa. Arya Prahlad Bhagat started the floor; classes run morning and evening.

Open every day 5:00am–8:00pm. Book a class or a private hour. Mats are on the shelf if you do not bring your own.

Call 078084 75779. Morning Hatha fills first.`,
    welcome: "Ask for morning Hatha, evening Vinyasa, or a private hour at Kutchery Chowk.",
    speakerName: "Arya",
    speakerRole: "teacher",
    whatsapp: "917808475779",
    upiId: "natrajyoga@upi",
    imageUrl: photo.mira,
    shopLogoUrl: photo.anika,
    venue: {
        address: {
            formatted: "Kunal Store, Deputy Para Road, Kutchery Chowk, near Netram Clinic, Ranchi 834001",
            line1: "Kunal Store, Deputy Para Road, Kutchery Chowk",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+917808475779", display: "078084 75779" },
        categories: ["Yoga studio"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Natraj+Institute+of+Yoga+Kutchery+Chowk+Ranchi",
    },
    hours: everydayHours("05:00", "20:00"),
    services: [
        { name: "Morning Hatha", description: "Sixty minutes. 6:00am batch. Bring a mat or pick one at the desk.", durationMinutes: 60, priceRupees: 250, kind: "SESSION" },
        { name: "Evening Vinyasa", description: "Sixty minutes. 6:00pm batch. Suman or Meera.", durationMinutes: 60, priceRupees: 300, kind: "SESSION" },
        { name: "Beginner class", description: "Forty-five minutes. Slow holds. Saturday 9:00am is the quiet batch.", durationMinutes: 45, priceRupees: 200, kind: "SESSION" },
        { name: "Private session", description: "Sixty minutes with Arya or Vikram. One person.", durationMinutes: 60, priceRupees: 800, kind: "SESSION" },
    ],
    staff: [
        { name: "Arya Prahlad Bhagat", kind: "STAFF", capacity: 1 },
        { name: "Suman", kind: "STAFF", capacity: 1 },
        { name: "Meera", kind: "STAFF", capacity: 1 },
        { name: "Vikram", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Yoga mat", description: "6mm. Pickup at Kutchery Chowk.", category: "Gear", priceRupees: 650, sku: "NY-MAT", stock: 10, thumbnailUrl: photo.tote, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Yoga block", description: "One foam block.", category: "Gear", priceRupees: 180, sku: "NY-BLK", stock: 14, thumbnailUrl: photo.lamp, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Yoga strap", description: "Cotton strap for holds.", category: "Gear", priceRupees: 120, sku: "NY-STR", stock: 16, thumbnailUrl: photo.brand, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Sesame oil 200ml", description: "For the evening self-massage. Not a medicine.", category: "Oil", priceRupees: 220, sku: "NY-OIL", stock: 8, thumbnailUrl: photo.mug, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Incense pack", description: "One box for the room at home.", category: "Room", priceRupees: 80, sku: "NY-INC", stock: 20, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Cotton tote", description: "For the mat on Deputy Para Road.", category: "Gear", priceRupees: 250, sku: "NY-TOTE", stock: 7, thumbnailUrl: photo.tote, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [
        { url: photo.interior, title: "Kutchery Chowk", body: "Kunal Store, Deputy Para Road. Morning light on the mats.", category: "AMBIENCE" },
        { url: photo.mira, title: "The floor", body: "Hatha at 6am, Vinyasa at 6pm. Book the batch.", category: "INTERIOR" },
        { url: photo.anika, title: "Teachers", body: "Arya, Suman, Meera, Vikram.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About Natraj", rawText: "Natraj Institute of Yoga, Kunal Store, Deputy Para Road, Kutchery Chowk, Ranchi 834001. Independent studio. Open 5:00am–8:00pm every day. Phone 078084 75779. Morning Hatha ₹250, evening Vinyasa ₹300, beginner ₹200, private ₹800. Teachers: Arya Prahlad Bhagat, Suman, Meera, Vikram. Mats on the shelf." },
        { type: "FAQ", title: "Batches and retail", rawText: "Book a batch. Private is one person. Bring a mat or buy one at the desk. Oil on the shelf is not a medicine. We do not diagnose backs or joints. Teacher training is a separate conversation at the desk, not a chat enrolment." },
    ],
    customInstructions: "You are Natraj Institute of Yoga at Kunal Store, Deputy Para Road, Kutchery Chowk, Ranchi. Help with class batches, private hours, teachers, and mat-shop pickup. Open 5:00–20:00 every day. Prices in rupees. Staff are Arya Prahlad Bhagat, Suman, Meera, Vikram. Never diagnose a back, joint, or illness. Never prescribe oil as treatment. Never invent a second ashram.",
    tone: "calm",
}

export const PLUTO_PET_GROOMING: DemoShop = {
    flavor: "PET_GROOMING",
    engine: "SALON_SPA",
    goal: "TAKE_APPOINTMENTS",
    slug: "pluto-grooming-hinoo",
    name: "Pluto Pet Grooming",
    headline: "Hinoo Main Road grooming table — bath, haircut, nails. Slots only.",
    bio: `Pluto Pet Grooming sits at Vrinda Market Complex, 1 Hinoo Main Road, Hinoo, Ranchi 834002, opposite Indira Place, near Puja Medical. The table books baths and cuts. Chat does not take illness, shots, or surgery.

Open every day 9:00am–9:00pm. Bring the dog on a lead. Cats in a box. Large coats need the 90-minute slot.

Call 099341 77145. Ask for Rina, Imran, Sonal, or Vikash.`,
    welcome: "Ask for a bath, a full groom, or nails, and a time on Hinoo Main Road.",
    speakerName: "Hinoo desk",
    speakerRole: "groomer",
    whatsapp: "919934177145",
    upiId: "plutohinoo@upi",
    imageUrl: photo.nia,
    shopLogoUrl: photo.tote,
    venue: {
        address: {
            formatted: "Vrinda Market Complex, 1 Hinoo Main Road, opposite Indira Place, Hinoo, Ranchi 834002",
            line1: "Vrinda Market Complex, Hinoo Main Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919934177145", display: "099341 77145" },
        categories: ["Pet grooming"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Pluto+Pet+Clinic+Vrinda+Market+Hinoo+Main+Road+Ranchi",
    },
    hours: everydayHours("09:00", "21:00"),
    services: [
        { name: "Bath and blow-dry", description: "Shampoo, dry, brush. Forty-five minutes. Small and medium dogs.", durationMinutes: 45, priceRupees: 800, kind: "SESSION" },
        { name: "Full groom — small", description: "Bath, haircut, nails, ears. Seventy-five minutes. Under 15 kg.", durationMinutes: 75, priceRupees: 1200, kind: "SESSION" },
        { name: "Full groom — large", description: "Bath, haircut, nails, ears. Ninety minutes. Over 15 kg. Book before 6pm.", durationMinutes: 90, priceRupees: 1800, kind: "SESSION" },
        { name: "Nails and ears", description: "Twenty minutes. Quick table. Cats in a box.", durationMinutes: 20, priceRupees: 300, kind: "SESSION" },
    ],
    staff: [
        { name: "Rina", kind: "STAFF", capacity: 1 },
        { name: "Imran", kind: "STAFF", capacity: 1 },
        { name: "Sonal", kind: "STAFF", capacity: 1 },
        { name: "Vikash", kind: "STAFF", capacity: 1 },
    ],
    products: [
        { title: "Pet shampoo 200ml", description: "The bottle from the bath. Pickup at Hinoo.", category: "Grooming", priceRupees: 280, sku: "PG-SHAM", stock: 14, thumbnailUrl: photo.packaging, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Coat oil 100ml", description: "After the blow-dry. Not a medicine.", category: "Grooming", priceRupees: 240, sku: "PG-OIL", stock: 10, thumbnailUrl: photo.mug, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Slicker brush", description: "One brush for home.", category: "Gear", priceRupees: 220, sku: "PG-BRUSH", stock: 12, thumbnailUrl: photo.lamp, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Nail clipper", description: "Small. Desk will show the stop if you ask.", category: "Gear", priceRupees: 180, sku: "PG-NAIL", stock: 9, thumbnailUrl: photo.brand, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Cotton towel", description: "For the ride back up Hinoo Main Road.", category: "Gear", priceRupees: 160, sku: "PG-TOW", stock: 11, thumbnailUrl: photo.tote, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
        { title: "Chew pack", description: "Four pieces. Not a meal.", category: "Treats", priceRupees: 140, sku: "PG-CHEW", stock: 18, thumbnailUrl: photo.muffin, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true },
    ],
    story: [
        { url: photo.store, title: "Hinoo Main Road", body: "Vrinda Market Complex, opposite Indira Place. Lead on, name at the desk.", category: "AMBIENCE" },
        { url: photo.nia, title: "The table", body: "Bath, cut, nails. Book the minutes by coat size.", category: "INTERIOR" },
        { url: photo.table, title: "Retail", body: "Shampoo, oil, brush, towel. Pickup with the slot.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About the table", rawText: "Pluto Pet Grooming, Vrinda Market Complex, 1 Hinoo Main Road, Hinoo, Ranchi 834002, opposite Indira Place. Grooming slots only in this chat. Open 9:00am–9:00pm every day. Phone 099341 77145. Bath ₹800, small groom ₹1,200, large groom ₹1,800, nails and ears ₹300. Groomers: Rina, Imran, Sonal, Vikash." },
        { type: "FAQ", title: "Slots and what we will not do in chat", rawText: "Bring a lead or a box. Large coats before 6pm. We do not book shots, surgery, or illness in this chat — those are a different desk if the hospital is open. Retail is shampoo, oil, brush, clipper, towel, chews. Oil is not a medicine. No diagnosis of skin, ears, or limp." },
    ],
    customInstructions: "You are the grooming desk at Pluto on Hinoo Main Road, Vrinda Market Complex, Ranchi. Help with bath, full groom, nails, hours, and retail pickup. Open 9:00–21:00 every day. Prices in rupees. Staff are Rina, Imran, Sonal, Vikash. Never diagnose an animal. Never name a disease. Never suggest a medicine, a shot, or a surgery. Never read a lab report. If they describe an emergency, tell them to go to a veterinary hospital — do not triage. Grooming slots only.",
    tone: "warm",
}

export const BOOK_SHOPS: DemoShop[] = [
    JK_SHARMA_CLINIC,
    PODDAR_ASSOCIATES,
    KATHAL_MORE_INSURANCE,
    LALPUR_CONSULTANT,
    SINGH_RAUSHAN_CA,
    H_SQUARE_SALON,
    FITNESS_ADDICTION,
    AURA_FITNESS,
    FIT24,
    PRINCE_BARBER,
    NATRAJ_YOGA,
    PLUTO_PET_GROOMING,
]

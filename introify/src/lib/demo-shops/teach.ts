import { everydayHours, weekdaysHours, type DemoShop } from "./types"

const photo = {
    nia: "/uploads/try-nia.jpg",
    course: "/uploads/try-course.jpg",
    workshop: "/uploads/try-workshop.jpg",
    priya: "/uploads/try-priya.jpg",
    rohan: "/uploads/try-rohan.jpg",
    leela: "/uploads/try-leela.jpg",
    kabir: "/uploads/try-kabir.jpg",
    samir: "/uploads/try-samir.jpg",
    theo: "/uploads/try-theo.jpg",
}

export const KANKE_BOARD_CLASS: DemoShop = {
    flavor: "TUTOR",
    engine: "COACH",
    goal: "SELL_PRODUCTS",
    slug: "kanke-board-class",
    name: "Kanke Board Class",
    headline: "Class 10 and 12 boards from a Kanke Road home class — JAC and CBSE maths, science, accountancy.",
    bio: `Kabir runs a home class on a lane off Kanke Road, near Ranchi University, Ranchi 834008. Class 10 maths and science for JAC and CBSE. Class 12 maths for PCM, and accountancy plus business studies for commerce.

Six students around one table. Hindi-medium JAC papers and English-medium CBSE papers in the same week, not a mall batch. Parents sit through the intro. Homework is a page of board-style questions, marked the next evening.

Crash batch runs December to February, before JAC matric, JAC intermediate, and CBSE boards. Notes and practice packs are PDFs after UPI.

WhatsApp 94311 56210.`,
    welcome: "Ask for class 10 or 12, JAC or CBSE, the intro, a weekly seat, or the December crash.",
    speakerName: "Kabir",
    speakerRole: "tutor",
    whatsapp: "919431156210",
    upiId: "kankeboard@upi",
    deliveryNote: "PDFs arrive in chat after UPI. The home class is on Kanke Road; crash sittings are at the same table.",
    imageUrl: photo.kabir,
    shopLogoUrl: photo.course,
    venue: {
        address: {
            formatted: "Home class, lane off Kanke Road, near Ranchi University, Ranchi 834008",
            line1: "Lane off Kanke Road, near Ranchi University",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834008",
            country: "IN",
        },
        phone: { e164: "+919431156210", display: "94311 56210" },
        categories: ["Board tuition", "Class 10", "Class 12", "JAC", "CBSE"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Kanke+Road+Ranchi+University",
    },
    hours: weekdaysHours("15:30", "20:30"),
    staff: [
        { name: "Kabir", kind: "STAFF", capacity: 6 },
        { name: "Board table", kind: "ROOM", capacity: 6 },
    ],
    services: [
        { name: "Intro session", description: "Thirty minutes with parent and student. Board, subject, and whether a weekly seat is free. No fee.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Weekly class", description: "Sixty minutes at the Kanke table. Maths, science, or accountancy. Homework marked the next class.", durationMinutes: 60, priceRupees: 500, kind: "SESSION", isRecurring: true },
        { name: "Crash batch", description: "Ninety-minute sitting in the December–February window. Full syllabus, board papers, and timed writing. One seat in the batch.", durationMinutes: 90, priceRupees: 9000, kind: "SESSION" },
    ],
    products: [
        { title: "Class 10 maths notes", description: "JAC and CBSE class 10 maths — formulae, worked numbers, and board-style questions. PDF.", category: "Notes", priceRupees: 249, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "KB-M10", thumbnailUrl: photo.course, highlights: ["Real numbers to quadratic", "JAC and CBSE wording", "Marked solutions"] },
        { title: "Class 10 science practice pack", description: "Physics, chemistry, and biology numericals and reasons, written the way JAC and CBSE award marks. PDF.", category: "Practice", priceRupees: 299, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "KB-S10", thumbnailUrl: photo.course, highlights: ["Numericals with steps", "Reason-why questions", "Diagram labels"] },
        { title: "Class 12 maths board pack", description: "Calculus, algebra, and probability for PCM. Timed papers in the crash style. PDF.", category: "Practice", priceRupees: 399, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "KB-M12", thumbnailUrl: photo.course, highlights: ["Integrals and applications", "Three-hour papers", "Marking notes"] },
        { title: "Class 12 accountancy pack", description: "Partnership, companies, and analysis of statements. Journal to balance sheet, CBSE and JAC. PDF.", category: "Notes", priceRupees: 349, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "KB-ACC12", thumbnailUrl: photo.kabir, highlights: ["Company accounts", "Cash flow", "Board format"] },
    ],
    courses: [
        {
            title: "Class 10 board maths — Kanke",
            description: "The class 10 maths paper as it is written in Ranchi — JAC Hindi-medium and CBSE. Algebra first, then geometry, then a timed paper.",
            priceRupees: 2500,
            thumbnailUrl: photo.course,
            modules: [
                {
                    title: "Number and algebra",
                    lessons: ["Real numbers and Euclid", "Polynomials", "Pair of linear equations", "Quadratic equations"],
                },
                {
                    title: "Geometry and data",
                    lessons: ["Triangles and similarity", "Circles", "Surface areas and volumes", "Statistics and probability"],
                },
            ],
        },
    ],
    events: [
        { title: "Pre-board paper sitting", description: "A three-hour maths paper at the Kanke table. Bring the board pad. Marked the same evening.", daysFromNow: 18, durationHours: 3, location: "Kanke Board Class, Kanke Road", priceRupees: 400, thumbnailUrl: photo.workshop },
    ],
    leadMagnets: [
        { title: "Class 10 formula sheet", description: "One page of maths formulae as they appear on JAC and CBSE papers." },
    ],
    story: [
        { url: photo.kabir, title: "The table", body: "Six seats, board pads, and the evening batch on Kanke Road.", category: "INTERIOR" },
        { url: photo.course, title: "Notes", body: "Worked numbers and a timed paper. What goes home as a PDF.", category: "TEAM" },
        { url: photo.rohan, title: "Evening class", body: "Class 12 stays till 8:30 when the crash is on.", category: "TEAM" },
        { url: photo.workshop, title: "Paper sitting", body: "Pre-board at the same table. Silence, then marking.", category: "EVENT" },
    ],
    documents: [
        { type: "BIO", title: "About Kanke Board Class", rawText: "Kanke Board Class is Kabir’s home tuition on a lane off Kanke Road, near Ranchi University, Ranchi 834008. Class 10 maths and science (JAC and CBSE). Class 12 maths for PCM and accountancy for commerce. Six students at a time. Monday–Saturday 15:30–20:30. Intro is free. Weekly class ₹500. Crash batch ₹9,000 in December–February. WhatsApp 94311 56210. UPI kankeboard@upi. Independent — not a national coaching brand." },
        { type: "FAQ", title: "Boards, seats, and crash", rawText: "JAC Hindi-medium and CBSE English papers. Class 10: maths and science. Class 12: maths and accountancy. Intro is 30 minutes with a parent. Weekly seat is one hour, homework marked next class. Crash batch is December to February, ninety minutes a sitting, before JAC matric, JAC intermediate, and CBSE boards. Sunday is off except a booked paper sitting. PDFs after UPI. No home visits outside Kanke, Harmu, and Morabadi." },
        { type: "TEXT", title: "Fee card", rawText: "Intro session ₹0. Weekly class ₹500 per hour. Crash batch ₹9,000 for the December–February seat. Class 10 maths notes ₹249. Science practice pack ₹299. Class 12 maths pack ₹399. Accountancy pack ₹349. Pre-board paper sitting ₹400. Pay on UPI before the PDF or the crash seat is held." },
    ],
    experiences: [
        { company: "Kanke Board Class", role: "Tutor", startDate: "2018", description: "Home class on Kanke Road. Class 10 and 12 boards, JAC and CBSE." },
        { company: "Home tuition, Harmu and Morabadi", role: "Class 10 maths", startDate: "2015", endDate: "2018", description: "One-to-one maths in the student’s house before the Kanke table opened." },
    ],
    projects: [
        { title: "2025 JAC matric maths batch", description: "Eight students from Kanke and Morabadi. Full class 10 maths, Hindi-medium papers, weekly timed writing through January.", year: "2025", imageUrl: photo.course, client: "JAC class 10 families" },
        { title: "CBSE class 12 accountancy pre-board", description: "Commerce students from nearby Kanke schools. Company accounts and cash flow in board format, marked against the CBSE scheme.", year: "2024", imageUrl: photo.kabir, client: "Class 12 commerce" },
    ],
    customInstructions: "You are Kabir at Kanke Board Class, a home class on Kanke Road, Ranchi 834008. Independent tutor — not a national coaching brand. Help with class 10 maths and science, class 12 maths and accountancy, JAC (including Hindi-medium) and CBSE. Offer the intro session, a weekly class, or the December–February crash batch. Sell the PDF notes and practice packs. Hours Monday–Saturday 15:30–20:30. Prices in rupees. Never invent ranks, school names you do not have, or a second branch. Do not send anyone to a mall coaching centre.",
    tone: "direct",
}

export const LALPUR_SANGEET_GHAR: DemoShop = {
    flavor: "MUSIC_TEACHER",
    engine: "COACH",
    goal: "SELL_PRODUCTS",
    slug: "lalpur-sangeet-ghar",
    name: "Lalpur Sangeet Ghar",
    headline: "Tabla, guitar, and vocal in a Lalpur home studio — riyaz, school annual day, Prayag papers.",
    bio: `Samir teaches from a home studio off Lalpur Circular Road, Ranchi 834001. Tabla, guitar, and Hindustani vocal in one room — two tablas, two guitars, a tanpura box, and a mat.

Children after school. Adults on Saturday morning. Beginners learn teentaal and three chords in the same month if that is the brief. Students who want a certificate sit Prayag Sangeet Samiti from this room. School annual day, church and college nights, and a Sarhul evening if the student is ready.

Independent class. Not a franchise. Practice files are PDFs after UPI.

WhatsApp 99341 78445.`,
    welcome: "Ask for tabla, guitar, or vocal — the intro, a weekly riyaz, or a crash before annual day.",
    speakerName: "Samir",
    speakerRole: "teacher",
    whatsapp: "919934178445",
    upiId: "lalpursangeet@upi",
    deliveryNote: "Practice PDFs arrive in chat after UPI. Classes are in the Lalpur room; guitar can come to the house in Lalpur and Bariatu.",
    imageUrl: photo.samir,
    shopLogoUrl: photo.theo,
    venue: {
        address: {
            formatted: "Home studio, off Lalpur Circular Road, Ranchi 834001",
            line1: "Off Lalpur Circular Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919934178445", display: "99341 78445" },
        categories: ["Music class", "Tabla", "Guitar", "Vocal"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Lalpur+Circular+Road+Ranchi",
    },
    hours: everydayHours("10:00", "20:00"),
    staff: [
        { name: "Samir", kind: "STAFF", capacity: 1 },
        { name: "Tabla gaddi", kind: "EQUIPMENT", capacity: 1 },
        { name: "Guitar chair", kind: "EQUIPMENT", capacity: 1 },
    ],
    services: [
        { name: "Intro session", description: "Thirty minutes in the Lalpur room. Hear the student, pick tabla, guitar, or vocal, and a first riyaz. No fee.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Weekly class", description: "Forty-five minutes, one instrument or voice. Homework is a recorded riyaz and a PDF.", durationMinutes: 45, priceRupees: 700, kind: "SESSION", isRecurring: true },
        { name: "Crash batch", description: "Six sittings before school annual day, a college night, or Prayag Prarambhik. Tabla theka, guitar song, or vocal bandish.", durationMinutes: 60, priceRupees: 4200, kind: "SESSION" },
    ],
    products: [
        { title: "Tabla kayda notebook", description: "Teentaal theka, kayda, and tihai written for this room. Print it or keep it on the phone. PDF.", category: "Tabla", priceRupees: 199, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LS-TAB", thumbnailUrl: photo.course, highlights: ["Teentaal theka", "Two kaydas", "Tihai"] },
        { title: "Guitar chord and strum pack", description: "Open chords, keharwa and dadra strums, and four songs used in Ranchi annual days. PDF.", category: "Guitar", priceRupees: 249, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LS-GIT", thumbnailUrl: photo.theo, highlights: ["G, C, D, Em, Am", "Keharwa strum", "Four songs"] },
        { title: "Vocal riyaz notes", description: "Sa re ga, aalaap, and one bhajan plus one film bandish. Swar written for daily practice. PDF.", category: "Vocal", priceRupees: 229, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LS-VOC", thumbnailUrl: photo.priya, highlights: ["Swar sadhana", "One bhajan", "One film song"] },
        { title: "Prayag Prarambhik pack", description: "Theory and practical list for Prayag Sangeet Samiti Prarambhik — tabla or vocal. PDF.", category: "Exam", priceRupees: 349, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LS-PRG", thumbnailUrl: photo.course, highlights: ["Syllabus list", "Taal writing", "Viva questions"] },
    ],
    courses: [
        {
            title: "First year in the Lalpur room",
            description: "Tabla, guitar, and voice as they are taught in this house — taal first, then a song you can play or sing at home.",
            priceRupees: 3500,
            thumbnailUrl: photo.workshop,
            modules: [
                {
                    title: "Tabla and taal",
                    lessons: ["Sitting, dayan, and bayan", "Bols: na, tin, dha, ge", "Teentaal theka", "A first kayda"],
                },
                {
                    title: "Guitar and voice",
                    lessons: ["Tuning and first three chords", "Keharwa on guitar", "Sa re ga and aalaap", "One bhajan, one film song"],
                },
            ],
        },
    ],
    events: [
        { title: "Sunday baithak", description: "An hour in the Lalpur room. Students play theka or a song. Parents sit on the mat.", daysFromNow: 12, durationHours: 1, location: "Lalpur Sangeet Ghar, Circular Road", priceRupees: 0, thumbnailUrl: photo.workshop },
    ],
    leadMagnets: [
        { title: "First-week riyaz sheet", description: "Ten minutes of tabla bols or guitar chords to do before the intro." },
    ],
    story: [
        { url: photo.samir, title: "The room", body: "Two tablas, two guitars, Circular Road below the window.", category: "INTERIOR" },
        { url: photo.theo, title: "Guitar hour", body: "After school, keharwa, then a song for annual day.", category: "TEAM" },
        { url: photo.priya, title: "A take", body: "Vocal students record the bhajan once a month so riyaz has a date.", category: "TEAM" },
        { url: photo.workshop, title: "Baithak", body: "Sunday. Theka, then tea.", category: "EVENT" },
    ],
    documents: [
        { type: "BIO", title: "About Lalpur Sangeet Ghar", rawText: "Lalpur Sangeet Ghar is Samir’s home studio off Lalpur Circular Road, Ranchi 834001. Tabla, guitar, and Hindustani vocal. Open 10:00–20:00 every day. Intro is free. Weekly class ₹700 for 45 minutes. Crash before annual day or Prayag Prarambhik ₹4,200. WhatsApp 99341 78445. UPI lalpursangeet@upi. Independent house class — not a music franchise." },
        { type: "FAQ", title: "Instruments, Prayag, annual day", rawText: "Bring your own guitar if you have one; tablas stay in the room. Vocal uses a tanpura box. Prayag Sangeet Samiti Prarambhik and Praveshika from this class if you want a certificate. School annual day crash is six sittings. Sarhul week in March/April the Sunday baithak is cancelled. Home visits only in Lalpur and Bariatu, guitar only." },
        { type: "TEXT", title: "Riyaz rules", rawText: "Ten minutes a day, recorded once a week. Weekly class is 45 minutes. Miss a class, message before noon. Crash batch dates are fixed when you pay. PDFs are for practice, not a substitute for the room." },
    ],
    experiences: [
        { company: "Lalpur Sangeet Ghar", role: "Teacher", startDate: "2016", description: "Home studio on Circular Road. Tabla, guitar, vocal." },
        { company: "School visiting class, Lalpur", role: "Annual-day guitar and vocal", startDate: "2014", endDate: "2016", description: "After-school guitar and voice for annual day before the home studio opened." },
    ],
    projects: [
        { title: "Lalpur school annual day", description: "Twelve students. Tabla theka under two songs, guitar on keharwa, one Hindustani bandish. Rehearsed in this room.", year: "2025", imageUrl: photo.workshop, client: "Lalpur school families" },
        { title: "Prayag Prarambhik, vocal and tabla", description: "Four students sat Prarambhik from the Lalpur room — two vocal, two tabla. Theory from the PDF, practical on the mat.", year: "2024", imageUrl: photo.samir, client: "Prayag Sangeet Samiti" },
    ],
    customInstructions: "You are Samir at Lalpur Sangeet Ghar, a home studio off Lalpur Circular Road, Ranchi 834001. Independent music teacher — tabla, guitar, and vocal. Not a franchise. Help with the intro, a weekly class, or a crash before annual day or Prayag Prarambhik. Sell the practice PDFs. Open 10:00–20:00 every day. Prices in rupees. Never invent grades you have not taught, a second branch, or a national music app. Home visits only in Lalpur and Bariatu, guitar only.",
    tone: "warm",
}

export const LEELA_PATH: DemoShop = {
    flavor: "COACH",
    engine: "COACH",
    goal: "SELL_PRODUCTS",
    slug: "leela-path-lalpur",
    name: "Leela Path",
    headline: "Career and ops coaching in Lalpur — Jharkhand students after 10 and 12, founders in the first year.",
    bio: `Leela coaches from a first-floor room in Lalpur, Ranchi 834001. Two kinds of work.

Students: class 10 stream — PCM, PCB, or commerce — with the actual Ranchi map in mind (JVM Shyamali, DAV, neighbourhood JAC schools). Class 12 college: JoSAA, CUET, BIT Mesra, NIT Jamshedpur, Ranchi University, RIMS. Parents sit in the intro.

Founders: the first twelve months of a Ranchi shop or a two-person firm — GST calendar, first hire from Harmu or Hatia, a weekly ops hour that actually happens. Jharcraft suppliers, mining-services shops, a Harmu software pair. Not a Delhi career brand.

Notes are PDFs after UPI. WhatsApp 92042 21890.`,
    welcome: "Ask for a student intro, a founder ops hour, the weekly seat, or the JoSAA / first-hire crash.",
    speakerName: "Leela",
    speakerRole: "coach",
    whatsapp: "919204221890",
    upiId: "leelapath@upi",
    deliveryNote: "PDFs arrive in chat after UPI. Sessions are in the Lalpur room; a founder ops hour can be at the shop if it is in Lalpur, Harmu, or Doranda.",
    imageUrl: photo.leela,
    shopLogoUrl: photo.nia,
    venue: {
        address: {
            formatted: "First-floor room, Lalpur, Ranchi 834001",
            line1: "Lalpur",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919204221890", display: "92042 21890" },
        categories: ["Career coach", "Founder ops", "Class 10", "Class 12"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Lalpur+Ranchi+834001",
    },
    hours: weekdaysHours("10:00", "19:00"),
    staff: [
        { name: "Leela", kind: "STAFF", capacity: 1 },
        { name: "Talk room", kind: "ROOM", capacity: 3 },
    ],
    services: [
        { name: "Intro session", description: "Forty-five minutes. Student and parent, or founder with the cash book. Whether a weekly seat is the next step. No fee.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Weekly class", description: "Sixty minutes. Stream and college for students, or a founder ops hour (GST, hire, this week’s numbers).", durationMinutes: 60, priceRupees: 2500, kind: "SESSION", isRecurring: true },
        { name: "Crash batch", description: "Five sittings. JoSAA / CUET week for class 12, or a first-hire and GST sprint for a Ranchi founder.", durationMinutes: 90, priceRupees: 12000, kind: "SESSION" },
    ],
    products: [
        { title: "Class 10 stream worksheet", description: "PCM, PCB, commerce, and what those actually mean in Ranchi schools and in JAC vs CBSE. PDF.", category: "Students", priceRupees: 199, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LP-STR", thumbnailUrl: photo.course, highlights: ["PCM / PCB / commerce", "JAC vs CBSE", "Parent page"] },
        { title: "JoSAA and CUET notes", description: "Choice filling for NIT Jamshedpur, BIT Mesra, GFTIs, and CUET colleges used by Jharkhand families. PDF.", category: "Students", priceRupees: 349, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LP-JOS", thumbnailUrl: photo.course, highlights: ["Choice lists", "BIT Mesra and NIT JSR", "CUET rounds"] },
        { title: "First-hire ops sheet", description: "A one-page ops sheet for a Ranchi founder hiring the first person — role, pay, and the first 30 days. PDF.", category: "Founders", priceRupees: 299, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LP-HIRE", thumbnailUrl: photo.nia, highlights: ["Role and pay", "30-day list", "Attendance"] },
        { title: "Weekly founder review", description: "GST dates, cash, UPI, and three numbers to look at every Saturday. Written for Ranchi shops. PDF.", category: "Founders", priceRupees: 249, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", sku: "LP-OPS", thumbnailUrl: photo.workshop, highlights: ["GST calendar", "Cash and UPI", "Saturday review"] },
    ],
    courses: [
        {
            title: "After school in Jharkhand",
            description: "Stream, college, and the first job or the first shop — taught for Ranchi families, not a metro brochure.",
            priceRupees: 4000,
            thumbnailUrl: photo.course,
            modules: [
                {
                    title: "Students after 10 and 12",
                    lessons: ["PCM, PCB, or commerce in Ranchi", "JAC intermediate vs CBSE 12", "BIT Mesra, NIT Jamshedpur, Ranchi University, CUET", "JoSAA choice filling without panic"],
                },
                {
                    title: "Founders in the first year",
                    lessons: ["The first twelve weeks of a Ranchi shop", "GST, UPI, and a cash book", "Hiring the first person from Harmu or Hatia", "A weekly ops hour that actually happens"],
                },
            ],
        },
    ],
    events: [
        { title: "JoSAA week sitting", description: "Class 12 families. Choice lists for NIT Jamshedpur, BIT Mesra, and GFTIs. Bring rank and category.", daysFromNow: 21, durationHours: 2, location: "Leela Path, Lalpur", priceRupees: 800, thumbnailUrl: photo.workshop },
        { title: "Founder Saturday", description: "Two hours. GST calendar, first hire, and the week’s three numbers. For Ranchi shops in year one.", daysFromNow: 9, durationHours: 2, location: "Leela Path, Lalpur", priceRupees: 1500, thumbnailUrl: photo.nia },
    ],
    leadMagnets: [
        { title: "Stream choice one-pager", description: "PCM, PCB, commerce — one page for a Ranchi class 10 parent." },
    ],
    story: [
        { url: photo.leela, title: "The room", body: "First floor, Lalpur. Parent, student, and the stream worksheet.", category: "INTERIOR" },
        { url: photo.nia, title: "A parent hour", body: "Class 12, JoSAA list, no brochure talk.", category: "TEAM" },
        { url: photo.workshop, title: "Founder Saturday", body: "Cash book on the table. First hire next.", category: "EVENT" },
        { url: photo.course, title: "Worksheets", body: "Stream page, choice list, ops sheet. What leaves as a PDF.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About Leela Path", rawText: "Leela Path is Leela’s independent coaching room in Lalpur, Ranchi 834001. Career work for class 10 and 12 students in Jharkhand, and ops work for Ranchi founders in year one. Monday–Saturday 10:00–19:00. Intro is free. Weekly class ₹2,500. Crash batch ₹12,000 (JoSAA week or first-hire sprint). WhatsApp 92042 21890. UPI leelapath@upi. Not a national career brand and not a coaching mall." },
        { type: "FAQ", title: "Students, founders, crash", rawText: "Students: class 10 stream and class 12 college (JoSAA, CUET, BIT Mesra, NIT Jamshedpur, Ranchi University, RIMS). Founders: GST calendar, first hire, weekly numbers — shops and two-person firms in Ranchi, including Jharcraft suppliers and mining-services. Intro is 45 minutes. Weekly is 60 minutes. Crash is five sittings. Founder ops can be at the shop in Lalpur, Harmu, or Doranda. No placement guarantee. No college admission sold from this room." },
        { type: "TEXT", title: "What this room will not do", rawText: "No rank prediction sold as a promise. No paid seat in a private college. No Delhi-style CV mill. No national coaching package. Student work is stream, college list, and choice filling. Founder work is ops in year one. PDFs support the hour; they are not the hour." },
    ],
    experiences: [
        { company: "Leela Path", role: "Coach", startDate: "2019", description: "Lalpur room. Jharkhand students after 10 and 12, Ranchi founders in year one." },
        { company: "School stream talks, Ranchi", role: "Class 10 stream hour", startDate: "2016", endDate: "2019", description: "Evening stream hours with class 10 families in Lalpur and Doranda before the room opened." },
    ],
    projects: [
        { title: "JoSAA week, NIT Jamshedpur", description: "Six class 12 families. Choice lists written against rank and category. Seats taken at NIT Jamshedpur and a GFTI. No brochure.", year: "2025", imageUrl: photo.workshop, client: "Class 12 families" },
        { title: "First hire at a Harmu workshop", description: "A two-person workshop. Role, pay, 30-day list, and attendance. The ops hour ran twelve weeks.", year: "2024", imageUrl: photo.nia, client: "Harmu workshop" },
        { title: "Jharcraft supplier, GST calendar", description: "A supplier putting GST dates and UPI on a Saturday review. Cash book, not a pitch deck.", year: "2024", imageUrl: photo.course, client: "Jharcraft supplier" },
    ],
    customInstructions: "You are Leela at Leela Path, a first-floor room in Lalpur, Ranchi 834001. Independent career and ops coach for Jharkhand students and Ranchi founders. Help class 10 with stream and class 12 with JoSAA, CUET, BIT Mesra, NIT Jamshedpur, Ranchi University, and RIMS. Help founders with GST, first hire, and a weekly ops hour. Offer the intro, the weekly class, or the crash batch. Sell the PDFs. Hours Monday–Saturday 10:00–19:00. Prices in rupees. Never invent ranks, admissions, placements, or a second city office. Never sell a national coaching package.",
    tone: "calm",
}

export const TEACH_SHOPS: DemoShop[] = [
    KANKE_BOARD_CLASS,
    LALPUR_SANGEET_GHAR,
    LEELA_PATH,
]

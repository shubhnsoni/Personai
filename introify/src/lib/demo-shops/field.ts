import { everydayHours, weekdaysHours, type DemoShop } from "./types"

const photo = {
    workshop: "/uploads/try-workshop.jpg",
    store: "/uploads/try-storefront.jpg",
    lamp: "/uploads/try-lamp.jpg",
    arjun: "/uploads/try-arjun.jpg",
    kabir: "/uploads/try-kabir.jpg",
    samir: "/uploads/try-samir.jpg",
    rohan: "/uploads/try-rohan.jpg",
    atlas: "/uploads/try-atlas.jpg",
    counter: "/uploads/skydine-cafe/counter.jpg",
    interior: "/uploads/skydine-cafe/interior.jpg",
    table: "/uploads/skydine-cafe/table.jpg",
    cafe: "/uploads/blu-cafe/cafe.jpg",
    pack: "/uploads/try-packaging.jpg",
}

export const JHARKHAND_FIELD_CREW: DemoShop = {
    flavor: "FIELD_SERVICE",
    engine: "FIELD_SERVICE",
    goal: "TAKE_APPOINTMENTS",
    slug: "jharkhand-plumbing-electrical",
    name: "Jharkhand Plumbing & Electrical Solutions",
    headline: "Hinoo field crew — site visits, leak tracing, wiring checks, and a job card.",
    bio: `Jharkhand Plumbing & Electrical Solutions works out of Hinoo Balmandir, Hinoo, Ranchi 834002. A small crew, not a call-centre. Plumbing and electrical jobs in the same van.

Ask for a site visit first. We look at the leak, the MCB, or the dry fan, then we quote before we cut a pipe or pull a wire. Open 8:00–20:00. WhatsApp the landmark — Balmandir, Hinoo Main Road, or the airport side.

We cover Hinoo, Doranda, and Harmu. Booty Road and Kanke are a next-day slot unless it is a burst or a dead board.`,
    welcome: "Tell us the house, the fault, and whether it is water or power. We will send a visit.",
    speakerName: "Hinoo desk",
    speakerRole: "dispatcher",
    upiId: "jharkhandfield@upi",
    deliveryNote: "We come to you in Hinoo, Doranda, and Harmu. Parts billed on the job. Cash and UPI.",
    imageUrl: photo.workshop,
    shopLogoUrl: photo.samir,
    venue: {
        address: {
            formatted: "Hinoo Balmandir, Hinoo, Ranchi 834002",
            line1: "Hinoo Balmandir, Hinoo",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Hinoo desk" },
        categories: ["Field service", "Plumbing", "Electrical"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Jharkhand+Plumbing+Electrical+Solutions+Hinoo+Balmandir+Ranchi",
    },
    hours: everydayHours("08:00", "20:00"),
    services: [
        { name: "Site visit", description: "One technician at the door. Looks at the fault, photographs it, and quotes before any work.", durationMinutes: 60, priceRupees: 300, kind: "SESSION" },
        { name: "Leak tracing", description: "Follow a wet wall, a dripping joint, or a tank overflow. Open-up is extra if we have to chase a pipe.", durationMinutes: 90, priceRupees: 800, kind: "SESSION" },
        { name: "Electrical safety check", description: "Board, earthing, MCB, and hot points. Written list of what must be replaced.", durationMinutes: 60, priceRupees: 450, kind: "SESSION" },
        { name: "Fan and fitting job", description: "Ceiling fan, exhaust, or a new holder. Fan cost extra if you do not have one ready.", durationMinutes: 60, priceRupees: 250, kind: "SESSION" },
        { name: "Bathroom fittings", description: "Tap, angle cock, health faucet, or a cistern washer. Fitting only; sanitary billed as used.", durationMinutes: 75, priceRupees: 700, kind: "SESSION" },
        { name: "Emergency call-out", description: "Burst pipe, dead board, or no power after 8pm. Desk confirms a technician is free before we roll.", durationMinutes: 90, priceRupees: 900, kind: "SESSION" },
    ],
    staff: [
        { name: "Rakesh", kind: "STAFF", capacity: 1 },
        { name: "Imran", kind: "STAFF", capacity: 1 },
        { name: "Suresh", kind: "STAFF", capacity: 1 },
    ],
    story: [
        { url: photo.workshop, title: "The van", body: "Tools, pipe, wire, and a job card. We leave Hinoo Balmandir from eight.", category: "INTERIOR" },
        { url: photo.store, title: "Hinoo", body: "Balmandir side of Hinoo. Landmark the desk if the pin drops on the airport road.", category: "AMBIENCE" },
        { url: photo.lamp, title: "Jobs", body: "Leaks, boards, fans. Quote on site before we open a wall.", category: "INTERIOR" },
        { url: photo.samir, title: "Crew", body: "Rakesh, Imran, Suresh. One name on the visit, not a rotating roster.", category: "TEAM" },
    ],
    documents: [
        { type: "BIO", title: "About the Hinoo crew", rawText: "Jharkhand Plumbing & Electrical Solutions, Hinoo Balmandir, Hinoo, Ranchi 834002. Field crew for plumbing and electrical site visits. Open 8:00–20:00. Service area: Hinoo, Doranda, Harmu. Visit ₹300. Quote before work. Cash and UPI." },
        { type: "FAQ", title: "Visits and Sunday", rawText: "Book a site visit in chat. Sunday 8:00–20:00 is for emergencies — burst, no water, dead board. After 8pm WhatsApp the desk; we come if a technician is free, emergency call-out ₹900. We do not cover Kanke or Booty Road the same morning unless it is a burst. Parts are billed on the job; we do not leave stock at the house." },
    ],
    customInstructions: "You are the desk at Jharkhand Plumbing & Electrical Solutions, Hinoo Balmandir, Ranchi. Dispatch site visits in Hinoo, Doranda, and Harmu. Open 8:00–20:00. Prices in rupees. Quote after a visit; do not invent a parts bill. Sunday is emergency-first. Never offer Booty Road or Kanke as a same-morning slot unless they say it is a burst or a dead board. Never invent ratings or another branch.",
    tone: "direct",
}

export const GOODWILL_PLUMBING: DemoShop = {
    flavor: "PLUMBER",
    engine: "FIELD_SERVICE",
    goal: "TAKE_APPOINTMENTS",
    slug: "goodwill-plumbing",
    name: "Goodwill Plumbing Services",
    headline: "Lalpur Road plumbers — tanks, leaks, drains, and a same-day visit.",
    bio: `Goodwill Plumbing Services sits at Delatoli, near Madan Dhaba, on Lalpur Road in Kokar, Ranchi 834001. Independent plumbers since 2014. Water tanks, pipe leaks, sewer lines, and drain clearing.

Call 96655 96519. Tell us the house, the floor, and whether it is a tap, a closet, or the overhead tank. Visit ₹300. We quote before we open a wall.

We cover Lalpur, Kokar, Booty Road, and Kanke. Harmu and Doranda if the morning board still has a slot.`,
    welcome: "Ask for a visit — tap, leak, drain, tank, or closet. We will tell you who is free.",
    speakerName: "Goodwill desk",
    speakerRole: "dispatcher",
    whatsapp: "919665596519",
    upiId: "goodwillplumbing@upi",
    deliveryNote: "Plumber comes to Lalpur, Kokar, Booty Road, and Kanke. Fittings billed as used. Cash and UPI.",
    imageUrl: photo.store,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Delatoli, near Madan Dhaba, Lalpur Road, Kokar, Ranchi 834001",
            line1: "Delatoli, near Madan Dhaba, Lalpur Road, Kokar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919665596519", display: "96655 96519" },
        categories: ["Plumber", "Water tank", "Drain"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Goodwill+Plumbing+Services+Delatoli+Madan+Dhaba+Kokar+Ranchi",
    },
    hours: everydayHours("08:00", "20:00"),
    services: [
        { name: "Site visit", description: "Look at the leak, the tank, or the blocked line. Visit fee adjusts against the job if you go ahead the same day.", durationMinutes: 45, priceRupees: 300, kind: "SESSION" },
        { name: "Tap and mixer repair", description: "Bib cock, sink mixer, or angle cock. Spindle and washer on us if stocked; new body extra.", durationMinutes: 60, priceRupees: 600, kind: "SESSION" },
        { name: "Pipe leak repair", description: "GI or CPVC joint, clamp, or a short replacement. Wall chase billed if the leak is inside plaster.", durationMinutes: 90, priceRupees: 1000, kind: "SESSION" },
        { name: "Blocked drain", description: "Kitchen sink, floor trap, or a short soil line. Machine if the spring will not pass.", durationMinutes: 75, priceRupees: 1000, kind: "SESSION" },
        { name: "Closet and cistern", description: "Flush tank, syphon, seat, or a running closet. Chinaware extra if the pan is cracked.", durationMinutes: 90, priceRupees: 1500, kind: "SESSION" },
        { name: "Overhead tank fitting", description: "Loft or terrace tank, inlet, overflow, and a ball cock. Tank cost extra; we fit what you buy or what we bring.", durationMinutes: 180, priceRupees: 2500, kind: "SESSION" },
        { name: "Geyser install", description: "Wall geyser, inlet-outlet, and a safety valve. Wiring is a separate electrician if the point is dead.", durationMinutes: 120, priceRupees: 2000, kind: "SESSION" },
    ],
    staff: [
        { name: "Manoj", kind: "STAFF", capacity: 1 },
        { name: "Birendra", kind: "STAFF", capacity: 1 },
        { name: "Pintu", kind: "STAFF", capacity: 1 },
    ],
    story: [
        { url: photo.store, title: "Lalpur Road", body: "Delatoli, near Madan Dhaba, Kokar. The desk is on Lalpur Road.", category: "AMBIENCE" },
        { url: photo.workshop, title: "On the job", body: "Tanks, CPVC, and a spring for the drain. Quote before the wall comes off.", category: "FOOD" },
        { url: photo.arjun, title: "Crew", body: "Manoj, Birendra, Pintu. One plumber on the visit.", category: "TEAM" },
        { url: photo.table, title: "Calls", body: "WhatsApp the landmark. Lalpur, Kokar, Booty Road, Kanke.", category: "EVENT" },
    ],
    documents: [
        { type: "BIO", title: "About Goodwill Plumbing", rawText: "Goodwill Plumbing Services, Delatoli, near Madan Dhaba, Lalpur Road, Kokar, Ranchi 834001. Independent plumbers since 2014. Phone 96655 96519. Open 8:00–20:00. Visit ₹300. Taps, leaks, drains, closets, tanks, geyser fitting. Service area: Lalpur, Kokar, Booty Road, Kanke." },
        { type: "FAQ", title: "Rates and Sunday", rawText: "Visit ₹300. Tap ₹600. Pipe leak ₹1000. Drain ₹1000. Closet ₹1500. Tank fitting ₹2500 plus the tank. Geyser install ₹2000. Sunday 8:00–20:00 is emergency — burst, overflow, no water in the kitchen. After 8pm WhatsApp 96655 96519; we come if Manoj or Birendra is free. Harmu and Doranda only if a morning slot is open. We do not do electrical boards." },
    ],
    experiences: [
        { company: "Goodwill Plumbing Services", role: "Plumber", startDate: "2014", description: "House and shop plumbing across Lalpur, Kokar, Booty Road, and Kanke." },
    ],
    customInstructions: "You are the desk at Goodwill Plumbing Services, Delatoli near Madan Dhaba, Lalpur Road, Kokar, Ranchi. Send plumbers to Lalpur, Kokar, Booty Road, and Kanke. Open 8:00–20:00. Phone 96655 96519. Prices in rupees. Visit ₹300. Sunday is emergency-first. Do not quote electrical or AC work. Never invent a second shop or a rating.",
    tone: "direct",
}

export const VICKY_ELECTRICAL: DemoShop = {
    flavor: "ELECTRICIAN",
    engine: "FIELD_SERVICE",
    goal: "TAKE_APPOINTMENTS",
    slug: "vicky-electrical",
    name: "Vicky Electrical Services",
    headline: "Kokar Chowk electricians — fans, boards, points, and inverter jobs.",
    bio: `Vicky Electrical Services is a family crew at Kokar Chowk, Ranchi 834001. Wiring, ceiling fans, switches, MCB boards, geysers, and inverter work in houses, shops, and a few schools.

Call 83401 15902. Book a site visit; we quote the points before we chase a wall. Open 8:00–20:00 for booked jobs.

We cover Lalpur, Kokar, and Kanke. Booty Road if the afternoon is free. Hinoo and Doranda are next-day unless the board is dead.`,
    welcome: "Tell us the fault — fan, point, MCB, inverter, or a new board. We will book a visit.",
    speakerName: "Vicky desk",
    speakerRole: "dispatcher",
    whatsapp: "918340115902",
    upiId: "vickyelectrical@upi",
    deliveryNote: "Electrician comes to Lalpur, Kokar, and Kanke. Wire and fittings billed as used. Cash and UPI.",
    imageUrl: photo.lamp,
    shopLogoUrl: photo.kabir,
    venue: {
        address: {
            formatted: "Kokar Chowk, Ranchi 834001",
            line1: "Kokar Chowk",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918340115902", display: "83401 15902" },
        categories: ["Electrician", "Wiring", "Inverter"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Vicky+Electrical+Services+Kokar+Chowk+Ranchi",
    },
    hours: everydayHours("08:00", "20:00"),
    services: [
        { name: "Site visit", description: "Look at the board, the dead point, or the noisy fan. Visit adjusts against the job if we start the same day.", durationMinutes: 45, priceRupees: 250, kind: "SESSION" },
        { name: "Fan fitting", description: "Ceiling or exhaust fan on an existing point. Fan extra if you have not bought one.", durationMinutes: 45, priceRupees: 200, kind: "SESSION" },
        { name: "Switch and socket", description: "Replace a switch, socket, or holder. Modular plate extra if the old one is cracked.", durationMinutes: 40, priceRupees: 150, kind: "SESSION" },
        { name: "New point wiring", description: "One new point from the nearest board, concealed if the wall is open. Wire billed per metre.", durationMinutes: 60, priceRupees: 180, kind: "SESSION" },
        { name: "MCB and distribution", description: "Change an MCB, add a way, or tidy a smoking board. Breakers extra at counter rate.", durationMinutes: 90, priceRupees: 500, kind: "SESSION" },
        { name: "Inverter install", description: "Home inverter, changeover, and a battery stand. Inverter and battery are yours or billed separately.", durationMinutes: 120, priceRupees: 800, kind: "SESSION" },
        { name: "Geyser wiring", description: "Dedicated point, MCB, and earthing check for a wall geyser. Plumbing is a plumber.", durationMinutes: 90, priceRupees: 450, kind: "SESSION" },
    ],
    staff: [
        { name: "Vicky", kind: "STAFF", capacity: 1 },
        { name: "Ravi", kind: "STAFF", capacity: 1 },
        { name: "Ankit", kind: "STAFF", capacity: 1 },
    ],
    story: [
        { url: photo.lamp, title: "Boards", body: "MCB, points, and a fan hook. Quote the points before we chase plaster.", category: "FOOD" },
        { url: photo.store, title: "Kokar Chowk", body: "Family crew at Kokar Chowk. Lalpur, Kokar, Kanke on the same day.", category: "AMBIENCE" },
        { url: photo.kabir, title: "Crew", body: "Vicky, Ravi, Ankit. One electrician on the visit.", category: "TEAM" },
        { url: photo.counter, title: "The van", body: "Wire, testers, and a drill. We leave Kokar from eight.", category: "INTERIOR" },
    ],
    documents: [
        { type: "BIO", title: "About Vicky Electrical", rawText: "Vicky Electrical Services, Kokar Chowk, Ranchi 834001. Family electricians. Phone 83401 15902. Open 8:00–20:00. Fans, switches, concealed points, MCB boards, inverters, geyser wiring. Service area: Lalpur, Kokar, Kanke. Booty Road afternoon if free." },
        { type: "FAQ", title: "Jobs and Sunday", rawText: "Visit ₹250. Fan fitting ₹200. Switch ₹150. New point ₹180 plus wire. MCB job ₹500. Inverter install ₹800. Sunday 8:00–20:00 is for a dead board, no power, or a sparking switch. After 8pm WhatsApp 83401 15902. We do not do plumbing or AC gas. Hinoo and Doranda are next-day unless the board is dead." },
    ],
    experiences: [
        { company: "Vicky Electrical Services", role: "Electrician", startDate: "2013", description: "House and shop wiring from Kokar Chowk across Lalpur and Kanke." },
    ],
    customInstructions: "You are the desk at Vicky Electrical Services, Kokar Chowk, Ranchi. Send electricians to Lalpur, Kokar, and Kanke. Booty Road in the afternoon if a man is free. Open 8:00–20:00. Phone 83401 15902. Prices in rupees. Visit ₹250. Sunday is emergency-first. Do not quote plumbing or AC gas refill. Never invent a branch outside Kokar Chowk.",
    tone: "direct",
}

export const COOLING_WORLD: DemoShop = {
    flavor: "AC_REPAIR",
    engine: "FIELD_SERVICE",
    goal: "TAKE_APPOINTMENTS",
    slug: "cooling-world-ranchi",
    name: "Cooling World Refrigeration and Electricals",
    headline: "Hindpiri AC crew — split service, gas, leak, and a filter you can pick up.",
    bio: `Cooling World Refrigeration and Electricals works from 74 Nala Road, Pepee Compound, Hindpiri, Ranchi 834001. Split, window, cassette, and tower machines. Wet service, gas, and leak jobs at the house.

The counter also keeps gas, indoor filters, capacitors, and drain pipe for pickup if you want to fit them yourself. Ask for a site visit first; we do not refill blind.

We cover Hinoo, Doranda, Harmu, and Lalpur. Kanke and Booty Road if the van is already on that side.`,
    welcome: "Ask for a visit — not cooling, leak, noise, or a wet service. Gas is on the counter if you want pickup.",
    speakerName: "Nala Road desk",
    speakerRole: "dispatcher",
    upiId: "coolingworld@upi",
    deliveryNote: "Technician visits Hinoo, Doranda, Harmu, and Lalpur. Gas and filters pickup at 74 Nala Road, Pepee Compound.",
    imageUrl: photo.workshop,
    shopLogoUrl: photo.rohan,
    venue: {
        address: {
            formatted: "74, Nala Road, Pepee Compound, Hindpiri, Ranchi 834001",
            line1: "74, Nala Road, Pepee Compound, Hindpiri",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { display: "Nala Road desk" },
        categories: ["AC repair", "Refrigeration", "Gas refill"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Cooling+World+Refrigeration+74+Nala+Road+Pepee+Compound+Ranchi",
    },
    hours: everydayHours("08:00", "20:00"),
    services: [
        { name: "Site visit", description: "Check cooling, current, and the outdoor unit. Visit adjusts against a same-day service.", durationMinutes: 45, priceRupees: 350, kind: "SESSION" },
        { name: "Split wet service", description: "Indoor chemical wash, outdoor rinse, drain, and a cooling check. Gas extra if the pressures are low.", durationMinutes: 90, priceRupees: 599, kind: "SESSION" },
        { name: "Window AC service", description: "Pull, wash, and refit a window machine. Bracket work extra if the sill is rotten.", durationMinutes: 75, priceRupees: 499, kind: "SESSION" },
        { name: "Gas leak check", description: "Soap and gauge on the flare and coil. We do not refill until the leak is found.", durationMinutes: 75, priceRupees: 699, kind: "SESSION" },
        { name: "Gas refill job", description: "R32 or R410A after a leak is sealed. Gas billed as used; 1.5 ton and below is the usual charge.", durationMinutes: 90, priceRupees: 3299, kind: "SESSION" },
        { name: "Split installation", description: "Old split on an existing copper run, vacuum, and start. Core cutting extra. New copper billed per metre.", durationMinutes: 180, priceRupees: 2999, kind: "SESSION" },
        { name: "Water leakage repair", description: "Indoor drain, pipe slope, and a clogged tray. Pipe extra if the PVC is crushed.", durationMinutes: 75, priceRupees: 599, kind: "SESSION" },
    ],
    products: [
        { title: "R32 refrigerant 1 kg", description: "Pickup at Nala Road. We fill on the job if you book a gas refill visit.", category: "Gas", priceRupees: 1800, sku: "CW-R32", stock: 8, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack, weightGrams: 1000 },
        { title: "R410A refrigerant 1 kg", description: "For older splits still on 410A. Ask which gas your outdoor says.", category: "Gas", priceRupees: 1600, sku: "CW-R410", stock: 6, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack, weightGrams: 1000 },
        { title: "Split indoor filter", description: "Washable plastic mesh, common 1–1.5 ton frames. Bring the old one if the size is odd.", category: "Filters", priceRupees: 180, sku: "CW-FIL", stock: 24, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Outdoor fan capacitor", description: "Common 45/50/60 µF. We test the old one on the visit before you buy.", category: "Spares", priceRupees: 220, sku: "CW-CAP", stock: 18, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.lamp },
        { title: "Drain pipe 3 m", description: "PVC drain for indoor tray. Pickup; we fit it on a leakage visit.", category: "Spares", priceRupees: 90, sku: "CW-DRN", stock: 30, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Copper insulation 3 m", description: "Foam sleeve for suction line. Pickup with a new install.", category: "Spares", priceRupees: 240, sku: "CW-INS", stock: 12, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Universal split remote", description: "Works on most wall splits after the code. Bring the indoor model if you can.", category: "Spares", priceRupees: 350, sku: "CW-REM", stock: 10, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.lamp },
    ],
    staff: [
        { name: "Irfan", kind: "STAFF", capacity: 1 },
        { name: "Deepak", kind: "STAFF", capacity: 1 },
        { name: "Naushad", kind: "STAFF", capacity: 1 },
    ],
    story: [
        { url: photo.workshop, title: "Nala Road", body: "74, Pepee Compound, Hindpiri. Gas and filters on the counter.", category: "AMBIENCE" },
        { url: photo.interior, title: "On site", body: "Wet service, gauges, and a drain flush. We do not refill a leaking coil.", category: "FOOD" },
        { url: photo.rohan, title: "Crew", body: "Irfan, Deepak, Naushad. One technician, one indoor.", category: "TEAM" },
        { url: photo.cafe, title: "Van", body: "Gauges, pump, and a nitrogen cylinder when the line needs a hold.", category: "INTERIOR" },
    ],
    documents: [
        { type: "BIO", title: "About Cooling World", rawText: "Cooling World Refrigeration and Electricals, 74 Nala Road, Pepee Compound, Hindpiri, Ranchi 834001. AC and refrigeration field crew. Open 8:00–20:00. Split wet service ₹599. Window service ₹499. Gas refill after a leak check. Filters, R32, R410A, capacitors for pickup at Nala Road. Service area: Hinoo, Doranda, Harmu, Lalpur." },
        { type: "FAQ", title: "Gas, pickup, Sunday", rawText: "We do not refill until a leak check is done. R32 and R410A are on the counter for pickup; we will not sell gas to a machine that is still leaking. Sunday 8:00–20:00 is for no-cooling and water on the floor. After 8pm WhatsApp the desk. Kanke and Booty Road only if the van is already north. Fridge jobs are a separate visit, not the AC wet-service slot." },
    ],
    customInstructions: "You are the desk at Cooling World Refrigeration and Electricals, 74 Nala Road, Pepee Compound, Hindpiri, Ranchi. Send AC technicians to Hinoo, Doranda, Harmu, and Lalpur. Open 8:00–20:00. Prices in rupees. Do not book a gas refill without a leak check. Spares are pickup at Nala Road. Sunday is emergency-first — no cooling or water on the floor. Never invent a brand authorisation or a second counter.",
    tone: "direct",
}

export const BHOLA_GARAGE: DemoShop = {
    flavor: "GARAGE",
    engine: "FIELD_SERVICE",
    goal: "TAKE_APPOINTMENTS",
    slug: "bhola-service-centre",
    name: "Bhola Service Centre",
    headline: "Harmu Bypass two-wheeler garage — service, oil, brakes, and a next-day collection.",
    bio: `Bhola Service Centre is an independent two-wheeler workshop at Bharat Mata Chowk, Harmu Bypass, Harmu, Ranchi 834002. Bikes and scooters — Hero, Honda, Bajaj, TVS, Yamaha. Owner Bhola on the floor.

Call 93344 86718. Drop the bike in the evening and collect the next working day. Oil, filters, chain lube, and tubes are on the rack for pickup if you service at home.

We take machines from Harmu, Doranda, and Hinoo. Pickup inside those neighbourhoods if you WhatsApp the number plate. Lalpur and Kanke are drop-only.`,
    welcome: "Ask for a general service, oil, brakes, or a pickup. Send the number plate if we should collect.",
    speakerName: "Bhola",
    speakerRole: "workshop",
    whatsapp: "919334486718",
    upiId: "bholaservice@upi",
    deliveryNote: "Drop at Bharat Mata Chowk, Harmu Bypass. Pickup in Harmu, Doranda, and Hinoo if you send the number plate. Spares on the rack.",
    imageUrl: photo.store,
    shopLogoUrl: photo.atlas,
    venue: {
        address: {
            formatted: "Bharat Mata Chowk, Harmu Bypass, Harmu, Ranchi 834002",
            line1: "Bharat Mata Chowk, Harmu Bypass, Harmu",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919334486718", display: "93344 86718" },
        categories: ["Two-wheeler garage", "Bike service", "Scooter"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Bhola+Service+Centre+Bharat+Mata+Chowk+Harmu+Bypass+Ranchi",
    },
    hours: weekdaysHours("08:00", "20:00"),
    services: [
        { name: "General service", description: "Oil, plugs, chain, brakes, and a wash. Oil and filter extra from the rack or yours.", durationMinutes: 120, priceRupees: 650, kind: "SESSION" },
        { name: "Engine oil change", description: "Drain, filter if due, and a fresh fill. 10W-30 on the rack; other grades if you bring the bottle.", durationMinutes: 45, priceRupees: 250, kind: "SESSION" },
        { name: "Brake job", description: "Shoe or pad clean, adjust, and a fluid top-up. Shoes extra if they are down to the rivet.", durationMinutes: 75, priceRupees: 450, kind: "SESSION" },
        { name: "Chain and sprocket", description: "Clean, lube, set slack. Kit extra if the hook is hooked or the teeth are shark-finned.", durationMinutes: 90, priceRupees: 550, kind: "SESSION" },
        { name: "Carburettor and injector", description: "Clean, set idle, and a plug read. Injector rail on Fi scooters is a longer slot.", durationMinutes: 90, priceRupees: 600, kind: "SESSION" },
        { name: "Bike pickup", description: "Collect in Harmu, Doranda, or Hinoo. Number plate in chat. Drop back when the job is done.", durationMinutes: 40, priceRupees: 150, kind: "SESSION" },
        { name: "Puncture and wheel", description: "Tube or tubeless plug, balance if the rim is true. Tube on the rack.", durationMinutes: 30, priceRupees: 80, kind: "SESSION" },
    ],
    products: [
        { title: "Engine oil 10W-30 1 L", description: "Mineral fill for commuter bikes and scooters. Pickup at Bharat Mata Chowk.", category: "Oil", priceRupees: 320, sku: "BH-OIL", stock: 40, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack, weightGrams: 1000 },
        { title: "Oil filter", description: "Common Hero and Honda commuter sizes. Bring the old one if the bike is uncommon.", category: "Filters", priceRupees: 90, sku: "BH-OF", stock: 28, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Air filter", description: "Paper element, commuter sizes. Foam ones if you say the model.", category: "Filters", priceRupees: 140, sku: "BH-AF", stock: 22, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Chain lube 500 ml", description: "Spray for O-ring and standard chains. Pickup; we use it on the chain job.", category: "Lube", priceRupees: 280, sku: "BH-CL", stock: 16, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack, weightGrams: 500 },
        { title: "Brake fluid 250 ml", description: "DOT-3/DOT-4 mix for scooters and commuter discs. Do not mix with old unknown fluid if the cup is black.", category: "Brakes", priceRupees: 120, sku: "BH-BF", stock: 14, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack, weightGrams: 250 },
        { title: "Spark plug", description: "Standard copper plug for 100–125 cc. Iridium if you ask and we have it.", category: "Ignition", priceRupees: 80, sku: "BH-SP", stock: 36, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.lamp },
        { title: "Clutch cable", description: "Commuter clutch cable, barrel ends. Bring the old cable for length.", category: "Cables", priceRupees: 160, sku: "BH-CC", stock: 12, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
        { title: "Tube 18 inch", description: "Rear commuter tube. Front 17/18 if you say the size at the rack.", category: "Wheels", priceRupees: 220, sku: "BH-TB", stock: 10, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", allowCod: true, thumbnailUrl: photo.pack },
    ],
    staff: [
        { name: "Bhola", kind: "STAFF", capacity: 1 },
        { name: "Wasim", kind: "STAFF", capacity: 1 },
        { name: "Raju", kind: "STAFF", capacity: 1 },
    ],
    story: [
        { url: photo.store, title: "Harmu Bypass", body: "Bharat Mata Chowk. Drop the bike; collect the next working day.", category: "AMBIENCE" },
        { url: photo.workshop, title: "The bay", body: "Oil, chain, brakes. Independent workshop — not a company dealer.", category: "INTERIOR" },
        { url: photo.atlas, title: "Crew", body: "Bhola, Wasim, Raju. One bay, one bike.", category: "TEAM" },
        { url: photo.pack, title: "Rack", body: "Oil, filters, lube, tubes. Pickup if you service at home.", category: "FOOD" },
    ],
    documents: [
        { type: "BIO", title: "About Bhola Service Centre", rawText: "Bhola Service Centre, Bharat Mata Chowk, Harmu Bypass, Harmu, Ranchi 834002. Independent two-wheeler workshop. Phone 93344 86718. Open Monday–Saturday 8:00–20:00. Hero, Honda, Bajaj, TVS, Yamaha. General service ₹650 plus oil. Pickup in Harmu, Doranda, Hinoo. Oil, filters, chain lube, tubes on the rack." },
        { type: "FAQ", title: "Bays and Sunday", rawText: "Bays are Monday–Saturday 8:00–20:00. Sunday the shutters are down — WhatsApp 93344 86718 only for a bike that will not start in Harmu; we do not open the full rack. Evening drop, next working day collect. We are not a car dealer workshop and we do not take four-wheelers. Lalpur and Kanke are drop-only, no pickup. Cash and UPI." },
    ],
    customInstructions: "You are Bhola Service Centre, Bharat Mata Chowk, Harmu Bypass, Ranchi. Two-wheelers only. Pickup in Harmu, Doranda, and Hinoo. Open Monday–Saturday 8:00–20:00. Phone 93344 86718. Prices in rupees. Oil and filters are pickup at the rack. Sunday is emergency-only and the bays are shut. Never book a car. Never send people to an authorised dealer workshop. Never invent a second garage.",
    tone: "warm",
}

export const FIELD_SHOPS: DemoShop[] = [
    JHARKHAND_FIELD_CREW,
    GOODWILL_PLUMBING,
    VICKY_ELECTRICAL,
    COOLING_WORLD,
    BHOLA_GARAGE,
]

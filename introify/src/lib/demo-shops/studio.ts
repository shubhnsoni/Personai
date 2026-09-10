import { everydayHours, weekdaysHours, type DemoShop } from "./types"

const photo = {
    film: "/uploads/try-film.jpg",
    packaging: "/uploads/try-packaging.jpg",
    workshop: "/uploads/try-workshop.jpg",
    course: "/uploads/try-course.jpg",
    zine: "/uploads/try-zine.jpg",
    presets: "/uploads/try-presets.jpg",
    anika: "/uploads/try-anika.jpg",
    app: "/uploads/try-app.jpg",
    atlas: "/uploads/try-atlas.jpg",
    brand: "/uploads/try-brand.jpg",
    nia: "/uploads/try-nia.jpg",
    samir: "/uploads/try-samir.jpg",
    theo: "/uploads/try-theo.jpg",
    leela: "/uploads/try-leela.jpg",
    priya: "/uploads/try-priya.jpg",
    rohan: "/uploads/try-rohan.jpg",
}

export const NEXT_LEVEL_EVENTS: DemoShop = {
    flavor: "EVENTS_STUDIO",
    engine: "EVENTS_STUDIO",
    goal: "COLLECT_LEADS",
    slug: "next-level-events-kanke",
    name: "Next Level Events",
    headline: "Kanke Road event studio — Haldi, sangeet, birthday, and a hall that is already dressed.",
    bio: `Next Level Events works from the first floor of SB Complex, Kanke Road, near Gokul Restaurant, Ranchi 834002. Sumit Kumar Varma has run the desk since 2016 — weddings, birthdays, college fests, and corporate days across Ranchi.

Bring the date, the hall, and a headcount. We plan the flow, dress the mandap, and stay on the floor until the last cue. Haldi, mehendi, sangeet, varmala, reception. Starting around ₹1,50,000 for a full wedding plan; a birthday setup can be smaller.

Call 79031 33317. WhatsApp the date first — we will tell you if the crew is free.`,
    welcome: "Share the date, the hall, and Haldi or a full wedding. We will say if the crew is free.",
    speakerName: "Sumit",
    speakerRole: "studio lead",
    whatsapp: "917903133317",
    upiId: "nextlevelevents@upi",
    imageUrl: photo.workshop,
    shopLogoUrl: photo.leela,
    venue: {
        address: {
            formatted: "SB Complex, First Floor, Kanke Road, near Gokul Restaurant, Ranchi 834002",
            line1: "SB Complex, First Floor, Kanke Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+917903133317", display: "079031 33317" },
        categories: ["Events studio", "Wedding planner", "Decor"],
    },
    socials: {
        instagram: "https://www.instagram.com/nextlevelevents.in/",
        maps: "https://www.google.com/maps/search/?api=1&query=Next+Level+Events+Kanke+Road+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:00"),
    services: [
        { name: "Event planning call", description: "Date, hall, headcount, and Haldi or a full wedding. 45 minutes on Kanke Road or on a call.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Venue walk", description: "We walk the hall with you — power, entry, mandap line. Bring the caretaker’s number.", durationMinutes: 90, priceRupees: 2500, kind: "SESSION" },
        { name: "Decor briefing", description: "Palette, flowers, lighting, and what the crew will bring. After the date is held.", durationMinutes: 60, priceRupees: 0, kind: "SESSION" },
    ],
    staff: [
        { name: "Sumit Verma", kind: "STAFF", capacity: 1 },
        { name: "Decor crew", kind: "STAFF", capacity: 4 },
    ],
    events: [
        { title: "Saturday hall walk", description: "See a dressed mandap and a birthday backdrop on the Kanke Road floor. Bring the date.", daysFromNow: 12, durationHours: 2, location: "SB Complex, Kanke Road", priceRupees: 0, thumbnailUrl: photo.workshop },
    ],
    experiences: [
        { company: "Next Level Events", role: "Studio lead", startDate: "2016", description: "Weddings, birthdays, and corporate days from Kanke Road across Ranchi." },
        { company: "Ranchi hall circuit", role: "Floor manager", startDate: "2012", endDate: "2016", description: "Learned power, entry, and timing in Lalpur and Harmu banquet halls." },
    ],
    projects: [
        { title: "Kanke Road sangeet", description: "Entry, stage, and lighting for a 180-guest sangeet. Crew stayed until the last cue.", year: "2025", imageUrl: photo.workshop, client: "Kanke family wedding" },
        { title: "Harmu birthday floor", description: "Backdrop, balloon line, and a cake table in a Harmu Housing hall. Same-day turnaround.", year: "2025", imageUrl: photo.film, client: "Harmu Housing Colony" },
    ],
    documents: [
        { type: "BIO", title: "About Next Level Events", rawText: "Next Level Events, SB Complex, first floor, Kanke Road, near Gokul Restaurant, Ranchi 834002. Sumit Kumar Varma. Weddings, Haldi, mehendi, sangeet, birthdays, college fests, corporate days. Desk 10:00–18:00 Monday to Saturday. Phone 79031 33317. Instagram nextlevelevents.in. Hold a date after 50% on booking." },
        { type: "FAQ", title: "Dates and halls", rawText: "WhatsApp the date first. We work Ranchi halls — Kanke Road, Harmu, Lalpur, Bariatu. We do not book the hall for you unless you ask. Decor starts from a birthday setup; a full wedding plan is quoted after the venue walk. 50% on the date, balance before load-in. No out-of-state destination weddings." },
    ],
    customInstructions: "You are the desk at Next Level Events, SB Complex, Kanke Road, Ranchi. Sumit runs the floor. Help with dates, halls, Haldi, sangeet, birthdays, and corporate days. Hours 10:00–18:00 Monday to Saturday. Prices in rupees. Offer Event planning call, Venue walk, or Decor briefing. Hold a date only after they share a date and a hall. Never invent ratings or promise a hall you do not control.",
    tone: "warm",
}

export const SHAKTI_PROPERTY: DemoShop = {
    flavor: "REAL_ESTATE_BROKERAGE",
    engine: "REAL_ESTATE_BROKERAGE",
    goal: "COLLECT_LEADS",
    slug: "shakti-property-lalpur",
    name: "Shakti Property",
    headline: "Lalpur brokerage — flats, plots, and shop floors in Ranchi, with a viewing on the same week.",
    bio: `Shakti Property is Navin Jaiswal’s desk in Lalpur, Ranchi 834001. Independent realtor, on the National Association of Realtors and the Jharkhand Association of Realtors. Buy, sell, and rent — 2BHK and 3BHK in Bariatu, Kanke, and Lalpur, shop floors on Main Road, plots toward Mahilong.

Tell us the locality, the budget, and buy or rent. We set a viewing. Papers stay with the owner until you are ready; we walk you through what to ask.

WhatsApp 92949 00041. Desk hours Monday to Saturday.`,
    welcome: "Share locality, budget, and buy or rent. We will set a viewing.",
    speakerName: "Navin",
    speakerRole: "realtor",
    whatsapp: "919294900041",
    imageUrl: photo.atlas,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Lalpur, Ranchi 834001",
            line1: "Lalpur",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919294900041", display: "092949 00041" },
        categories: ["Real estate", "Brokerage"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Shakti+Property+Lalpur+Ranchi",
    },
    hours: weekdaysHours("10:00", "19:00"),
    services: [
        { name: "Property consultation", description: "Locality, budget, buy or rent. 30 minutes at the Lalpur desk or on a call.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Site viewing", description: "Walk a flat, plot, or shop floor. We coordinate the caretaker. Weekday evenings fill first.", durationMinutes: 60, priceRupees: 0, kind: "SESSION" },
        { name: "Mandate review", description: "If you are selling or letting, we go through papers, asking price, and who we will show it to.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Shakti Property", role: "Principal realtor", startDate: "2014", description: "Buy, sell, and rent across Lalpur, Bariatu, Kanke, Harmu, and Mahilong. JAR and NAR." },
        { company: "Ranchi resale desks", role: "Field broker", startDate: "2008", endDate: "2014", description: "Learned papers and viewing hours on Main Road and Bariatu Road." },
    ],
    projects: [
        { title: "Bariatu 3BHK letting", description: "A 2000 sq ft flat in Bariatu, let to a hospital family. Viewing to keys in three weeks.", year: "2025", imageUrl: photo.atlas, client: "Bariatu owner" },
        { title: "Lalpur shop floor", description: "Ground-floor commercial on the Lalpur main stretch. Mandate, board, and a tenant who already trades on Circular Road.", year: "2024", imageUrl: photo.brand, client: "Lalpur shop owner" },
    ],
    documents: [
        { type: "BIO", title: "About Shakti Property", rawText: "Shakti Property, Lalpur, Ranchi 834001. Navin Jaiswal. Independent realtor, NAR and Jharkhand Association of Realtors. Flats, plots, shop floors. Buy, sell, rent. Desk 10:00–19:00 Monday to Saturday. WhatsApp 92949 00041. shaktiprop01@gmail.com." },
        { type: "FAQ", title: "Viewings and papers", rawText: "Share locality and budget first. We do not list every building in Ranchi — we tell you if we have a match. Brokerage is discussed after a serious viewing. We do not hold original papers. RERA numbers are the builder’s; ask us to show the one on the file. No out-of-city Patna inventory on this desk unless you ask." },
    ],
    customInstructions: "You are Navin at Shakti Property, Lalpur, Ranchi. Help with flats, plots, and shop floors in Lalpur, Bariatu, Kanke, Harmu, and Mahilong. Hours 10:00–19:00 Monday to Saturday. Offer Property consultation, Site viewing, or Mandate review. Never invent a rate, a RERA number, or a flat that is not on the books. Never take token money in chat.",
    tone: "calm",
}

export const NITA_RECRUITERS: DemoShop = {
    flavor: "RECRUITMENT_AGENCY",
    engine: "RECRUITMENT_AGENCY",
    goal: "COLLECT_LEADS",
    slug: "nita-recruiters-ashok-nagar",
    name: "Nita Recruiters",
    headline: "Ashok Nagar hiring desk — Ranchi roles, a brief, and a shortlist you can actually call.",
    bio: `Nita Recruiters sits in Shop 33, Cooperative Complex, Road No. 2, Ashok Nagar, Ranchi 834002 — opposite Top N Town, the same stretch as the rest of the colony’s offices. Domestic placement: accounts, office, sales, hospital desks, and a few IT hardware roles.

Employers send a brief. Candidates walk in with a CV or WhatsApp one. We do not run overseas files from this shop.

Call 97088 16511. Monday to Saturday, 10 to 6.`,
    welcome: "Share the role and the city, or send a CV. We will say if the desk can help.",
    speakerName: "Nita desk",
    speakerRole: "recruiter",
    whatsapp: "919708816511",
    imageUrl: photo.brand,
    shopLogoUrl: photo.samir,
    venue: {
        address: {
            formatted: "Shop No. 33, Cooperative Complex, Road No. 2, Ashok Nagar, Ranchi 834002",
            line1: "Shop 33, Cooperative Complex, Road No. 2, Ashok Nagar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919708816511", display: "097088 16511" },
        categories: ["Recruitment", "Placement"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Cooperative+Complex+Road+No+2+Ashok+Nagar+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:00"),
    services: [
        { name: "Hiring brief call", description: "Role, salary band, joining date, and whether the seat is Ashok Nagar, Lalpur, or Namkum.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
        { name: "Candidate intro", description: "Walk in with a CV. We tell you which files are open this week.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
        { name: "Interview slot", description: "We hold a half-hour at the shop for a first conversation. Employer or candidate.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    documents: [
        { type: "BIO", title: "About Nita Recruiters", rawText: "Nita Recruiters, Shop 33, Cooperative Complex, Road No. 2, Ashok Nagar, Ranchi 834002. Domestic placement — accounts, office, sales, hospital, IT hardware. Desk 10:00–18:00 Monday to Saturday. Phone 97088 16511. Landline 0651-2243036. No overseas files." },
        { type: "FAQ", title: "Fees and files", rawText: "Candidates do not pay to submit a CV. Employer fees are discussed after a brief, not in the first WhatsApp. We do not guarantee a joining date. Bring Aadhaar and a current CV. Walk-ins after 5:30pm wait until the next morning." },
    ],
    customInstructions: "You are the desk at Nita Recruiters, Shop 33, Cooperative Complex, Ashok Nagar, Ranchi. Help employers with a hiring brief and candidates with open files. Hours 10:00–18:00 Monday to Saturday. Offer Hiring brief call, Candidate intro, or Interview slot. Never charge a candidate in chat. Never invent a vacancy, a salary, or an overseas seat.",
    tone: "direct",
}

export const LETS_CLICK: DemoShop = {
    flavor: "PHOTOGRAPHER",
    engine: "EVENTS_STUDIO",
    goal: "COLLECT_LEADS",
    slug: "lets-click-ratu-road",
    name: "Let's Click Photography",
    headline: "Ratu Road wedding desk — candid stills, a cinematic cut, and a Patratu pre-wedding.",
    bio: `Let's Click Photography sits on Ratu Road, near Ramvilas Petrol Pump, Indrapuri Colony, Ranchi 834001. Amit Mahato and the crew shoot weddings, pre-weddings, and family days across Jharkhand — Ranchi Club, Patratu Valley, home functions in Harmu and Doranda.

Photo day, photo plus film, albums. Pre-wedding from ₹25,000 a day. A wedding photo day is quoted after we know the functions. Outstation stay is on the family.

Call 95257 16666. WhatsApp the date and the hall.`,
    welcome: "Share the wedding date, the hall, and photo or photo-plus-film.",
    speakerName: "Amit",
    speakerRole: "photographer",
    whatsapp: "919525716666",
    upiId: "letsclickranchi@upi",
    imageUrl: photo.film,
    shopLogoUrl: photo.anika,
    venue: {
        address: {
            formatted: "Ratu Road, near Ramvilas Petrol Pump, Indrapuri Colony, Ranchi 834001",
            line1: "Ratu Road, near Ramvilas Petrol Pump, Indrapuri Colony",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919525716666", display: "095257 16666" },
        categories: ["Wedding photographer", "Cinematography"],
    },
    socials: {
        instagram: "https://www.instagram.com/lets_click_photography/",
        facebook: "https://www.facebook.com/letsclickphotographystudio",
        maps: "https://www.google.com/maps/search/?api=1&query=Lets+Click+Photography+Ratu+Road+Ranchi",
    },
    hours: everydayHours("10:00", "20:00"),
    services: [
        { name: "Wedding day coverage", description: "One photographer, one function — Haldi, pheras, or reception. Hours and second shooter quoted after the date.", durationMinutes: 480, priceRupees: 28000, kind: "SESSION" },
        { name: "Patratu pre-wedding", description: "Half or full day at Patratu Valley. Golden hour fills first. Travel in the quote.", durationMinutes: 240, priceRupees: 25000, kind: "SESSION" },
        { name: "Album review", description: "Sit with the selects on Ratu Road. 40-page album from ₹8,000. Bring one decision-maker.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Brief call", description: "Date, functions, photo or photo-plus-film. 20 minutes.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
    ],
    events: [
        { title: "Sunday at Patratu Valley", description: "One pre-wedding slot at the valley. Two hours around dusk. Book the date; we bring the lights.", daysFromNow: 18, durationHours: 2, location: "Patratu Valley", priceRupees: 12000, thumbnailUrl: photo.film },
    ],
    experiences: [
        { company: "Let's Click Photography", role: "Lead photographer", startDate: "2015", description: "Weddings and pre-weddings from Ratu Road across Ranchi, Patratu, and home functions." },
        { company: "Ranchi wedding floors", role: "Second shooter", startDate: "2011", endDate: "2015", description: "Learned pheras, baraat light, and album selects in Lalpur and Club weddings." },
    ],
    projects: [
        { title: "Ranchi Club pheras", description: "Candid stills and a short film from a Club wedding. Crowd, lamps, and the walk back to the lawn.", year: "2025", imageUrl: photo.anika, client: "Ranchi Club wedding" },
        { title: "Patratu Valley pre-wedding", description: "Dusk at the valley, two outfits, no drone on that date. The stills the family still prints.", year: "2024", imageUrl: photo.film, client: "Patratu pre-wedding" },
    ],
    documents: [
        { type: "BIO", title: "About Let's Click", rawText: "Let's Click Photography, Ratu Road, near Ramvilas Petrol Pump, Indrapuri Colony, Ranchi 834001. Amit Mahato. Weddings, pre-weddings, family days, cinematic film. Desk 10:00–20:00 every day. Phone 95257 16666. Instagram lets_click_photography. Pre-wedding from ₹25,000 a day. Album 40 pages from ₹8,000." },
        { type: "FAQ", title: "Dates and travel", rawText: "Hold a date after 25% advance. Outstation stay and travel are on the family. We shoot Jharkhand — Ranchi, Patratu, Netarhat if the light is worth the drive. Drone needs a clear venue and a yes from the hall. Raw files are not the default; ask. Edits in three to five weeks after the last function." },
    ],
    customInstructions: "You are Amit at Let's Click Photography, Ratu Road, Indrapuri Colony, Ranchi. Help with wedding dates, pre-weddings at Patratu, albums, and photo versus film. Hours 10:00–20:00 every day. Prices in rupees. Offer Wedding day coverage, Patratu pre-wedding, Album review, or Brief call. Never invent ratings or a second studio. Never promise a drone if the hall has not agreed.",
    tone: "warm",
}

export const TSS_JOURNEY: DemoShop = {
    flavor: "TRAVEL",
    engine: "EVENTS_STUDIO",
    goal: "COLLECT_LEADS",
    slug: "tss-journey-morabadi",
    name: "TSS Journey Ranchi",
    headline: "Morabadi travel desk — Netarhat sunrise, Betla safari, and a car that starts from Tagore Hill.",
    bio: `TSS Journey Ranchi — Travel Solution and Services — sits on the ground floor near Sanskar Garden, Tagore Hill Road, Morabadi, Ranchi 834008. Dzire, Ertiga, Innova Crysta, Tempo Traveller. Ranchi local, airport, and the plateau: Netarhat, Betla, Patratu, Hundru, Deoghar.

A 2N Netarhat–Betla run is the usual ask. Magnolia sunset, Koel viewpoint, Lodh Falls, morning safari at Betla. Safari permit is extra; we file it when you confirm the date.

Call 88611 48919. The desk answers through the evening; cars leave at dawn.`,
    welcome: "Share dates, heads, and Netarhat, Betla, or a Ranchi day. We will put a car on it.",
    speakerName: "TSS desk",
    speakerRole: "travel desk",
    whatsapp: "918861148919",
    upiId: "tssjourney@upi",
    imageUrl: photo.atlas,
    shopLogoUrl: photo.film,
    venue: {
        address: {
            formatted: "Ground Floor, near Sanskar Garden, Tagore Hill Road, Morabadi, Ranchi 834008",
            line1: "Tagore Hill Road, near Sanskar Garden, Morabadi",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834008",
            country: "IN",
        },
        phone: { e164: "+918861148919", display: "088611 48919" },
        categories: ["Travel agent", "Taxi", "Jharkhand tours"],
    },
    socials: {
        instagram: "https://www.instagram.com/tss.journey/",
        maps: "https://www.google.com/maps/search/?api=1&query=TSS+Journey+Tagore+Hill+Road+Morabadi+Ranchi",
    },
    hours: everydayHours("06:00", "22:00"),
    services: [
        { name: "Netarhat itinerary call", description: "2N or 3N. Magnolia, pine forest, Ghaghri, then Betla or back to Ranchi. Heads and car type.", durationMinutes: 25, priceRupees: 0, kind: "SESSION" },
        { name: "Betla safari desk", description: "We file the jeep permit when the date is firm. Permit is extra. Say how many jeeps.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
        { name: "Vehicle briefing", description: "Dzire, Ertiga, Innova, or Tempo. Pickup at Birsa Munda or Hatia. Driver allowance and tolls extra.", durationMinutes: 15, priceRupees: 0, kind: "SESSION" },
        { name: "Ranchi day circuit", description: "Hundru, Jonha, Dassam, or Patratu Valley in an 8-hour local. 80 km in the local pack.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
    ],
    events: [
        { title: "Saturday Netarhat briefing", description: "How a 2N Netarhat–Betla run actually works — light, lodging, safari slot. At the Morabadi desk.", daysFromNow: 9, durationHours: 1.5, location: "TSS Journey, Tagore Hill Road", priceRupees: 0, thumbnailUrl: photo.atlas },
    ],
    experiences: [
        { company: "TSS Journey Ranchi", role: "Travel desk", startDate: "2019", description: "Cars and plateau itineraries from Morabadi — Netarhat, Betla, Patratu, Deoghar." },
        { company: "Ranchi outstation cabs", role: "Dispatcher", startDate: "2015", endDate: "2019", description: "Airport and Hatia pickups, then the Netarhat road enough times to know the fog." },
    ],
    projects: [
        { title: "Netarhat 2N for a Howrah family", description: "Pickup at Hatia, Magnolia at dusk, sunrise, Lodh, drop at the station. Dzire, two rooms.", year: "2025", imageUrl: photo.atlas, client: "Hatia pickup" },
        { title: "Betla morning safari", description: "Two jeeps, Palamu fort after, back via Kechki. Permit filed the week before.", year: "2025", imageUrl: photo.film, client: "Betla weekend" },
    ],
    documents: [
        { type: "BIO", title: "About TSS Journey", rawText: "TSS Journey Ranchi, Travel Solution and Services, ground floor near Sanskar Garden, Tagore Hill Road, Morabadi, Ranchi 834008. Netarhat, Betla, Patratu, Hundru, Deoghar, airport. Dzire, Ertiga, Innova Crysta, Tempo Traveller. Phone 88611 48919. Desk 06:00–22:00 every day. Local 8hr/80km: Dzire ₹1,700, Ertiga ₹2,300, Innova ₹3,200. Outstation per km; tolls, parking, driver allowance extra." },
        { type: "FAQ", title: "Netarhat and Betla", rawText: "Ranchi to Netarhat is about 156 km, four to five hours. Magnolia is a sunset point; sunrise is a different stop. Betla safari permits are extra and seasonal — we file them after you confirm. Lodging is on you unless you ask us to hold a forest lodge. Peak weekends and school holidays fill first. We do not run a fixed-departure coach; every car is a private hire." },
    ],
    customInstructions: "You are the desk at TSS Journey Ranchi, Tagore Hill Road, Morabadi. Help with Netarhat, Betla, Patratu, Hundru, airport, and which car. Hours 06:00–22:00 every day. Prices in rupees. Offer Netarhat itinerary call, Betla safari desk, Vehicle briefing, or Ranchi day circuit. Tolls, parking, and driver allowance are extra. Never invent a safari permit or a lodge inventory. Never quote a per-person package as if it were a group coach.",
    tone: "direct",
}

export const AAKRITI_INTERIORS: DemoShop = {
    flavor: "INTERIOR",
    engine: "DESIGNER",
    goal: "SHOW_PORTFOLIO",
    slug: "aakriti-interiors-lalpur",
    name: "Aakriti Interiors",
    headline: "Lalpur interior desk — modular kitchens, wardrobes, and a 2BHK that uses every wall.",
    bio: `Aakriti Interiors works from the first floor of Damyantika Complex, East Jail Road, Lalpur, Ranchi 834001. Homes and small offices — Morabadi, Ashok Nagar, Harmu, Kanke Road, Bariatu, Doranda, Hinoo, Argora.

Kitchen, wardrobe, TV unit, a full 2BHK. 3D before carpentry. Most flats finish in four to six weeks after you lock the drawings. Plywood, laminate, veneer — we will say what survives a Ranchi monsoon.

Call 87574 65160. Bring the floor plan if you have one.`,
    welcome: "Share the flat — 2BHK or a kitchen — and the locality. We will set a brief.",
    speakerName: "Aakriti desk",
    speakerRole: "interior designer",
    whatsapp: "918757465160",
    upiId: "aakritiinteriors@upi",
    imageUrl: photo.packaging,
    shopLogoUrl: photo.leela,
    venue: {
        address: {
            formatted: "First floor, Damyantika Complex, East Jail Road, Lalpur, Ranchi 834001",
            line1: "Damyantika Complex, East Jail Road, Lalpur",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918757465160", display: "087574 65160" },
        categories: ["Interior designer", "Modular kitchen"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Aakriti+Interiors+Damyantika+Complex+Lalpur+Ranchi",
    },
    hours: weekdaysHours("10:00", "19:00"),
    services: [
        { name: "Home brief", description: "Rooms, budget band, and whether this is a kitchen or the whole flat. 40 minutes in Lalpur.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
        { name: "Site measure", description: "Tape, photos, and the wall that is never square. Needed before 3D.", durationMinutes: 75, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Aakriti Interiors", role: "Interior lead", startDate: "2018", description: "Modular kitchens, wardrobes, and full flats across Lalpur, Doranda, Harmu, and Kanke Road." },
        { company: "Ranchi carpentry floors", role: "Site supervisor", startDate: "2013", endDate: "2018", description: "Learned BWP plywood, laminate shutters, and monsoon delays on Ashok Nagar bungalows." },
    ],
    projects: [
        { title: "Lalpur 2BHK kitchen", description: "L-shaped modular kitchen, loft storage, laminate that wipes after tadka. Compact flat, full use of the wet wall.", year: "2025", imageUrl: photo.packaging, client: "East Jail Road 2BHK" },
        { title: "Doranda living and wardrobe", description: "TV wall, sliding wardrobe, and a study nook in a Doranda independent house. Veneer on the shutters that face the hall.", year: "2024", imageUrl: photo.brand, client: "Doranda bungalow" },
    ],
    documents: [
        { type: "BIO", title: "About Aakriti Interiors", rawText: "Aakriti Interiors, first floor, Damyantika Complex, East Jail Road, Lalpur, Ranchi 834001. Modular kitchens, wardrobes, TV units, full flats and small offices. Morabadi, Ashok Nagar, Harmu, Kanke Road, Bariatu, Lalpur, Doranda, Hinoo, Argora, Kadru. Desk 10:00–19:00 Monday to Saturday. Phone 87574 65160. 3D before carpentry. Most projects four to six weeks after drawings lock." },
        { type: "FAQ", title: "Materials and time", rawText: "We specify BWP plywood in wet areas. Particle board does not like a Ranchi monsoon — we will say so. 3D is part of the brief, not a paid extra unless the scope keeps changing. We do not start carpentry before you sign the drawings. Payment is staged: design, material, handover. We do not run a Livspace-style EMI desk; ask your bank." },
    ],
    customInstructions: "You are the desk at Aakriti Interiors, Damyantika Complex, East Jail Road, Lalpur, Ranchi. Help with kitchens, wardrobes, and full flats in Ranchi localities. Hours 10:00–19:00 Monday to Saturday. Prices in rupees, quoted after a measure. Offer Home brief or Site measure. Never invent a per-square-foot rate or a finish you have not specified. Never promise a two-week kitchen.",
    tone: "calm",
}

export const CREATIVEBIT: DemoShop = {
    flavor: "AGENCY",
    engine: "CONSULTANT",
    goal: "COLLECT_LEADS",
    slug: "creativebit-main-road",
    name: "CreativeBit",
    headline: "Main Road agency — branding, ads, and a Ranchi team that has sat with a shop for years.",
    bio: `CreativeBit Services Pvt. Ltd. works from the fifth floor of JD Corporate, Mahatma Gandhi Main Road, behind JD Hi Street Mall, Ranchi 834001. Opened 9 January 2013. Branding, performance ads, websites, and a few AI tools for Jharkhand and Bihar shops.

EatMillet packaging and shop growth. Vinaika Eco Resort’s identity. IHM Ranchi from its first admissions year. Premosons Motor and Basudeb Auto lead ads. Ratnalaya in Patna over a long retainer.

Call 89875 00999. Monday to Saturday, 9 to 5. Discovery first; we do not sell a poster from the lift.`,
    welcome: "Share the brand and whether this is identity, ads, or a site. We will book discovery.",
    speakerName: "CreativeBit desk",
    speakerRole: "agency",
    whatsapp: "918987500999",
    upiId: "creativebit@upi",
    gstin: "20AAFCC1376D1ZA",
    imageUrl: photo.brand,
    shopLogoUrl: photo.packaging,
    venue: {
        address: {
            formatted: "5th Floor, JD Corporate, Mahatma Gandhi Main Road, behind JD Hi Street Mall, Ranchi 834001",
            line1: "5th Floor, JD Corporate, MG Main Road, behind JD Hi Street Mall",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918987500999", display: "089875 00999" },
        categories: ["Agency", "Branding", "Digital"],
    },
    socials: {
        instagram: "https://www.instagram.com/creativebitindia/",
        facebook: "https://www.facebook.com/creativebitindia/",
        youtube: "https://www.youtube.com/watch?v=Ip6rDhQFT3w",
        maps: "https://www.google.com/maps/search/?api=1&query=CreativeBit+JD+Corporate+Main+Road+Ranchi",
    },
    hours: weekdaysHours("09:00", "17:00"),
    services: [
        { name: "Discovery call", description: "What the brand sells, where it sits in Ranchi or Bihar, and whether this is identity, ads, or a site. 40 minutes.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
        { name: "Brand audit", description: "A working session on the current identity, packaging, and Google listing. We come back with a written brief.", durationMinutes: 90, priceRupees: 8500, kind: "SESSION" },
        { name: "Retainer briefing", description: "Monthly ads, social, and reporting. For shops that already know they want a year, not a week.", durationMinutes: 60, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "CreativeBit Services", role: "Ranchi studio", startDate: "2013", description: "Branding, ads, and sites for Jharkhand and Bihar shops from JD Corporate, Main Road." },
        { company: "Ranchi print and identity desks", role: "Designer", startDate: "2009", endDate: "2012", description: "Learned jewellery catalogues and auto dealer boards before the agency opened." },
    ],
    projects: [
        { title: "EatMillet identity", description: "Name, pack, and the first shop shelves. A Jharkhand food brand that had to look like food, not a pitch deck.", year: "2021", imageUrl: photo.packaging, client: "EatMillet" },
        { title: "Vinaika Eco Resort", description: "Logo, signage, menu, uniforms, and the site for Jharkhand’s first eco-resort. One language from gate to room.", year: "2023", imageUrl: photo.brand, client: "Vinaika Eco Resort" },
    ],
    documents: [
        { type: "BIO", title: "About CreativeBit", rawText: "CreativeBit Services Pvt. Ltd., 5th Floor, JD Corporate, MG Main Road, behind JD Hi Street Mall, Ranchi 834001. Founded 9 January 2013. CIN U72200JH2013PTC000928. GSTIN 20AAFCC1376D1ZA. Branding, ads, websites, AI tools. Desk 09:00–17:00 Monday to Saturday. Phone 89875 00999. Instagram creativebitindia. contact@creativebit.in." },
        { type: "FAQ", title: "How we start", rawText: "Discovery is free. We do not quote a poster from WhatsApp. Retainers are monthly and written. We have worked EatMillet, Vinaika Eco Resort, IHM Ranchi, Premosons Motor, Basudeb Auto, and a long Patna jewellery retainer — ask if your category is new to us. We do not run a same-week logo stall." },
    ],
    customInstructions: "You are the desk at CreativeBit, fifth floor JD Corporate, MG Main Road, Ranchi. Help with branding, ads, and sites for Jharkhand and Bihar shops. Hours 09:00–17:00 Monday to Saturday. Offer Discovery call, Brand audit, or Retainer briefing. Prices in rupees after discovery. Never invent a client result or a Google rating. Never sell a one-day logo.",
    tone: "calm",
}

export const DEEPSHIKHA: DemoShop = {
    flavor: "NGO",
    engine: "CREATOR",
    goal: "COLLECT_LEADS",
    slug: "deepshikha-upper-bazar",
    name: "Deepshikha",
    headline: "Upper Bazar school and therapy desk — autism, cerebral palsy, and a parent who needs the next step.",
    bio: `Deepshikha, Institute for Child Development and Mental Health, sits on the Arya Samaj Mandir campus, Shraddhanand Road, Upper Bazar, Ranchi 834001. Purshree opened the first room on 17 July 1988. Sudha Lhila still runs the desk. Education, therapy, and vocational work for children with developmental disabilities — autism, cerebral palsy, intellectual disability, multiple disabilities. State Nodal Agency Centre for Jharkhand under the National Trust.

The special school is at Ara Gate, Mahilong, Tatisilwai Road, Ranchi 835103. Assessment before a seat. Volunteers and donors use the Upper Bazar number.

Call 93344 23789. Monday to Saturday.`,
    welcome: "Ask about admission, volunteering, or the caregiver notes. We will point you to the right desk.",
    speakerName: "Sudha",
    speakerRole: "institute desk",
    whatsapp: "919334423789",
    imageUrl: photo.workshop,
    shopLogoUrl: photo.course,
    venue: {
        address: {
            formatted: "Arya Samaj Mandir Campus, Shraddhanand Road, Upper Bazar, Ranchi 834001",
            line1: "Arya Samaj Mandir Campus, Shraddhanand Road, Upper Bazar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919334423789", display: "093344 23789" },
        categories: ["NGO", "Special school", "Therapy"],
    },
    socials: {
        facebook: "https://www.facebook.com/DeepshikhaRanchi",
        maps: "https://www.google.com/maps/search/?api=1&query=Deepshikha+Shraddhanand+Road+Upper+Bazar+Ranchi",
    },
    hours: weekdaysHours("09:30", "16:30"),
    products: [
        { title: "Home therapy desk notes", description: "A short PDF for parents starting home routines between school days. Written with the therapy floor.", category: "Guides", priceRupees: 150, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.course, sku: "DS-HOME" },
        { title: "Volunteer floor briefing", description: "What a Saturday on the Mahilong floor actually looks like — roles, hours, who to report to.", category: "Guides", priceRupees: 0, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.workshop, sku: "DS-VOL" },
    ],
    leadMagnets: [
        { title: "First week at home", description: "A two-page note on sleep, meals, and one play routine while you wait for an assessment date." },
    ],
    documents: [
        { type: "BIO", title: "About Deepshikha", rawText: "Deepshikha, Institute for Child Development and Mental Health, Arya Samaj Mandir Campus, Shraddhanand Road, Upper Bazar, Ranchi 834001. A unit of Purshree. Opened 17 July 1988. Sudha Lhila, executive director. Special school at Ara Gate, Mahilong, Tatisilwai Road, Ranchi 835103. Autism, cerebral palsy, intellectual disability, multiple disabilities. SNAC for Jharkhand under the National Trust. Phone 93344 23789 / 0651-2214203. deepshikhainfo@gmail.com. Desk 09:30–16:30 Monday to Saturday." },
        { type: "FAQ", title: "Admission and visiting", rawText: "Admission starts with an assessment — call the Upper Bazar desk for a date. The special school is at Ara Gate, Mahilong, not the Upper Bazar office. Volunteers fill the form or call; teaching and therapy seats are planned, not walk-in. Donations go to the registered society; ask the desk for the account, do not transfer to a personal UPI from chat. We do not diagnose in WhatsApp." },
    ],
    customInstructions: "You are the desk at Deepshikha, Shraddhanand Road, Upper Bazar, Ranchi. Help parents with assessment dates, volunteers with the floor briefing, and donors with the registered route. Hours 09:30–16:30 Monday to Saturday. Offer the free First week at home note. Never diagnose. Never invent a seat, a surgery, or a fee. Never ask for money on a personal UPI.",
    tone: "calm",
}

export const TAGORE_HILL_PRESS: DemoShop = {
    flavor: "CREATOR",
    engine: "CREATOR",
    goal: "COLLECT_LEADS",
    slug: "tagore-hill-press",
    name: "Tagore Hill Press",
    headline: "Morabadi stills and a Chotanagpur zine — LUTs for Magnolia dusk, and the plateau in print.",
    bio: `Tagore Hill Press is Rohan Kujur’s desk on Tagore Hill Road, Morabadi, Ranchi 834008. Stills of the plateau — Netarhat pine, Magnolia Point, Betla road, Ranchi monsoon — printed as a small zine and sold as LUTs for the same light.

The zine is a PDF. The LUT pack is graded from actual dusk at Magnolia and Koel viewpoint, not a generic orange. A stills pack if you want the frames without the grade.

WhatsApp 94311 20884. I answer after the walk, usually from 11.`,
    welcome: "Ask for the zine, the LUT pack, or the Magnolia notes. I will send the right file.",
    speakerName: "Rohan",
    speakerRole: "photographer",
    whatsapp: "919431120884",
    upiId: "tagorehillpress@upi",
    imageUrl: photo.rohan,
    shopLogoUrl: photo.zine,
    venue: {
        address: {
            formatted: "Tagore Hill Road, Morabadi, Ranchi 834008",
            line1: "Tagore Hill Road, Morabadi",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834008",
            country: "IN",
        },
        phone: { display: "Morabadi desk" },
        categories: ["Creator", "Zine", "Photography"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Tagore+Hill+Morabadi+Ranchi",
    },
    hours: weekdaysHours("11:00", "19:00"),
    products: [
        { title: "Chotanagpur dusk zine", description: "24 pages. Pine, Magnolia, the Betla road, one Ranchi monsoon. PDF, print-ready.", category: "Zines", priceRupees: 450, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.zine, sku: "TH-ZINE" },
        { title: "Magnolia LUT pack", description: "Three grades from actual Magnolia dusk and Koel viewpoint. Rec.709. For wedding and travel cuts shot in Jharkhand light.", category: "LUTs", priceRupees: 900, type: "OTHER", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.presets, sku: "TH-LUT" },
    ],
    leadMagnets: [
        { title: "Metering Magnolia at dusk", description: "Where to stand, when the haze wins, and why auto-white-balance lies on that ridge." },
    ],
    documents: [
        { type: "BIO", title: "About Tagore Hill Press", rawText: "Tagore Hill Press, Tagore Hill Road, Morabadi, Ranchi 834008. Rohan Kujur. Chotanagpur zine, Magnolia LUT pack, stills of Netarhat, Betla, and Ranchi monsoon. Desk 11:00–19:00 Monday to Saturday. WhatsApp 94311 20884. Files are digital; I do not run a walk-in print counter." },
        { type: "FAQ", title: "Files and light", rawText: "The zine is a PDF. The LUT pack is Rec.709, three looks, with a one-page note on where each was shot. Refunds only if the file will not open. I do not shoot your wedding — send wedding dates to a wedding desk. I do walk Magnolia with one person if you buy the LUT pack and the date is clear; that is a separate WhatsApp, not a tour." },
    ],
    customInstructions: "You are Rohan at Tagore Hill Press, Morabadi, Ranchi. Help with the zine, the Magnolia LUT pack, and the free metering note. Hours 11:00–19:00 Monday to Saturday. Prices in rupees. Digital files only. Never offer a wedding shoot. Never invent a printed stock or a tour company. Point Netarhat cars to a travel desk.",
    tone: "calm",
}

export const UNIQUE_GRAPHICS: DemoShop = {
    flavor: "DESIGNER",
    engine: "DESIGNER",
    goal: "SHOW_PORTFOLIO",
    slug: "unique-graphics-ashok-nagar",
    name: "Unique Graphics",
    headline: "Ashok Kunj design desk — logos, packs, and a board that still reads from the road.",
    bio: `Unique Graphics works from 292/C, Road Number 1, Ashok Kunj, Ashok Nagar, Ranchi 834002. Neighbourhood identity work: logos for Lalpur shops, packaging for a mithai counter, boards that have to survive Main Road sun.

Bring the name, what you sell, and whether this is a pack, a board, or a full set. I draw, you mark, we print when you say yes.

WhatsApp 94311 66721. Monday to Saturday, 10 to 7.`,
    welcome: "Share the shop name and whether this is a logo, a pack, or a board.",
    speakerName: "Unique desk",
    speakerRole: "designer",
    whatsapp: "919431166721",
    upiId: "uniquegraphics@upi",
    imageUrl: photo.brand,
    shopLogoUrl: photo.nia,
    venue: {
        address: {
            formatted: "292/C, Road Number 1, Ashok Kunj, Ashok Nagar, Ranchi 834002",
            line1: "292/C, Road Number 1, Ashok Kunj, Ashok Nagar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Ashok Nagar desk" },
        categories: ["Graphic designer", "Packaging"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Unique+Graphics+Ashok+Kunj+Ashok+Nagar+Ranchi",
    },
    hours: weekdaysHours("10:00", "19:00"),
    services: [
        { name: "Brief on the drawing board", description: "Name, what you sell, pack or board. 40 minutes in Ashok Kunj.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Unique Graphics", role: "Designer", startDate: "2016", description: "Identity, packaging, and boards for Ashok Nagar, Lalpur, and Main Road shops." },
        { company: "Lalpur print counters", role: "Layout artist", startDate: "2012", endDate: "2016", description: "Visiting cards, flex, and the first shop boards before the studio opened." },
    ],
    projects: [
        { title: "Mithai tin for a Lalpur counter", description: "A festive tin that still reads as Ranchi mithai, not a metro dessert. Foil, type, and a lid you can stack.", year: "2025", imageUrl: photo.packaging, client: "Lalpur mithai counter" },
        { title: "Ashok Nagar shop board", description: "Name, Hindi and English, colours that hold after a summer on Road Number 1.", year: "2024", imageUrl: photo.brand, client: "Ashok Kunj shop" },
    ],
    documents: [
        { type: "BIO", title: "About Unique Graphics", rawText: "Unique Graphics, 292/C, Road Number 1, Ashok Kunj, Ashok Nagar, Ranchi 834002. Logos, packaging, shop boards. Desk 10:00–19:00 Monday to Saturday. WhatsApp 94311 66721. Neighbourhood work — Lalpur, Ashok Nagar, Main Road. Print is local; I do not run an offset plant." },
        { type: "FAQ", title: "Revisions and print", rawText: "Two rounds of marks on a logo are in the brief. A third is a new ticket. I send print-ready files; the flex shop on Hazaribagh Road is yours unless you ask me to stand there. I do not build apps or run ads. Packaging dielines need the tin or pouch size before I draw." },
    ],
    customInstructions: "You are the desk at Unique Graphics, 292/C Road Number 1, Ashok Kunj, Ashok Nagar, Ranchi. Help with logos, packs, and boards for neighbourhood shops. Hours 10:00–19:00 Monday to Saturday. Prices in rupees after the brief. Offer Brief on the drawing board. Never invent a print plant or an ad retainer. Never send a finished logo in chat.",
    tone: "direct",
}

export const KADRU_LAB: DemoShop = {
    flavor: "DEVELOPER",
    engine: "DESIGNER",
    goal: "SHOW_PORTFOLIO",
    slug: "kadru-lab",
    name: "Kadru Lab",
    headline: "Kadru independent — shop apps, booking pages, and a stock counter that does not need a call to Mumbai.",
    bio: `Kadru Lab is Samir Toppo’s practice near the Kadru overbridge, Ranchi 834002. I build small software for Ranchi counters — booking for a salon, stock for a kirana, a page a travel desk can actually update.

BIT Mesra, then three years on someone else’s bench, then this desk. React, Next.js, a bit of Flutter when the owner wants it in a pocket. I do not sell a six-month transformation.

WhatsApp 99343 11820. I am in Kadru Monday to Saturday.`,
    welcome: "Share what the counter needs — booking, stock, or a page. I will say if I am the right desk.",
    speakerName: "Samir",
    speakerRole: "developer",
    whatsapp: "919934311820",
    upiId: "kadrulab@upi",
    imageUrl: photo.samir,
    shopLogoUrl: photo.app,
    venue: {
        address: {
            formatted: "Kadru, near the railway overbridge, Ranchi 834002",
            line1: "Kadru, near railway overbridge",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Kadru desk" },
        categories: ["Developer", "Shop software"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Kadru+overbridge+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:30"),
    services: [
        { name: "Build brief", description: "What the counter does today, what should happen on the phone, and whether this is a page or an app. 40 minutes.", durationMinutes: 40, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Kadru Lab", role: "Independent developer", startDate: "2022", description: "Booking, stock, and pages for Ranchi counters from a Kadru desk." },
        { company: "Ranchi product bench", role: "Engineer", startDate: "2019", endDate: "2022", description: "BIT Mesra, then three years shipping internal tools for a Namkum IT park team." },
    ],
    projects: [
        { title: "Salon booking for a Doranda chair", description: "Named staff, 45-minute slots, WhatsApp confirm. The owner still writes the evening list by hand; the phone stopped double-booking.", year: "2025", imageUrl: photo.app, client: "Doranda salon" },
        { title: "Kirana stock for a Harmu counter", description: "SKU, loose vs packed, a low-stock ping. No warehouse module. The shopkeeper updates it after closing.", year: "2024", imageUrl: photo.atlas, client: "Harmu kirana" },
    ],
    documents: [
        { type: "BIO", title: "About Kadru Lab", rawText: "Kadru Lab, Kadru near the railway overbridge, Ranchi 834002. Samir Toppo. Independent developer. Shop booking, stock counters, small pages. React, Next.js, Flutter when needed. Desk 10:00–18:30 Monday to Saturday. WhatsApp 99343 11820. BIT Mesra. I do not run a 20-person shop." },
        { type: "FAQ", title: "Scope", rawText: "I take work I can ship in weeks, not a year. I do not bid government tenders from this desk. Hosting is yours or a small VPS I set up — we decide in the brief. Source is yours after the last invoice. I do not keep admin passwords in chat." },
    ],
    customInstructions: "You are Samir at Kadru Lab, Kadru, Ranchi. Help Ranchi counters with booking, stock, and small pages. Hours 10:00–18:30 Monday to Saturday. Offer a Build brief. Never invent a team size or an enterprise platform. Never take card details or admin passwords in chat. Prices in rupees after the brief.",
    tone: "direct",
}

export const SWAROOP_PRODUCTION: DemoShop = {
    flavor: "EDITOR",
    engine: "DESIGNER",
    goal: "SHOW_PORTFOLIO",
    slug: "swaroop-production-doranda",
    name: "Swaroop Production",
    headline: "Doranda edit desk — wedding films graded, YouTube cuts, and a colour pass that keeps Ranchi skin honest.",
    bio: `Swaroop Production sits in Punjabi Gali, Shyamali Colony, Doranda, Ranchi 834002. We cut and grade wedding films, pre-wedding teasers, and YouTube for Ranchi creators. The camera can be yours; the timeline is ours.

Bring the cards, the song, and when the family needs to see a first cut. Wedding films in three to five weeks after the last function if the footage is complete. YouTube in days.

WhatsApp 94313 22901. Shyamali Colony, behind the usual Doranda lanes.`,
    welcome: "Share whether this is a wedding film, a teaser, or a YouTube cut, and when you need the first pass.",
    speakerName: "Swaroop",
    speakerRole: "editor",
    whatsapp: "919431322901",
    upiId: "swaroopproduction@upi",
    imageUrl: photo.theo,
    shopLogoUrl: photo.film,
    venue: {
        address: {
            formatted: "Punjabi Gali, Shyamali Colony, Doranda, Ranchi 834002",
            line1: "Punjabi Gali, Shyamali Colony, Doranda",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Doranda desk" },
        categories: ["Editor", "Wedding film", "Colour"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Shyamali+Colony+Doranda+Ranchi",
    },
    hours: weekdaysHours("11:00", "20:00"),
    services: [
        { name: "Edit briefing", description: "Cards, song, length, and the date the family will sit. 30 minutes in Doranda or on a call.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Swaroop Production", role: "Editor", startDate: "2017", description: "Wedding films, teasers, and YouTube cuts from Shyamali Colony, Doranda." },
        { company: "Ranchi wedding crews", role: "Offline editor", startDate: "2013", endDate: "2017", description: "Night grades for Club and Harmu films while the crew slept." },
    ],
    projects: [
        { title: "Club wedding film grade", description: "A 12-minute film, pheras in mixed tungsten, skin kept, greens not neon. First cut in 18 days.", year: "2025", imageUrl: photo.film, client: "Ranchi Club wedding" },
        { title: "Patratu teaser", description: "45 seconds, two outfits, no drone. The cut the family sent on WhatsApp the same week.", year: "2024", imageUrl: photo.presets, client: "Patratu pre-wedding" },
    ],
    documents: [
        { type: "BIO", title: "About Swaroop Production", rawText: "Swaroop Production, Punjabi Gali, Shyamali Colony, Doranda, Ranchi 834002. Wedding films, teasers, YouTube. Desk 11:00–20:00 Monday to Saturday. WhatsApp 94313 22901. We edit and grade; we are not a full camera crew unless you ask well in advance." },
        { type: "FAQ", title: "Footage and time", rawText: "Bring cards or a drive; we do not download from a random link on the first day. Wedding films three to five weeks after the last function if footage is complete. One round of picture marks is in the ticket. Music must be cleared by you. We do not colour a film to look like a Korean drama if the hall was yellow tube light — we will say so." },
    ],
    customInstructions: "You are Swaroop at Swaroop Production, Shyamali Colony, Doranda, Ranchi. Help with wedding films, teasers, and YouTube cuts. Hours 11:00–20:00 Monday to Saturday. Offer Edit briefing. Prices in rupees after we see the footage. Never promise a camera crew by default. Never invent a delivery date shorter than the brief.",
    tone: "calm",
}

export const PRIYA_MINZ: DemoShop = {
    flavor: "JOB_SEEKER",
    engine: "JOB_SEEKER",
    goal: "HIRE_ME",
    slug: "priya-minz-bariatu",
    name: "Priya Minz",
    headline: "Bariatu product designer — Ranchi counters, civic pages, and a seat I can ride to.",
    bio: `I am Priya Minz. I live in Bariatu Housing Colony, Ranchi 834009. Product and interface design. BIT Mesra, 2021. Two years at a Namkum bench on internal tools, then a year with a Lalpur shop OS — booking, stock, the page a counter actually uses.

I am looking for a product or design seat I can do from Ranchi or with a week each month in the city. Civic, health, and small-business tools. I am not looking for a pure visual-polish stall.

WhatsApp 99345 01772. Intro chat is free and short.`,
    welcome: "If you have a product seat in Ranchi or remote-with-Ranchi, book an intro chat.",
    speakerName: "Priya",
    speakerRole: "product designer",
    whatsapp: "919934501772",
    imageUrl: photo.priya,
    shopLogoUrl: photo.app,
    venue: {
        address: {
            formatted: "Bariatu Housing Colony, Ranchi 834009",
            line1: "Bariatu Housing Colony",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834009",
            country: "IN",
        },
        phone: { display: "Bariatu" },
        categories: ["Product designer", "Open to work"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Bariatu+Housing+Colony+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:00"),
    services: [
        { name: "Intro chat", description: "Twenty minutes. The seat, the stack, whether I would live in the file. Free.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
    ],
    experiences: [
        { company: "Lalpur shop OS", role: "Product designer", startDate: "2023", endDate: "2025", description: "Booking, stock, and the counter page for Ranchi independents. Shipped with one engineer." },
        { company: "Namkum product bench", role: "UI designer", startDate: "2021", endDate: "2023", description: "Internal tools after BIT Mesra. Learned tickets, release notes, and when not to add a screen." },
    ],
    projects: [
        { title: "Counter booking", description: "Named chairs, 45-minute slots, a WhatsApp ping. Designed so the owner can change hours without me.", year: "2024", imageUrl: photo.app, client: "Ranchi salon counters" },
        { title: "Ward-level civic page", description: "A Bariatu notice board that does not look like a PDF dump. Dates, one action, Hindi and English.", year: "2023", imageUrl: photo.atlas, client: "Bariatu civic brief" },
    ],
    documents: [
        { type: "BIO", title: "About Priya Minz", rawText: "Priya Minz, Bariatu Housing Colony, Ranchi 834009. Product and interface designer. BIT Mesra 2021. Namkum bench 2021–23. Lalpur shop OS 2023–25. Looking for a product or design seat in Ranchi or remote with Ranchi time. WhatsApp 99345 01772. Intro chat 20 minutes, free. Desk hours 10:00–18:00 Monday to Saturday for calls." },
        { type: "FAQ", title: "What I want", rawText: "Product or design, not a poster stall. I can do Figma, a bit of front-end, and a tight brief. I am not relocating full-time to Bengaluru this year. I do not do wedding albums. Intro chat is not a paid consult — if you want design work as a client, say so and I will tell you if I still take briefs." },
    ],
    customInstructions: "You are Priya Minz, a product designer in Bariatu, Ranchi, open to work. Help hiring managers with an Intro chat. Hours 10:00–18:00 Monday to Saturday. Never invent an employer, a salary, or a Bengaluru move. Never sell a wedding shoot. If they want design as a client, say you take few briefs and will decide on the call.",
    tone: "direct",
}

export const ARGORA_WORKROOM: DemoShop = {
    flavor: "CUSTOM",
    engine: "CUSTOM",
    goal: "BOOK_CALL",
    slug: "argora-workroom",
    name: "Argora Workroom",
    headline: "Argora independent — shop photographs, a lighting course, and a Saturday desk you can book.",
    bio: `Argora Workroom is Nia Kachhap’s practice in Harmu Housing Colony, Argora, Ranchi 834002, near Sahjanand Chowk. I photograph Ranchi counters and rooms, print a small Chotanagpur zine, sell a LUT pack for this light, and teach a short course on shooting a shop so the owner can post it.

A brand-shoot morning, a packaging stills half-day, a discovery call if you do not know which. Three things on the shelf: the zine, the LUT pack, a print set of eight. A Saturday lighting workshop at the workroom. A free note on tube light versus the door.

WhatsApp 94315 44018. I shoot weekdays; Saturdays are the floor.`,
    welcome: "Ask for a shop shoot, the zine, the course, or Saturday lighting. We will pick a date.",
    speakerName: "Nia",
    speakerRole: "photographer",
    whatsapp: "919431544018",
    upiId: "argoraworkroom@upi",
    imageUrl: photo.nia,
    shopLogoUrl: photo.zine,
    venue: {
        address: {
            formatted: "Harmu Housing Colony, near Sahjanand Chowk, Argora, Ranchi 834002",
            line1: "Harmu Housing Colony, near Sahjanand Chowk, Argora",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Argora workroom" },
        categories: ["Photographer", "Workshop", "Zine"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Sahjanand+Chowk+Harmu+Housing+Colony+Argora+Ranchi",
    },
    hours: weekdaysHours("10:00", "18:00"),
    services: [
        { name: "Shop brand shoot", description: "A morning at your counter — board, hands, three plates or pieces. Files the same week.", durationMinutes: 180, priceRupees: 8500, kind: "SESSION" },
        { name: "Packaging stills", description: "Half day. Tins, bottles, a white wall in Argora or your godown. For the listing, not a campaign.", durationMinutes: 240, priceRupees: 12000, kind: "SESSION" },
        { name: "Discovery call", description: "Shoot, course, or the Saturday floor. 25 minutes. Free.", durationMinutes: 25, priceRupees: 0, kind: "SESSION" },
    ],
    products: [
        { title: "Chotanagpur workroom zine", description: "20 pages. Counters, monsoon glass, one Netarhat ridge. PDF.", category: "Zines", priceRupees: 400, type: "PDF", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.zine, sku: "AW-ZINE" },
        { title: "Ranchi door-light LUTs", description: "Two grades for shops that only have a door and a tube. Rec.709.", category: "LUTs", priceRupees: 700, type: "OTHER", fulfillment: "DIGITAL", shipMode: "NONE", thumbnailUrl: photo.presets, sku: "AW-LUT" },
        { title: "Eight stills, print set", description: "A physical set of eight 6×8s from the Argora archive. Pickup at the workroom.", category: "Prints", priceRupees: 1800, type: "PHYSICAL", fulfillment: "PHYSICAL", shipMode: "PICKUP", thumbnailUrl: photo.film, sku: "AW-PRINT", stock: 12 },
    ],
    courses: [
        {
            title: "Shooting the Ranchi counter",
            description: "Four lessons on photographing a shop with a door, a tube, and one hour before the lunch rush. Made for owners and the cousin who holds the phone.",
            priceRupees: 2400,
            thumbnailUrl: photo.course,
            modules: [
                { title: "Light you already have", lessons: ["The door as a softbox", "Tube light without green skin", "When to wait for 4pm"] },
                { title: "The counter", lessons: ["Hands and steel", "Boards that still read", "A five-frame set you can post"] },
            ],
        },
    ],
    events: [
        { title: "Saturday lighting floor", description: "Three hours in Argora. Bring a phone or a camera. We shoot a table, a board, and a doorway. Eight seats.", daysFromNow: 16, durationHours: 3, location: "Argora Workroom, Harmu Housing Colony", priceRupees: 900, thumbnailUrl: photo.workshop },
    ],
    leadMagnets: [
        { title: "Tube versus the door", description: "A one-page note on where to stand in a Ranchi shop when you only have those two lights." },
    ],
    experiences: [
        { company: "Argora Workroom", role: "Photographer", startDate: "2021", description: "Shop stills, a zine, LUTs, and a Saturday lighting floor from Harmu Housing Colony, Argora." },
        { company: "Ranchi wedding second", role: "Second shooter", startDate: "2018", endDate: "2021", description: "Learned mixed light and family crowds before I stopped taking full wedding days." },
    ],
    projects: [
        { title: "Lalpur mithai counter", description: "Eight stills — tins, kadhai, the morning board. The owner still uses three of them on the listing.", year: "2025", imageUrl: photo.packaging, client: "Lalpur mithai" },
        { title: "Kanke Road hall, empty", description: "A dressed mandap at 11am, no guests yet. Lighting notes later became the Saturday floor.", year: "2024", imageUrl: photo.workshop, client: "Kanke Road crew" },
    ],
    documents: [
        { type: "BIO", title: "About Argora Workroom", rawText: "Argora Workroom, Harmu Housing Colony, near Sahjanand Chowk, Argora, Ranchi 834002. Nia Kachhap. Shop photographs, packaging stills, Chotanagpur zine, Ranchi door-light LUTs, print set of eight, course on shooting a counter, Saturday lighting floor. Desk 10:00–18:00 Monday to Saturday. WhatsApp 94315 44018. I no longer take full wedding days." },
        { type: "FAQ", title: "Shoots, files, Saturday", rawText: "Discovery is free. Shop shoots are a morning; packaging is a half day. Digital files by drive. The print set is pickup in Argora. The course is self-paced. Saturday lighting is eight seats, ₹900, phone or camera. I do not run a travel desk or a wedding crew. If you need Netarhat, I will point you to a car." },
    ],
    customInstructions: "You are Nia at Argora Workroom, Harmu Housing Colony, Argora, Ranchi. Help with shop shoots, packaging stills, the zine, LUTs, the print set, the counter course, Saturday lighting, and the free tube-versus-door note. Hours 10:00–18:00 Monday to Saturday. Prices in rupees. Offer Shop brand shoot, Packaging stills, or Discovery call. Never take a full wedding. Never invent a second workroom. Never sell a Netarhat tour.",
    tone: "warm",
}

export const STUDIO_SHOPS: DemoShop[] = [
    NEXT_LEVEL_EVENTS,
    SHAKTI_PROPERTY,
    NITA_RECRUITERS,
    LETS_CLICK,
    TSS_JOURNEY,
    AAKRITI_INTERIORS,
    CREATIVEBIT,
    DEEPSHIKHA,
    TAGORE_HILL_PRESS,
    UNIQUE_GRAPHICS,
    KADRU_LAB,
    SWAROOP_PRODUCTION,
    PRIYA_MINZ,
    ARGORA_WORKROOM,
]

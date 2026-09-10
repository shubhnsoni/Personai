import { everydayHours, weekdaysHours, type DemoShop } from "./types"
import { SKYDINE_CAFE } from "./cafe"

const photo = {
    dal: "/uploads/try-dal.jpg",
    naan: "/uploads/try-naan.jpg",
    butter: "/uploads/try-butter.jpg",
    lassi: "/uploads/try-lassi.jpg",
    store: "/uploads/try-storefront.jpg",
    arjun: "/uploads/try-arjun.jpg",
    plates: "/uploads/skydine-cafe/plates.jpg",
    muffin: "/uploads/blu-cafe/muffin.jpg",
    cookie: "/uploads/blu-cafe/cookie-chocolate.jpg",
    croissant: "/uploads/blu-cafe/croissant.jpg",
}

export const KAVERI_RESTAURANT: DemoShop = {
    flavor: "RESTAURANT",
    engine: "RESTAURANT",
    goal: "BOOK_TABLE",
    slug: "kaveri-main-road",
    name: "Kaveri Restaurant",
    headline: "Ranchi’s thali house on Main Road — dal, roti, sabzi, and a full plate.",
    bio: `Kaveri Restaurant sits on the first floor of G.E.L. Church Shopping Complex, 11 Mahatma Gandhi Main Road, Ranchi 834001. Families have been coming here for thali for years — it is the city’s most-reviewed kitchen on Google.

Veg thali, North Indian plates, and a few Chinese sides. About ₹400–600 for two. Open through the evening. Walk in for lunch; reserve if you are more than four.

Ask the desk for today’s thali, Jain, or a table upstairs.`,
    welcome: "Ask for today’s thali, Jain, or a table for the evening.",
    speakerName: "Kaveri desk",
    speakerRole: "host",
    whatsapp: "919431100221",
    upiId: "kaveriranchi@upi",
    deliveryNote: "Thali is plated for the table. Parcel from the Main Road counter until 10pm.",
    imageUrl: photo.store,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Shop 9, 1st Floor, G.E.L. Church Shopping Complex, 11 Mahatma Gandhi Main Road, Ranchi 834001",
            line1: "G.E.L. Church Shopping Complex, MG Main Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { display: "Main Road desk" },
        categories: ["North Indian", "Thali", "Vegetarian"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Kaveri+Restaurant+GEL+Church+Ranchi",
    },
    hours: everydayHours("11:00", "22:15"),
    tables: [
        { zone: "Hall", prefix: "Hall", count: 18, seats: 4 },
        { zone: "Family", prefix: "Family", count: 8, seats: 6 },
    ],
    products: [
        { title: "Veg thali", description: "Dal, two sabzi, roti, rice, papad, pickle, and a sweet. The plate Ranchi comes for.", category: "Thali", priceRupees: 220, diet: "VEG", spiceLevel: 1, serveWindow: "11:00–22:00", prepMinutes: 15, thumbnailUrl: photo.dal, sku: "KV-THALI", stock: 80, shipMode: "PICKUP" },
        { title: "Jain thali", description: "No onion, no garlic. Same generous plate.", category: "Thali", priceRupees: 240, diet: "JAIN", spiceLevel: 1, serveWindow: "11:00–22:00", prepMinutes: 15, thumbnailUrl: photo.dal, sku: "KV-JAIN", stock: 20, shipMode: "PICKUP" },
        { title: "Dal tadka", description: "Yellow dal, ghee tadka. Homestyle.", category: "Mains", priceRupees: 140, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.dal, sku: "KV-DAL", shipMode: "PICKUP" },
        { title: "Paneer butter masala", description: "Cashew-tomato gravy, mild heat.", category: "Mains", priceRupees: 260, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.butter, sku: "KV-PBM", shipMode: "PICKUP" },
        { title: "Mix veg", description: "Seasonal sabzi for the thali plate.", category: "Mains", priceRupees: 160, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.dal, sku: "KV-MIX", shipMode: "PICKUP" },
        { title: "Jeera rice", description: "Steamed rice with cumin.", category: "Rice", priceRupees: 90, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.dal, sku: "KV-RICE", shipMode: "PICKUP" },
        { title: "Tandoor roti", description: "Plain tandoor roti. Butter on request.", category: "Breads", priceRupees: 20, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.naan, sku: "KV-ROTI", shipMode: "PICKUP" },
        { title: "Garlic naan", description: "Tandoor, butter, extra garlic if you ask.", category: "Breads", priceRupees: 50, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.naan, sku: "KV-NAAN", arKey: "garlic-bread", shipMode: "PICKUP" },
        { title: "Masala chaas", description: "Salted buttermilk with cumin.", category: "Drinks", priceRupees: 40, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "KV-CHAAS", shipMode: "PICKUP" },
        { title: "Mango lassi", description: "Kesar when Alphonso is out.", category: "Drinks", priceRupees: 80, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "KV-LASSI", shipMode: "PICKUP" },
        { title: "Gulab jamun", description: "Two pieces, warm syrup.", category: "Sweets", priceRupees: 60, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.cookie, sku: "KV-GJ", shipMode: "PICKUP" },
        { title: "Veg steam momo", description: "A side plate if the table wants something extra.", category: "Sides", priceRupees: 120, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.plates, sku: "KV-MOMO", arKey: "veg-momos", shipMode: "PICKUP" },
    ],
    services: [
        { name: "Hall table", description: "Main hall, 90 minutes, up to four.", durationMinutes: 90, priceRupees: 0, kind: "TABLE", covers: 4 },
        { name: "Family table", description: "Corner table for six. Weekend lunch fills first.", durationMinutes: 100, priceRupees: 0, kind: "TABLE", covers: 6 },
    ],
    story: [
        { url: photo.store, title: "Main Road", body: "First floor, G.E.L. Church complex. The stairs are busy at one o’clock.", category: "INTERIOR" },
        { url: photo.dal, title: "The plate", body: "Dal, sabzi, roti, rice. The thali is why people queue.", category: "FOOD" },
        { url: photo.naan, title: "Tandoor", body: "Roti and naan off the tandoor through the evening.", category: "FOOD" },
    ],
    documents: [
        { type: "BIO", title: "About Kaveri", rawText: "Kaveri Restaurant, first floor G.E.L. Church Shopping Complex, 11 MG Main Road, Ranchi 834001. North Indian thali house. Veg and Jain. About ₹400–600 for two. Open 11:00–22:15 every day. No alcohol. Family tables upstairs." },
        { type: "FAQ", title: "Thali and Jain", rawText: "Veg thali is the house plate. Jain thali has no onion or garlic. Parcel from the counter until 10pm. Groups larger than six should reserve a family table." },
    ],
    customInstructions: "You are the desk at Kaveri Restaurant, G.E.L. Church complex, Main Road, Ranchi. Help with thali, Jain, spice, and tables. Open 11:00–22:15 every day. Prices in rupees. No alcohol. Offer Hall table or Family table. Never invent ratings or branches that are not Main Road.",
    tone: "warm",
}

export const NANAK_DHABA: DemoShop = {
    flavor: "DHABA",
    engine: "RESTAURANT",
    goal: "BOOK_TABLE",
    slug: "nanak-dhaba",
    name: "Nanak Dhaba",
    headline: "Punjabi dhaba on NH-33, Chuttupalu — dal, paneer, paratha, garden seating.",
    bio: `Nanak Dhaba sits on NH-33 at Chuttupalu, on the Ranchi–Ramgarh stretch. Pure vegetarian. Garden seating, a khat outside, and an AC hall when the highway dust is high.

Dal makhani, paneer butter masala, tandoor roti, lassi. Families stop here on the way to Ramgarh. Open through the day. Parking on the highway side.

Call 062076 69040.`,
    welcome: "Ask for dal makhani, a thali, or a garden table off the highway.",
    speakerName: "Nanak counter",
    speakerRole: "host",
    whatsapp: "916207669040",
    upiId: "nanakdhaba@upi",
    deliveryNote: "Highway stop. Parcel from the counter. Garden tables are first-come; AC hall if it is raining.",
    imageUrl: photo.store,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "NH-33, Chuttupalu, Jharkhand 829102",
            line1: "NH-33, Chuttupalu",
            locality: "Ormanjhi",
            region: "Jharkhand",
            postalCode: "829102",
            country: "IN",
        },
        phone: { e164: "+916207669040", display: "062076 69040" },
        categories: ["Dhaba", "Punjabi", "Vegetarian"],
    },
    socials: {
        maps: "https://maps.app.goo.gl/3aoALDQs5JPmDFTn6",
    },
    hours: everydayHours("08:00", "23:00"),
    tables: [
        { zone: "Garden", prefix: "Garden", count: 14, seats: 6 },
        { zone: "Hall", prefix: "Hall", count: 10, seats: 4 },
    ],
    products: [
        { title: "Aloo paratha", description: "Tawa paratha, white butter, pickle.", category: "Breads", priceRupees: 50, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.naan, sku: "ND-PARATHA", shipMode: "PICKUP" },
        { title: "Tandoor naan", description: "Plain naan off the tandoor.", category: "Breads", priceRupees: 50, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.naan, sku: "ND-NAAN", arKey: "garlic-bread", shipMode: "PICKUP" },
        { title: "Dal tadka", description: "Yellow dal, ghee. The highway plate.", category: "Mains", priceRupees: 80, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.dal, sku: "ND-DAL", shipMode: "PICKUP" },
        { title: "Dal makhani", description: "Overnight black dal. What people stop for.", category: "Mains", priceRupees: 180, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.dal, sku: "ND-MAKHANI", shipMode: "PICKUP" },
        { title: "Paneer butter masala", description: "Mild, creamy, with naan.", category: "Mains", priceRupees: 250, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.butter, sku: "ND-PBM", shipMode: "PICKUP" },
        { title: "Paneer mushroom", description: "Paneer and mushroom in onion-tomato gravy.", category: "Mains", priceRupees: 250, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.butter, sku: "ND-PM", shipMode: "PICKUP" },
        { title: "Mix veg", description: "Seasonal sabzi, dhaba heat.", category: "Mains", priceRupees: 160, diet: "VEG", spiceLevel: 2, thumbnailUrl: photo.dal, sku: "ND-MIX", shipMode: "PICKUP" },
        { title: "Jeera rice", description: "Plain rice with cumin.", category: "Rice", priceRupees: 90, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.dal, sku: "ND-RICE", shipMode: "PICKUP" },
        { title: "Lassi", description: "Sweet or salted. Tall steel glass.", category: "Drinks", priceRupees: 70, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "ND-LASSI", shipMode: "PICKUP" },
        { title: "Masala chaas", description: "For the drive onward.", category: "Drinks", priceRupees: 40, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "ND-CHAAS", shipMode: "PICKUP" },
        { title: "Veg steam momo", description: "A plate for the kids while dal finishes.", category: "Sides", priceRupees: 120, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.plates, sku: "ND-MOMO", arKey: "veg-momos", shipMode: "PICKUP" },
        { title: "Dhaba thali", description: "Dal, sabzi, roti, rice, onion, pickle. Pure veg.", category: "Thali", priceRupees: 180, diet: "VEG", spiceLevel: 2, thumbnailUrl: photo.dal, sku: "ND-THALI", shipMode: "PICKUP" },
    ],
    services: [
        { name: "Garden table", description: "Outside, off the highway. 90 minutes.", durationMinutes: 90, priceRupees: 0, kind: "TABLE", covers: 6 },
        { name: "AC hall", description: "Indoor four. Use when it is raining or dusty.", durationMinutes: 90, priceRupees: 0, kind: "TABLE", covers: 4 },
    ],
    story: [
        { url: photo.store, title: "NH-33", body: "Chuttupalu. Parking on the highway side. Garden tables fill at dusk.", category: "AMBIENCE" },
        { url: photo.dal, title: "Dal", body: "Makhani and tadka. Pure veg kitchen.", category: "FOOD" },
        { url: photo.lassi, title: "Lassi", body: "Steel glass, then back on the Ramgarh road.", category: "FOOD" },
    ],
    documents: [
        { type: "BIO", title: "About Nanak Dhaba", rawText: "Nanak Dhaba, NH-33, Chuttupalu, Jharkhand 829102. Pure vegetarian Punjabi dhaba on the Ranchi–Ramgarh highway. Garden, khat, AC hall. Open 8am–11pm. Phone 062076 69040. Dal makhani, paneer, paratha, lassi." },
        { type: "FAQ", title: "Highway stop", rawText: "Parking on the NH-33 side. Pure veg only — no eggs, no meat. Garden tables first-come. AC hall if monsoon. Parcel from the counter. Cash, card, UPI." },
    ],
    customInstructions: "You are the counter at Nanak Dhaba, NH-33 Chuttupalu, on the Ranchi–Ramgarh highway. Pure vegetarian. Help with dal, paneer, paratha, lassi, garden or AC hall. Open 8am–11pm. Prices in rupees. Never offer chicken or eggs.",
    tone: "warm",
}

export const ALBELA_KITCHEN: DemoShop = {
    flavor: "CLOUD_KITCHEN",
    engine: "RESTAURANT",
    goal: "BOOK_TABLE",
    slug: "albela-biryani",
    name: "Albela Biryani",
    headline: "Biryani counter in the centre of Ranchi — parcel, no dining room.",
    bio: `Albela Biryani is a parcel kitchen in central Ranchi. Biryani, kebabs, and a few Chinese sides. No tables — pick up at the counter or send someone.

About ₹250–400 a box. Open through the evening. Ask which rice is on today, spice, and how long the parcel will take.`,
    welcome: "Ask which biryani is on, spice, and when the parcel will be ready.",
    speakerName: "Albela counter",
    speakerRole: "kitchen",
    whatsapp: "919934001188",
    upiId: "albelabiryani@upi",
    deliveryNote: "No dining room. Parcel in 20–30 minutes. Tell us the name on the box.",
    imageUrl: photo.butter,
    shopLogoUrl: photo.store,
    venue: {
        address: {
            formatted: "Central Ranchi, Jharkhand 834001",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        categories: ["Biryani", "Cloud kitchen"],
    },
    hours: everydayHours("11:00", "23:00"),
    products: [
        { title: "Chicken biryani", description: "Dum rice, one piece, raita.", category: "Biryani", priceRupees: 220, diet: "NONVEG", spiceLevel: 2, prepMinutes: 25, thumbnailUrl: photo.butter, sku: "AB-CB", shipMode: "PICKUP", allowCod: true },
        { title: "Mutton biryani", description: "When the pot is on. Ask first.", category: "Biryani", priceRupees: 320, diet: "NONVEG", spiceLevel: 2, prepMinutes: 30, thumbnailUrl: photo.butter, sku: "AB-MB", shipMode: "PICKUP", allowCod: true },
        { title: "Veg biryani", description: "Paneer and veg, dum rice.", category: "Biryani", priceRupees: 180, diet: "VEG", spiceLevel: 1, prepMinutes: 25, thumbnailUrl: photo.dal, sku: "AB-VB", shipMode: "PICKUP", allowCod: true },
        { title: "Egg biryani", description: "Two eggs, dum rice.", category: "Biryani", priceRupees: 160, diet: "NONVEG", spiceLevel: 2, prepMinutes: 20, thumbnailUrl: photo.dal, sku: "AB-EB", shipMode: "PICKUP", allowCod: true },
        { title: "Chicken kebab", description: "Six pieces, mint.", category: "Kebabs", priceRupees: 180, diet: "NONVEG", spiceLevel: 2, thumbnailUrl: photo.butter, sku: "AB-KEB", shipMode: "PICKUP" },
        { title: "Paneer tikka", description: "Eight cubes, salad.", category: "Kebabs", priceRupees: 160, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.butter, sku: "AB-PT", shipMode: "PICKUP" },
        { title: "Chicken burger", description: "A side if you are feeding the car.", category: "Sides", priceRupees: 120, diet: "NONVEG", spiceLevel: 1, thumbnailUrl: photo.plates, sku: "AB-BUR", arKey: "chicken-burger", shipMode: "PICKUP" },
        { title: "Veg steam momo", description: "Eight pieces, red chutney.", category: "Sides", priceRupees: 90, diet: "VEG", spiceLevel: 1, thumbnailUrl: photo.plates, sku: "AB-MOMO", arKey: "veg-momos", shipMode: "PICKUP" },
        { title: "Garlic bread", description: "Four sticks with the biryani box.", category: "Sides", priceRupees: 80, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.naan, sku: "AB-GB", arKey: "garlic-bread", shipMode: "PICKUP" },
        { title: "Raita", description: "Boondi raita, small.", category: "Sides", priceRupees: 40, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "AB-RAI", shipMode: "PICKUP" },
        { title: "Salan", description: "Mirchi salan for the rice.", category: "Sides", priceRupees: 30, diet: "VEG", spiceLevel: 2, thumbnailUrl: photo.dal, sku: "AB-SAL", shipMode: "PICKUP" },
        { title: "Coke 750ml", description: "For the ride.", category: "Drinks", priceRupees: 50, diet: "VEG", spiceLevel: 0, thumbnailUrl: photo.lassi, sku: "AB-COKE", shipMode: "PICKUP" },
    ],
    services: [
        { name: "Parcel slot", description: "Kitchen holds your box for 20 minutes. No table.", durationMinutes: 20, priceRupees: 0, kind: "TABLE", covers: 1 },
    ],
    documents: [
        { type: "BIO", title: "About Albela", rawText: "Albela Biryani is a parcel kitchen in central Ranchi. No dining room. Chicken, mutton, veg, and egg biryani. Open 11:00–23:00. Parcel in 20–30 minutes." },
        { type: "FAQ", title: "Parcel", rawText: "Give the name on the box. Mutton is not every day — ask. Spice can be less. No tables." },
    ],
    customInstructions: "You are Albela Biryani, a Ranchi parcel kitchen with no dining room. Help with biryani, spice, and pickup time. Open 11:00–23:00. Never offer a table to sit. Prices in rupees.",
    tone: "direct",
}

export const RANCHI_CATERER: DemoShop = {
    flavor: "CATERER",
    engine: "EVENTS_STUDIO",
    goal: "COLLECT_LEADS",
    slug: "lalpur-kitchen-catering",
    name: "Lalpur Kitchen Catering",
    headline: "Ranchi house catering — pooja, office, and wedding counts.",
    bio: `Lalpur Kitchen cooks for Ranchi homes and halls. Veg thali, North Indian, a Chinese counter if you want it. We take a date, a headcount, and a menu, then we show up with steel and staff.

Pooja meals from 25 plates. Office lunch. Wedding sides. Ask for a menu and a date — we will tell you if the kitchen is free.`,
    welcome: "Share the date, headcount, and veg or mixed. We will send a menu.",
    speakerName: "Rina",
    speakerRole: "kitchen lead",
    whatsapp: "919431122009",
    upiId: "lalpurkitchen@upi",
    imageUrl: photo.arjun,
    shopLogoUrl: photo.store,
    venue: {
        address: {
            formatted: "Lalpur, Ranchi 834001",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { display: "Lalpur kitchen" },
        categories: ["Caterer"],
    },
    hours: weekdaysHours("09:00", "20:00"),
    services: [
        { name: "Menu tasting", description: "45 minutes at the Lalpur kitchen. Bring the date.", durationMinutes: 45, priceRupees: 0, kind: "SESSION" },
        { name: "Event planning call", description: "Headcount, hall, and veg or mixed.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    products: [
        { title: "Veg pooja thali", description: "Per plate. Dal, sabzi, roti, rice, sweet.", category: "Menus", priceRupees: 280, diet: "VEG", thumbnailUrl: photo.dal, sku: "LK-POOJA", shipMode: "DELIVER" },
        { title: "Office lunch box", description: "Per box. Roti, sabzi, rice, pickle.", category: "Menus", priceRupees: 160, diet: "VEG", thumbnailUrl: photo.dal, sku: "LK-OFFICE", shipMode: "DELIVER" },
        { title: "Wedding veg counter", description: "Per plate estimate. Live roti, paneer, dal.", category: "Menus", priceRupees: 650, diet: "VEG", thumbnailUrl: photo.butter, sku: "LK-WED", shipMode: "DELIVER" },
        { title: "Chinese counter", description: "Per plate. Noodles, manchurian, fried rice.", category: "Menus", priceRupees: 220, diet: "VEG", thumbnailUrl: photo.plates, sku: "LK-CHN", arKey: "veg-momos", shipMode: "DELIVER" },
        { title: "Garlic naan live", description: "Tandoor at the hall. Per piece.", category: "Live", priceRupees: 40, diet: "VEG", thumbnailUrl: photo.naan, sku: "LK-NAAN", arKey: "garlic-bread", shipMode: "DELIVER" },
        { title: "Dessert tray", description: "Gulab jamun and brownie bites for 25.", category: "Sweets", priceRupees: 1800, diet: "VEG", thumbnailUrl: photo.cookie, sku: "LK-DES", arKey: "chocolate-brownie", shipMode: "DELIVER" },
        { title: "Mineral water crate", description: "12 bottles.", category: "Service", priceRupees: 240, diet: "VEG", thumbnailUrl: photo.lassi, sku: "LK-WAT", shipMode: "DELIVER" },
        { title: "Staff and steel", description: "Service team and plates for 50.", category: "Service", priceRupees: 3500, diet: "VEG", thumbnailUrl: photo.store, sku: "LK-STAFF", shipMode: "DELIVER" },
    ],
    events: [
        { title: "Saturday tasting", description: "Try the pooja thali and a wedding paneer.", daysFromNow: 10, durationHours: 2, location: "Lalpur kitchen", priceRupees: 0, thumbnailUrl: photo.dal },
    ],
    documents: [
        { type: "BIO", title: "About Lalpur Kitchen", rawText: "Lalpur Kitchen Catering, Lalpur, Ranchi. Veg pooja, office lunch, wedding counters. Tasting at the kitchen. Advance on the date. WhatsApp the headcount." },
        { type: "FAQ", title: "Booking", rawText: "We hold a date after 40% advance. Veg kitchen can add a Chinese counter. No alcohol service. Halls in Lalpur, Doranda, and Harmu." },
    ],
    experiences: [
        { company: "Lalpur Kitchen", role: "Kitchen lead", startDate: "2016", description: "Home and hall catering across Ranchi." },
    ],
    customInstructions: "You are Lalpur Kitchen Catering in Lalpur, Ranchi. Take date, headcount, and veg or mixed. Offer a tasting. Prices in rupees per plate. Do not promise a hall you do not have.",
    tone: "calm",
}

export const BAKERS_FRESH: DemoShop = {
    flavor: "BAKERY",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "bakers-fresh-ranchi",
    name: "Baker's Fresh",
    headline: "Cakes, pav, and a morning counter in Ranchi.",
    bio: `Baker's Fresh is a Ranchi bakery counter — pav, cream rolls, and birthday cakes you can pick up the same afternoon if you order before eleven.

Ask for today’s loaf, a 500g cake, or a tray of cookies. Counter closes when the racks are empty.`,
    welcome: "Ask for today’s loaf, a cake, or what is left on the rack.",
    whatsapp: "919934112233",
    upiId: "bakersfresh@upi",
    deliveryNote: "Pickup at the counter. Cakes need four hours. Pav is morning stock.",
    imageUrl: photo.croissant,
    shopLogoUrl: photo.muffin,
    venue: {
        address: { formatted: "Ranchi, Jharkhand", locality: "Ranchi", region: "Jharkhand", country: "IN" },
        categories: ["Bakery"],
    },
    hours: everydayHours("08:00", "21:00"),
    products: [
        { title: "Pav pack", description: "Six pieces. Morning bake.", category: "Bread", priceRupees: 40, diet: "VEG", stock: 40, thumbnailUrl: photo.croissant, sku: "BF-PAV", allowCod: true, shipMode: "PICKUP" },
        { title: "Sandwich loaf", description: "White sandwich bread.", category: "Bread", priceRupees: 45, diet: "VEG", stock: 20, thumbnailUrl: photo.croissant, sku: "BF-LOAF", allowCod: true, shipMode: "PICKUP" },
        { title: "Butter croissant", description: "Two pieces.", category: "Pastry", priceRupees: 70, diet: "VEG", stock: 18, thumbnailUrl: photo.croissant, sku: "BF-CR", allowCod: true, shipMode: "PICKUP" },
        { title: "Muffin", description: "Chocolate or vanilla.", category: "Pastry", priceRupees: 50, diet: "VEG", stock: 24, thumbnailUrl: photo.muffin, sku: "BF-MUF", allowCod: true, shipMode: "PICKUP" },
        { title: "Chocolate cookie", description: "Four pieces.", category: "Pastry", priceRupees: 80, diet: "VEG", stock: 30, thumbnailUrl: photo.cookie, sku: "BF-CK", allowCod: true, shipMode: "PICKUP" },
        { title: "Chocolate brownie", description: "Warm square. Ice cream extra.", category: "Cake", priceRupees: 90, diet: "VEG", stock: 16, thumbnailUrl: photo.cookie, sku: "BF-BR", arKey: "chocolate-brownie", allowCod: true, shipMode: "PICKUP" },
        { title: "500g chocolate cake", description: "Order before 11am for evening pickup.", category: "Cake", priceRupees: 380, diet: "VEG", stock: 6, thumbnailUrl: photo.cookie, sku: "BF-CAKE", allowCod: true, shipMode: "PICKUP" },
        { title: "1kg birthday cake", description: "Write the name in chat. Next-day pickup.", category: "Cake", priceRupees: 720, diet: "VEG", stock: 4, thumbnailUrl: photo.cookie, sku: "BF-BDAY", allowCod: false, shipMode: "PICKUP" },
        { title: "Garlic bread pack", description: "Four sticks, reheat at home.", category: "Savoury", priceRupees: 90, diet: "VEG", stock: 12, thumbnailUrl: photo.naan, sku: "BF-GB", arKey: "garlic-bread", allowCod: true, shipMode: "PICKUP" },
        { title: "Veg sandwich", description: "Counter sandwich until 4pm.", category: "Savoury", priceRupees: 60, diet: "VEG", stock: 15, thumbnailUrl: photo.plates, sku: "BF-SND", allowCod: true, shipMode: "PICKUP" },
    ],
    documents: [
        { type: "BIO", title: "About Baker's Fresh", rawText: "Baker's Fresh, Ranchi bakery counter. Pav, loaf, muffins, brownies, birthday cakes. Open 8am–9pm. Cakes need four hours if ordered before 11am." },
        { type: "FAQ", title: "Cakes", rawText: "500g same day if you order before 11. 1kg next day. Write the name in chat. No egg-free unless you ask — most sponge has egg." },
    ],
    customInstructions: "You are Baker's Fresh, a Ranchi bakery counter. Help with pav, cakes, and what is left on the rack. Cakes need lead time. Prices in rupees. Pickup only.",
    tone: "warm",
}

export const SAMRIDDHI_SWEETS: DemoShop = {
    flavor: "SWEETS",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "samriddhi-sweets",
    name: "Samriddhi Sweets",
    headline: "Mithai boxes and festive trays in Ranchi.",
    bio: `Samriddhi Sweets packs Ranchi mithai by the kilo — kaju katli, gulab jamun, and mixed festive trays.

Ask for a 500g box, a wedding tray, or what came out of the kadhai this morning. Counter scales, not guesswork.`,
    welcome: "Ask for a kilo, a festive tray, or what is fresh this morning.",
    whatsapp: "919431188776",
    upiId: "samriddhisweets@upi",
    imageUrl: photo.cookie,
    shopLogoUrl: photo.store,
    venue: {
        address: { formatted: "Ranchi, Jharkhand 834001", locality: "Ranchi", region: "Jharkhand", postalCode: "834001", country: "IN" },
        categories: ["Sweets"],
    },
    hours: everydayHours("08:30", "21:30"),
    products: [
        { title: "Kaju katli 500g", description: "Cashew, silver leaf.", category: "Mithai", priceRupees: 420, diet: "VEG", stock: 18, thumbnailUrl: photo.cookie, sku: "SS-KAJU", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Gulab jamun 500g", description: "Warm syrup. Packed so they do not crush.", category: "Mithai", priceRupees: 180, diet: "VEG", stock: 24, thumbnailUrl: photo.cookie, sku: "SS-GJ", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Rasgulla 500g", description: "Spongy, light syrup.", category: "Mithai", priceRupees: 160, diet: "VEG", stock: 20, thumbnailUrl: photo.cookie, sku: "SS-RAS", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Motichoor laddoo 500g", description: "Festival default.", category: "Mithai", priceRupees: 200, diet: "VEG", stock: 22, thumbnailUrl: photo.cookie, sku: "SS-LAD", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Mixed mithai 1kg", description: "Katli, barfi, laddoo. Gift box.", category: "Trays", priceRupees: 620, diet: "VEG", stock: 12, thumbnailUrl: photo.cookie, sku: "SS-MIX", weightGrams: 1000, allowCod: true, shipMode: "BOTH" },
        { title: "Wedding tray 2kg", description: "Dry fruits and mithai. Write the names.", category: "Trays", priceRupees: 1400, diet: "VEG", stock: 6, thumbnailUrl: photo.store, sku: "SS-WED", weightGrams: 2000, allowCod: false, shipMode: "PICKUP" },
        { title: "Samosa", description: "Two pieces, afternoon fry.", category: "Namkeen", priceRupees: 30, diet: "VEG", stock: 40, thumbnailUrl: photo.plates, sku: "SS-SAM", allowCod: true, shipMode: "PICKUP" },
        { title: "Kachori pack", description: "Four pieces.", category: "Namkeen", priceRupees: 50, diet: "VEG", stock: 30, thumbnailUrl: photo.plates, sku: "SS-KAC", allowCod: true, shipMode: "PICKUP" },
        { title: "Namkeen mix 250g", description: "Bhujia and sev.", category: "Namkeen", priceRupees: 70, diet: "VEG", stock: 25, thumbnailUrl: photo.dal, sku: "SS-NAM", weightGrams: 250, allowCod: true, shipMode: "PICKUP" },
        { title: "Chocolate brownie", description: "A modern piece next to the katli.", category: "Bakery", priceRupees: 80, diet: "VEG", stock: 10, thumbnailUrl: photo.cookie, sku: "SS-BR", arKey: "chocolate-brownie", allowCod: true, shipMode: "PICKUP" },
    ],
    documents: [
        { type: "BIO", title: "About Samriddhi Sweets", rawText: "Samriddhi Sweets, Ranchi mithai counter. Kilos and festive trays. Open 8:30am–9:30pm. Scales at the counter." },
        { type: "FAQ", title: "Trays", rawText: "Wedding trays need a day. Mixed 1kg is ready. Sugar-free is not stocked unless you ask two days ahead." },
    ],
    customInstructions: "You are Samriddhi Sweets in Ranchi. Help with kilos, trays, and what is fresh. Prices in rupees. Pickup. Do not invent sugar-free stock.",
    tone: "warm",
}

export const CHURUWALA: DemoShop = {
    flavor: "SWEETS",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "churuwala-upper-bazar",
    name: "Churuwala's",
    headline: "Upper Bazar mithai counter since 1949 — kachori, rasgulla, and festival trays.",
    bio: `Churuwala sits on JJ Road, East Market, Upper Bazar, Ranchi 834001 — one of the city’s oldest sweet shops. Families have been buying kilos here since 1949.

Kaju katli, barfi, peda, laddoo, gulab jamun, rasgulla, samosa, and the kachori people still name in reviews. About ₹250 for two at the snack counter. Open from early morning through evening.

Call 081973 60379. Ask for a kilo, a wedding tray, or what’s fresh from the kadhai.`,
    welcome: "Ask for today’s mithai, a kachori, or a festival tray from Upper Bazar.",
    speakerName: "Churuwala desk",
    speakerRole: "counter",
    whatsapp: "918197360379",
    upiId: "churuwalaupperbazar@upi",
    gstin: "20AGJPS6768E1Z7",
    deliveryNote: "Pickup at Upper Bazar, JJ Road. Trays need a day. Card usually above ₹200.",
    imageUrl: "/uploads/demo/kaju-katli.jpg",
    shopLogoUrl: "/uploads/churuwala/logo.jpg",
    venue: {
        address: {
            formatted: "East Market, JJ Road, Upper Bazar, Ranchi 834001",
            line1: "East Market, JJ Road, Upper Bazar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918197360379", display: "081973 60379" },
        categories: ["Mithai", "Sweet shop", "Snacks"],
    },
    hours: everydayHours("07:00", "22:00"),
    products: [
        { title: "Kaju katli 500g", description: "Cashew, silver leaf. Scale at the counter.", category: "Mithai", priceRupees: 420, diet: "VEG", stock: 20, thumbnailUrl: "/uploads/demo/kaju-katli.jpg", sku: "CW-KAJU", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Gulab jamun 500g", description: "Warm syrup. Packed so they do not crush.", category: "Mithai", priceRupees: 180, diet: "VEG", stock: 24, thumbnailUrl: "/uploads/demo/gulab-jamun.jpg", sku: "CW-GJ", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Rasgulla 500g", description: "Spongy, light syrup. The big ones people still ask for.", category: "Mithai", priceRupees: 160, diet: "VEG", stock: 22, thumbnailUrl: "/uploads/demo/rasgulla.jpg", sku: "CW-RAS", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Motichoor laddoo 500g", description: "Festival default.", category: "Mithai", priceRupees: 200, diet: "VEG", stock: 18, thumbnailUrl: "/uploads/demo/kaju-katli.jpg", sku: "CW-LAD", weightGrams: 500, allowCod: true, shipMode: "PICKUP" },
        { title: "Mixed mithai 1kg", description: "Katli, barfi, laddoo. Gift box.", category: "Trays", priceRupees: 620, diet: "VEG", stock: 10, thumbnailUrl: "/uploads/demo/kaju-katli.jpg", sku: "CW-MIX", weightGrams: 1000, allowCod: true, shipMode: "BOTH" },
        { title: "Wedding tray 2kg", description: "Write the names. Needs a day.", category: "Trays", priceRupees: 1400, diet: "VEG", stock: 4, thumbnailUrl: "/uploads/demo/gulab-jamun.jpg", sku: "CW-WED", weightGrams: 2000, allowCod: false, shipMode: "PICKUP" },
        { title: "Samosa", description: "Two pieces, afternoon fry.", category: "Namkeen", priceRupees: 30, diet: "VEG", stock: 40, thumbnailUrl: "/uploads/skydine-dishes/fries.jpg", sku: "CW-SAM", allowCod: true, shipMode: "PICKUP" },
        { title: "Kachori", description: "The one Upper Bazar still names.", category: "Namkeen", priceRupees: 25, diet: "VEG", stock: 36, thumbnailUrl: "/uploads/skydine-dishes/fries.jpg", sku: "CW-KAC", allowCod: true, shipMode: "PICKUP" },
        { title: "Dahi kachori", description: "Breakfast plate. Ask if the dahi is fresh.", category: "Namkeen", priceRupees: 60, diet: "VEG", stock: 20, thumbnailUrl: "/uploads/demo/rasgulla.jpg", sku: "CW-DAHI", allowCod: true, shipMode: "PICKUP" },
        { title: "Namkeen mix 250g", description: "Bhujia and sev.", category: "Namkeen", priceRupees: 70, diet: "VEG", stock: 25, thumbnailUrl: "/uploads/demo/kaju-katli.jpg", sku: "CW-NAM", weightGrams: 250, allowCod: true, shipMode: "PICKUP" },
    ],
    story: [],
    documents: [
        { type: "BIO", title: "About Churuwala's", rawText: "Churuwala's, East Market, JJ Road, Upper Bazar, Ranchi 834001. Sweet shop since 1949. GSTIN 20AGJPS6768E1Z7. Phone 081973 60379. Open about 7:00am–10:00pm. Kilos, trays, samosa, kachori. About ₹250 for two at the snack counter. Pickup on JJ Road." },
        { type: "FAQ", title: "Trays and snacks", rawText: "Wedding trays need a day. Mixed 1kg is ready. Kachori and samosa are the afternoon fry. Sugar-free is not stocked unless you ask two days ahead. Card usually above ₹200." },
    ],
    customInstructions: "You are Churuwala's on JJ Road, Upper Bazar, Ranchi — the 1949 mithai counter. Help with kilos, trays, kachori, and samosa. Prices in rupees. Pickup. Do not invent a second branch in another city. Do not invent sugar-free stock.",
    tone: "warm",
}

export const FOOD_SHOPS: DemoShop[] = [
    SKYDINE_CAFE,
    KAVERI_RESTAURANT,
    NANAK_DHABA,
    ALBELA_KITCHEN,
    RANCHI_CATERER,
    BAKERS_FRESH,
    SAMRIDDHI_SWEETS,
    CHURUWALA,
]

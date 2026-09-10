import { SKYDINE_AR_BY_TITLE } from "./ar"
import { SKYDINE_MENU_RAW } from "./skydine-menu"
import { everydayHours, type DemoProduct, type DemoShop } from "./types"

const DISH = "/uploads/skydine-dishes"

export function dishThumb(category: string, title: string) {
    const t = `${category} ${title}`.toLowerCase()
    if (/soup/.test(t) && /chicken|non veg|prawn/.test(t)) return `${DISH}/soup-chicken.jpg`
    if (/soup/.test(t)) return `${DISH}/soup-veg.jpg`
    if (/salad/.test(t)) return `${DISH}/salad.jpg`
    if (/fries|wedges|potato/.test(t)) return `${DISH}/fries.jpg`
    if (/pizza/.test(t)) return `${DISH}/pizza.jpg`
    if (/burger/.test(t)) return `${DISH}/burger.jpg`
    if (/momo/.test(t)) return `${DISH}/momos.jpg`
    if (/coffee|cappuccino|latte|espresso|americano|mocha/.test(t)) return `${DISH}/coffee.jpg`
    if (/shake|frappe|mocktail|mojito|cooler|lassi/.test(t)) return `${DISH}/shake.jpg`
    if (/brownie|dessert|pastry|cake|ice cream|sundae|cookie/.test(t)) return `${DISH}/brownie.jpg`
    if (/pasta|spaghetti|penne|lasagna/.test(t)) return `${DISH}/pasta.jpg`
    if (/wing/.test(t)) return `${DISH}/wings.jpg`
    if (/garlic bread|bruschetta/.test(t)) return `${DISH}/garlic-bread.jpg`
    if (/pancake|waffle|french toast/.test(t)) return `${DISH}/pancake.jpg`
    if (/avocado/.test(t)) return `${DISH}/avocado.jpg`
    if (/noodle|hakka|chowmein|manchurian|chilli chicken/.test(t)) return `${DISH}/noodles.jpg`
    if (/sandwich|wrap|taco/.test(t)) return `${DISH}/sandwich.jpg`
    if (/biryani|pulao|fried rice/.test(t)) return `${DISH}/biryani.jpg`
    if (/tandoor|tikka|kebab|grill/.test(t)) return `${DISH}/tandoor.jpg`
    if (/naan|dal|roti|thali|curry|butter chicken|paneer|sabzi/.test(t)) return `${DISH}/naan-dal.jpg`
    return `${DISH}/tandoor.jpg`
}

function menuProducts(): DemoProduct[] {
    return SKYDINE_MENU_RAW.trim().split("\n").map((line) => {
        const [category, diet, title, description, price] = line.split("|")
        const sku = `SD-${title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24).toUpperCase()}`
        return {
            title,
            description,
            category,
            priceRupees: Number(price),
            sku,
            diet: diet === "NONVEG" ? "NONVEG" : "VEG",
            spiceLevel: /chilli|schezwan|spicy|manchow|hot/i.test(`${title} ${description}`) ? 2 : /pepper|garlic|tikka/i.test(title) ? 1 : 0,
            serveWindow: "12:00–23:00",
            prepMinutes: /pizza|pasta|grilled|combo/i.test(category + title) ? 18 : 12,
            arKey: SKYDINE_AR_BY_TITLE[title],
            type: "PHYSICAL",
            fulfillment: "PHYSICAL",
            shipMode: "PICKUP",
            allowCod: true,
            thumbnailUrl: dishThumb(category, title),
        }
    })
}

export const SKYDINE_CAFE: DemoShop = {
    flavor: "CAFE",
    engine: "RESTAURANT",
    goal: "BOOK_TABLE",
    slug: "skydine-cafe",
    name: "SkyDine Cafe",
    headline: "Rooftop cafe on Hinoo Main Road — Chinese, North Indian, and the airport runway view.",
    bio: `SkyDine Cafe sits on Hinoo Main Road, Hindpiri, Ranchi 834002 — a rooftop hangout with a direct view of Birsa Munda Airport’s runway. Planes take off while you eat.

Chinese and North Indian plates, burgers, pasta, momos, coffee, and mocktails. Open every day from noon to 11pm. About ₹700–1,000 for two. Family, students, and date nights all fit. Reservations recommended; pets are welcome; outdoor and rooftop seating.

Call 092622 68837. Find us near Paintwala, North Ranchi.`,
    welcome: "Ask for the menu, a table tonight, or tap a dish to put it on the table.",
    speakerName: "SkyDine desk",
    speakerRole: "host",
    whatsapp: "919262268837",
    upiId: "skydine@okaxis",
    deliveryNote: "Pickup at the Hinoo counter. Terrace tables are first-come after 8pm unless you reserved. Pets welcome on the terrace.",
    imageUrl: "/uploads/skydine-cafe/terrace-dusk.jpg",
    shopLogoUrl: "/uploads/skydine-cafe/storefront.jpg",
    venue: {
        address: {
            formatted: "Hinoo Main Road, Hindpiri, near Paintwala, Ranchi 834002",
            line1: "Hinoo Main Road, Hindpiri",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919262268837", display: "092622 68837" },
        categories: ["Cafe", "Chinese", "North Indian", "Rooftop"],
    },
    socials: {
        instagram: "https://www.instagram.com/skydine.ranchi/",
        maps: "https://www.google.com/maps/place/SkyDine+Cafe/@23.3252515,85.3102119,17z",
        zomato: "https://www.zomato.com/ranchi/skydine-cafe-doranda",
    },
    googlePlaceId: "ChIJ9T0yOmfh9DkRpal0PA7vsN4",
    hours: everydayHours("12:00", "23:00"),
    tables: [
        { zone: "Ground", prefix: "Hall", count: 12, seats: 4 },
        { zone: "1st floor", prefix: "Indoor", count: 16, seats: 4 },
        { zone: "Terrace", prefix: "Terrace", count: 20, seats: 6 },
    ],
    products: menuProducts(),
    services: [
        { name: "Indoor two-top", description: "Quiet indoor table. 75 minutes. Good for coffee and a plate.", durationMinutes: 75, priceRupees: 0, kind: "TABLE", covers: 2 },
        { name: "Hall four", description: "Indoor table for four. 90 minutes. High chair on request.", durationMinutes: 90, priceRupees: 0, kind: "TABLE", covers: 4 },
        { name: "Terrace six", description: "Rooftop table with the runway behind you. 2 hours. Evenings fill first.", durationMinutes: 120, priceRupees: 0, kind: "TABLE", covers: 6 },
    ],
    story: [],
    documents: [
        {
            type: "BIO",
            title: "About SkyDine Cafe",
            rawText: "SkyDine Cafe is a rooftop cafe on Hinoo Main Road, Hindpiri, Ranchi 834002, near Paintwala, with a view of Birsa Munda Airport. Open noon to 11pm every day. Chinese and North Indian, burgers, pasta, momos, coffee, shakes, mocktails. Veg and non-veg. No alcohol. Pets welcome on the terrace. About ₹700–1,000 for two. Phone 092622 68837. Instagram skydine.ranchi.",
        },
        {
            type: "FAQ",
            title: "Tables and pickup",
            rawText: "Reserve Indoor two-top, Hall four, or Terrace six in chat. Terrace evenings fill first. Walk-ins after 9pm if a table is free. Pickup at the Hinoo counter. No delivery after kitchen close at 11pm. Dishes with a 3D plate can be placed on the table in AR.",
        },
        {
            type: "FAQ",
            title: "Kitchen notes",
            rawText: "Bestsellers: Chicken Burger, Margherita Pizza, Veg Steam Momo, Garlic Bread, Cappuccino, Nutella Shake, Chocolate Brownie, Avocado Toast. Jain and less-spice on request. No pork. No buffet. Live music some evenings on the terrace.",
        },
    ],
    customInstructions: "You are the desk at SkyDine Cafe, Hinoo Main Road, Hindpiri, Ranchi. Help with the menu, diet, spice, table booking, pickup, and AR plates. Hours are noon to 11pm every day. Prices are in rupees. No alcohol. Pets on the terrace. Offer Indoor two-top, Hall four, or Terrace six. If they ask to see a dish that has AR, mention they can place it on the table. Never invent ratings. Never send people to Kolkata or any other Sky Dine.",
    tone: "warm",
}

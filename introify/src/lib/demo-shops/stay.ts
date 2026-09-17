import { everydayHours, type DemoShop } from "./types"

const photo = {
    store: "/uploads/try-storefront.jpg",
    interior: "/uploads/skydine-cafe/interior.jpg",
    table: "/uploads/skydine-cafe/table.jpg",
    counter: "/uploads/skydine-cafe/counter.jpg",
    cafe: "/uploads/blu-cafe/cafe.jpg",
    arjun: "/uploads/try-arjun.jpg",
}

function stayDocs(name: string, place: string, extra: string): DemoShop["documents"] {
    return [
        { type: "BIO", title: `About ${name}`, rawText: `${name} is at ${place}. Check-in 14:00, checkout 11:00. Concierge on the QR. Housekeeping for towels, water, toiletries. Reception for anything else. ${extra}` },
        { type: "FAQ", title: "Wi-Fi, rooms, and requests", rawText: `Wi-Fi name is ${name.replace(/\s+/g, "-").toLowerCase()}-guest. Ask the concierge for the password. Room QR knows your room. Say “two towels room 101” to raise a housekeeping ticket. Restaurants are connected Introify pages, not a second menu. Talk to Reception hands the chat to a person.` },
    ]
}

export const HAVEN_HOTEL: DemoShop = {
    flavor: "HOTEL",
    engine: "HOTEL",
    goal: "TAKE_APPOINTMENTS",
    slug: "haven-hinoo",
    name: "Haven Hinoo",
    headline: "A 28-room stay in Hinoo — concierge on the QR, towels on request.",
    bio: `Haven Hinoo sits on Hinoo Main Road, Ranchi 834002. Twenty-eight rooms, a small lobby, and a reception desk that still answers the phone.

Check-in from 14:00. Checkout 11:00. Wi-Fi on every floor. Housekeeping until 22:00. The restaurant next door is an Introify kitchen — we connect it, we do not copy the menu.

Scan the room QR. Ask for towels, water, or reception.`,
    welcome: "Room, Wi-Fi, towels, or the restaurant next door — ask the concierge.",
    speakerName: "Haven desk",
    speakerRole: "concierge",
    whatsapp: "919431100221",
    upiId: "havenhinoo@upi",
    deliveryNote: "Housekeeping to the room. Restaurant orders stay on the connected kitchen’s page.",
    imageUrl: photo.interior,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Hinoo Main Road, Hinoo, Ranchi 834002",
            line1: "Hinoo Main Road, Hinoo",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Haven reception" },
        categories: ["Hotel", "Stay", "Concierge"],
    },
    hours: everydayHours("00:00", "23:59"),
    services: [
        { name: "Housekeeping", description: "Towels, water, toiletries, or a room clean.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
        { name: "Reception", description: "Front desk for keys, late checkout, and anything the concierge cannot close.", durationMinutes: 10, priceRupees: 0, kind: "SESSION" },
    ],
    story: [
        { url: photo.interior, title: "Lobby", body: "A small desk, not a call centre. Reception until 23:00.", category: "INTERIOR" },
        { url: photo.table, title: "Rooms", body: "Room QR on the nightstand. The concierge already knows the number.", category: "AMBIENCE" },
        { url: photo.cafe, title: "Next door", body: "Breakfast and dinner sit on the connected restaurant page.", category: "FOOD" },
    ],
    documents: stayDocs("Haven Hinoo", "Hinoo Main Road, Ranchi 834002", "28 rooms. Reception until 23:00."),
    customInstructions: "You are the concierge at Haven Hinoo, Hinoo Main Road, Ranchi. Check-in 14:00, checkout 11:00. Create housekeeping tickets. Never invent a room. Connected restaurants keep their own menus. Late checkout is a request, not a paid confirmation.",
    tone: "warm",
}

export const SAL_RESORT: DemoShop = {
    flavor: "RESORT",
    engine: "HOTEL",
    goal: "TAKE_APPOINTMENTS",
    slug: "sal-forest-stay",
    name: "Sal Forest Stay",
    headline: "A small resort off the Ranchi–Bundu road — pool, rooms, concierge QR.",
    bio: `Sal Forest Stay is a 16-cottage resort off the Ranchi–Bundu road, past the sal trees. Pool, a slow breakfast, and a desk that still writes room numbers by hand.

Scan the cottage QR. Ask for extra towels, the pool hours, or the kitchen next to reception. We do not reprint restaurant menus here.

Check-in 14:00. Checkout 11:00. Quiet after 22:00.`,
    welcome: "Cottage QR, towels, pool hours, or the kitchen — ask the desk.",
    speakerName: "Sal desk",
    speakerRole: "concierge",
    whatsapp: "919934112211",
    upiId: "salforest@upi",
    imageUrl: photo.cafe,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Ranchi–Bundu Road, Ranchi 835215",
            line1: "Ranchi–Bundu Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "835215",
            country: "IN",
        },
        phone: { display: "Sal reception" },
        categories: ["Resort", "Stay"],
    },
    hours: everydayHours("00:00", "23:59"),
    services: [
        { name: "Housekeeping", description: "Cottage towels, water, and a clean.", durationMinutes: 25, priceRupees: 0, kind: "SESSION" },
    ],
    documents: stayDocs("Sal Forest Stay", "Ranchi–Bundu Road", "16 cottages. Pool 07:00–19:00. Quiet after 22:00."),
    customInstructions: "You are the desk at Sal Forest Stay, a 16-cottage resort off the Bundu road. Pool 07:00–19:00. Housekeeping to the cottage. Never invent a cottage number. Quiet after 22:00.",
    tone: "calm",
}

export const DORANDA_HOSTEL: DemoShop = {
    flavor: "HOSTEL",
    engine: "HOTEL",
    goal: "TAKE_APPOINTMENTS",
    slug: "doranda-bunks",
    name: "Doranda Bunks",
    headline: "A hostel in Doranda — bunks, lockers, Wi-Fi, one QR on the door.",
    bio: `Doranda Bunks is a 40-bed hostel near Doranda market, Ranchi 834002. Mixed dorms, a few private rooms, lockers, and a desk that closes at midnight.

The door QR is the concierge. Ask for a towel, the Wi-Fi, or a nearby kitchen. We connect restaurants; we do not copy their menus.

Check-in 14:00. Checkout 11:00. Shoes off in the dorm.`,
    welcome: "Towel, Wi-Fi, or a kitchen nearby — the door QR is the desk.",
    speakerName: "Doranda desk",
    speakerRole: "concierge",
    whatsapp: "919905501122",
    upiId: "dorandabunks@upi",
    imageUrl: photo.counter,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Doranda Market Road, Doranda, Ranchi 834002",
            line1: "Doranda Market Road, Doranda",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Doranda desk" },
        categories: ["Hostel", "Stay"],
    },
    hours: everydayHours("00:00", "23:59"),
    services: [
        { name: "Housekeeping", description: "Towel, water, or a bunk tidy.", durationMinutes: 15, priceRupees: 0, kind: "SESSION" },
    ],
    documents: stayDocs("Doranda Bunks", "Doranda Market Road, Ranchi 834002", "40 beds. Desk until midnight. Shoes off in the dorm."),
    customInstructions: "You are the desk at Doranda Bunks, a hostel in Doranda, Ranchi. Dorms and a few private rooms. Housekeeping is towels and a tidy, not hotel turndown. Never invent a bunk number.",
    tone: "direct",
}

export const HARMU_HOMESTAY: DemoShop = {
    flavor: "HOMESTAY",
    engine: "HOTEL",
    goal: "TAKE_APPOINTMENTS",
    slug: "harmu-house",
    name: "Harmu House",
    headline: "A homestay on Harmu Road — three rooms, breakfast, a family desk.",
    bio: `Harmu House is a three-room homestay on Harmu Road, Ranchi 834002. A family house, not a hotel tower. Breakfast at the table. Keys from the same desk that answers WhatsApp.

The room card is a QR. Ask for extra water, a late breakfast, or a restaurant in Harmu. We connect kitchens; we do not reprint menus.

Check-in 14:00. Checkout 11:00. Quiet after 21:30.`,
    welcome: "Water, breakfast, or a Harmu kitchen — the room QR is the house desk.",
    speakerName: "Harmu house",
    speakerRole: "host",
    whatsapp: "919934445566",
    upiId: "harmuhouse@upi",
    imageUrl: photo.store,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Harmu Road, Harmu, Ranchi 834002",
            line1: "Harmu Road, Harmu",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { display: "Harmu house" },
        categories: ["Homestay", "Stay"],
    },
    hours: everydayHours("07:00", "22:00"),
    services: [
        { name: "Housekeeping", description: "Water, towels, or a room tidy.", durationMinutes: 20, priceRupees: 0, kind: "SESSION" },
    ],
    documents: stayDocs("Harmu House", "Harmu Road, Ranchi 834002", "Three rooms. Breakfast at the table. Quiet after 21:30."),
    customInstructions: "You are the host at Harmu House, a three-room homestay on Harmu Road. Breakfast is at the table. Housekeeping is water and towels. Never invent a fourth room.",
    tone: "warm",
}

export const LALPUR_APARTMENTS: DemoShop = {
    flavor: "SERVICED_APARTMENT",
    engine: "HOTEL",
    goal: "TAKE_APPOINTMENTS",
    slug: "lalpur-suites",
    name: "Lalpur Suites",
    headline: "Serviced apartments in Lalpur — kitchenette, weekly clean, concierge QR.",
    bio: `Lalpur Suites is twelve serviced apartments near Lalpur Chowk, Ranchi 834001. Kitchenette, weekly clean, and a desk that handles towels between cleans.

The door QR is the concierge. Ask for water, a clean, or a restaurant downstairs. Menus live on the connected restaurant page.

Check-in 14:00. Checkout 11:00. Long stays by the week.`,
    welcome: "Water, a clean, or the restaurant downstairs — the door QR is the desk.",
    speakerName: "Lalpur desk",
    speakerRole: "concierge",
    whatsapp: "919905509988",
    upiId: "lalpursuites@upi",
    imageUrl: photo.interior,
    shopLogoUrl: photo.arjun,
    venue: {
        address: {
            formatted: "Near Lalpur Chowk, Lalpur, Ranchi 834001",
            line1: "Near Lalpur Chowk, Lalpur",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { display: "Lalpur desk" },
        categories: ["Serviced apartment", "Stay"],
    },
    hours: everydayHours("00:00", "23:59"),
    services: [
        { name: "Housekeeping", description: "Towels, water, or a weekly clean.", durationMinutes: 30, priceRupees: 0, kind: "SESSION" },
    ],
    documents: stayDocs("Lalpur Suites", "Near Lalpur Chowk, Ranchi 834001", "Twelve apartments. Weekly clean. Long stays by the week."),
    customInstructions: "You are the desk at Lalpur Suites, twelve serviced apartments in Lalpur. Weekly clean plus on-demand towels and water. Never invent an apartment number. Restaurants stay on their own Introify pages.",
    tone: "calm",
}

export const STAY_SHOPS: DemoShop[] = [
    HAVEN_HOTEL,
    SAL_RESORT,
    DORANDA_HOSTEL,
    HARMU_HOMESTAY,
    LALPUR_APARTMENTS,
]

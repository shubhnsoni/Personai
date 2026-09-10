import { everydayHours, weekdaysHours, type DemoShop } from "./types"

const photo = {
    mira: "/uploads/try-mira.jpg",
    mug: "/uploads/try-mug.jpg",
    vase: "/uploads/try-vase.jpg",
    lamp: "/uploads/try-lamp.jpg",
    tote: "/uploads/try-tote.jpg",
    brand: "/uploads/try-brand.jpg",
    store: "/uploads/try-storefront.jpg",
    arjun: "/uploads/try-arjun.jpg",
    dal: "/uploads/try-dal.jpg",
    naan: "/uploads/try-naan.jpg",
    butter: "/uploads/try-butter.jpg",
    lassi: "/uploads/try-lassi.jpg",
    cafe: "/uploads/skydine-cafe/storefront.jpg",
    plates: "/uploads/skydine-cafe/plates.jpg",
}

const K22 = 9160
const K18 = 7500
const K24 = 9990

function medicine(batch: string, expiry: string, mrpRupees: number, rxRequired = false) {
    return JSON.stringify({
        medicine: {
            batch,
            expiry,
            mrpPaise: Math.round(mrpRupees * 100),
            ...(rxRequired ? { rxRequired: true } : {}),
        },
    })
}

function fitment(make: string, model: string, yearFrom: number, yearTo: number) {
    return JSON.stringify({ fitment: { make, model, yearFrom, yearTo } })
}

function gold(grams: number, purityBps: number, makingRupees: number) {
    return JSON.stringify({
        metal: {
            grossMg: Math.round(grams * 1000),
            purityBps,
            makingPaise: Math.round(makingRupees * 100),
        },
    })
}

export const RAGHUVANSHI_STORES: DemoShop = {
    flavor: "KIRANA",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "raghuvanshi-stores",
    name: "Raghuvanshi Stores",
    headline: "Main Road kirana at Sujata Chowk — atta, dal, oil, and the evening sack.",
    bio: `Raghuvanshi Stores sits on Mahatma Gandhi Main Road near Sujata Cinema Chowk, Hindpiri, Ranchi 834001. It is a neighbourhood kirana — loose grain on the scale, packed oil and tea on the shelf, and the household bits people run out of mid-week.

The counter weighs toor, moong, and rice to the bag you ask for. Families on Main Road send someone down for atta and sugar rather than wait on a cart. Pickup at the shop; if the sack is heavy, say so and we will help you to the kerb.

Open every day from 8:00 to 21:00. Landline 0651 233 1077. Ask what is in the sack today, a 5 kg atta, or a packed oil.`,
    welcome: "Ask for atta, dal, oil, or what is left in the sack.",
    speakerName: "Raghuvanshi counter",
    speakerRole: "shop",
    deliveryNote: "Pickup at Sujata Chowk. Heavy sacks to the kerb. No evening delivery after 21:00.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Mahatma Gandhi Main Road, near Sujata Cinema Chowk, Hindpiri, Ranchi 834001",
            line1: "MG Main Road, near Sujata Cinema Chowk",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+916512331077", display: "0651 233 1077" },
        categories: ["Kirana", "Grocery", "Staples"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Raghuvanshi+Stores+Sujata+Chowk+Ranchi",
    },
    hours: everydayHours("08:00", "21:00"),
    products: [
        { title: "Toor dal 1kg", description: "Loose toor, weighed at the counter. Packed in a poly bag.", category: "Dal", priceRupees: 168, sku: "RG-TOOR-1", stock: 40, thumbnailUrl: photo.dal, weightGrams: 1000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Moong dal 1kg", description: "Yellow moong, counter scale.", category: "Dal", priceRupees: 154, sku: "RG-MOONG-1", stock: 28, thumbnailUrl: photo.dal, weightGrams: 1000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Atta 5kg", description: "Packed wheat flour. The evening 5 kg that goes home on a cycle.", category: "Staples", priceRupees: 255, sku: "RG-ATTA-5", stock: 22, thumbnailUrl: photo.naan, weightGrams: 5000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Rice 5kg", description: "Sonam or similar medium grain. Ask which sack is open.", category: "Staples", priceRupees: 290, sku: "RG-RICE-5", stock: 18, thumbnailUrl: photo.dal, weightGrams: 5000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Refined oil 1L", description: "Packed sunflower or soy. Brand on the bottle at the shelf.", category: "Oil", priceRupees: 148, sku: "RG-OIL-1", stock: 30, thumbnailUrl: photo.lassi, weightGrams: 900, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Ghee 500ml", description: "Packed tin. Keep upright in the bag.", category: "Dairy", priceRupees: 325, sku: "RG-GHEE-500", stock: 14, thumbnailUrl: photo.butter, weightGrams: 500, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Sugar 1kg", description: "Loose crystal, weighed.", category: "Staples", priceRupees: 46, sku: "RG-SUGAR-1", stock: 50, thumbnailUrl: photo.dal, weightGrams: 1000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Iodised salt 1kg", description: "Packed Tata or similar. Two packets if you ask.", category: "Staples", priceRupees: 28, sku: "RG-SALT-1", stock: 60, thumbnailUrl: photo.brand, weightGrams: 1000, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Tea 250g", description: "CTC leaf, packed. The morning tin refill.", category: "Beverages", priceRupees: 92, sku: "RG-TEA-250", stock: 24, thumbnailUrl: photo.mug, weightGrams: 250, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Sudha milk 500ml", description: "Pouch from the crate. Morning and evening stock; ask before 8pm.", category: "Dairy", priceRupees: 28, sku: "RG-MILK-500", stock: 36, thumbnailUrl: photo.lassi, weightGrams: 500, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Raghuvanshi Stores", rawText: "Raghuvanshi Stores, Mahatma Gandhi Main Road, near Sujata Cinema Chowk, Hindpiri, Ranchi 834001. Neighbourhood kirana for atta, dal, oil, rice, tea, ghee, and milk. Open 8:00–21:00 every day. Landline 0651 233 1077. Pickup at the counter. Loose grain is weighed; packed brands sit on the shelf." },
        { type: "FAQ", title: "Sacks and pickup", rawText: "Loose dal and sugar are weighed when you ask. 5 kg atta and rice are packed sacks. Milk is a pouch from the crate and can run out after 8pm. Pickup at Sujata Chowk. Cash, card, UPI. No alcohol, no cooked food." },
    ],
    customInstructions: "You are the counter at Raghuvanshi Stores, MG Main Road near Sujata Cinema Chowk, Hindpiri, Ranchi 834001. Help with atta, dal, oil, rice, tea, ghee, salt, sugar, and milk. Open 8:00–21:00 every day. Prices in rupees. Pickup at the shop. Loose grain is weighed; do not invent a brand that is not on the shelf. Never invent a rating or a second branch.",
    tone: "warm",
}

export const FIRAYALAL_NXT: DemoShop = {
    flavor: "BOUTIQUE",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "firayalal-nxt",
    name: "Firayalal Nxt",
    headline: "Sarees and ladies wear at Argora Chowk — bridal, festive, and the everyday drape.",
    bio: `Firayalal Nxt is a saree and ladies-wear floor on the ground at Argora Chowk, Ranchi 834002, opposite Punjab National Bank, Ashok Nagar. Ranchi families have used the Firayalal name for weddings and festivals; this floor opened in 2014 for bridal heirlooms, festive silks, and lighter cottons.

Banarasi, Kanjivaram, kurta sets, lehengas, and a rack of men’s and kids’ ethnic sit with the drapes. Stylists keep pieces ready if you WhatsApp the occasion, the budget, and a size before you walk in. Alteration stays with the garment; pickup at Argora.

Open every day 10:00–21:00. WhatsApp 92048 05839. Landline 0651-2243717.`,
    welcome: "Tell us the occasion, the size, and whether you want a saree or a set.",
    speakerName: "Firayalal floor",
    speakerRole: "stylist",
    whatsapp: "919204805839",
    deliveryNote: "Pickup at Argora Chowk, opposite PNB Ashok Nagar. Alteration stays with the piece. Ready-to-wear sets go the same day if the size is on the rack.",
    imageUrl: photo.mira,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Ground Floor, Firayalal Nxt, Argora Chowk, opposite Punjab National Bank, Ashok Nagar, Ranchi 834002",
            line1: "Ground Floor, Argora Chowk, opposite PNB Ashok Nagar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919204805839", display: "092048 05839" },
        categories: ["Boutique", "Sarees", "Ladies wear"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Firayalal+Nxt+Argora+Chowk+Ranchi",
    },
    hours: everydayHours("10:00", "21:00"),
    products: [
        { title: "Cotton kurti", description: "Everyday cotton, three-quarter sleeve. Size M and L on the rack; S and XL on request.", category: "Kurtis", priceRupees: 890, sku: "FN-KURTI-M", stock: 12, thumbnailUrl: photo.mira, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", highlights: ["Size M–L on rack"] },
        { title: "Kurta palazzo set", description: "Printed kurta with palazzo. Size M. Dupatta in the set.", category: "Sets", priceRupees: 1890, sku: "FN-SET-M", stock: 8, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Banarasi katan saree", description: "Katan silk, zari pallu, kadhua butis. Bridal and festive. Blouse piece attached.", category: "Sarees", priceRupees: 12500, sku: "FN-BAN-KATAN", stock: 4, thumbnailUrl: photo.mira, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Kanjivaram silk saree", description: "Temple border, heavy pallu. Try on the floor; we keep the blouse measurement.", category: "Sarees", priceRupees: 18500, sku: "FN-KANJIV", stock: 3, thumbnailUrl: photo.lamp, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Handloom cotton saree", description: "Light drape for a festive Saturday. Contrast border.", category: "Sarees", priceRupees: 2450, sku: "FN-COTTON-SR", stock: 9, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Silk dupatta", description: "Plain silk, 2.5 m. Matches the kurta sets.", category: "Dupattas", priceRupees: 650, sku: "FN-DUP-SILK", stock: 16, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Festive lehenga", description: "Lehenga, choli, and dupatta. Size 38 choli on the rack. Other sizes need two days.", category: "Lehengas", priceRupees: 8500, sku: "FN-LEH-38", stock: 3, thumbnailUrl: photo.mira, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Men's cotton kurta", description: "Straight kurta, size 40 and 42. White and ivory.", category: "Men", priceRupees: 1490, sku: "FN-MEN-40", stock: 10, thumbnailUrl: photo.arjun, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Kids festive set", description: "Kurta and pyjama, ages 4–6. One set on the rack in marigold.", category: "Kids", priceRupees: 1290, sku: "FN-KIDS-4", stock: 6, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Blouse piece 1m", description: "Matching silk for the Banarasi and Kanjivaram. Stitch at the floor or take home.", category: "Stitching", priceRupees: 450, sku: "FN-BLOUSE-1", stock: 20, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Firayalal Nxt", rawText: "Firayalal Nxt, ground floor, Argora Chowk, Ranchi 834002, opposite Punjab National Bank, Ashok Nagar. Sarees, ladies wear, lehengas, men’s and kids’ ethnic. Open 10:00–21:00 every day. WhatsApp 92048 05839. Landline 0651-2243717. Pickup at Argora. Alteration with the garment." },
        { type: "FAQ", title: "Size and pickup", rawText: "Kurtis and sets: M and L on the rack; S and XL on request. Lehenga choli size 38 on the floor; other sizes need two days. Bridal sarees stay in the cupboard until you confirm. WhatsApp the occasion before you come and we will keep a shortlist. Cash, card, UPI. No national-chain labels on this floor." },
    ],
    customInstructions: "You are the floor at Firayalal Nxt, Argora Chowk, Ranchi 834002, opposite PNB Ashok Nagar. Help with sarees, kurtis, sets, lehengas, men’s kurtas, and kids’ festive wear. Open 10:00–21:00 every day. Prices in rupees. Ask for size and occasion. Pickup at Argora. Do not invent a size that is not on the rack. Never send people to Pantaloons, Taneira, or a mall chain.",
    tone: "warm",
}

export const PAUL_OPTICS: DemoShop = {
    flavor: "OPTICS",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "paul-optics",
    name: "Paul Optics",
    headline: "Frames and lenses on Hazaribagh Road, Tharpakhna — an independent counter since 1986.",
    bio: `Paul Optics works the first floor at Uday Complex, 84 Hazaribagh Road, Tharpakhna, Ranchi 834001. The same family counter has been fitting Ranchi spectacles since 1986 — frames on the tray, lenses cut downstairs, and a case in the bag.

Full-rim acetate, metal half-rim, kids’ frames, sunglasses, and CR-39 or blue-cut pairs. Bring last year’s prescription or sit for a check; ready frames go the same afternoon if the power is ordinary. Progressive and high-index need a day.

Open every day 10:00–20:00. Call 94311 69384.`,
    welcome: "Bring the prescription, or ask which frames are on the tray today.",
    speakerName: "Paul Optics counter",
    speakerRole: "optician",
    whatsapp: "919431169384",
    deliveryNote: "Pickup at Uday Complex, Hazaribagh Road, Tharpakhna. Ordinary powers same afternoon; progressive lenses the next day.",
    imageUrl: photo.lamp,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "1st Floor, Uday Complex, 84 Hazaribagh Road, Tharpakhna, Ranchi 834001",
            line1: "Uday Complex, 84 Hazaribagh Road, Tharpakhna",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919431169384", display: "094311 69384" },
        categories: ["Optician", "Spectacles", "Lenses"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Paul+Optics+Hazaribagh+Road+Tharpakhna+Ranchi",
    },
    hours: everydayHours("10:00", "20:00"),
    products: [
        { title: "Full-rim acetate frame", description: "Everyday plastic rim, medium bridge. Try on at the tray; lenses extra.", category: "Frames", priceRupees: 1450, sku: "PO-ACE-FULL", stock: 14, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Metal half-rim frame", description: "Light metal, half-rim. Good for office wear.", category: "Frames", priceRupees: 1890, sku: "PO-MET-HALF", stock: 10, thumbnailUrl: photo.mira, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Kids' frame", description: "Flexible temple, size 44. Comes with a hard case.", category: "Frames", priceRupees: 980, sku: "PO-KIDS-44", stock: 8, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Sunglasses", description: "UV400, brown and grey tints. No prescription in this pair.", category: "Sunglasses", priceRupees: 1290, sku: "PO-SUN-UV", stock: 12, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "CR-39 lens pair", description: "Single vision, index 1.5. Ordinary power, same afternoon if we have the blank.", category: "Lenses", priceRupees: 650, sku: "PO-CR39", stock: 20, thumbnailUrl: photo.plates, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Blue-cut lens pair", description: "Single vision with blue filter. Bring the power. Ready next morning if cut after 4pm.", category: "Lenses", priceRupees: 1450, sku: "PO-BLUE", stock: 16, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Progressive lens pair", description: "Office-to-distance. Needs a fitting. One working day.", category: "Lenses", priceRupees: 4200, sku: "PO-PROG", stock: 6, thumbnailUrl: photo.lamp, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Monthly contact lens pair", description: "Soft monthly, standard base curve. Bring the brand you already wear; we will match the box.", category: "Contacts", priceRupees: 890, sku: "PO-CL-MON", stock: 18, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Hard spectacle case", description: "Clamshell case, one with every new frame or sold on its own.", category: "Accessories", priceRupees: 120, sku: "PO-CASE", stock: 30, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Lens cloth and spray", description: "Microfibre cloth and 30ml spray. Keep it in the case.", category: "Accessories", priceRupees: 90, sku: "PO-CLEAN", stock: 40, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Paul Optics", rawText: "Paul Optics, 1st floor, Uday Complex, 84 Hazaribagh Road, Tharpakhna, Ranchi 834001. Independent optician since 1986. Frames, sunglasses, CR-39, blue-cut, progressive lenses, monthly contacts. Open 10:00–20:00 every day. Phone 94311 69384. Pickup at Tharpakhna." },
        { type: "FAQ", title: "Prescriptions and timing", rawText: "Bring last year’s prescription or sit for a check at the counter. Ordinary single-vision lenses the same afternoon. Progressive and high-index need a day. We are not Lenskart or Titan Eye+; stock is the tray in Tharpakhna. Cash, card, UPI." },
    ],
    customInstructions: "You are the counter at Paul Optics, Uday Complex, 84 Hazaribagh Road, Tharpakhna, Ranchi 834001. Help with frames, lenses, sunglasses, and contact-lens boxes. Open 10:00–20:00 every day. Prices in rupees. Ordinary powers same afternoon; progressives next day. Never invent a power or send people to Lenskart, Titan Eye+, or Himalaya Optical. Pickup at Tharpakhna.",
    tone: "calm",
}

export const MANOJ_MALAKAR_FLORIST: DemoShop = {
    flavor: "FLORIST",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "manoj-malakar-florist",
    name: "Manoj Malakar Flower Shop",
    headline: "Cut flowers and garlands on Kutchery Road — bunches from the morning crate.",
    bio: `Manoj Malakar Flower Shop sits on Kutchery Road, near Kali Mandir and the SBI main branch, Ranchi 834001. It is a Malakar family flower counter — roses, marigold, lily, and the garlands Ranchi still buys for pooja and the car.

The crate opens early. Red rose bunches, mixed wraps, marigold mala, and a sympathy wreath if you call before noon. Same-day pickup at Kutchery; say the time and we will hold the wrap in water.

Open every day 7:00–21:00. Call 93863 64428.`,
    welcome: "Ask for a rose bunch, a garland, or a wrap to pick up today.",
    speakerName: "Malakar counter",
    speakerRole: "florist",
    whatsapp: "919386364428",
    deliveryNote: "Pickup at Kutchery Road, near Kali Mandir. Same-day wraps held in water until 21:00. Car garlands need two hours.",
    imageUrl: photo.vase,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Near SBI Main Branch, near Kali Mandir, Kutchery Road, Ranchi 834001",
            line1: "Kutchery Road, near Kali Mandir",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919386364428", display: "093863 64428" },
        categories: ["Florist", "Garlands", "Bouquets"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Manoj+Malakar+Flower+Shop+Kutchery+Road+Ranchi",
    },
    hours: everydayHours("07:00", "21:00"),
    products: [
        { title: "Red rose bunch (12)", description: "Twelve red roses, cut in the morning, wrapped with greens. Pickup the same day.", category: "Bunches", priceRupees: 450, sku: "MM-ROSE-12", stock: 18, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Mixed bouquet", description: "Rose, lily, and filler. Paper wrap. Tell us the colour if it is for a hospital or a house.", category: "Bouquets", priceRupees: 650, sku: "MM-MIX-BQ", stock: 12, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Marigold garland", description: "Genda mala for pooja and the door. Made when you ask; twenty minutes.", category: "Garlands", priceRupees: 180, sku: "MM-GENDA", stock: 24, thumbnailUrl: photo.plates, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Rose garland", description: "Car and varmala. Needs two hours. Say the time of the baraat.", category: "Garlands", priceRupees: 850, sku: "MM-ROSE-MALA", stock: 8, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Lily bunch", description: "Six stems, white. Keep upright.", category: "Bunches", priceRupees: 420, sku: "MM-LILY-6", stock: 10, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Orchid wrap", description: "Two sprays in a wrap. For a desk or a visit.", category: "Bouquets", priceRupees: 780, sku: "MM-ORCH", stock: 6, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Carnation bunch (10)", description: "Ten stems, mixed pink. Lasts on the table.", category: "Bunches", priceRupees: 280, sku: "MM-CARN-10", stock: 14, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Lotus for pooja (4)", description: "Four lotus, morning stock. Ask before 11am.", category: "Pooja", priceRupees: 160, sku: "MM-LOTUS-4", stock: 10, thumbnailUrl: photo.plates, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Table vase arrangement", description: "Low bowl, mixed cut flowers, for a hall table. Pickup in a crate.", category: "Arrangements", priceRupees: 1200, sku: "MM-VASE", stock: 4, thumbnailUrl: photo.vase, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Sympathy wreath", description: "White and green. Call before noon for the same evening.", category: "Arrangements", priceRupees: 1500, sku: "MM-WREATH", stock: 3, thumbnailUrl: photo.store, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Manoj Malakar", rawText: "Manoj Malakar Flower Shop, Kutchery Road, near Kali Mandir and SBI main branch, Ranchi 834001. Cut flowers, garlands, wraps, and wreaths. Open 7:00–21:00 every day. Phone 93863 64428. Same-day pickup. Morning crate for lotus and loose stems." },
        { type: "FAQ", title: "Same-day wraps", rawText: "Rose bunches and mixed bouquets are same-day if you ask before 6pm. Rose garlands need two hours. Lotus is morning stock. Wreaths before noon. We are not Ferns N Petals; this is the Kutchery Road crate. Cash, UPI." },
    ],
    customInstructions: "You are the counter at Manoj Malakar Flower Shop, Kutchery Road, near Kali Mandir, Ranchi 834001. Help with bunches, garlands, wraps, and wreaths. Open 7:00–21:00 every day. Prices in rupees. Same-day pickup; rose garlands need two hours; lotus before 11am. Never invent a colour that is not in the crate. Never send people to Ferns N Petals.",
    tone: "warm",
}

export const MUKESH_XEROX: DemoShop = {
    flavor: "PRINT_SHOP",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "mukesh-xerox",
    name: "New Mukesh Xerox",
    headline: "Copies, spirals, and cards at Kutchery Chowk — the Radium Road print counter.",
    bio: `New Mukesh Xerox sits in Saraswati Complex, near Mamta Medical, Kutchery Chowk, Radium Road, Ranchi 834001. Students and offices come here for xerox, colour prints, spiral binding, lamination, visiting cards, and a flex when the function is this week.

Bring a pen drive or WhatsApp the file. Black-and-white A4 is the everyday job; colour and cards take a queue. Passport photos while you wait if the booth is free.

Open every day 10:00–21:00. Call 94315 21882.`,
    welcome: "Send the file, the size, and whether it is copy, colour, or cards.",
    speakerName: "Mukesh counter",
    speakerRole: "printer",
    whatsapp: "919431521882",
    deliveryNote: "Pickup at Saraswati Complex, Kutchery Chowk. Pen drive or WhatsApp the PDF. Cards need four hours.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Saraswati Complex, near Mamta Medical, Kutchery Chowk, Radium Road, Ranchi 834001",
            line1: "Saraswati Complex, Kutchery Chowk, Radium Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919431521882", display: "094315 21882" },
        categories: ["Print shop", "Xerox", "Binding"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=New+Mukesh+Xerox+Kutchery+Chowk+Ranchi",
    },
    hours: everydayHours("10:00", "21:00"),
    products: [
        { title: "B/W A4 xerox (100 pages)", description: "Single-side black copies from a PDF. Duplex if you ask. Pickup when the job ends.", category: "Copies", priceRupees: 180, sku: "MX-BW-100", stock: 40, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Colour A4 (20 pages)", description: "Inkjet colour on 70gsm. Charts and forms.", category: "Prints", priceRupees: 240, sku: "MX-COL-20", stock: 25, thumbnailUrl: photo.plates, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "A3 colour print", description: "One A3 sheet, poster or drawing. Ask if the plotter is free.", category: "Prints", priceRupees: 45, sku: "MX-A3-1", stock: 50, thumbnailUrl: photo.plates, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Spiral binding", description: "A4 notes, plastic spiral, transparent cover. Bring the stack or we print then bind.", category: "Finishing", priceRupees: 80, sku: "MX-SPIRAL", stock: 30, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "A4 lamination", description: "Hot pouch, one sheet. Certificates and ID.", category: "Finishing", priceRupees: 25, sku: "MX-LAM-A4", stock: 60, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Visiting cards (100)", description: "Single-side, 300gsm, colour. Four hours if the file is print-ready.", category: "Cards", priceRupees: 280, sku: "MX-VC-100", stock: 15, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Passport photo sheet", description: "Eight photos on one sheet. Booth on the floor.", category: "Photos", priceRupees: 80, sku: "MX-PP-8", stock: 40, thumbnailUrl: photo.mira, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Flex banner 3x2 ft", description: "Star flex, eyeleted. File in PDF. Same evening if you send before 2pm.", category: "Flex", priceRupees: 450, sku: "MX-FLEX-32", stock: 10, thumbnailUrl: photo.store, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Letterhead pad (100)", description: "A4 letterhead, one-colour or full colour. Bring the logo as PDF.", category: "Stationery", priceRupees: 420, sku: "MX-LH-100", stock: 8, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Wedding card pack (50)", description: "Single-fold card with envelope. File and paper choice at the counter. Two days.", category: "Cards", priceRupees: 1800, sku: "MX-WED-50", stock: 5, thumbnailUrl: photo.mira, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About New Mukesh Xerox", rawText: "New Mukesh Xerox, Saraswati Complex, near Mamta Medical, Kutchery Chowk, Radium Road, Ranchi 834001. Xerox, colour prints, spiral, lamination, visiting cards, passport photos, flex, letterheads. Open 10:00–21:00 every day. Phone 94315 21882. Pickup at Kutchery Chowk." },
        { type: "FAQ", title: "Files and timing", rawText: "WhatsApp a PDF or bring a pen drive. B/W copies while you wait. Visiting cards four hours. Flex the same evening if the file is in before 2pm. Wedding cards two days. We print what you send; we do not design a logo from scratch. Cash, UPI." },
    ],
    customInstructions: "You are the counter at New Mukesh Xerox, Saraswati Complex, Kutchery Chowk, Radium Road, Ranchi 834001. Help with xerox, colour prints, spiral, lamination, cards, passport photos, and flex. Open 10:00–21:00 every day. Prices in rupees. Ask for size and a PDF. Pickup at the shop. Never invent a finish that is not on the board.",
    tone: "direct",
}

export const ARMONIA_LALPUR: DemoShop = {
    flavor: "SHOP",
    engine: "SHOP",
    goal: "SELL_PRODUCTS",
    slug: "armonia-lalpur",
    name: "Armonia Decor & Gifts",
    headline: "Lamps, vases, and gifts on Circular Road, Lalpur — the H Square floor opposite Westside.",
    bio: `Armonia Decor & Gifts is on the ground floor of H Square, Circular Road, Lalpur, Ranchi 834001, opposite Westside. The floor is lamps, vases, mugs, cushions, clocks, and the wrapped gift Ranchi takes to a new house.

Wall art, candle stands, crockery, and a few small furniture pieces sit with the gifting table. Pick up at Lalpur; a vase goes in a crate if you ask. Cash, card, UPI.

Open every day 10:00–21:00. Call 94709 59090. Instagram armonia_ranchi.`,
    welcome: "Ask for a lamp, a vase, a mug pair, or a gift to wrap today.",
    speakerName: "Armonia floor",
    speakerRole: "shop",
    whatsapp: "919470959090",
    deliveryNote: "Pickup at H Square, Circular Road, Lalpur, opposite Westside. Vases and lamps in a crate. Gifts wrapped at the desk.",
    imageUrl: photo.vase,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Ground Floor, H Square, Circular Road, opposite Westside, Lalpur, Ranchi 834001",
            line1: "Ground Floor, H Square, Circular Road, opposite Westside",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919470959090", display: "094709 59090" },
        categories: ["Home decor", "Gifts", "Lighting"],
    },
    socials: {
        instagram: "https://www.instagram.com/armonia_ranchi/",
        maps: "https://www.google.com/maps/search/?api=1&query=Armonia+Decor+Gifts+H+Square+Lalpur+Ranchi",
    },
    hours: everydayHours("10:00", "21:00"),
    products: [
        { title: "Ceramic vase", description: "Glazed floor vase, about 30 cm. For cut flowers or dry stems. Crate on request.", category: "Vases", priceRupees: 1890, sku: "AR-VASE-30", stock: 8, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Table lamp", description: "Ceramic base, linen shade. Plug-in, warm bulb included.", category: "Lighting", priceRupees: 2450, sku: "AR-LAMP-T", stock: 6, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Coffee mug pair", description: "Two stoneware mugs. Gift box at the desk.", category: "Crockery", priceRupees: 780, sku: "AR-MUG-2", stock: 14, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Canvas tote", description: "Heavy canvas, one pocket. For the market or as a wrap for a smaller gift.", category: "Gifts", priceRupees: 650, sku: "AR-TOTE", stock: 16, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Wall clock", description: "Silent sweep, 30 cm face. Battery not in the box — ask at the desk.", category: "Wall", priceRupees: 1290, sku: "AR-CLOCK-30", stock: 9, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Candle stand pair", description: "Brass-finish pair for dinner tapers. Candles extra.", category: "Table", priceRupees: 980, sku: "AR-CANDLE-2", stock: 11, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Cushion 16 inch", description: "Printed cover with filler. Two on a sofa.", category: "Soft", priceRupees: 890, sku: "AR-CUSH-16", stock: 12, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Planter bowl", description: "Ceramic bowl for a table plant. Plant not included.", category: "Planters", priceRupees: 720, sku: "AR-PLANTER", stock: 10, thumbnailUrl: photo.vase, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Photo frame 5x7", description: "Standing frame, glass front. Two finishes on the shelf.", category: "Frames", priceRupees: 540, sku: "AR-FRAME-57", stock: 18, thumbnailUrl: photo.mira, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Buddha figurine", description: "Resin, about 20 cm. For a shelf or a gift.", category: "Figurines", priceRupees: 1150, sku: "AR-BUDDHA-20", stock: 7, thumbnailUrl: photo.arjun, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Armonia Lalpur", rawText: "Armonia Decor & Gifts, ground floor, H Square, Circular Road, opposite Westside, Lalpur, Ranchi 834001. Lamps, vases, mugs, totes, clocks, cushions, planters, frames. Open 10:00–21:00 every day. Phone 94709 59090. Instagram armonia_ranchi. Pickup at Lalpur. Gifts wrapped at the desk." },
        { type: "FAQ", title: "Wrapping and crates", rawText: "Mugs and frames go in a gift box. Vases and lamps go in a crate if you are on a bike. We wrap at the desk; say the occasion. This is the Lalpur floor — not the Kolkata shop. Cash, card, UPI." },
    ],
    customInstructions: "You are the floor at Armonia Decor & Gifts, H Square, Circular Road, Lalpur, Ranchi 834001, opposite Westside. Help with lamps, vases, mugs, totes, clocks, cushions, and gifts. Open 10:00–21:00 every day. Prices in rupees. Pickup at Lalpur. Wrap at the desk. Never send people to Kolkata, Fabindia, or a mall chain. Never invent a piece that is not on the shelf.",
    tone: "warm",
}

export const SANJIVANI_MEDICO: DemoShop = {
    flavor: "PHARMACY",
    engine: "PHARMACY",
    goal: "SELL_PRODUCTS",
    slug: "sanjivani-medico",
    name: "Sanjivani Medico",
    headline: "Neighbourhood pharmacy at Harmu Bypass — fever, cold, and the prescription on the counter.",
    bio: `Sanjivani Medico is in Pradeep Complex, Bypass, near Sahjanand Chowk, Harmu Housing Colony, Harmu, Ranchi 834002. It is a neighbourhood pharmacy — strips, syrups, and ointments with batch and expiry on the pack, billed over the counter.

Bring the prescription for antibiotics and other Rx stock. OTC fever, cold, ORS, and antiseptic go without a slip. Pickup at Harmu; we do not diagnose from chat.

Open Monday to Saturday 10:00–20:00. Closed Sunday. Call 93340 63575.`,
    welcome: "Ask for a medicine, the batch, or whether we need the prescription.",
    speakerName: "Sanjivani counter",
    speakerRole: "pharmacist",
    whatsapp: "919334063575",
    deliveryNote: "Pickup at Pradeep Complex, Harmu Bypass, near Sahjanand Chowk. Rx strips need a photo of the prescription or a short note with the doctor’s name. Closed Sunday.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Pradeep Complex, Bypass, near Sahjanand Chowk, Harmu Housing Colony, Harmu, Ranchi 834002",
            line1: "Pradeep Complex, Bypass, near Sahjanand Chowk, Harmu Housing Colony",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919334063575", display: "093340 63575" },
        categories: ["Pharmacy", "Medicines"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Sanjivani+Medico+Pradeep+Complex+Harmu+Ranchi",
    },
    hours: weekdaysHours("10:00", "20:00"),
    products: [
        { title: "Paracetamol 650", description: "Strip of 10. Fever and pain. OTC. Batch and expiry on the foil.", category: "Fever", priceRupees: 28, sku: "SM-PCM-650", stock: 40, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("PCM2408", "2027-08-01", 32) },
        { title: "Dolo 650", description: "Strip of 15. Paracetamol 650 mg. OTC.", category: "Fever", priceRupees: 32, sku: "SM-DOLO-650", stock: 28, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("DLO2511", "2027-11-01", 36) },
        { title: "Amoxicillin 500", description: "Capsule strip. Antibiotic. Prescription required.", category: "Antibiotic", priceRupees: 85, sku: "SM-AMX-500", stock: 18, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("AMX2311", "2027-10-15", 92, true) },
        { title: "Azithromycin 500", description: "Three-tablet pack. Prescription required.", category: "Antibiotic", priceRupees: 95, sku: "SM-AZI-500", stock: 12, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("AZI2502", "2027-09-30", 108, true) },
        { title: "Cetirizine 10", description: "Strip of 10. Allergy. OTC.", category: "Allergy", priceRupees: 22, sku: "SM-CET-10", stock: 35, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("CET2406", "2027-12-01", 26) },
        { title: "Cough syrup 100ml", description: "Bottle, measuring cup in the pack. OTC. Keep upright.", category: "Cold", priceRupees: 120, sku: "SM-COU-100", stock: 12, thumbnailUrl: photo.lassi, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("COU2501", "2027-06-20", 135) },
        { title: "ORS lemon 21g", description: "One sachet. Mix in a glass of water. OTC.", category: "Hydration", priceRupees: 18, sku: "SM-ORS-21", stock: 48, thumbnailUrl: photo.lassi, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("ORS2504", "2028-01-15", 22) },
        { title: "Pantoprazole 40", description: "Strip of 10. Acidity. OTC at this counter; ask if you already take other tablets.", category: "Acidity", priceRupees: 75, sku: "SM-PAN-40", stock: 22, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("PAN2409", "2027-09-01", 82) },
        { title: "Calcium D3", description: "Strip of 15. Supplement. OTC.", category: "Supplement", priceRupees: 110, sku: "SM-CAL-D3", stock: 16, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("CAL2503", "2027-07-01", 125) },
        { title: "Povidone iodine 15g", description: "Antiseptic ointment tube. OTC. For small cuts.", category: "Antiseptic", priceRupees: 85, sku: "SM-PVP-15", stock: 14, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("PVP2505", "2028-03-01", 95) },
        { title: "Metformin 500", description: "Strip of 10. Prescription required.", category: "Diabetes", priceRupees: 42, sku: "SM-MET-500", stock: 20, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: medicine("MET2412", "2027-12-20", 48, true) },
    ],
    documents: [
        { type: "BIO", title: "About Sanjivani Medico", rawText: "Sanjivani Medico, Pradeep Complex, Bypass, near Sahjanand Chowk, Harmu Housing Colony, Harmu, Ranchi 834002. Neighbourhood pharmacy. Physical medicines with batch and expiry. Open Monday–Saturday 10:00–20:00. Closed Sunday. Phone 93340 63575. Pickup at Harmu. Rx stock needs a prescription photo or a short note." },
        { type: "FAQ", title: "OTC, Rx, and Sunday", rawText: "Paracetamol, cetirizine, ORS, cough syrup, iodine, and calcium are OTC. Amoxicillin, azithromycin, and metformin need a prescription — send a photo or the doctor’s name in chat. We do not diagnose. Closed Sunday. This is Harmu Bypass, not Ratu Road Sanjivani Medicare." },
    ],
    customInstructions: "You are the counter at Sanjivani Medico, Pradeep Complex, Harmu Bypass, near Sahjanand Chowk, Harmu Housing Colony, Ranchi 834002. Help with physical medicines, batch, expiry, and pickup. Open Monday–Saturday 10:00–20:00. Closed Sunday. Prices in rupees. OTC can go; Rx (amoxicillin, azithromycin, metformin) needs a prescription photo or a short note. Never diagnose. Never invent stock. Never send people to Ratu Road or a chain chemist.",
    tone: "calm",
}

export const PARAS_AUTO: DemoShop = {
    flavor: "AUTO_PARTS",
    engine: "AUTO_PARTS",
    goal: "SELL_PRODUCTS",
    slug: "paras-auto",
    name: "Paras Auto",
    headline: "Spare parts on Namkum Main Road, Doranda — ask with make, model, and year.",
    bio: `Paras Auto is on Namkum Main Road at Kusai, Doranda, Ranchi 834002. It is a counter for car parts that fit — pads, filters, batteries, hoses, and a clutch plate if the year matches.

Say the make, the model, and the year before we pull a box. Maruti, Hyundai, Tata, Honda, and Mahindra are the everyday bins. Pickup at Doranda; we do not fit the part here.

Open Monday to Saturday 8:00–20:00. Closed Sunday. Call 99391 85887.`,
    welcome: "Give make, model, and year. We will tell you if the part is in the bin.",
    speakerName: "Paras counter",
    speakerRole: "parts",
    whatsapp: "919939185887",
    deliveryNote: "Pickup at Namkum Main Road, Kusai, Doranda. Bring the old part if you can. Closed Sunday. We sell the box; we do not fit it.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Namkum Main Road, Kusai, Doranda, Ranchi 834002",
            line1: "Namkum Main Road, Kusai, Doranda",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919939185887", display: "099391 85887" },
        categories: ["Auto parts", "Car spares"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Paras+Auto+Namkum+Main+Road+Doranda+Ranchi",
    },
    hours: weekdaysHours("08:00", "20:00"),
    products: [
        { title: "Front brake pad", description: "Fits Maruti Swift 2018–2024. Pair for the front axle. Bring the old pad if the year is unclear.", category: "Brakes", priceRupees: 1450, sku: "PA-BP-SWIFT", stock: 8, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Maruti", "Swift", 2018, 2024) },
        { title: "Oil filter", description: "Fits Hyundai i20 2015–2023. Spin-on. Match the old filter thread.", category: "Filters", priceRupees: 280, sku: "PA-OF-I20", stock: 20, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Hyundai", "i20", 2015, 2023) },
        { title: "Battery 35Ah", description: "Fits Maruti Alto 2012–2020. 35Ah, left polarity. Exchange the old battery at the counter.", category: "Electrical", priceRupees: 3850, sku: "PA-BAT-ALTO", stock: 4, thumbnailUrl: photo.store, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Maruti", "Alto", 2012, 2020) },
        { title: "Air filter", description: "Fits Tata Nexon 2020–2024. Panel filter. Tap the dust out only if you are between services.", category: "Filters", priceRupees: 420, sku: "PA-AF-NEXON", stock: 12, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Tata", "Nexon", 2020, 2024) },
        { title: "Wiper blade pair", description: "Fits Honda City 2014–2021. Driver and passenger lengths in the pack.", category: "Body", priceRupees: 390, sku: "PA-WP-CITY", stock: 15, thumbnailUrl: photo.brand, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Honda", "City", 2014, 2021) },
        { title: "Clutch plate", description: "Fits Mahindra Bolero 2011–2019. Driven plate only; pressure plate extra if you ask.", category: "Clutch", priceRupees: 1850, sku: "PA-CP-BOLERO", stock: 5, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Mahindra", "Bolero", 2011, 2019) },
        { title: "Spark plug set (4)", description: "Fits Maruti Swift 2018–2024. Four plugs. Gap as marked on the box.", category: "Engine", priceRupees: 640, sku: "PA-SP-SWIFT", stock: 10, thumbnailUrl: photo.mug, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Maruti", "Swift", 2018, 2024) },
        { title: "Radiator hose", description: "Fits Hyundai i20 2015–2023. Upper hose. Clamp not in the bag unless you ask.", category: "Cooling", priceRupees: 310, sku: "PA-RH-I20", stock: 9, thumbnailUrl: photo.lassi, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Hyundai", "i20", 2015, 2023) },
        { title: "Brake disc", description: "Fits Tata Nexon 2020–2024. Front disc, one side. Pair them if both are scored.", category: "Brakes", priceRupees: 2100, sku: "PA-BD-NEXON", stock: 6, thumbnailUrl: photo.lamp, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Tata", "Nexon", 2020, 2024) },
        { title: "Cabin filter", description: "Fits Honda City 2014–2021. Pollen filter behind the glove box.", category: "Filters", priceRupees: 350, sku: "PA-CF-CITY", stock: 14, thumbnailUrl: photo.tote, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: fitment("Honda", "City", 2014, 2021) },
    ],
    documents: [
        { type: "BIO", title: "About Paras Auto", rawText: "Paras Auto, Namkum Main Road, Kusai, Doranda, Ranchi 834002. Car parts by make, model, and year. Open Monday–Saturday 8:00–20:00. Closed Sunday. Phone 99391 85887. Pickup at Doranda. We sell the box; we do not fit it on the car." },
        { type: "FAQ", title: "Fitment", rawText: "Always give make, model, and year. Swift pads are 2018–2024; i20 filters 2015–2023; Alto battery 2012–2020; Nexon air filter 2020–2024; City wipers 2014–2021; Bolero clutch 2011–2019. If the year is outside the range, say so — we will not force a box. Closed Sunday." },
    ],
    customInstructions: "You are the counter at Paras Auto, Namkum Main Road, Kusai, Doranda, Ranchi 834002. Help with parts that fit a make, model, and year. Open Monday–Saturday 8:00–20:00. Closed Sunday. Prices in rupees. Always ask make, model, and year before quoting. Pickup only; we do not fit the part. Never invent a fitment outside the years on the box.",
    tone: "direct",
}

export const MK_JEWELLERS: DemoShop = {
    flavor: "JEWELRY_RETAIL",
    engine: "JEWELRY_RETAIL",
    goal: "SELL_PRODUCTS",
    slug: "mk-jewellers",
    name: "MK Jewellers",
    headline: "22K HUID gold on Main Road — Shop 2, Baba Tower, opposite the Gurudwara.",
    bio: `MK Jewellers is Shop 2, Baba Tower, opposite the Gurudwara on Mahatma Gandhi Main Road, Ranchi 834001. Manoj’s floor has been here since 2001 — 22K HUID gold, 18K diamond mounts, 92.5 silver, and gemstones in the tray.

Price follows today’s Ranchi city board × weight × purity, plus making (about 8–10% on 22K). Old gold comes in on exchange. GST bill with the piece. Coins for gifting sit beside the bangles.

Open every day 10:15–21:15. Call 99052 92254. mkjewellersmkj.com. Instagram @m.k_jewellers_ranchi.`,
    welcome: "Ask for a weight, a purity, or today’s Ranchi board on a bangle or a chain.",
    speakerName: "MK floor",
    speakerRole: "jeweller",
    whatsapp: "919905292254",
    deliveryNote: "Pickup at Shop 2, Baba Tower, opposite the Gurudwara, MG Main Road. Pieces leave with a GST bill. Old gold exchange at the counter.",
    imageUrl: photo.mira,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "Shop 2, Baba Tower, opposite Gurudwara, Mahatma Gandhi Main Road, Ranchi 834001",
            line1: "Shop 2, Baba Tower, opposite Gurudwara, MG Main Road",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+919905292254", display: "099052 92254" },
        categories: ["Jewellery", "Gold", "Diamonds"],
    },
    socials: {
        instagram: "https://www.instagram.com/m.k_jewellers_ranchi/",
        maps: "https://maps.app.goo.gl/EGKdBEczuaobhg116",
    },
    hours: everydayHours("10:15", "21:15"),
    products: [
        { title: "22K light bangle", description: "Hallmarked 22K HUID bangle, 10 g. Ticket is Ranchi city board × weight × purity, plus making.", category: "Bangles", priceRupees: 156000, sku: "MK-BAN-10", stock: 4, thumbnailUrl: photo.lamp, weightGrams: 10, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(10, K22, 14200) },
        { title: "22K rope chain", description: "22K rope chain, 19 g. Making on the bill. Try length at the counter.", category: "Chains", priceRupees: 292000, sku: "MK-CH-19", stock: 2, thumbnailUrl: photo.mira, weightGrams: 19, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(19, K22, 22500) },
        { title: "22K gold studs", description: "Pair of 22K studs, 4 g the pair. Screw back.", category: "Earrings", priceRupees: 62000, sku: "MK-ST-4", stock: 6, thumbnailUrl: photo.lamp, weightGrams: 4, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(4, K22, 5600) },
        { title: "22K gold ring", description: "Plain 22K ring, 6 g. Size adjustable at the bench.", category: "Rings", priceRupees: 93000, sku: "MK-RG-6", stock: 5, thumbnailUrl: photo.brand, weightGrams: 6, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(6, K22, 8500) },
        { title: "22K mangalsutra", description: "Black-bead mangalsutra, 11 g gold. 22K HUID.", category: "Mangalsutra", priceRupees: 171000, sku: "MK-MS-11", stock: 3, thumbnailUrl: photo.mira, weightGrams: 11, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(11, K22, 15600) },
        { title: "22K pendant", description: "Plain 22K pendant, 5 g. Chain extra.", category: "Pendants", priceRupees: 78000, sku: "MK-PD-5", stock: 4, thumbnailUrl: photo.vase, weightGrams: 5, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(5, K22, 7100) },
        { title: "22K kada", description: "Gents 22K kada, 17 g. Openable.", category: "Kadas", priceRupees: 262000, sku: "MK-KD-17", stock: 2, thumbnailUrl: photo.lamp, weightGrams: 17, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(17, K22, 20400) },
        { title: "22K gold coin 8g", description: "22K coin, 8 g. Gifting and pooja. Making is low on coins.", category: "Coins", priceRupees: 114000, sku: "MK-COIN-8", stock: 8, thumbnailUrl: photo.brand, weightGrams: 8, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(8, K22, 800) },
        { title: "18K diamond ring", description: "18K mount, 3 g gold, IGI stone on the bill. Ticket is board on the gold plus the diamond.", category: "Diamonds", priceRupees: 125000, sku: "MK-DIA-3", stock: 2, thumbnailUrl: photo.mira, weightGrams: 3, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(3, K18, 12000) },
        { title: "92.5 silver payal", description: "Hallmarked silver payal, 28 g the pair. Not on the gold board — silver rate at the counter.", category: "Silver", priceRupees: 4200, sku: "MK-SL-PAY-28", stock: 5, thumbnailUrl: photo.tote, weightGrams: 28, allowCod: true, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About MK Jewellers", rawText: "MK Jewellers, Shop 2, Baba Tower, opposite Gurudwara, Mahatma Gandhi Main Road, Ranchi 834001. Independent jeweller since 2001. 22K HUID gold, 18K diamond mounts, 92.5 silver, gemstones. Open 10:15–21:15 every day. Phone 99052 92254. Website mkjewellersmkj.com. Instagram @m.k_jewellers_ranchi. GST bill. Old gold exchange." },
        { type: "FAQ", title: "Board, making, exchange", rawText: "Gold tickets follow today’s Ranchi city board × weight × purity, plus making (about 8–10% on 22K HUID). We never invent a board rate — quote the board on the page. Coins have low making. Old gold 100% exchange value on the gold; silver is a fair counter rate. This is Baba Tower Main Road, not Kalyan, Tanishq, or Senco." },
    ],
    customInstructions: "You are the floor at MK Jewellers, Shop 2, Baba Tower, opposite the Gurudwara, MG Main Road, Ranchi 834001. Help with 22K HUID gold, 18K diamond mounts, silver, and coins. Open 10:15–21:15 every day. Price is today’s Ranchi city board × weight × purity, plus making (about 8–10% on 22K). Quote the board from the facts; never invent a rate, a gram weight, or a making charge. GST bill. Old gold exchange at the counter. Never send people to Kalyan, Tanishq, or Senco.",
    tone: "calm",
}

export const SHRI_RADHE_JEWELLERS: DemoShop = {
    flavor: "JEWELRY_WHOLESALE",
    engine: "JEWELRY_WHOLESALE",
    goal: "COLLECT_LEADS",
    slug: "shri-radhe-jewellers",
    name: "Shri Radhe Jewellers",
    headline: "Trade gold on Sonar Gali, Upper Bazar — 70 touch in, 74 out, cash or udhaar.",
    bio: `Shri Radhe Jewellers is in R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar, Ranchi 834001. It is a trade counter for Ranchi retailers — lots on touch against 24K, not a bridal showroom.

We take metal at about 70 touch and bill shops at about 74. Cash on the lot, or udhaar on the book after we know the shop. WhatsApp the shop name, the GST, and the weight. We do not grant credit from chat.

Open Monday to Saturday 10:00–19:30. Closed Sunday. Call 80920 02235.`,
    welcome: "Shops only. Send the shop name, GST, and the weight you need.",
    speakerName: "Radhe desk",
    speakerRole: "wholesale",
    whatsapp: "918092002235",
    deliveryNote: "Dealer pickup at R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar. Lots on touch. Udhaar only after the book is open — never from chat.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar, Ranchi 834001",
            line1: "R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834001",
            country: "IN",
        },
        phone: { e164: "+918092002235", display: "080920 02235" },
        categories: ["Gold wholesale", "Jewellery trade"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Shri+Radhe+Jewellers+Sonar+Gali+Upper+Bazar+Ranchi",
    },
    hours: weekdaysHours("10:00", "19:30"),
    products: [
        { title: "Light bangle 10g", description: "Trade bangle, about 10 g, 70 touch in the lot. Billed to shops at 74 against 24K. Not a retail making ticket.", category: "Bangles", priceRupees: 115000, sku: "SR-BAN-10", stock: 24, thumbnailUrl: photo.lamp, weightGrams: 10, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(10, 7000, 0) },
        { title: "Rope chain 20g", description: "Trade chain, about 20 g. 74 out to the retailer.", category: "Chains", priceRupees: 230000, sku: "SR-CH-20", stock: 10, thumbnailUrl: photo.mira, weightGrams: 20, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(20, 7000, 0) },
        { title: "Plain kada 16g", description: "Gents kada lot, about 16 g. Touch on the bill.", category: "Kadas", priceRupees: 184000, sku: "SR-KD-16", stock: 8, thumbnailUrl: photo.lamp, weightGrams: 16, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(16, 7000, 0) },
        { title: "Casting chip 50g", description: "Melting chip, about 50 g. For the caster, not the tray.", category: "Casting", priceRupees: 575000, sku: "SR-CHIP-50", stock: 6, thumbnailUrl: photo.brand, weightGrams: 50, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(50, 7000, 0) },
        { title: "24K coin 10g", description: "24K coin, 10 g. Trade gifting stock. Board on 24K, not 22K retail.", category: "Coins", priceRupees: 155000, sku: "SR-COIN-24-10", stock: 12, thumbnailUrl: photo.brand, weightGrams: 10, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(10, K24, 0) },
        { title: "Ear stud lot 4g", description: "Pair lot, about 4 g. 74 out.", category: "Earrings", priceRupees: 46000, sku: "SR-ST-4", stock: 20, thumbnailUrl: photo.lamp, weightGrams: 4, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(4, 7000, 0) },
        { title: "Mangalsutra 12g", description: "Trade mangalsutra, about 12 g gold. Beads on the piece.", category: "Mangalsutra", priceRupees: 138000, sku: "SR-MS-12", stock: 7, thumbnailUrl: photo.mira, weightGrams: 12, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(12, 7000, 0) },
        { title: "Gents chain 22g", description: "Heavy gents chain, about 22 g. Shop order, not walk-in bridal.", category: "Chains", priceRupees: 253000, sku: "SR-GCH-22", stock: 5, thumbnailUrl: photo.arjun, weightGrams: 22, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL", variantsJson: gold(22, 7000, 0) },
    ],
    leadMagnets: [
        { title: "Today's touch and lot list", description: "70 in, 74 out against 24K. WhatsApp the shop name, GST, and the weight." },
    ],
    documents: [
        { type: "BIO", title: "About Shri Radhe Jewellers", rawText: "Shri Radhe Jewellers, R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar, Ranchi 834001. Gold wholesale for retailers. About 70 touch in, 74 out against 24K. Cash or udhaar on the book. Open Monday–Saturday 10:00–19:30. Closed Sunday. Phone 80920 02235. Dealer pickup at Sonar Gali." },
        { type: "FAQ", title: "Touch, cash, udhaar", rawText: "This is a trade counter, not a bridal showroom. Lots are billed on touch against 24K — not the 22K retail board. Udhaar only after the shop is on the book; never grant credit from chat. Send shop name, GST, and weight. Closed Sunday. Not Kalyan, not Tanishq." },
    ],
    customInstructions: "You supply shops from Shri Radhe Jewellers, R.N. Complex, Gandhi Chowk, Sonar Gali, Upper Bazar, Ranchi 834001. Bills are on touch against 24K — about 70 in, 74 out — not the 22K retail board. Open Monday–Saturday 10:00–19:30. Closed Sunday. Take shop name, GST, and weight. Never grant udhaar from chat. Never invent stock or touch. Never quote a bridal making charge. Send trade questions to WhatsApp or the stock page.",
    tone: "direct",
}

export const BALAJI_SALES: DemoShop = {
    flavor: "DISTRIBUTOR",
    engine: "DISTRIBUTOR",
    goal: "SELL_PRODUCTS",
    slug: "balaji-sales-harmu",
    name: "Balaji Sales Corporation",
    headline: "Cement, TMT, and paint from the Harmu Bypass godown — dealer bags and bundles.",
    bio: `Balaji Sales Corporation is at R-365, Bypass Road, near Shiv Mandir, H.H. Colony, Harmu, Ranchi 834002. It is a Ranchi godown for dealers — ACC and UltraTech bags, TMT bundles, emulsion, primer, putty, and binding wire.

Orders are dealer-facing. Send the shop name, the SKU, and the bag or bundle count. Pickup at the Harmu godown; truck out after accounts bills. We do not retail a single bag to a walk-in household.

Open every day 8:00–20:00. Call 94317 67222.`,
    welcome: "Dealer order: shop name, SKU, and how many bags or bundles.",
    speakerName: "Balaji godown",
    speakerRole: "despatch",
    whatsapp: "919431767222",
    deliveryNote: "Dealer pickup at R-365, Bypass Road, H.H. Colony, Harmu, near Shiv Mandir. Truck out after accounts bills. Household walk-ins are not billed here.",
    imageUrl: photo.store,
    shopLogoUrl: photo.brand,
    venue: {
        address: {
            formatted: "R-365, Bypass Road, near Shiv Mandir, H.H. Colony, Harmu, Ranchi 834002",
            line1: "R-365, Bypass Road, near Shiv Mandir, H.H. Colony, Harmu",
            locality: "Ranchi",
            region: "Jharkhand",
            postalCode: "834002",
            country: "IN",
        },
        phone: { e164: "+919431767222", display: "094317 67222" },
        categories: ["Distributor", "Cement", "Steel", "Paint"],
    },
    socials: {
        maps: "https://www.google.com/maps/search/?api=1&query=Balaji+Sales+Corporation+Harmu+Bypass+Ranchi",
    },
    hours: everydayHours("08:00", "20:00"),
    products: [
        { title: "ACC Gold 50kg", description: "PPC bag, 50 kg. Dealer rate at the Harmu godown. Stack by the dozen.", category: "Cement", priceRupees: 415, sku: "BS-ACC-GOLD-50", stock: 180, thumbnailUrl: photo.store, weightGrams: 50000, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "UltraTech PPC 50kg", description: "PPC bag, 50 kg. Godown stock. Ask which lot is on the floor.", category: "Cement", priceRupees: 420, sku: "BS-UT-PPC-50", stock: 140, thumbnailUrl: photo.store, weightGrams: 50000, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Bangur 50kg", description: "PPC bag, 50 kg. Harmu stack.", category: "Cement", priceRupees: 405, sku: "BS-BAN-50", stock: 90, thumbnailUrl: photo.brand, weightGrams: 50000, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "TMT 8mm bundle", description: "8 mm TMT bundle for stirrups and slabs. Count the pieces at the weighbridge.", category: "Steel", priceRupees: 520, sku: "BS-TMT-8", stock: 40, thumbnailUrl: photo.lamp, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "TMT 12mm bundle", description: "12 mm TMT bundle. Dealer rate. Loading at the Harmu yard.", category: "Steel", priceRupees: 685, sku: "BS-TMT-12", stock: 36, thumbnailUrl: photo.lamp, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "TMT 16mm bundle", description: "16 mm TMT bundle for columns. Ask the yard before you send a small truck.", category: "Steel", priceRupees: 890, sku: "BS-TMT-16", stock: 22, thumbnailUrl: photo.store, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Emulsion 20L", description: "Interior emulsion, 20 L bucket. Dealer tint at the counter if the base is in.", category: "Paint", priceRupees: 3100, sku: "BS-EML-20", stock: 24, thumbnailUrl: photo.mug, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Exterior primer 10L", description: "Wall primer, 10 L. Goes with the emulsion order.", category: "Paint", priceRupees: 1450, sku: "BS-PRM-10", stock: 18, thumbnailUrl: photo.lassi, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Wall putty 40kg", description: "White putty bag, 40 kg. Keep dry in the godown bay.", category: "Putty", priceRupees: 980, sku: "BS-PUT-40", stock: 50, thumbnailUrl: photo.brand, weightGrams: 40000, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
        { title: "Binding wire 1kg", description: "Annealed binding wire, 1 kg coil. For the TMT yard.", category: "Steel", priceRupees: 85, sku: "BS-WIRE-1", stock: 80, thumbnailUrl: photo.tote, weightGrams: 1000, allowCod: false, shipMode: "PICKUP", type: "PHYSICAL", fulfillment: "PHYSICAL" },
    ],
    documents: [
        { type: "BIO", title: "About Balaji Sales", rawText: "Balaji Sales Corporation, R-365, Bypass Road, near Shiv Mandir, H.H. Colony, Harmu, Ranchi 834002. Ranchi godown for cement, TMT, paint, and putty. Dealer orders. Open 8:00–20:00 every day. Phone 94317 67222. Pickup at the Harmu godown. Truck out after accounts bills." },
        { type: "FAQ", title: "Dealer orders", rawText: "Send shop name, SKU, and bag or bundle count. ACC Gold, UltraTech PPC, Bangur 50 kg; TMT 8 / 12 / 16 mm; emulsion 20 L; primer 10 L; putty 40 kg; binding wire. We do not retail a single bag to a household walk-in. Loading at Harmu. Cash or billed account — no COD on the yard." },
    ],
    customInstructions: "You are the godown desk at Balaji Sales Corporation, R-365 Bypass Road, H.H. Colony, Harmu, Ranchi 834002, near Shiv Mandir. Help dealers with cement bags, TMT bundles, paint, putty, and binding wire. Open 8:00–20:00 every day. Prices in rupees are dealer rates. Ask for shop name, SKU, and quantity. Pickup at the Harmu godown; truck after accounts bills. Do not sell a household walk-in a single bag. Never invent godown stock.",
    tone: "direct",
}

export const SHOP_SHOPS: DemoShop[] = [
    RAGHUVANSHI_STORES,
    FIRAYALAL_NXT,
    PAUL_OPTICS,
    MANOJ_MALAKAR_FLORIST,
    MUKESH_XEROX,
    ARMONIA_LALPUR,
    SANJIVANI_MEDICO,
    PARAS_AUTO,
    MK_JEWELLERS,
    SHRI_RADHE_JEWELLERS,
    BALAJI_SALES,
]

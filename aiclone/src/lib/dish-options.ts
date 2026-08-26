export type DishChoice = {
    id: string
    name: string
    priceCents: number
}

export type DishGroup = {
    id: string
    label: string
    required?: boolean
    max: number
    options: DishChoice[]
}

function rupees(n: number) {
    return Math.round(n * 100)
}

const SIZE = (regular = 0, large = 40): DishGroup => ({
    id: "size",
    label: "Size",
    required: true,
    max: 1,
    options: [
        { id: "regular", name: "Regular", priceCents: rupees(regular) },
        { id: "large", name: "Large", priceCents: rupees(large) },
    ],
})

const PIZZA_SIZE: DishGroup = {
    id: "size",
    label: "Size",
    required: true,
    max: 1,
    options: [
        { id: "regular", name: "Regular", priceCents: 0 },
        { id: "medium", name: "Medium", priceCents: rupees(50) },
        { id: "large", name: "Large", priceCents: rupees(100) },
    ],
}

const TOPPINGS: DishGroup = {
    id: "toppings",
    label: "Add toppings",
    max: 6,
    options: [
        { id: "cheese", name: "Extra cheese", priceCents: rupees(40) },
        { id: "jalapeno", name: "Jalapeno", priceCents: rupees(30) },
        { id: "olives", name: "Olives", priceCents: rupees(30) },
        { id: "mushroom", name: "Mushroom", priceCents: rupees(40) },
        { id: "paneer", name: "Paneer", priceCents: rupees(60) },
        { id: "chicken", name: "Chicken", priceCents: rupees(80) },
    ],
}

const BURGER_EXTRAS: DishGroup = {
    id: "extras",
    label: "Customise",
    max: 5,
    options: [
        { id: "cheese", name: "Cheese slice", priceCents: rupees(30) },
        { id: "patty", name: "Extra patty", priceCents: rupees(80) },
        { id: "bacon", name: "Chicken bacon", priceCents: rupees(60) },
        { id: "no-onion", name: "No onion", priceCents: 0 },
        { id: "spicy", name: "Make it spicy", priceCents: 0 },
    ],
}

const COFFEE_EXTRAS: DishGroup = {
    id: "extras",
    label: "Customise",
    max: 4,
    options: [
        { id: "shot", name: "Extra shot", priceCents: rupees(20) },
        { id: "oat", name: "Oat milk", priceCents: rupees(20) },
        { id: "vanilla", name: "Vanilla", priceCents: rupees(15) },
        { id: "less-sugar", name: "Less sugar", priceCents: 0 },
    ],
}

const SHAKE_EXTRAS: DishGroup = {
    id: "extras",
    label: "Customise",
    max: 3,
    options: [
        { id: "scoop", name: "Extra scoop", priceCents: rupees(40) },
        { id: "cream", name: "Whipped cream", priceCents: rupees(20) },
        { id: "choco", name: "Chocolate drizzle", priceCents: rupees(20) },
    ],
}

const SPICE: DishGroup = {
    id: "spice",
    label: "Spice",
    max: 1,
    options: [
        { id: "mild", name: "Mild", priceCents: 0 },
        { id: "medium", name: "Medium", priceCents: 0 },
        { id: "hot", name: "Hot", priceCents: 0 },
    ],
}

export function dishGroups(category?: string | null, title?: string | null): DishGroup[] {
    const cat = (category || "").toLowerCase()
    const name = (title || "").toLowerCase()
    if (/pizza/.test(cat) || /pizza/.test(name)) return [PIZZA_SIZE, TOPPINGS]
    if (/pasta|spaghetti/.test(cat) || /pasta|spaghetti|penne|mac/.test(name)) {
        return [SPICE, { ...TOPPINGS, options: TOPPINGS.options.filter((o) => o.id !== "chicken" || /chicken/.test(name)) }]
    }
    if (/burger|sandwich/.test(cat) || /burger|sandwich/.test(name)) return [BURGER_EXTRAS]
    if (/coffee|beverage/.test(cat) || /latte|cappuccino|espresso|americano|mocha|macchiato|chai|tea/.test(name)) return [SIZE(0, 30), COFFEE_EXTRAS]
    if (/shake/.test(cat) || /shake/.test(name)) return [SIZE(0, 40), SHAKE_EXTRAS]
    if (/mocktail/.test(cat)) return [SIZE(0, 30)]
    if (/breakfast|combo/.test(cat)) return [{
        id: "sides",
        label: "Add on",
        max: 3,
        options: [
            { id: "fries", name: "French fries", priceCents: rupees(79) },
            { id: "coke", name: "Soft drink", priceCents: rupees(49) },
            { id: "shake", name: "Shake", priceCents: rupees(99) },
        ],
    }]
    if (/momo/.test(cat)) return [{
        id: "dip",
        label: "Dip",
        max: 2,
        options: [
            { id: "schezwan", name: "Schezwan", priceCents: 0 },
            { id: "mayo", name: "Mayo", priceCents: rupees(15) },
            { id: "extra-dip", name: "Extra chutney", priceCents: rupees(20) },
        ],
    }]
    return []
}

export function extrasTotal(groups: DishGroup[], picked: Record<string, string[]>) {
    let n = 0
    for (const g of groups) {
        for (const id of picked[g.id] || []) {
            n += g.options.find((o) => o.id === id)?.priceCents || 0
        }
    }
    return n
}

export function extrasLabel(groups: DishGroup[], picked: Record<string, string[]>) {
    const names: string[] = []
    for (const g of groups) {
        for (const id of picked[g.id] || []) {
            const o = g.options.find((x) => x.id === id)
            if (o) names.push(o.name)
        }
    }
    return names.join(", ")
}

export function defaultPicks(groups: DishGroup[]): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const g of groups) {
        out[g.id] = g.required && g.options[0] ? [g.options[0].id] : []
    }
    return out
}

export function picksKey(picked: Record<string, string[]>) {
    return Object.keys(picked)
        .sort()
        .map((k) => `${k}:${(picked[k] || []).slice().sort().join("+")}`)
        .join("|")
}

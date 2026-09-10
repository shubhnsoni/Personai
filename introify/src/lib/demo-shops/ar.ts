export type ArDish = {
    key: string
    glb: string
    usdz: string
}

export const AR_DISHES: Record<string, ArDish> = {
    "chicken-burger": {
        key: "chicken-burger",
        glb: "/uploads/skydine-ar/chicken-burger.glb",
        usdz: "/uploads/skydine-ar/chicken-burger.usdz",
    },
    "margherita-pizza": {
        key: "margherita-pizza",
        glb: "/uploads/skydine-ar/margherita-pizza.glb",
        usdz: "/uploads/skydine-ar/margherita-pizza.usdz",
    },
    cappuccino: {
        key: "cappuccino",
        glb: "/uploads/skydine-ar/cappuccino.glb",
        usdz: "/uploads/skydine-ar/cappuccino.usdz",
    },
    "nutella-shake": {
        key: "nutella-shake",
        glb: "/uploads/skydine-ar/nutella-shake.glb",
        usdz: "/uploads/skydine-ar/nutella-shake.usdz",
    },
    "caesar-salad": {
        key: "caesar-salad",
        glb: "/uploads/skydine-ar/caesar-salad.glb",
        usdz: "/uploads/skydine-ar/caesar-salad.usdz",
    },
    "avocado-toast": {
        key: "avocado-toast",
        glb: "/uploads/skydine-ar/avocado-toast.glb",
        usdz: "/uploads/skydine-ar/avocado-toast.usdz",
    },
    "chocolate-brownie": {
        key: "chocolate-brownie",
        glb: "/uploads/skydine-ar/chocolate-brownie.glb",
        usdz: "/uploads/skydine-ar/chocolate-brownie.usdz",
    },
    "veg-momos": {
        key: "veg-momos",
        glb: "/uploads/skydine-ar/veg-momos.glb",
        usdz: "/uploads/skydine-ar/veg-momos.usdz",
    },
    "garlic-bread": {
        key: "garlic-bread",
        glb: "/uploads/skydine-ar/garlic-bread.glb",
        usdz: "/uploads/skydine-ar/garlic-bread.usdz",
    },
    "pancake-stack": {
        key: "pancake-stack",
        glb: "/uploads/skydine-ar/pancake-stack.glb",
        usdz: "/uploads/skydine-ar/pancake-stack.usdz",
    },
}

/** Menu titles on SkyDine that already have a table-ready 3D plate. */
export const SKYDINE_AR_BY_TITLE: Record<string, string> = {
    "Chicken Burger": "chicken-burger",
    "Margherita Pizza": "margherita-pizza",
    Cappuccino: "cappuccino",
    "Nutella Shake": "nutella-shake",
    "Caesar Salad Veg": "caesar-salad",
    "Avocado Toast": "avocado-toast",
    "Chocolate Brownie": "chocolate-brownie",
    "Veg Steam Momo": "veg-momos",
    "Garlic Bread": "garlic-bread",
    "Avocado Toast Combo": "pancake-stack",
}

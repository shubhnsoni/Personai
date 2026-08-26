import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()

const RAW = `
Soup|VEG|Cream Of Tomato|Smooth tomato puree cooked with cream and seasoning|159
Soup|VEG|Veg Burnt Garlic Soup|Smoky garlic broth with lingering savoury heat|169
Soup|VEG|Veg Coriander Soup|Light herbal broth bursting with freshness|159
Soup|VEG|Veg Hot & Sour Soup|Tangy heat with mixed vegetables|169
Soup|VEG|Veg Manchow Soup|Thick Indo-Chinese soup with chopped greens|169
Soup|VEG|Veg Lemon Coriander Soup|Citrus notes and fresh herbs|159
Soup|VEG|Cream Of Mushroom Soup|Velvety mushroom soup|179
Soup|NONVEG|Chicken Burnt Garlic Soup|Garlic broth with tender chicken|189
Soup|NONVEG|Chicken Coriander Soup|Chicken simmered with herbs|189
Soup|NONVEG|Chicken Lemon Coriander Soup|Chicken broth with lemon zest|189
Soup|NONVEG|Non Veg Hot & Sour Soup|Spicy broth with chicken|199
Soup|NONVEG|Non Veg Manchow Soup|Thick soup with shredded chicken|199
Soup|VEG|Veg Sweet Corn Soup|Creamy sweet corn broth|159
Soup|NONVEG|Chicken Sweet Corn Soup|Sweet corn broth with chicken|189
Salads|VEG|Caesar Salad Veg|Crisp lettuce, creamy dressing, croutons|229
Salads|VEG|Greek Salad|Cucumber, tomato, olives, cheese|229
Salads|VEG|Waldorf Salad|Apple, celery, nuts, creamy dressing|239
Salads|NONVEG|Chicken Caesar Salad|Grilled chicken over crisp greens|269
Salads|NONVEG|Prawns Caesar Salad|Prawns with crunchy lettuce|289
Starters & Snacks|VEG|American Corn Salt & Pepper|Sweet corn tossed with butter and pepper|199
Starters & Snacks|VEG|Avocado Toast|Creamy avocado on toasted bread|249
Starters & Snacks|VEG|Baked French Fries|Oven-baked fries|169
Starters & Snacks|VEG|Cheese Cigar|Crunchy pastry with gooey cheese|219
Starters & Snacks|VEG|Cheese Stuffed Mushroom|Mushrooms baked with cheese|229
Starters & Snacks|VEG|Chilli Cheese Toast|Melted cheese and chillies|199
Starters & Snacks|VEG|French Fries|Golden salted fries|159
Starters & Snacks|VEG|Garlic Bread|Garlic butter toast|149
Starters & Snacks|VEG|Jalepeno Cheese Balls|Molten cheese with jalapeno|219
Starters & Snacks|VEG|Loaded French Fries|Fries with sauces and toppings|219
Starters & Snacks|VEG|Paneer Tikka Wrap|Smoky grilled paneer wrap|249
Starters & Snacks|VEG|Peri Peri French Fries|Fries tossed in peri peri|179
Starters & Snacks|VEG|Potato Wedges|Thick-cut seasoned potatoes|179
Starters & Snacks|VEG|Stir Fry Exotic Vegetable|High-flame tossed veg|229
Starters & Snacks|VEG|Taco Mexican Veg|Spiced vegetables in taco shells|229
Starters & Snacks|VEG|Tomato Bruschetta|Tomato, herbs, olive oil|199
Starters & Snacks|NONVEG|BBQ Baked Chicken Wings|Sticky BBQ wings|299
Starters & Snacks|NONVEG|BBQ Chicken Bruschetta|Toasted bread with BBQ chicken|249
Starters & Snacks|NONVEG|Chicken Loaded French Fries|Fries with seasoned chicken|259
Starters & Snacks|NONVEG|Chicken Popcorn|Bite-sized crispy chicken|249
Starters & Snacks|NONVEG|Chicken Tikka Wrap|Smoky grilled chicken wrap|269
Starters & Snacks|NONVEG|Nachos Chicken|Nachos with chicken and cheese|279
Starters & Snacks|NONVEG|Taco BBQ Chicken|BBQ chicken in soft shells|269
Starters & Snacks|NONVEG|Taco Mexicana Chicken|Spiced chicken tacos|269
Pizza & Pasta|VEG|Chilly Paneer Pizza|Spicy paneer with peppers and cheese|349
Pizza & Pasta|VEG|Farm Feast Pizza|Garden vegetables, peppers and cheese|339
Pizza & Pasta|VEG|Mexican Spiced Pizza|Mexican spices and crunchy veg|349
Pizza & Pasta|VEG|Margherita Pizza|Tomato sauce and melted cheese|299
Pizza & Pasta|NONVEG|Chilli Chicken Pizza|Spicy chicken and cheese|379
Pizza & Pasta|NONVEG|Only Meat Pizza|Assorted meats and cheese|399
Pizza & Pasta|NONVEG|Pesto Chicken Pizza|Basil pesto and chicken|389
Pizza & Pasta|NONVEG|Chicken Marinara Pasta|Chicken in marinara sauce|299
Pizza & Pasta|NONVEG|Chicken Pomodoro Pasta|Chicken tomato herb pasta|299
Pizza & Pasta|VEG|Veg Mac N Cheese|Creamy cheesy pasta|259
Pizza & Pasta|VEG|Veg Penne Mix Sauce|Creamy white and tangy red|269
Pizza & Pasta|VEG|Veg Penne Red Sauce|Herb tomato penne|249
Pizza & Pasta|VEG|Veg Penne White Sauce|Rich white sauce penne|249
Pizza & Pasta|VEG|Veg Spaghetti Aglio Olio|Garlic, olive oil, herbs|249
Pizza & Pasta|NONVEG|Chicken Mac N Cheese|Mac and cheese with chicken|289
Pizza & Pasta|NONVEG|Chicken Penne Mix Sauce|Chicken in mixed sauces|299
Pizza & Pasta|NONVEG|Chicken Penne Red Sauce|Chicken tomato penne|289
Pizza & Pasta|NONVEG|Chicken Penne White Sauce|Chicken white sauce penne|289
Pizza & Pasta|NONVEG|Chicken Spaghetti Aglio Olio|Garlic spaghetti with chicken|289
Pizza & Pasta|NONVEG|Chicken Spaghetti Bolognese|Minced chicken bolognese|309
Main Course|VEG|Veg American Chopsuey|Crispy noodles with sweet tangy gravy|279
Main Course|VEG|Veg Au Gratin|Baked veg with cheese|289
Main Course|VEG|Veg Chinese Chopsuey|Golden noodles with veg sauce|279
Main Course|NONVEG|Chicken American Chopsuey|Crispy noodles with chicken gravy|319
Main Course|NONVEG|Chicken Au Gratin|Baked chicken with white sauce|329
Main Course|NONVEG|Chicken Chinese Chopsuey|Chinese-style chicken gravy|319
Main Course|NONVEG|Chicken Stroganoff|Creamy mushroom chicken|349
Main Course|NONVEG|Grilled Chicken|Herb marinated grilled breast|329
Main Course|NONVEG|Grilled Fish In Lemon Butter|Fish with lemon butter|369
Main Course|VEG|Mushroom Masala|Mushrooms in onion tomato masala|279
Starter|VEG|Chinese Bhel|Crunchy noodles with veg and spice|199
Starter|VEG|Paneer Chilli|Paneer in chilli sauce|249
Starter|VEG|Paneer Majestic|Crispy paneer in creamy sauce|259
Starter|VEG|Veg Manchurian|Veg balls in Manchurian sauce|229
Starter|VEG|Veg Chilli|Stir-fried veg in chilli sauce|219
Starter|VEG|Veg Spring Roll|Crispy vegetable rolls|199
Starter|VEG|Cheese Chilli|Cheese cubes in chilli sauce|249
Starter|VEG|Honey Chilli Potato|Potato fingers in honey chilli|219
Starter|VEG|Babycorn Chilli|Fried babycorn chilli|219
Starter|VEG|Mushroom Chilli|Crispy mushroom chilli|229
Starter|NONVEG|Chicken 65|Spicy South Indian fried chicken|279
Starter|NONVEG|Chicken Finger|Crispy chicken fingers|259
Starter|NONVEG|Chicken Peri Peri Chilli|Peri peri chicken|289
Starter|NONVEG|Creamy Chicken Wings|Wings in creamy sauce|299
Starter|NONVEG|Dice Chicken Red Chilli Sauce|Diced chicken in red chilli|289
Starter|NONVEG|Hongkong Chilli Chicken|Hong Kong style chilli chicken|289
Starter|NONVEG|Lemon Chicken Pepper|Lemon pepper chicken|279
Starter|NONVEG|Shredded Chilli Chicken|Street-style shredded chilli|279
Starter|NONVEG|Chicken Spring Roll|Chicken stuffed rolls|229
Starter|NONVEG|Green Chicken Chilli|Green chilli chicken|289
Starter|NONVEG|Garlic Chicken|Garlic stir-fried chicken|279
Starter|NONVEG|Dragon Chicken|Spicy dragon-style strips|299
Starter|NONVEG|Chicken Chilli Boneless|Boneless chilli chicken|299
Starter|NONVEG|Chicken Salt & Pepper|Salt and pepper chicken|269
Starter|NONVEG|Chicken Wings|Fried or sauced wings|279
Starter|NONVEG|Chicken Lollipop|Frenched fried lollipops|289
Fried Rice & Noodles|VEG|Mix Burnt Garlic Rice|Rice with burnt garlic|219
Fried Rice & Noodles|VEG|Mix Fried Rice|Vegetable fried rice|199
Fried Rice & Noodles|VEG|Mix Schezwan Rice|Spicy Schezwan rice|219
Fried Rice & Noodles|VEG|Veg Schezwan Rice|Veg Schezwan fried rice|209
Fried Rice & Noodles|VEG|Veg Burnt Garlic Fried Rice|Burnt garlic veg rice|209
Fried Rice & Noodles|VEG|Veg Fried Rice|Classic veg fried rice|189
Fried Rice & Noodles|NONVEG|Prawns Burnt Garlic Rice|Prawns with burnt garlic rice|279
Fried Rice & Noodles|NONVEG|Prawns Schezwan Rice|Prawns Schezwan rice|279
Fried Rice & Noodles|NONVEG|Chicken Fried Rice|Chicken fried rice|239
Fried Rice & Noodles|NONVEG|Chicken Schezwan Rice|Chicken Schezwan rice|249
Fried Rice & Noodles|NONVEG|Chicken Burnt Garlic Rice|Chicken burnt garlic rice|249
Fried Rice & Noodles|NONVEG|Prawns Fried Rice|Prawns fried rice|269
Fried Rice & Noodles|VEG|Veg Chilli Garlic Noodle|Chilli garlic noodles|209
Fried Rice & Noodles|VEG|Veg Hakka Noodles|Classic hakka noodles|199
Fried Rice & Noodles|VEG|Veg Hongkong Noodle|Hong Kong veg noodles|209
Fried Rice & Noodles|VEG|Veg Schezwan Noodle|Schezwan veg noodles|209
Fried Rice & Noodles|VEG|Veg Singapore Noodle|Singapore-style veg noodles|219
Fried Rice & Noodles|VEG|Veg Panfried Noodle|Crispy pan-fried noodles|229
Fried Rice & Noodles|NONVEG|Chicken Chilli Garlic Noodle|Chicken chilli garlic noodles|239
Fried Rice & Noodles|NONVEG|Chicken Hakka Noodles|Chicken hakka noodles|229
Fried Rice & Noodles|NONVEG|Chicken Hongkong Noodle|Chicken Hong Kong noodles|239
Fried Rice & Noodles|NONVEG|Chicken Schezwan Noodle|Chicken Schezwan noodles|239
Fried Rice & Noodles|NONVEG|Chicken Singapore Noodle|Chicken Singapore noodles|239
Fried Rice & Noodles|NONVEG|Mix Hakka Noodles|Chicken and prawn hakka|269
Fried Rice & Noodles|NONVEG|Prawns Hakka Noodle|Prawns hakka noodles|269
Fried Rice & Noodles|NONVEG|Prawns Schezwan Noodles|Prawns Schezwan noodles|279
Fried Rice & Noodles|NONVEG|Chicken Panfried Noodle|Crispy chicken noodles|249
Momo|VEG|Veg Panfried Momo|Golden pan-fried veg momos|169
Momo|VEG|Veg Steam Momo|Steamed vegetable momos|149
Momo|VEG|Veg Fried Momo|Crispy fried veg momos|159
Momo|NONVEG|Chicken Steam Momos|Steamed chicken momos|169
Momo|NONVEG|Chicken Fried Momos|Fried chicken momos|179
Momo|NONVEG|Chicken Panfried Momos|Pan-fried chicken momos|189
Burgers & Sandwiches|VEG|BBQ Paneer Burger|BBQ paneer patty burger|199
Burgers & Sandwiches|VEG|Classic Veg Burger|Crispy veg patty|169
Burgers & Sandwiches|VEG|Mexican Veg Burger|Salsa and cheese veg burger|189
Burgers & Sandwiches|NONVEG|BBQ Chicken Burger|BBQ chicken burger|219
Burgers & Sandwiches|NONVEG|Chicken Burger|Classic chicken burger|199
Burgers & Sandwiches|NONVEG|Chicken Smash Burger|Smashed chicken patty|229
Burgers & Sandwiches|NONVEG|Crunchy Chicken Burger|Fried chicken burger|219
Burgers & Sandwiches|VEG|Corn Spinach Sandwich|Corn and spinach grilled|169
Burgers & Sandwiches|VEG|Paneer Brocolli Sandwich|Paneer broccoli grilled|189
Burgers & Sandwiches|VEG|Veg Club Sandwich|Triple-layer veg club|199
Burgers & Sandwiches|VEG|Veg Grilled Sandwich|Classic grilled veg|159
Burgers & Sandwiches|VEG|Veg Colslow Sandwich|Coleslaw sandwich|149
Burgers & Sandwiches|NONVEG|Chicken Colslow Sandwich|Chicken coleslaw|179
Burgers & Sandwiches|NONVEG|Chicken Grilled Sandwich|Grilled chicken sandwich|189
Burgers & Sandwiches|NONVEG|Chicken Club Sandwich|Triple-layer chicken club|219
Fish&prawn|NONVEG|Butter Garlic Prawns|Prawns in butter garlic|399
Fish&prawn|NONVEG|Fish & Chips|Battered fish with fries|349
Fish&prawn|NONVEG|Fish Fingers|Crumb-coated fish fingers|329
Fish&prawn|NONVEG|Lemon Fish|Lemon pepper fried fish|349
Fish&prawn|NONVEG|Prawns Crackers|Crisp prawn crackers|249
Fish&prawn|NONVEG|Fish Chilli|Fish in chilli sauce|359
Fish&prawn|NONVEG|Prawns Chilli|Prawns in chilli sauce|399
Shakes|VEG|Blueberry Shake|Blueberry milkshake|169
Shakes|VEG|Brownie Shake|Chocolate brownie shake|189
Shakes|VEG|Butterscotch Shake|Butterscotch milkshake|169
Shakes|VEG|Cold Coffee|Blended cold coffee|149
Shakes|VEG|Hazelnut Shake|Hazelnut milkshake|179
Shakes|VEG|Kesar Pista Shake|Saffron pista shake|189
Shakes|VEG|Lotus Biscoff Shake|Biscoff milkshake|199
Shakes|VEG|Nutella Shake|Nutella milkshake|199
Shakes|VEG|Strawberry Shake|Strawberry milkshake|169
Shakes|VEG|Chocolate Shake|Classic chocolate shake|169
Shakes|VEG|Kit Kat Shake|KitKat milkshake|189
Shakes|VEG|Mango Shake|Mango milkshake|169
Shakes|VEG|Oreo Shake|Oreo milkshake|189
Mocktails|VEG|Blueberry Mist|Chilled blueberry cooler|149
Mocktails|VEG|Bubblegum Blast|Bubblegum fizz|149
Mocktails|VEG|Chilli Guava|Spicy-sweet guava|159
Mocktails|VEG|Classic Mojito|Mint lime soda|149
Mocktails|VEG|Fresh Lime Soda|Fresh lime soda|99
Mocktails|VEG|Masala Cold Drink|Masala fizzy drink|119
Mocktails|VEG|Peach Ice|Peach iced drink|149
Mocktails|VEG|Sour Green Apple|Green apple sour|149
Mocktails|VEG|Strawberry Mojito|Strawberry mint mojito|159
Mocktails|VEG|Watermelon Mojito|Watermelon mint mojito|159
Mocktails|VEG|Blue Lagoon|Blue citrus cooler|159
Mocktails|VEG|Cola Punch|Cola fruit punch|129
Mocktails|VEG|Litchi Rose|Litchi rose cooler|159
Mocktails|VEG|Rose Mojito|Rose mint mojito|159
Breakfast & Combos|VEG|Avocado Toast Combo|Avocado toast with fries and shake|349
Breakfast & Combos|VEG|Garlic Bread Combo|Garlic bread, fries, mocktail|299
Breakfast & Combos|VEG|Veg Club Combo|Veg club sandwich with fries|329
Breakfast & Combos|VEG|Classic Veg Burger Combo|Burger, fries, cold coffee|299
Breakfast & Combos|VEG|Paneer Wrap Combo|Paneer wrap with wedges|329
Breakfast & Combos|NONVEG|Chicken Burger Combo|Chicken burger, fries, shake|349
Breakfast & Combos|NONVEG|Chicken Club Combo|Chicken club with fries|369
Breakfast & Combos|NONVEG|Grilled Chicken Combo|Grilled chicken with salad|429
Coffee & Beverages|VEG|Espresso|Short, intense shot of roasted coffee|99
Coffee & Beverages|VEG|Americano|Espresso lengthened with hot water|129
Coffee & Beverages|VEG|Cappuccino|Espresso with steamed milk and foam|149
Coffee & Beverages|VEG|Cafe Latte|Smooth espresso with steamed milk|159
Coffee & Beverages|VEG|Cafe Mocha|Chocolate espresso latte|169
Coffee & Beverages|VEG|Flat White|Velvety microfoam over espresso|159
Coffee & Beverages|VEG|Macchiato|Espresso marked with milk foam|139
Coffee & Beverages|VEG|Caramel Latte|Latte finished with caramel|179
Coffee & Beverages|VEG|Hazelnut Latte|Nutty espresso latte|179
Coffee & Beverages|VEG|Vanilla Latte|Vanilla-scented steamed milk latte|169
Coffee & Beverages|VEG|Iced Latte|Chilled espresso over milk|169
Coffee & Beverages|VEG|Iced Americano|Cold espresso and water over ice|149
Coffee & Beverages|VEG|Filter Coffee|South Indian style filter coffee|139
Coffee & Beverages|VEG|Hot Chocolate|Rich melted chocolate with milk|169
Coffee & Beverages|VEG|Masala Chai|Spiced Indian tea with milk|99
Coffee & Beverages|VEG|Ginger Tea|Warm ginger infusion|89
Coffee & Beverages|VEG|Green Tea|Light, clean brewed green tea|99
Coffee & Beverages|VEG|Lemon Iced Tea|Chilled tea with lemon|119
Desserts|VEG|Chocolate Brownie|Warm dark chocolate brownie|179
Desserts|VEG|Walnut Brownie|Brownie with toasted walnuts|189
Desserts|VEG|New York Cheesecake|Creamy baked cheesecake|219
Desserts|VEG|Chocolate Lava Cake|Molten centre chocolate cake|229
Desserts|VEG|Tiramisu|Coffee-soaked mascarpone dessert|239
Desserts|VEG|Sizzling Brownie|Brownie on a hot plate with ice cream|249
Desserts|VEG|Ice Cream Scoop|Single scoop of the day's flavour|99
`

function hash(s) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}

const profile = await p.profile.findFirst({ where: { slug: { in: ["skydine-cafe", "blu-cafe"] } } })
if (!profile) throw new Error("SkyDine profile missing")

await p.offerReview.deleteMany({ where: { product: { profileId: profile.id } } })
await p.digitalProduct.deleteMany({ where: { profileId: profile.id } })

const rows = RAW.trim().split("\n").map((line) => {
    const [category, diet, title, description, price] = line.split("|")
    return { category, diet, title, description, price: Number(price) }
})

const BESTSELLERS = new Set(["Chicken Burger", "Margherita Pizza", "Veg Fried Rice"])
const OFFERS = new Set(["Classic Veg Burger", "French Fries", "Cold Coffee", "Veg Steam Momo", "Cream Of Tomato"])
const PHOTOS = {
    Soup: [
        "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Salads: [
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Starters & Snacks": [
        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Pizza & Pasta": [
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Main Course": [
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1604908554175-2c2670c5b2b5?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Starter: [
        "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Fried Rice & Noodles": [
        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Momo: [
        "https://images.unsplash.com/photo-1534422298391-e4f8c172ddbb?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Burgers & Sandwiches": [
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Fish&prawn": [
        "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Shakes: [
        "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Mocktails: [
        "https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Breakfast & Combos": [
        "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    "Coffee & Beverages": [
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&h=800&q=80",
    ],
    Desserts: [
        "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&h=800&q=80",
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&h=800&q=80",
    ],
}
const FALLBACK = [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&h=800&q=80",
    "/uploads/blu-cafe/sandwich.jpg",
]

for (const d of rows) {
    const pool = PHOTOS[d.category] || FALLBACK
    await p.digitalProduct.create({
        data: {
            profileId: profile.id,
            title: d.title,
            description: d.description,
            type: "PHYSICAL",
            fulfillment: "PHYSICAL",
            category: d.category,
            diet: d.diet,
            priceCents: Math.round(d.price * 100),
            compareAtCents: OFFERS.has(d.title) ? Math.round(d.price * 1.2 * 100) : null,
            currency: "INR",
            isActive: true,
            downloadCount: BESTSELLERS.has(d.title) ? 12 : 0,
            thumbnailUrl: pool[hash(d.title) % pool.length],
            shipMode: "PICKUP",
        },
    })
}

console.log("imported", rows.length, "dishes for", profile.slug)
await p.$disconnect()

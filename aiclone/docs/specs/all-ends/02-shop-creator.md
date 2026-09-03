# Shop and creator ends

Shop and creator already sit on the restaurant catalog spine (`DigitalProduct`, `/shop`, item `StoryGallery`, photoreal 3D, About/story). They do **not** get the restaurant guest gold path: Swiggy-style menu, table cart, Google About footer, kitchen receipts, or catalog AR banner.

Combined sequence: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).

---

## Kits

| | **SHOP** | **CREATOR** | **RESTAURANT** |
|---|---|---|---|
| Surfaces | home, profile, inbox, **shop**, **sales** | home, profile, inbox, **leads**, **shop**, **sales** | home, profile, inbox, shop, **calendar**, sales |
| Packs | `shopPhysical`, `shopDigital`, **`ar`**, `whatsappUpi` | **`shopDigital`**, `whatsappUpi` | `menuDish`, `ar`, `tableBook`, `whatsappUpi` |
| Goal / headline | `SELL_PRODUCTS` · “Shop now” | `COLLECT_LEADS` · “Get the free guide” | `BOOK_TABLE` · “Reserve a table” |
| Owner next | `/dashboard/products` | `/dashboard/lead-magnets` | `/dashboard/products` |
| Blueprint | `retail-storefront-v1` (correspondence) | none | `restaurant-venue-v3` |
| Default fulfillment | **PHYSICAL** | **DIGITAL** | PHYSICAL via `menuDish` |

SHOP can add digital as an addon. CREATOR can add physical shop as an addon. CREATOR has **no AR pack**.

Do **not** reuse `RestaurantMenu` for either kit.

---

## 1. Guest loop today

### Shopkeeper (`SHOP`, `SELL_PRODUCTS`)

1. `/{slug}` chat with the orb intro veil (restaurant skips this).
2. Chips: Shop panel, **Open shop**, WhatsApp, tip; then About / courses / events if present.
3. **Open shop → `/{slug}/shop`**: dark grid `ShopCatalog`. UPI + WhatsApp strip. Category chips. Diet chips only if items have `diet`. **No cart, hours, reserve, live kitchen, table QR, or catalog AR banner** (those only fire when `restaurant === true`).
4. Tile → `/{slug}/shop/{id}`: `StoryGallery`, price, stock, reviews, sticky **Order · price** → `CheckoutSheet` (UPI / WhatsApp / COD / Stripe). If `arModelUrl`: **“View on table”** (restaurant wording).
5. Chat “Shop” panel (`ProductsStore`): Buy in-sheet or “See” the same item page.
6. About only if story frames exist. Header `aboutHref` is implemented but **never passed**.
7. Pay: manual `ProductPurchase` (PENDING) or Stripe. **`placeCartOrder` exists and is unused.** No table/kitchen loop.

### Creator (`CREATOR`, `COLLECT_LEADS`)

1. Same chat landing + intro veil.
2. Chips: **Get the free guide** (prompt only: “How can I get the free guide?”), Ask, work, book — then extras: About, products, Open shop, WA, **Send a tip** (CREATOR always allowed), courses/events.
3. **Guide is not a capture UI.** Chat tool `showLeadMagnets` lists files and asks “Would you like to get any of these?” Generic `collectLead` is the only capture. No public `/guide` page.
4. Shop is the same `ShopCatalog` + item page, defaulting to digital. Physical/COD/ship only if they add the shop addon.
5. **No AR pack** → no AR control in Quick Add. Photoreal 3D **banner still shows** on `/dashboard/products`.
6. Owner: Shop + **Free** tab (`lead-magnets`). Nav still says “Shop”, not “Downloads”.
7. **See work is blocked** (no `portfolio` pack).

Restaurant, for contrast: skip veil → Menu / About / Reserve / WA → `/{slug}/menu` cart + modifiers + table QR + live order + AR menu banner → kitchen receipts.

---

## 2. Already shared with restaurant

Same `DigitalProduct` row: photos, price, category, diet/spice (menu fields), AR URLs, stock, variants, ship, COD, file.

| Piece | Shared? | Notes |
|---|---|---|
| Catalog model | Yes | One table for dishes, goods, and files |
| Item page | Yes | `src/app/[slug]/shop/[id]/page.tsx` for all roles |
| `StoryGallery` | Yes | Default labels still **Menu / Guest / More / Google** |
| Photoreal 3D | Owner yes | `ArBuildSheet` + Meshy + `optimize-glb`; SHOP has `ar` pack |
| AR viewer | Yes if model exists | `/{slug}/ar` back-link is `/menu` vs `/shop` |
| About / story | Yes | Walk-in, Google panel if Maps URL, category labels slightly role-aware |
| WhatsApp / UPI | Yes | Header WA, catalog UPI strip, checkout UPI/WA, tip sheet |
| Import | Partial | Dock Import for shop; restaurant also has a dedicated “Import menu” card |
| Chat knowledge | Partial | SHOP: `showProducts`. Restaurant: `showMenu`. CREATOR: `showLeadMagnets` + `showProducts` |

Restaurant-only: `RestaurantMenu`, table codes, live orders, dish modifiers, reserve, cooking-time, Floor nav, thermal receipts.

---

## 3. Gaps vs restaurant gold path

### Google fill

Story **From Google** works for any role **if** Maps is on the profile. Catalog never links About.

Import Google/Swiggy/Zomato/Uber is real, but shop copy is still food: “paste dishes: Paneer tikka…”. Restaurant gets a first-class Import menu card; shop only gets dock + empty-state “Photo, name, price.”

No Shopify / Instagram / Amazon catalog importer.

### About footer from listing

Hardcoded SkyDine in `story-magazine.tsx`. Shop/creator CTAs are **Chat** only — not Open shop / Get the guide.

Google panel can show listing hours/address; the footer does not consume it.

### Import

Exists for shop (`Import shop` sheet) and can emit `product` + `leadMagnet`. Weak vs restaurant: no storefront-source chips, food placeholders, CREATOR `defaultHintFor` is `"cv"`, not `"shop"`.

### Receipts

Restaurant: `Order` + kitchen + 80mm ticket + guest `/o/{token}`.

Shop: `ProductPurchase` list on Sales/Orders, Confirm button, no 80mm ticket, no guest live ticket.

Creator digital: Stripe → email/library (“You’re in”) — right for files, wrong if they later sell physical.

### AR on item

- Item page **does** link AR when a model exists.
- Catalog AR banner is **restaurant-only**. Shop guests never see it on the grid.
- Copy is still “View on table” / “AR menu” for lamps, totes, PDFs.
- CREATOR kit has no `ar` pack, but ProductsList still offers Photoreal 3D.

### Other

- No hours/open-today on shop catalog (`hoursToday` only passed for restaurant, and restaurant doesn’t use `ShopCatalog`).
- Diet/spice UI on shop catalog if someone imported a menu into a shop.
- Shop item page has **Reserve a table** only for restaurant; shop has no pickup/visit CTA in that slot.
- Enroll button says **Order** even for a free PDF.

---

## 4. Copy / CTA / catalog differences

### Shop

- Catalog: **Shop** not Menu; **View in your space** / **See it in AR**, not “on your table”.
- Grid: stock, variants, pickup vs deliver — hide diet/spice unless `menuDish`.
- Item CTA: **Buy · price** / **WhatsApp to order** / **Pay UPI**; shipping line if `shipMode`.
- About footer: shop address + hours from Google/profile; CTAs **Shop** + **WhatsApp**, not table.
- Chat chips: keep Open shop first; drop tip unless they opt in; add **Visit / pickup** if address exists.
- Owner empty state: “Import a catalog or add a product” (not Swiggy).
- Receipts: simple order ticket (name, SKU, qty, UPI), not kitchen.

### Creator

- Primary loop: **Get the free guide** should open a sheet (email + file), not a chat prompt.
- Catalog label: **Shop** or **Downloads**; tiles as **Guide / File / Preset**, not “Physical”.
- Item CTA: **Get free** / **Buy the file**; hide stock/COD/AR unless packs added.
- About: creator story labels (already “Studio / Craft / Moments”); footer **Get the guide** + **Tip** + **Shop**.
- Chat: `showLeadMagnets` should call `collectLead` + download link, not “check out their products”.
- Owner: default into **Free** (`lead-magnets`); Shop tab is paid files. Hide Photoreal 3D unless `ar` pack.
- Import default: downloads/products, not CV.

---

## 5. Implementation slices (this end)

Spine phases A–C still go first (nouns, FillFromListing, About footer). Then:

**Slice 1 — Role copy on the shared spine (no new surfaces)**  
`catalogLabel` / AR / checkout / `StoryGallery` / Quick Add / ProductsList empty states. SHOP: space/AR/Buy. CREATOR: file/Get/guide. Gate Photoreal 3D on `fieldOn(..., "ar")`. Pass `aboutHref` when story exists.

**Slice 2 — Shop catalog, not leftover menu**  
On `ShopCatalog`: drop diet unless `menuDish`; hours from availability; catalog AR banner with shop copy if any item has a model; hide restaurant-only hours/book props. Item page: pickup/WhatsApp instead of Reserve.

**Slice 3 — About footer from listing**  
Covered by spine C. Role CTAs: shop Shop+WA; creator Guide+Tip+Shop.

**Slice 4 — Creator lead-magnet gold path**  
Chip opens a sheet (email → file + `VisitorLead`). Chat `showLeadMagnets` completes that. Public `/shop` can pin free downloads. Owner lands on Free tab; import hint `shop`/`leadMagnet` for CREATOR.

**Slice 5 — Shop import + Google fill**  
Shop-shaped sources (CSV, pasted list, Maps) vs Swiggy. Prominent Import card like restaurant.

**Slice 6 — Shop order ticket (not kitchen)**  
Use `placeCartOrder` or a small cart; guest status page; owner print from `ProductPurchase` without table/kitchen language. Keep restaurant receipts isolated.

**Slice 7 — Optional later**  
Shopify/Instagram import; shop cart on the grid; CREATOR `ar` addon; retail blueprint install from onboarding (correspondence only today).

The gold path to copy is: Google/import → catalog → item (gallery + AR) → About from listing → WhatsApp/UPI — with **shop/creator nouns**, not dishes, tables, or kitchen.

---

## 6. File paths

**Kits** — `src/lib/surfaces.ts`, `src/lib/onboarding-needs.ts`, `src/lib/try-kits.ts`, `src/lib/menu.ts` (`isRestaurant`, `catalogLabel`), `src/lib/story.ts`

**Guest** — `[slug]/page.tsx`, `[slug]/shop/page.tsx`, `[slug]/shop/[id]/page.tsx`, `[slug]/story/page.tsx`, `[slug]/ar/page.tsx`, `profile-view.tsx`, `store-panel.tsx`, `story-magazine.tsx`, `shop-catalog.tsx`, `catalog-header.tsx`, `story-gallery.tsx`, `checkout-sheet.tsx`, `enroll-button.tsx`, `src/lib/rag.ts`

**Owner** — `products-list.tsx`, `quick-add-sheet.tsx`, `shop-tabs.tsx`, `ar-build-sheet.tsx`, `lead-magnets-list.tsx`, `import-studio.tsx`, `src/app/actions/products.ts` (`placeManualOrder`, unused `placeCartOrder`)

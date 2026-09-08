/**
 * Wave G / G1 commerce variants, fulfilment and returns schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens
 * inside a transaction that is deliberately rolled back.
 *
 * Three families of assertion matter here.
 *
 * REUSE: orders stay Order and OrderLine, money stays Payment, sites stay Location, stock
 * stays InventoryItem. Foreign keys are verified to point at those pre-existing models BY
 * NAME, and a list of forbidden fork tables (Cart, Shipment, CommerceOrder, ...) must be
 * absent.
 *
 * BACKWARD COMPATIBILITY: DigitalProduct keeps `stock`, `sku` and the legacy `variantsJson`
 * blob exactly as they were, and InventoryItem keeps `productId` even though identity moved
 * to the variant.
 *
 * ENFORCEMENT: every guarantee is asserted against the DATABASE with no engine involved -
 * the oversell CHECKs still hold after the identity change, a negative variant price is
 * refused, a zero-quantity fulfilment or return line is refused, two default variants on one
 * product are refused, and a stock row whose productId disagrees with its variant's product
 * is refused by trigger.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-commerce-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";
const RUN = `wg1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const NEW_TABLES = [
  "ProductOption", "ProductOptionValue", "ProductVariant", "ProductVariantOptionValue",
  "Fulfilment", "FulfilmentItem", "ReturnRequest", "ReturnItem", "CommerceEvent",
] as const;

/** Tables that must NOT exist, because the pre-existing ones already do the job. */
const FORBIDDEN_TABLES = [
  "Cart", "CartItem", "ShoppingCart", "Shipment", "ShipmentItem", "CommerceOrder",
  "CommerceOrderLine", "CommercePayment", "Refund", "VariantStock", "VariantInventory",
] as const;

const NEW_ENUMS: Array<[string, number]> = [
  ["FulfilmentState", 5],
  ["ReturnRequestState", 5],
  ["ReturnItemRestockState", 3],
  ["CommerceEventKind", 5],
  ["CommerceEventSubject", 3],
  ["CommerceEventActor", 3],
];

/** The reuse contract: each link must point at the PRE-EXISTING model. */
const REUSE_FKS: Array<[string, string, string]> = [
  ["ProductOption", "productId", "DigitalProduct"],
  ["ProductVariant", "productId", "DigitalProduct"],
  ["ProductVariant", "profileId", "Profile"],
  ["Fulfilment", "orderId", "Order"],
  ["Fulfilment", "locationId", "Location"],
  ["FulfilmentItem", "orderLineId", "OrderLine"],
  ["FulfilmentItem", "variantId", "ProductVariant"],
  ["ReturnRequest", "orderId", "Order"],
  ["ReturnRequest", "refundPaymentId", "Payment"],
  ["ReturnItem", "orderLineId", "OrderLine"],
  ["ReturnItem", "restockMovementId", "InventoryMovement"],
  ["InventoryItem", "variantId", "ProductVariant"],
  ["CommerceEvent", "orderId", "Order"],
];

const CHECK_CONSTRAINTS = [
  "ProductVariant_priceCents_nonnegative",
  "ProductVariant_compareAtCents_nonnegative",
  "FulfilmentItem_qty_positive",
  "ReturnItem_qty_positive",
  // Wave F constraints that must survive the identity change untouched.
  "InventoryItem_onHand_nonnegative",
  "InventoryItem_reserved_nonnegative",
  "InventoryItem_reserved_within_onHand",
] as const;

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
}

function errLine(e: unknown): string {
  const lines = String((e as Error).message).split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    lines.find(
      (l) =>
        l.includes("append-only") ||
        l.includes("does not match") ||
        l.includes("violates") ||
        l.includes("duplicate") ||
        l.includes("ERROR"),
    ) ?? lines[0] ?? "unknown error"
  ).slice(0, 150);
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type Seeded = {
  profileId: string;
  locationId: string;
  productId: string;
  variantId: string;
  itemId: string;
  orderId: string;
  orderLineId: string;
  paymentId: string;
};

/** Seeds profile -> location -> product -> default variant -> stock -> order -> line. */
async function seed(tx: Tx, tag: string): Promise<Seeded> {
  const p = `${RUN}_${tag}`;
  const ids = {
    u: `${p}_u`, pr: `${p}_pr`, ws: `${p}_ws`, loc: `${p}_l`, prod: `${p}_prod`,
    variant: `${p}_var`, item: `${p}_item`, order: `${p}_o`, line: `${p}_ol`, pay: `${p}_pay`,
  };
  await tx.$executeRawUnsafe(
    `insert into "User" ("id","clerkId","email","updatedAt") values ('${ids.u}','clerk_${ids.u}','${ids.u}@example.test',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${ids.pr}','${ids.u}','${ids.pr}','P',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${ids.ws}','${ids.pr}','WS','${ids.ws}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${ids.loc}','${ids.ws}','Shop',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "DigitalProduct" ("id","profileId","title","stock","sku","variantsJson","updatedAt")
     values ('${ids.prod}','${ids.pr}','Widget',9,'${ids.prod}-SKU','[{"name":"legacy"}]',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","updatedAt")
     values ('${ids.variant}','${ids.pr}','${ids.prod}',true,'Default',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","onHand","reserved","updatedAt")
     values ('${ids.item}','${ids.pr}','${ids.prod}','${ids.variant}','${ids.loc}',10,0,CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Order" ("id","profileId","publicToken","number","businessDate","subtotalCents","totalCents","currency","updatedAt")
     values ('${ids.order}','${ids.pr}','tok_${ids.order}',1,CURRENT_DATE,1000,1000,'USD',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "OrderLine" ("id","orderId","titleSnapshot","qty","unitPriceCents","lineTotalCents","updatedAt")
     values ('${ids.line}','${ids.order}','Widget',3,500,1500,CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Payment" ("id","profileId","amountCents","currency","updatedAt") values ('${ids.pay}','${ids.pr}',1500,'USD',CURRENT_TIMESTAMP)`,
  );
  return {
    profileId: ids.pr, locationId: ids.loc, productId: ids.prod, variantId: ids.variant,
    itemId: ids.item, orderId: ids.order, orderLineId: ids.line, paymentId: ids.pay,
  };
}

let prismaRef: PrismaClient | null = null;

/** Runs `body` inside a transaction that always rolls back, reporting whether it refused. */
async function refuses(tag: string, body: (tx: Tx, s: Seeded) => Promise<void>): Promise<{ refused: boolean; detail: string }> {
  let refused = false;
  let detail = "";
  try {
    await prismaRef!.$transaction(async (tx) => {
      const s = await seed(tx, tag);
      try {
        await body(tx, s);
      } catch (e) {
        refused = true;
        detail = errLine(e);
      }
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback) && !refused) {
      refused = true;
      detail = errLine(e);
    }
  }
  return { refused, detail };
}

async function main() {
  const url = process.env.DATABASE_URL;
  const db = parseDatabaseName(url);
  assertDisposableTarget(url);
  if (db !== AUTHORIZED_TARGET) {
    console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  prismaRef = prisma;
  try {
    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db");
    if (live[0].db !== AUTHORIZED_TARGET) {
      console.error(`ABORT: connected to ${live[0].db}`);
      process.exit(1);
    }

    // ---- 1. tables present, forks absent -------------------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    check("all 9 commerce tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "9/9");
    const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t));
    check("no parallel cart, shipment, order, payment or variant-stock table was created", forked.length === 0, forked.join(",") || "none");
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
      "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
    );
    for (const [name, expected] of NEW_ENUMS) {
      const n = enums.filter((e) => e.typname === name).length;
      check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`);
    }
    check(
      "ReturnItemRestockState carries PENDING, so a received return is not implicitly restocked",
      enums.some((e) => e.typname === "ReturnItemRestockState" && e.enumlabel === "PENDING"),
    );
    for (const t of ["DigitalProduct", "Order", "OrderLine", "Payment", "Location", "InventoryItem", "InventoryMovement"]) {
      check(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING");
    }

    // ---- 2. the legacy product columns are untouched --------------------
    const productCols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string; data_type: string }[]>(
      `select column_name, is_nullable, data_type from information_schema.columns
        where table_schema='public' and table_name='DigitalProduct'`,
    );
    for (const [col, type] of [["stock", "integer"], ["sku", "text"], ["variantsJson", "text"], ["priceCents", "integer"]] as Array<[string, string]>) {
      const c = productCols.find((r) => r.column_name === col);
      check(`DigitalProduct.${col} survived unchanged as ${type}`, c?.data_type === type, `${c?.data_type}/${c?.is_nullable}`);
    }

    // ---- 3. the inventory identity change, exactly ---------------------
    const invCols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
      `select column_name, is_nullable from information_schema.columns
        where table_schema='public' and table_name='InventoryItem'`,
    );
    const variantCol = invCols.find((c) => c.column_name === "variantId");
    check("InventoryItem gained variantId", !!variantCol, variantCol ? `nullable=${variantCol.is_nullable}` : "MISSING");
    check("InventoryItem.variantId is NOT NULL", variantCol?.is_nullable === "NO", `${variantCol?.is_nullable}`);
    check("InventoryItem kept productId as a denormalized parent", invCols.some((c) => c.column_name === "productId"));
    for (const c of ["onHand", "reserved", "reorderPoint", "safetyStock", "trackingEnabled"]) {
      check(`pre-existing InventoryItem.${c} survived`, invCols.some((r) => r.column_name === c));
    }
    const indexes = (
      await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `select indexname from pg_indexes where schemaname='public' and tablename in ('InventoryItem','ProductVariant')`,
      )
    ).map((r) => r.indexname);
    check("the new (variant, location) unique key exists", indexes.includes("InventoryItem_variantId_locationId_key"), indexes.join(","));
    check("the old (product, location) unique key is gone", !indexes.includes("InventoryItem_productId_locationId_key"));
    check("a partial unique index enforces one default variant per product", indexes.includes("ProductVariant_one_default_per_product"));

    // ---- 4. REUSE: links point at the pre-existing models -------------
    const fks = await prisma.$queryRawUnsafe<{ tbl: string; def: string; conname: string }[]>(
      `select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
         from pg_constraint where contype='f' and connamespace='public'::regnamespace`,
    );
    for (const [table, column, target] of REUSE_FKS) {
      const found = fks.find(
        (f) =>
          f.tbl.replace(/"/g, "") === table &&
          f.def.includes(`"${column}"`) &&
          new RegExp(`REFERENCES\\s+"?${target}"?`).test(f.def),
      );
      check(`${table}.${column} references the existing ${target}`, !!found, found ? "ok" : "MISSING");
    }
    const commerceCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `select table_name, column_name from information_schema.columns
        where table_schema='public' and table_name in ('Fulfilment','FulfilmentItem','ReturnRequest','ReturnItem','ProductVariant')`,
    );
    const smells = commerceCols.filter((c) =>
      ["subtotalCents", "totalCents", "taxCents", "payStatus", "payMethod", "providerPaymentId", "guestEmail", "guestPhone", "onHand", "reserved"].includes(
        c.column_name,
      ),
    );
    check(
      "no commerce table duplicates order-total, payment-provider or stock-balance columns",
      smells.length === 0,
      smells.map((s) => `${s.table_name}.${s.column_name}`).join(",") || "none",
    );

    // ---- 5. CHECK constraints registered ------------------------------
    const constraints = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      `select conname, pg_get_constraintdef(oid) as def from pg_constraint
        where contype='c' and connamespace='public'::regnamespace`,
    );
    for (const name of CHECK_CONSTRAINTS) {
      check(`CHECK constraint ${name} is registered`, constraints.some((c) => c.conname === name), name);
    }

    // ---- 6. ENFORCEMENT, with no engine involved ---------------------
    {
      const { refused, detail } = await refuses("oversell", async (tx, s) => {
        await tx.$executeRawUnsafe(`update "InventoryItem" set "reserved"=99 where "id"='${s.itemId}'`);
      });
      // This is the single inverted assertion: the Wave F oversell guarantee must survive
      // the identity change, and it must hold at the storage layer.
      const expected = INVERT ? !refused : refused && detail.length > 0;
      check("reserved > onHand is STILL refused after the variant identity change", expected, detail || "NO ERROR - OVERSELL ACCEPTED");
    }
    {
      const { refused, detail } = await refuses("negprice", async (tx, s) => {
        await tx.$executeRawUnsafe(`update "ProductVariant" set "priceCents"=-1 where "id"='${s.variantId}'`);
      });
      check("a negative variant price is refused", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "nullprice");
          await tx.$executeRawUnsafe(`update "ProductVariant" set "priceCents"=NULL where "id"='${s.variantId}'`);
          const row = await tx.$queryRawUnsafe<{ p: number | null }[]>(`select "priceCents" p from "ProductVariant" where "id"='${s.variantId}'`);
          accepted = row[0].p === null;
          detail = `priceCents=${row[0].p}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("a NULL variant price is allowed, meaning inherit from the product", accepted, detail);
    }
    {
      const { refused, detail } = await refuses("zerofulfil", async (tx, s) => {
        await tx.$executeRawUnsafe(
          `insert into "Fulfilment" ("id","profileId","orderId","reference","updatedAt") values ('${RUN}_f0','${s.profileId}','${s.orderId}','F0',CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(
          `insert into "FulfilmentItem" ("id","fulfilmentId","orderLineId","variantId","qty") values ('${RUN}_fi0','${RUN}_f0','${s.orderLineId}','${s.variantId}',0)`,
        );
      });
      check("a zero-quantity fulfilment line is refused", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses("zeroreturn", async (tx, s) => {
        await tx.$executeRawUnsafe(
          `insert into "ReturnRequest" ("id","profileId","orderId","reference","updatedAt") values ('${RUN}_r0','${s.profileId}','${s.orderId}','R0',CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(
          `insert into "ReturnItem" ("id","returnRequestId","orderLineId","variantId","qty","updatedAt") values ('${RUN}_ri0','${RUN}_r0','${s.orderLineId}','${s.variantId}',0,CURRENT_TIMESTAMP)`,
        );
      });
      check("a zero-quantity return line is refused", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses("twodefaults", async (tx, s) => {
        await tx.$executeRawUnsafe(
          `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","updatedAt")
           values ('${RUN}_var2','${s.profileId}','${s.productId}',true,'Second default',CURRENT_TIMESTAMP)`,
        );
      });
      check("a second default variant on one product is refused", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "manynondefault");
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","ordinal","updatedAt")
               values ('${RUN}_nd${i}','${s.profileId}','${s.productId}',false,'V${i}',${i + 1},CURRENT_TIMESTAMP)`,
            );
          }
          const n = await tx.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from "ProductVariant" where "productId"='${s.productId}'`,
          );
          accepted = Number(n[0].n) === 4;
          detail = `variants=${n[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("many non-default variants on one product are allowed", accepted, detail);
    }
    {
      const { refused, detail } = await refuses("mismatch", async (tx, s) => {
        // A second product with its own variant, then point the first product's stock row
        // at the wrong product's variant.
        await tx.$executeRawUnsafe(
          `insert into "DigitalProduct" ("id","profileId","title","updatedAt") values ('${RUN}_other','${s.profileId}','Other',CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(
          `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","updatedAt")
           values ('${RUN}_othervar','${s.profileId}','${RUN}_other',true,'Default',CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(`update "InventoryItem" set "variantId"='${RUN}_othervar' where "id"='${s.itemId}'`);
      });
      check(
        "a stock row whose productId disagrees with its variant's product is refused by trigger",
        refused && /does not match/.test(detail),
        detail || "NO ERROR",
      );
    }

    // ---- 7. append-only commerce timeline ---------------------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["CommerceEvent.UPDATE", "CommerceEvent.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }
    for (const want of [
      "ActivityEvent.UPDATE", "ReservationEvent.UPDATE", "AppointmentEvent.UPDATE",
      "CaseEvent.UPDATE", "CohortEvent.UPDATE", "InventoryMovement.UPDATE",
    ]) {
      check(`pre-existing trigger ${want} still armed`, trg.includes(want), trg.includes(want) ? "armed" : `have: ${trg}`);
    }
    for (const op of ["UPDATE", "DELETE"] as const) {
      const { refused, detail } = await refuses(`ao${op}`, async (tx, s) => {
        const eid = `${RUN}_ce_${op}`;
        await tx.$executeRawUnsafe(
          `insert into "CommerceEvent" ("id","profileId","kind","subjectType","subjectId","to") values ('${eid}','${s.profileId}','VARIANT','VARIANT','${s.variantId}','CREATED')`,
        );
        if (op === "UPDATE") await tx.$executeRawUnsafe(`update "CommerceEvent" set "to"='TAMPERED' where "id"='${eid}'`);
        else await tx.$executeRawUnsafe(`delete from "CommerceEvent" where "id"='${eid}'`);
      });
      check(`CommerceEvent refuses ${op}`, refused && detail.length > 0, detail || "NO ERROR OBSERVED");
    }

    // ---- 8. uniqueness that makes the model coherent ---------------
    const uniqueCases: Array<[string, (tx: Tx, s: Seeded) => Promise<void>]> = [
      [
        "a variant sku is unique per profile",
        async (tx, s) => {
          await tx.$executeRawUnsafe(
            `insert into "ProductVariant" ("id","profileId","productId","title","sku","updatedAt")
             values ('${RUN}_sk1','${s.profileId}','${s.productId}','A','DUP-SKU',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "ProductVariant" ("id","profileId","productId","title","sku","updatedAt")
             values ('${RUN}_sk2','${s.profileId}','${s.productId}','B','DUP-SKU',CURRENT_TIMESTAMP)`,
          );
        },
      ],
      [
        "one stock record per variant per location",
        async (tx, s) => {
          await tx.$executeRawUnsafe(
            `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","updatedAt")
             values ('${RUN}_dupitem','${s.profileId}','${s.productId}','${s.variantId}','${s.locationId}',CURRENT_TIMESTAMP)`,
          );
        },
      ],
      [
        "one fulfilment line per order line per shipment",
        async (tx, s) => {
          await tx.$executeRawUnsafe(
            `insert into "Fulfilment" ("id","profileId","orderId","reference","updatedAt") values ('${RUN}_fu','${s.profileId}','${s.orderId}','FU',CURRENT_TIMESTAMP)`,
          );
          for (const id of [`${RUN}_fi1`, `${RUN}_fi2`]) {
            await tx.$executeRawUnsafe(
              `insert into "FulfilmentItem" ("id","fulfilmentId","orderLineId","variantId","qty") values ('${id}','${RUN}_fu','${s.orderLineId}','${s.variantId}',1)`,
            );
          }
        },
      ],
      [
        "one return line per order line per request",
        async (tx, s) => {
          await tx.$executeRawUnsafe(
            `insert into "ReturnRequest" ("id","profileId","orderId","reference","updatedAt") values ('${RUN}_rr','${s.profileId}','${s.orderId}','RR',CURRENT_TIMESTAMP)`,
          );
          for (const id of [`${RUN}_ri1`, `${RUN}_ri2`]) {
            await tx.$executeRawUnsafe(
              `insert into "ReturnItem" ("id","returnRequestId","orderLineId","variantId","qty","updatedAt") values ('${id}','${RUN}_rr','${s.orderLineId}','${s.variantId}',1,CURRENT_TIMESTAMP)`,
            );
          }
        },
      ],
      [
        "a fulfilment reference is unique per profile",
        async (tx, s) => {
          for (const id of [`${RUN}_fa`, `${RUN}_fb`]) {
            await tx.$executeRawUnsafe(
              `insert into "Fulfilment" ("id","profileId","orderId","reference","updatedAt") values ('${id}','${s.profileId}','${s.orderId}','SAME-REF',CURRENT_TIMESTAMP)`,
            );
          }
        },
      ],
      [
        "a return reference is unique per profile",
        async (tx, s) => {
          for (const id of [`${RUN}_ra`, `${RUN}_rb`]) {
            await tx.$executeRawUnsafe(
              `insert into "ReturnRequest" ("id","profileId","orderId","reference","updatedAt") values ('${id}','${s.profileId}','${s.orderId}','SAME-REF',CURRENT_TIMESTAMP)`,
            );
          }
        },
      ],
      [
        "a variant selects at most one value per option",
        async (tx, s) => {
          await tx.$executeRawUnsafe(
            `insert into "ProductOption" ("id","productId","name","updatedAt") values ('${RUN}_opt','${s.productId}','Size',CURRENT_TIMESTAMP)`,
          );
          for (const [id, v] of [[`${RUN}_ov1`, "M"], [`${RUN}_ov2`, "L"]]) {
            await tx.$executeRawUnsafe(
              `insert into "ProductOptionValue" ("id","optionId","value","updatedAt") values ('${id}','${RUN}_opt','${v}',CURRENT_TIMESTAMP)`,
            );
          }
          for (const [id, ov] of [[`${RUN}_sel1`, `${RUN}_ov1`], [`${RUN}_sel2`, `${RUN}_ov2`]]) {
            await tx.$executeRawUnsafe(
              `insert into "ProductVariantOptionValue" ("id","variantId","optionId","optionValueId") values ('${id}','${s.variantId}','${RUN}_opt','${ov}')`,
            );
          }
        },
      ],
      [
        "an option name is unique per product",
        async (tx, s) => {
          for (const id of [`${RUN}_o1`, `${RUN}_o2`]) {
            await tx.$executeRawUnsafe(
              `insert into "ProductOption" ("id","productId","name","updatedAt") values ('${id}','${s.productId}','Colour',CURRENT_TIMESTAMP)`,
            );
          }
        },
      ],
    ];
    for (const [label, body] of uniqueCases) {
      const { refused, detail } = await refuses(`uq_${label.replace(/\W+/g, "").slice(0, 12)}`, body);
      check(label, refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 9. seq is monotonic per profile ---------------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "seq");
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "CommerceEvent" ("id","profileId","kind","subjectType","subjectId","to") values ('${RUN}_sq${i}','${s.profileId}','FULFILMENT','FULFILMENT','x','DRAFT')`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "CommerceEvent" where "profileId"='${s.profileId}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("CommerceEvent.seq is monotonic per profile", ordered, detail);
    }

    // ---- 10. cascade reaches commerce rows but never the order ----
    {
      let variantGone = false;
      let stockGone = false;
      let orderSurvived = false;
      let lineSurvived = false;
      let paymentSurvived = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "cascade");
          await tx.$executeRawUnsafe(
            `insert into "ReturnRequest" ("id","profileId","orderId","reference","refundPaymentId","updatedAt")
             values ('${RUN}_crr','${s.profileId}','${s.orderId}','CRR','${s.paymentId}',CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(`delete from "DigitalProduct" where "id"='${s.productId}'`);
          const v = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "ProductVariant" where "id"='${s.variantId}'`);
          const i = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "InventoryItem" where "id"='${s.itemId}'`);
          const o = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Order" where "id"='${s.orderId}'`);
          const l = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "OrderLine" where "id"='${s.orderLineId}'`);
          const p = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Payment" where "id"='${s.paymentId}'`);
          variantGone = Number(v[0].n) === 0;
          stockGone = Number(i[0].n) === 0;
          orderSurvived = Number(o[0].n) === 1;
          lineSurvived = Number(l[0].n) === 1;
          paymentSurvived = Number(p[0].n) === 1;
          detail = `variants=${v[0].n} stock=${i[0].n} orders=${o[0].n} lines=${l[0].n} payments=${p[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("deleting a product cascades its variants", variantGone, detail);
      check("deleting a product cascades its stock records", stockGone, detail);
      check("deleting a product does NOT delete the Order it was sold on", orderSurvived, detail);
      check("deleting a product does NOT delete the OrderLine", lineSurvived, detail);
      check("deleting a product does NOT delete the referenced Payment", paymentSurvived, detail);
    }

    // ---- 11. zero residue ----------------------------------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "ProductVariant" where "id" like '${RUN}%')
            + (select count(*) from "ProductOption" where "id" like '${RUN}%')
            + (select count(*) from "Fulfilment" where "id" like '${RUN}%')
            + (select count(*) from "ReturnRequest" where "id" like '${RUN}%')
            + (select count(*) from "CommerceEvent" where "id" like '${RUN}%')
            + (select count(*) from "InventoryItem" where "id" like '${RUN}%')
            + (select count(*) from "OrderLine" where "id" like '${RUN}%')
            + (select count(*) from "Order" where "id" like '${RUN}%')
            + (select count(*) from "Payment" where "id" like '${RUN}%')
            + (select count(*) from "DigitalProduct" where "id" like '${RUN}%')
            + (select count(*) from "Location" where "id" like '${RUN}%')
            + (select count(*) from "Workspace" where "id" like '${RUN}%')
            + (select count(*) from "Profile" where "id" like '${RUN}%')
            + (select count(*) from "User" where "id" like '${RUN}%') as n`,
    );
    check("harness left zero residue", Number(residue[0].n) === 0, `residue rows=${residue[0].n}`);
  } finally {
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} invariants passed`);
  if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof");
  if (failed.length) process.exit(1);
  console.log("All commerce schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

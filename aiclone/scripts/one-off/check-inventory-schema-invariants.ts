/**
 * Wave F / F1 commerce inventory schema invariant harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database. Every write happens
 * inside a transaction that is deliberately rolled back.
 *
 * Two families of assertion matter most here.
 *
 * REUSE: this wave must build on DigitalProduct, Location, Order and OrderLine rather
 * than fork a product, warehouse or order model beside them. A forked schema would pass a
 * naive "tables exist" check, so foreign keys are verified to point at the pre-existing
 * models BY NAME, and no Inventory* table is allowed to carry a product-, price- or
 * order-shaped column.
 *
 * ENFORCEMENT: the oversell guarantee is asserted against the DATABASE, not against the
 * engine. Application code can be wrong; a CHECK constraint cannot be bypassed by it. The
 * harness tries to write reserved > onHand, a negative balance and a zero-quantity hold,
 * and requires all three to be refused with no engine involved.
 *
 * The movement ledger is also proved self-consistent: replaying the stored signed deltas
 * must reproduce the stored after-values.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-inventory-schema-invariants.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db";

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704";
const INVERT = process.env.INVERT_ASSERTION === "1";
const RUN = `wf1_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const NEW_TABLES = ["InventoryItem", "InventoryMovement", "InventoryReservation"] as const;

/** Tables that must NOT exist, because the pre-existing ones already do the job. */
const FORBIDDEN_TABLES = [
  "InventoryProduct", "InventoryLocation", "InventoryOrder", "InventoryOrderLine",
  "StockItem", "ProductStock", "Warehouse", "WarehouseBin", "StockLedger", "InventoryPayment",
] as const;

const NEW_ENUMS: Array<[string, number]> = [
  ["InventoryMovementKind", 7],
  ["InventoryMovementActor", 3],
  ["InventoryReservationState", 4],
];

/** The reuse contract: each link must point at the PRE-EXISTING model. */
const REUSE_FKS: Array<[string, string, string]> = [
  ["InventoryItem", "productId", "DigitalProduct"],
  ["InventoryItem", "locationId", "Location"],
  ["InventoryItem", "profileId", "Profile"],
  ["InventoryMovement", "orderId", "Order"],
  ["InventoryMovement", "orderLineId", "OrderLine"],
  ["InventoryMovement", "itemId", "InventoryItem"],
  ["InventoryReservation", "orderLineId", "OrderLine"],
  ["InventoryReservation", "itemId", "InventoryItem"],
];

const CHECK_CONSTRAINTS = [
  "InventoryItem_onHand_nonnegative",
  "InventoryItem_reserved_nonnegative",
  "InventoryItem_reserved_within_onHand",
  "InventoryReservation_qty_positive",
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
  orderId: string;
  orderLineId: string;
  itemId: string;
};

/** Seeds a real profile → location → product → order → line → stock chain. */
async function seed(tx: Tx, tag = "a"): Promise<Seeded> {
  const u = `${RUN}_u_${tag}`;
  const p = `${RUN}_p_${tag}`;
  const w = `${RUN}_w_${tag}`;
  const l = `${RUN}_l_${tag}`;
  const pr = `${RUN}_pr_${tag}`;
  const o = `${RUN}_o_${tag}`;
  const ol = `${RUN}_ol_${tag}`;
  const it = `${RUN}_it_${tag}`;
  await tx.$executeRawUnsafe(
    `insert into "User" ("id","clerkId","email","updatedAt") values ('${u}','clerk_${u}','${u}@example.test',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${p}','${u}','${p}','P ${p}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${w}','${p}','WS','${w}',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Location" ("id","workspaceId","name","updatedAt") values ('${l}','${w}','Shop',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "DigitalProduct" ("id","profileId","title","updatedAt") values ('${pr}','${p}','Widget',CURRENT_TIMESTAMP)`,
  );
  // Wave G moved inventory identity to the variant, so a stock record needs one. The id
  // convention matches the migration's backfill and the engine's ensureDefaultVariant.
  await tx.$executeRawUnsafe(
    `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","updatedAt")
     values ('var_${pr}','${p}','${pr}',true,'Default',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "Order" ("id","profileId","publicToken","number","businessDate","subtotalCents","totalCents","currency","updatedAt")
     values ('${o}','${p}','tok_${o}',1,CURRENT_DATE,1000,1000,'USD',CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "OrderLine" ("id","orderId","titleSnapshot","qty","unitPriceCents","lineTotalCents","updatedAt")
     values ('${ol}','${o}','Widget',2,500,1000,CURRENT_TIMESTAMP)`,
  );
  await tx.$executeRawUnsafe(
    `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","onHand","reserved","updatedAt")
     values ('${it}','${p}','${pr}','var_${pr}','${l}',10,0,CURRENT_TIMESTAMP)`,
  );
  return { profileId: p, locationId: l, productId: pr, orderId: o, orderLineId: ol, itemId: it };
}

let prismaRef: PrismaClient | null = null;

/** Runs `body` inside a transaction that always rolls back, reporting whether it refused. */
async function refuses(body: (tx: Tx, s: Seeded) => Promise<void>, tag = "r"): Promise<{ refused: boolean; detail: string }> {
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

    // ---- 1. the three tables exist, and no fork does ---------------------
    const tables = (
      await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    const missing = NEW_TABLES.filter((t) => !tables.includes(t));
    check("all 3 inventory tables present", missing.length === 0, missing.length ? `missing: ${missing}` : "3/3");
    const forked = FORBIDDEN_TABLES.filter((t) => tables.includes(t));
    check(
      "no parallel product, warehouse, order or payment table was created",
      forked.length === 0,
      forked.join(",") || "none",
    );
    for (const t of ["DigitalProduct", "Location", "Order", "OrderLine"]) {
      check(`pre-existing ${t} still exists`, tables.includes(t), tables.includes(t) ? "present" : "MISSING");
    }

    // ---- 2. the legacy stock column is untouched ------------------------
    const productCols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string; data_type: string }[]>(
      `select column_name, is_nullable, data_type from information_schema.columns
        where table_schema='public' and table_name='DigitalProduct'`,
    );
    const stock = productCols.find((c) => c.column_name === "stock");
    check("DigitalProduct.stock still exists", !!stock, stock ? `${stock.data_type} nullable=${stock.is_nullable}` : "MISSING");
    check("DigitalProduct.stock is still a nullable integer, not altered", stock?.is_nullable === "YES" && stock?.data_type === "integer", `${stock?.data_type}/${stock?.is_nullable}`);

    // ---- 3. the three enums with correct label counts ------------------
    const enums = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
      "select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid",
    );
    for (const [name, expected] of NEW_ENUMS) {
      const n = enums.filter((e) => e.typname === name).length;
      check(`enum ${name} has ${expected} labels`, n === expected, `count=${n}`);
    }

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

    const inventoryCols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `select table_name, column_name from information_schema.columns
        where table_schema='public' and table_name like 'Inventory%'`,
    );
    const smells = inventoryCols.filter((c) =>
      [
        "title", "titleSnapshot", "sku", "priceCents", "unitPriceCents", "compareAtCents",
        "currency", "guestEmail", "guestPhone", "fileUrl", "payStatus", "totalCents",
      ].includes(c.column_name),
    );
    check(
      "no inventory table duplicates product, price or order columns",
      smells.length === 0,
      smells.map((s) => `${s.table_name}.${s.column_name}`).join(",") || "none",
    );
    check(
      "locationId is NOT NULL, so stock is always somewhere",
      (
        await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
          `select is_nullable from information_schema.columns where table_schema='public' and table_name='InventoryItem' and column_name='locationId'`,
        )
      )[0]?.is_nullable === "NO",
    );

    // ---- 5. the oversell guarantee is a CONSTRAINT ---------------------
    const constraints = (
      await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
        `select conname, pg_get_constraintdef(oid) as def from pg_constraint
          where contype='c' and connamespace='public'::regnamespace`,
      )
    );
    for (const name of CHECK_CONSTRAINTS) {
      const found = constraints.find((c) => c.conname === name);
      check(`CHECK constraint ${name} is registered`, !!found, found?.def ?? "MISSING");
    }

    {
      const { refused, detail } = await refuses(async (tx, s) => {
        await tx.$executeRawUnsafe(`update "InventoryItem" set "reserved"=20 where "id"='${s.itemId}'`);
      }, "over");
      // This is the single inverted assertion: the database itself must make
      // overselling impossible, independently of any application code.
      const expected = INVERT ? !refused : refused && detail.length > 0;
      check("the database refuses reserved greater than onHand", expected, detail || "NO ERROR - OVERSELL WAS ACCEPTED");
    }
    {
      const { refused, detail } = await refuses(async (tx, s) => {
        await tx.$executeRawUnsafe(`update "InventoryItem" set "onHand"=-1 where "id"='${s.itemId}'`);
      }, "neg");
      check("the database refuses a negative onHand", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx, s) => {
        await tx.$executeRawUnsafe(`update "InventoryItem" set "onHand"=5, "reserved"=-1 where "id"='${s.itemId}'`);
      }, "negres");
      check("the database refuses a negative reserved", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx, s) => {
        await tx.$executeRawUnsafe(
          `insert into "InventoryReservation" ("id","itemId","orderLineId","qty","updatedAt") values ('${RUN}_r0','${s.itemId}','${s.orderLineId}',0,CURRENT_TIMESTAMP)`,
        );
      }, "zeroqty");
      check("the database refuses a zero-quantity reservation", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      // The boundary case must be ACCEPTED: reserving everything on hand is legal.
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "exact");
          await tx.$executeRawUnsafe(`update "InventoryItem" set "reserved"=10 where "id"='${s.itemId}'`);
          const row = await tx.$queryRawUnsafe<{ onHand: number; reserved: number }[]>(
            `select "onHand","reserved" from "InventoryItem" where "id"='${s.itemId}'`,
          );
          accepted = Number(row[0].reserved) === 10 && Number(row[0].onHand) === 10;
          detail = `onHand=${row[0].onHand} reserved=${row[0].reserved}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("reserving exactly the whole on-hand quantity is allowed", accepted, detail);
    }

    // ---- 6. append-only ledger ---------------------------------------
    const trg = (
      await prisma.$queryRawUnsafe<{ tbl: string; ev: string }[]>(
        "select event_object_table tbl, event_manipulation ev from information_schema.triggers where trigger_schema='public' and trigger_name like '%append_only%'",
      )
    ).map((r) => `${r.tbl}.${r.ev}`);
    for (const want of ["InventoryMovement.UPDATE", "InventoryMovement.DELETE"]) {
      check(`trigger ${want}`, trg.includes(want), trg.includes(want) ? "registered" : `have: ${trg}`);
    }
    // The five earlier ledgers must still be armed; this migration reused their function.
    for (const want of [
      "ActivityEvent.UPDATE", "ReservationEvent.UPDATE", "AppointmentEvent.UPDATE",
      "CaseEvent.UPDATE", "CohortEvent.UPDATE",
    ]) {
      check(`pre-existing trigger ${want} still armed`, trg.includes(want), trg.includes(want) ? "armed" : `have: ${trg}`);
    }

    for (const op of ["UPDATE", "DELETE"] as const) {
      const { refused, detail } = await refuses(async (tx, s) => {
        const mid = `${RUN}_mv_${op}`;
        await tx.$executeRawUnsafe(
          `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","reservedDelta","onHandAfter","reservedAfter")
           values ('${mid}','${s.itemId}','RECEIPT',10,0,10,0)`,
        );
        if (op === "UPDATE") {
          await tx.$executeRawUnsafe(`update "InventoryMovement" set "qtyDelta"=999 where "id"='${mid}'`);
        } else {
          await tx.$executeRawUnsafe(`delete from "InventoryMovement" where "id"='${mid}'`);
        }
      }, `ao${op}`);
      check(`InventoryMovement refuses ${op}`, refused && detail.length > 0, detail || "NO ERROR OBSERVED");
    }

    // ---- 7. the ledger is self-verifying ----------------------------
    {
      let consistent = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "ledger");
          // onHand starts at 10, reserved at 0. Receipt +5, reserve 3, consume 3.
          const steps: Array<[string, number, number, number, number]> = [
            ["RECEIPT", 5, 0, 15, 0],
            ["RESERVE", 0, 3, 15, 3],
            ["CONSUME", -3, -3, 12, 0],
          ];
          let i = 0;
          for (const [kind, qtyDelta, reservedDelta, onHandAfter, reservedAfter] of steps) {
            await tx.$executeRawUnsafe(
              `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","reservedDelta","onHandAfter","reservedAfter")
               values ('${RUN}_lg${i}','${s.itemId}','${kind}',${qtyDelta},${reservedDelta},${onHandAfter},${reservedAfter})`,
            );
            i += 1;
          }
          await tx.$executeRawUnsafe(`update "InventoryItem" set "onHand"=12, "reserved"=0 where "id"='${s.itemId}'`);
          const rows = await tx.$queryRawUnsafe<
            { qtyDelta: number; reservedDelta: number; onHandAfter: number; reservedAfter: number }[]
          >(
            `select "qtyDelta","reservedDelta","onHandAfter","reservedAfter" from "InventoryMovement" where "itemId"='${s.itemId}' order by "seq"`,
          );
          let onHand = 10;
          let reserved = 0;
          let ok = rows.length === 3;
          for (const r of rows) {
            onHand += Number(r.qtyDelta);
            reserved += Number(r.reservedDelta);
            if (onHand !== Number(r.onHandAfter) || reserved !== Number(r.reservedAfter)) ok = false;
          }
          const item = await tx.$queryRawUnsafe<{ onHand: number; reserved: number }[]>(
            `select "onHand","reserved" from "InventoryItem" where "id"='${s.itemId}'`,
          );
          consistent = ok && Number(item[0].onHand) === onHand && Number(item[0].reserved) === reserved;
          detail = `replayed onHand=${onHand} reserved=${reserved} stored=${item[0].onHand}/${item[0].reserved}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("replaying the movement deltas reproduces the stored balances", consistent, detail);
    }

    // ---- 8. uniqueness that makes the model coherent ---------------
    {
      // Wave G moved this key from (product, location) to (variant, location). The
      // invariant is unchanged in spirit - one stock record per sellable unit per place -
      // but it is now expressed against the variant, so the assertion says so.
      const { refused, detail } = await refuses(async (tx, s) => {
        await tx.$executeRawUnsafe(
          `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","updatedAt") values ('${RUN}_dup','${s.profileId}','${s.productId}','var_${s.productId}','${s.locationId}',CURRENT_TIMESTAMP)`,
        );
      }, "dupitem");
      check("one stock record per variant per location", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      // The capability the identity change unlocked: two variants of the SAME product can
      // now hold separate stock at the same location, which is the whole point of variants.
      let accepted = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "twovariants");
          await tx.$executeRawUnsafe(
            `insert into "ProductVariant" ("id","profileId","productId","isDefault","title","ordinal","updatedAt")
             values ('${RUN}_v2','${s.profileId}','${s.productId}',false,'Large',1,CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(
            `insert into "InventoryItem" ("id","profileId","productId","variantId","locationId","onHand","updatedAt")
             values ('${RUN}_i2','${s.profileId}','${s.productId}','${RUN}_v2','${s.locationId}',4,CURRENT_TIMESTAMP)`,
          );
          const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from "InventoryItem" where "productId"='${s.productId}' and "locationId"='${s.locationId}'`,
          );
          accepted = Number(rows[0].n) === 2;
          detail = `stock rows for product at location=${rows[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("two variants of one product hold separate stock at the same location", accepted, detail);
    }
    {
      const { refused, detail } = await refuses(async (tx, s) => {
        const ins = (id: string) =>
          `insert into "InventoryReservation" ("id","itemId","orderLineId","qty","updatedAt") values ('${id}','${s.itemId}','${s.orderLineId}',1,CURRENT_TIMESTAMP)`;
        await tx.$executeRawUnsafe(ins(`${RUN}_rv1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_rv2`));
      }, "duprv");
      check("one reservation per order line", refused && detail.length > 0, detail || "NO ERROR");
    }
    {
      const { refused, detail } = await refuses(async (tx, s) => {
        const ins = (id: string) =>
          `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","onHandAfter","reservedAfter","idempotencyKey")
           values ('${id}','${s.itemId}','ADJUSTMENT',1,11,0,'KEY-1')`;
        await tx.$executeRawUnsafe(ins(`${RUN}_mk1`));
        await tx.$executeRawUnsafe(ins(`${RUN}_mk2`));
      }, "dupkey");
      check("a movement idempotency key is unique per item", refused && detail.length > 0, detail || "NO ERROR");
    }

    // ---- 9. seq is monotonic per item -----------------------------
    {
      let ordered = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "seq");
          for (let i = 0; i < 3; i += 1) {
            await tx.$executeRawUnsafe(
              `insert into "InventoryMovement" ("id","itemId","kind","qtyDelta","onHandAfter","reservedAfter") values ('${RUN}_sq${i}','${s.itemId}','COUNT',0,10,0)`,
            );
          }
          const rows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
            `select "seq" from "InventoryMovement" where "itemId"='${s.itemId}' order by "seq"`,
          );
          const seqs = rows.map((r) => Number(r.seq));
          ordered = seqs.length === 3 && seqs[0] < seqs[1] && seqs[1] < seqs[2];
          detail = `seqs=${seqs.join(",")}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("InventoryMovement.seq is monotonic per item", ordered, detail);
    }

    // ---- 10. cascade reaches inventory but never the order ---------
    {
      let itemGone = false;
      let orderSurvived = false;
      let lineSurvived = false;
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "cascade");
          await tx.$executeRawUnsafe(
            `insert into "InventoryReservation" ("id","itemId","orderLineId","qty","updatedAt") values ('${RUN}_cr','${s.itemId}','${s.orderLineId}',2,CURRENT_TIMESTAMP)`,
          );
          await tx.$executeRawUnsafe(`delete from "DigitalProduct" where "id"='${s.productId}'`);
          const items = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "InventoryItem" where "id"='${s.itemId}'`);
          const orders = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "Order" where "id"='${s.orderId}'`);
          const lines = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int n from "OrderLine" where "id"='${s.orderLineId}'`);
          itemGone = Number(items[0].n) === 0;
          orderSurvived = Number(orders[0].n) === 1;
          lineSurvived = Number(lines[0].n) === 1;
          detail = `items=${items[0].n} orders=${orders[0].n} lines=${lines[0].n}`;
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) detail = errLine(e);
      }
      check("deleting a product cascades its stock record", itemGone, detail);
      check("deleting a product does NOT delete the Order it was sold on", orderSurvived, detail);
      check("deleting a product does NOT delete the OrderLine", lineSurvived, detail);
    }

    // ---- 11. defaults keep a new record honest -------------------
    {
      let detail = "";
      try {
        await prisma.$transaction(async (tx) => {
          const s = await seed(tx, "defaults");
          await tx.$executeRawUnsafe(
            `insert into "InventoryReservation" ("id","itemId","orderLineId","qty","updatedAt") values ('${RUN}_dr','${s.itemId}','${s.orderLineId}',1,CURRENT_TIMESTAMP)`,
          );
          const rv = await tx.$queryRawUnsafe<{ st: string; ex: Date | null }[]>(
            `select "state" st, "expiresAt" ex from "InventoryReservation" where "id"='${RUN}_dr'`,
          );
          const it = await tx.$queryRawUnsafe<{ tracking: boolean; safety: number }[]>(
            `select "trackingEnabled" tracking, "safetyStock" safety from "InventoryItem" where "id"='${s.itemId}'`,
          );
          detail = `state=${rv[0].st} expires=${rv[0].ex} tracking=${it[0].tracking} safety=${it[0].safety}`;
          check("a new reservation defaults to HELD with no implicit expiry", rv[0].st === "HELD" && rv[0].ex === null, detail);
          check("a new stock record tracks by default with zero safety stock", it[0].tracking === true && Number(it[0].safety) === 0, detail);
          throw new Rollback();
        });
      } catch (e) {
        if (!(e instanceof Rollback)) check("defaults probe completed", false, errLine(e));
      }
    }

    // ---- 12. zero residue ---------------------------------------
    const residue = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select (select count(*) from "InventoryItem" where "id" like '${RUN}%')
            + (select count(*) from "InventoryMovement" where "id" like '${RUN}%')
            + (select count(*) from "InventoryReservation" where "id" like '${RUN}%')
            + (select count(*) from "OrderLine" where "id" like '${RUN}%')
            + (select count(*) from "Order" where "id" like '${RUN}%')
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
  console.log("All inventory schema invariants hold.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

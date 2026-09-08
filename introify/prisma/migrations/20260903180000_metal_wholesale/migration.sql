-- Additive gold wholesale / store stock-in ledger.
-- Lots cannot go negative. Party ledger is append-only via reject_append_only_mutation().

CREATE OR REPLACE FUNCTION "reject_append_only_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE TABLE "PartyAccount" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "contactId" TEXT,
    "kind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "gstin" TEXT,
    "creditLimitPaise" INTEGER NOT NULL DEFAULT 0,
    "termsDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartyAccount_contactId_key" ON "PartyAccount"("contactId");
CREATE INDEX "PartyAccount_profileId_kind_idx" ON "PartyAccount"("profileId", "kind");
CREATE INDEX "PartyAccount_profileId_phone_idx" ON "PartyAccount"("profileId", "phone");

CREATE TABLE "MetalLot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "grossMg" INTEGER NOT NULL,
    "remainingGrossMg" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL DEFAULT 0,
    "purityBps" INTEGER NOT NULL,
    "costTouchBps" INTEGER NOT NULL,
    "sourceBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetalLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetalLot_profileId_remainingGrossMg_idx" ON "MetalLot"("profileId", "remainingGrossMg");

CREATE TABLE "MetalBill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "partyAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "k24PaisePer10g" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "payStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueOn" TIMESTAMP(3),
    "publicToken" TEXT NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "liftedByProfileId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetalBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetalBill_publicToken_key" ON "MetalBill"("publicToken");
CREATE INDEX "MetalBill_profileId_kind_payStatus_idx" ON "MetalBill"("profileId", "kind", "payStatus");
CREATE INDEX "MetalBill_partyAccountId_payStatus_idx" ON "MetalBill"("partyAccountId", "payStatus");

CREATE TABLE "MetalBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lotId" TEXT,
    "title" TEXT NOT NULL,
    "grossMg" INTEGER NOT NULL,
    "touchBpsBilled" INTEGER NOT NULL,
    "makingPaise" INTEGER NOT NULL DEFAULT 0,
    "linePaise" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MetalBillLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetalPayment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "partyAccountId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "paise" INTEGER NOT NULL,
    "fineMg" INTEGER NOT NULL DEFAULT 0,
    "ref" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetalPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetalPayment_profileId_at_idx" ON "MetalPayment"("profileId", "at");
CREATE INDEX "MetalPayment_partyAccountId_at_idx" ON "MetalPayment"("partyAccountId", "at");

CREATE TABLE "MetalAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "paise" INTEGER NOT NULL,

    CONSTRAINT "MetalAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetalAllocation_paymentId_billId_key" ON "MetalAllocation"("paymentId", "billId");

CREATE TABLE "PartyLedgerEntry" (
    "id" TEXT NOT NULL,
    "partyAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "paiseDelta" INTEGER NOT NULL,
    "fineMgDelta" INTEGER NOT NULL DEFAULT 0,
    "paiseAfter" INTEGER NOT NULL,
    "fineMgAfter" INTEGER NOT NULL DEFAULT 0,
    "billId" TEXT,
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartyLedgerEntry_partyAccountId_idempotencyKey_key" ON "PartyLedgerEntry"("partyAccountId", "idempotencyKey");
CREATE INDEX "PartyLedgerEntry_partyAccountId_at_idx" ON "PartyLedgerEntry"("partyAccountId", "at");

ALTER TABLE "PartyAccount" ADD CONSTRAINT "PartyAccount_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyAccount" ADD CONSTRAINT "PartyAccount_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetalLot" ADD CONSTRAINT "MetalLot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetalLot" ADD CONSTRAINT "MetalLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetalBill" ADD CONSTRAINT "MetalBill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetalBill" ADD CONSTRAINT "MetalBill_partyAccountId_fkey" FOREIGN KEY ("partyAccountId") REFERENCES "PartyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetalBillLine" ADD CONSTRAINT "MetalBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MetalBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetalBillLine" ADD CONSTRAINT "MetalBillLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "MetalLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetalPayment" ADD CONSTRAINT "MetalPayment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetalPayment" ADD CONSTRAINT "MetalPayment_partyAccountId_fkey" FOREIGN KEY ("partyAccountId") REFERENCES "PartyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetalAllocation" ADD CONSTRAINT "MetalAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MetalPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetalAllocation" ADD CONSTRAINT "MetalAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "MetalBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_partyAccountId_fkey" FOREIGN KEY ("partyAccountId") REFERENCES "PartyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetalLot" ADD CONSTRAINT "MetalLot_remaining_nonnegative" CHECK ("remainingGrossMg" >= 0);
ALTER TABLE "MetalLot" ADD CONSTRAINT "MetalLot_remaining_within_gross" CHECK ("remainingGrossMg" <= "grossMg");
ALTER TABLE "MetalBill" ADD CONSTRAINT "MetalBill_paid_within_total" CHECK ("paidPaise" >= 0 AND "paidPaise" <= "totalPaise");

CREATE TRIGGER "PartyLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "PartyLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "reject_append_only_mutation"();

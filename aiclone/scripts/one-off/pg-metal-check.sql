SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('PartyAccount','MetalLot','MetalBill','MetalBillLine','MetalPayment','MetalAllocation','PartyLedgerEntry')
ORDER BY c.relname;

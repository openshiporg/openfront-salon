-- Cash tips are handed to the stylist at checkout; they were wrongly left payable through payroll.
UPDATE "GratuityLedgerEntry" g
SET "payoutStatus" = 'paid'
FROM "Payment" p
WHERE g."payment" = p."id"
  AND p."paymentMethod" = 'cash'
  AND g."type" = 'allocation'
  AND g."payoutStatus" = 'payable';

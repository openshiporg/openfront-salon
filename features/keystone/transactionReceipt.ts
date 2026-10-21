export type TransactionReceiptLine = { quantity?: number | null; unitPrice?: number | null; discount?: number | null };
export type TransactionReceiptEvidence = {
  metadata?: unknown;
  lineItems?: TransactionReceiptLine[] | null;
  payment?: { tax?: number | null; totalAmount?: number | null } | null;
};

function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Prefer immutable controlled-checkout facts; never invent tax/total from a universal rate. */
export function transactionReceiptTotals(transaction: TransactionReceiptEvidence) {
  const metadata = transaction.metadata && typeof transaction.metadata === "object"
    ? transaction.metadata as Record<string, unknown>
    : {};
  if (metadata.source === "controlled_checkout") {
    return {
      subtotal: cents(metadata.subtotal),
      tax: cents(metadata.tax),
      discount: cents(metadata.discount),
      total: cents(metadata.total),
    };
  }
  const lines = transaction.lineItems || [];
  return {
    subtotal: lines.reduce((sum, line) => sum + (cents(line.unitPrice) || 0) * (cents(line.quantity) ?? 1), 0),
    tax: cents(transaction.payment?.tax),
    discount: lines.reduce((sum, line) => sum + (cents(line.discount) || 0), 0),
    total: cents(transaction.payment?.totalAmount),
  };
}

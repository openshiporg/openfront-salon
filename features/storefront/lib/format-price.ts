const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/** Storefront service prices are dollars (cents ÷ 100 in the data layer). */
export function formatPrice(dollars: number | null | undefined): string {
  return priceFormatter.format(Number(dollars) || 0)
}

/** Menu prices drop empty cents: $85, $92.50. */
export function formatMenuPrice(dollars: number | null | undefined): string {
  const value = Number(dollars) || 0
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
}

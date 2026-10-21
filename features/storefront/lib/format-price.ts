const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/** Storefront service prices are dollars (cents ÷ 100 in the data layer). */
export function formatPrice(dollars: number | null | undefined): string {
  return priceFormatter.format(Number(dollars) || 0)
}

/** Mirrors the database's check constraint on `products.stock_qty`. */
export const MAX_STOCK = 100000;

export function isStock(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_STOCK;
}

/** At or below this many left, the shop says so. */
export const LOW_STOCK = 5;

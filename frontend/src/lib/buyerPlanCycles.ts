/**
 * How a buyer plan can be billed, and what each cycle costs.
 *
 * The client's cycles: three months at 10% off, six at 20%. Kept here so the
 * page that sells the plan and the page that lists what someone pays agree on
 * the price — two copies of a discount is one copy too many.
 */
export type BuyerCycle = "MONTHLY" | "THREE_MONTH" | "SIX_MONTH";

export const BUYER_CYCLES: { value: BuyerCycle; label: string; months: number; discount: number }[] = [
  { value: "MONTHLY", label: "Monthly", months: 1, discount: 0 },
  { value: "THREE_MONTH", label: "3 Months", months: 3, discount: 0.1 },
  { value: "SIX_MONTH", label: "6 Months", months: 6, discount: 0.2 },
];

/** What one billing period costs, from the plan's monthly price. */
export function buyerCyclePrice(monthly: number, cycle: BuyerCycle): number {
  const c = BUYER_CYCLES.find((x) => x.value === cycle) ?? BUYER_CYCLES[0];
  return Math.round(monthly * c.months * (1 - c.discount));
}

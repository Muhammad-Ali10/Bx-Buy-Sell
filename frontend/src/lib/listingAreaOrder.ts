import type { DashboardStep } from "@/pages/Dashboard";

/**
 * The areas of the listing form an administrator can arrange.
 *
 * They are dragged in the Content Management menu, and the seller's form asks
 * them in the same order. Category and Packages are not among them: the
 * category decides which questions exist at all, so it has to come first, and
 * Packages is payment, so it has to come last.
 *
 * The ids are the Content Management tabs' own slugs, which is also what the
 * server stores. `Backend/src/listing-area-order/dto/listing-area-order.dto.ts`
 * holds the same list — keep the two in step.
 */
export const LISTING_AREAS = [
  "brand-info",
  "tools",
  "financials",
  "additional-infos",
  "accounts",
  "ad-informations",
  "handover",
] as const;

export type ListingArea = (typeof LISTING_AREAS)[number];

export const DEFAULT_AREA_ORDER: ListingArea[] = [...LISTING_AREAS];

/** The seller's steps behind each area. Additional Infos is three of them, kept together. */
const AREA_STEPS: Record<ListingArea, DashboardStep[]> = {
  "brand-info": ["brand-information"],
  tools: ["tools"],
  financials: ["financials"],
  "additional-infos": ["statistics", "products", "management"],
  accounts: ["accounts"],
  "ad-informations": ["ad-informations"],
  handover: ["handover"],
};

export const isListingArea = (value: unknown): value is ListingArea =>
  typeof value === "string" && (LISTING_AREAS as readonly string[]).includes(value);

/**
 * A saved order, made safe to use.
 *
 * Unknown ids and repeats are dropped. An area the saved order does not
 * mention — one added after the order was last arranged — goes at the end, so
 * it is still asked rather than silently skipped.
 */
export function normalizeAreaOrder(saved: unknown): ListingArea[] {
  const order: ListingArea[] = [];
  if (Array.isArray(saved)) {
    for (const id of saved) {
      if (isListingArea(id) && !order.includes(id)) order.push(id);
    }
  }
  for (const id of LISTING_AREAS) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

/**
 * Steps the seller is not asked, for now.
 *
 * The client had Tools taken out of the admin menu, then out of Create Listing
 * as well. Like the admin row it is hidden, not deleted: the step, its screen
 * and what existing listings saved in it all stay, and bringing it back is
 * deleting the id from this set. It keeps its place in the arranged order, so
 * it returns where it was.
 */
export const HIDDEN_STEPS: ReadonlySet<DashboardStep> = new Set<DashboardStep>(["tools"]);

/** Every step, hidden ones included, first to last. */
const allSteps = (order: ListingArea[]): DashboardStep[] => [
  "category",
  ...order.flatMap((area) => AREA_STEPS[area]),
  "packages",
];

/** Every step of the seller's form, first to last. */
export const listingSteps = (order: ListingArea[]): DashboardStep[] =>
  allSteps(order).filter((step) => !HIDDEN_STEPS.has(step));

/**
 * Where to be instead of a hidden step: the next one that is asked.
 *
 * A draft saved on the Tools step, or a link to it, would otherwise open on a
 * screen that is no longer in the form.
 */
export function visibleStep(step: DashboardStep, order: ListingArea[]): DashboardStep {
  if (!HIDDEN_STEPS.has(step)) return step;
  const steps = allSteps(order);
  const after = steps.slice(steps.indexOf(step) + 1).find((next) => !HIDDEN_STEPS.has(next));
  return after ?? "packages";
}

/**
 * A dragged order, with the areas whose rows are not on screen put back where
 * they were.
 *
 * A hidden row cannot be dragged, so it is missing from what the drag hands
 * back. Saving that would drop the area from the order, and the seller's form
 * would then ask for it last instead of where it belongs. Each one goes back
 * behind the same area it followed before.
 */
export function keepHiddenAreas(
  dragged: ListingArea[],
  saved: readonly ListingArea[],
  hidden: ReadonlySet<string>,
): ListingArea[] {
  const order = [...dragged];
  saved.forEach((id, index) => {
    if (!hidden.has(id) || order.includes(id)) return;
    const before = saved
      .slice(0, index)
      .reverse()
      .find((other) => order.includes(other));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  return order;
}

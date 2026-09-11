import * as z from 'zod';

/**
 * The listing form's areas an administrator can arrange, in their default order.
 *
 * Category and Packages are not here: the category decides which questions
 * exist, so it always comes first, and Packages is payment, so it always comes
 * last. The ids are the Content Management tabs' slugs, and
 * `frontend/src/lib/listingAreaOrder.ts` holds the same list — keep the two in
 * step.
 */
export const LISTING_AREAS = [
  'brand-info',
  'tools',
  'financials',
  'additional-infos',
  'accounts',
  'ad-informations',
  'handover',
] as const;

export type ListingArea = (typeof LISTING_AREAS)[number];

/**
 * A new order: every area, each exactly once.
 *
 * A partial list is refused rather than filled in. The menu always sends all
 * of them, so a short one means something went wrong on the way, and saving it
 * would quietly move whatever was left out.
 */
export const ListingAreaOrderSchema = z.object({
  areas: z
    .array(z.enum(LISTING_AREAS))
    .refine(
      (areas) =>
        areas.length === LISTING_AREAS.length &&
        new Set(areas).size === LISTING_AREAS.length,
      { message: 'Send every area exactly once' },
    ),
});
export type ListingAreaOrderT = z.infer<typeof ListingAreaOrderSchema>;

/**
 * A stored order, made safe to hand out: unknown ids and repeats dropped, and
 * any area it does not mention added at the end.
 */
export function normalizeAreaOrder(saved: unknown): ListingArea[] {
  const known: readonly string[] = LISTING_AREAS;
  const order: ListingArea[] = [];
  if (Array.isArray(saved)) {
    for (const id of saved) {
      if (typeof id === 'string' && known.includes(id) && !order.includes(id as ListingArea)) {
        order.push(id as ListingArea);
      }
    }
  }
  for (const id of LISTING_AREAS) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

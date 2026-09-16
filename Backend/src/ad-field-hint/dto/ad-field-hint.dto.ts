import * as z from 'zod';

/**
 * The figures on a published ad that no question stands behind.
 *
 * Every other ⓘ on the ad belongs to a question, and its wording is that
 * question's `publicHint`. These are worked out instead of answered — the
 * profit margin from the P&L table, the multiples from the asking price, the
 * age from the starting date — so there is no question to hang their wording
 * on, and until now the sentences beside them lived in the page's own code
 * where an administrator could not reach them.
 *
 * The keys are the page's own names for the figures.
 * `frontend/src/lib/adFieldHints.ts` holds the same list — keep the two in step.
 */
export const AD_FIELD_HINT_KEYS = [
  'location',
  'businessAge',
  'profitMargin',
  'annualRevenue',
  'monthlyRevenue',
  'annualProfit',
  'monthlyProfit',
  'revenueMultiple',
  'profitMultiple',
  // The two headings, whose ⓘ said nothing at all until now.
  'averages',
  'multiples',
] as const;

export type AdFieldHintKey = (typeof AD_FIELD_HINT_KEYS)[number];

export const isAdFieldHintKey = (value: unknown): value is AdFieldHintKey =>
  typeof value === 'string' && (AD_FIELD_HINT_KEYS as readonly string[]).includes(value);

/**
 * What the panel sends: the figures it holds, each with its sentence.
 *
 * Only the keys sent are touched, so a panel that shows three figures cannot
 * wipe the wording of the six it does not. An empty string is a deletion — the
 * administrator has cleared the box, and the page goes back to the sentence it
 * came with.
 */
export const AdFieldHintSaveSchema = z.object({
  hints: z.record(z.enum(AD_FIELD_HINT_KEYS), z.string().max(400)),
});

export type AdFieldHintSaveT = z.infer<typeof AdFieldHintSaveSchema>;

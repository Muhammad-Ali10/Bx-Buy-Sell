/**
 * The ⓘ beside the figures on a published ad that no question stands behind.
 *
 * Every other ⓘ on an ad belongs to a question, and an administrator writes its
 * wording in the question's "Public Text Hint" box. The summary figures are
 * worked out instead of answered — the margin from the P&L table, the multiples
 * from the asking price, the age from the starting date — so there was no
 * question to hang their wording on, and the sentences sat in the page's own
 * code. An administrator filling in hints saw nothing change beside exactly
 * these figures.
 *
 * `Backend/src/ad-field-hint/dto/ad-field-hint.dto.ts` holds the same keys —
 * keep the two in step.
 */
export const AD_FIELD_HINTS = [
  { key: 'location', label: 'Location' },
  { key: 'businessAge', label: 'Business Age' },
  { key: 'profitMargin', label: 'Profit Margin' },
  { key: 'annualRevenue', label: '⌀ Annual Revenue' },
  { key: 'monthlyRevenue', label: '⌀ Monthly Revenue' },
  { key: 'annualProfit', label: '⌀ Annual Profit' },
  { key: 'monthlyProfit', label: '⌀ Monthly Profit' },
  { key: 'revenueMultiple', label: 'Revenue Multiple' },
  { key: 'profitMultiple', label: 'Profit Multiple' },
  { key: 'averages', label: 'Averages (heading)' },
  { key: 'multiples', label: 'Multiples (heading)' },
] as const;

export type AdFieldHintKey = (typeof AD_FIELD_HINTS)[number]['key'];

export type AdFieldHintMap = Partial<Record<AdFieldHintKey, string>>;

/**
 * A server answer, made safe to use.
 *
 * Anything that is not one of this page's figures, and anything blank, is
 * dropped — a blank would replace the page's own sentence with nothing, which
 * reads as a missing explanation rather than the default one.
 */
export const normalizeAdFieldHints = (value: unknown): AdFieldHintMap => {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const out: AdFieldHintMap = {};
  for (const { key } of AD_FIELD_HINTS) {
    const text = typeof source[key] === 'string' ? (source[key] as string).trim() : '';
    if (text) out[key] = text;
  }
  return out;
};

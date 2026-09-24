import { GROSS_REVENUE_ROW, OVERALL_COSTS_ROW, REVENUE_ROW } from "@/lib/financialTableUtils";

/**
 * What a seller is told on Packages → "Next Step" while anything the listing
 * needs is still empty. The client's own wording, word for word.
 */
export const REQUIRED_FIELDS_MESSAGE =
  "Before you can publish your listing, please fill out all required fields.";

const hasAmount = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text !== "" && parseFloat(text) !== 0 && !Number.isNaN(parseFloat(text));
};

/**
 * Whether the Financials step holds what it demands of the seller: Revenue for
 * at least one year, and at least one cost from any year.
 *
 * The same rule the step applies on "Continue". The last check before
 * publishing never looked at the step, so a seller who jumped there through
 * the sidebar could publish a listing with an empty profit & loss table.
 *
 * Listings saved before the table existed keep their figures as `months`; a
 * revenue and a cost among those count too, so editing one is not refused.
 */
export function financialsComplete(formData: Record<string, any> | null | undefined): boolean {
  const data = formData || {};
  const table = data.financialData;
  const columns = data.columnLabels;
  const rows = data.rowLabels;

  if (table && Array.isArray(columns) && Array.isArray(rows)) {
    const filled = (row: string) =>
      columns.some((col: { key?: string }) => col?.key !== undefined && hasAmount(table[row]?.[col.key]));
    const hasRevenue = filled(REVENUE_ROW) || filled(GROSS_REVENUE_ROW);
    const costRows =
      data.financialType === "simple"
        ? [OVERALL_COSTS_ROW]
        : rows.filter(
            (row: string) => row !== OVERALL_COSTS_ROW && !String(row).toLowerCase().includes("revenue"),
          );
    return hasRevenue && costRows.some(filled);
  }

  if (Array.isArray(data.months)) {
    const hasRevenue = data.months.some((m: any) => hasAmount(m?.revenue) || hasAmount(m?.revenue2));
    const hasCost = data.months.some((m: any) => hasAmount(m?.cost));
    return hasRevenue && hasCost;
  }

  return false;
}

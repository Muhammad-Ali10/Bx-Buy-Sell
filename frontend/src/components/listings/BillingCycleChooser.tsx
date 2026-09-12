import { BILLING_CYCLES, type BillingCycleId } from "@/lib/packagePricing";

/**
 * The three billing cycles, as a radio group inside the card being bought.
 *
 * Written once because it now appears twice on the same screen: on the chosen
 * package and on the chosen add-on. The client's note was "the add-ons also
 * need billing cycle options (monthly, 3 months, 6 months) — the same as we
 * already have for the packages", and copying the markup would have been the
 * fastest way to let the two drift apart.
 *
 * It lives *inside* a card, which is why it stops its clicks: on the wizard
 * the whole card is the select target, and a click on a cycle would otherwise
 * deselect the very thing being priced.
 */
export const BillingCycleChooser = ({
  value,
  onChange,
  disabled = false,
  flush = false,
}: {
  value: BillingCycleId;
  onChange: (cycle: BillingCycleId) => void;
  disabled?: boolean;
  /**
   * Sit directly under a header someone else drew.
   *
   * On the Manage Subscription page the strip above these radios says what is
   * about to happen — "Renews in 20 Days", "Downgrade Starts in 20 Days" —
   * and is red or black depending on which. A second header of our own saying
   * "Select Billing Cycle" underneath it would be one heading too many.
   */
  flush?: boolean;
}) => (
  <div
    className={flush ? "overflow-hidden rounded-b-2xl" : "mt-4 overflow-hidden rounded-2xl"}
    style={{ background: "rgba(249, 250, 251, 0.1)" }}
    onClick={(event) => event.stopPropagation()}
  >
    {!flush && (
      <h2 className="m-0 px-3 py-2.5 text-xs font-semibold text-black/80 uppercase tracking-wide">
        Select Billing Cycle
      </h2>
    )}
    <div className={flush ? "px-2 py-2" : "px-2 pb-2"}>
      {BILLING_CYCLES.map((cycle) => {
        const selected = value === cycle.id;
        return (
          <button
            key={cycle.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cycle.id)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left disabled:opacity-60"
            style={{ background: selected ? "rgba(255,255,255,0.08)" : "transparent" }}
          >
            <span className="flex items-center gap-2 text-xs text-black/70">
              <span
                className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-black/70"
                aria-hidden
              >
                {selected && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "#000000" }}
                  />
                )}
              </span>
              {cycle.label}
            </span>
            {/* Nothing next to Monthly, as the design has it — "No discount"
                were our own words, not theirs. */}
            {cycle.discountPercent > 0 && (
              <span className="text-[11px] text-black/70">
                {cycle.discountPercent}% Discount
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default BillingCycleChooser;

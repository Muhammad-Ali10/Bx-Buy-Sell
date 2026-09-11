/**
 * What Account Details says about proof of funds.
 *
 * The verification overview reports the case: absent until documents are
 * sent, UNASSIGNED or IN_REVIEW while they wait for a moderator, COMPLETED
 * once reviewed — and verified only when that review found an amount. New
 * documents put a verified case back in the queue, so it reads "In Review"
 * again until the new evidence is judged. A finished review that verified
 * nothing (every document declined) is back to square one.
 *
 * The row used to say "Verify Now" through all of this, so someone who had
 * just sent their documents came back to be asked for them again.
 */
export type CapacityRowStatus = "NONE" | "IN_REVIEW" | "VERIFIED";

export function capacityRowStatus(
  funds?: { verified?: boolean | null; status?: string | null } | null,
): CapacityRowStatus {
  if (funds?.verified) return "VERIFIED";
  const status = String(funds?.status ?? "").toUpperCase();
  if (status === "UNASSIGNED" || status === "IN_REVIEW") return "IN_REVIEW";
  return "NONE";
}

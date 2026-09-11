/**
 * Who the admin screens mark as a PRO member.
 *
 * PRO is the Pro plan ("Premium" on the pricing page); Starter is paid too, but
 * it is not PRO. The subscription must also be ACTIVE. Cancelling stops it at
 * the end of the paid period, and it stays ACTIVE until then. A subscription
 * that has ended keeps the Pro plan on its row, and only its CANCELLED status
 * says it is over.
 */
export const isProMember = (
  subscription:
    | { status?: string | null; plan?: { slug?: string | null } | null }
    | null
    | undefined,
): boolean => subscription?.status === "ACTIVE" && subscription?.plan?.slug === "pro";

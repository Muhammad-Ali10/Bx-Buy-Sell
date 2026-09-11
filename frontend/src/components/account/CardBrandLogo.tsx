import { CreditCard } from "lucide-react";

/**
 * A card network's mark, drawn inline.
 *
 * The project had no card artwork, and a picture from someone else's CDN is
 * one more thing that fails to load. These are simple renderings, enough to
 * tell a Visa from a MasterCard at a glance, as the design does.
 */
export const CardBrandLogo = ({ brand }: { brand?: string | null }) => {
  const key = String(brand ?? "").toLowerCase();
  return (
    <span
      className="flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E9EBF2] bg-white"
      aria-hidden="true"
    >
      {key === "visa" ? (
        <svg viewBox="0 0 48 16" className="h-4 w-10">
          <text
            x="24"
            y="13"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="14"
            fill="#1A1F71"
          >
            VISA
          </text>
        </svg>
      ) : key === "mastercard" ? (
        <svg viewBox="0 0 32 20" className="h-5 w-8">
          <circle cx="12" cy="10" r="8" fill="#EB001B" />
          <circle cx="20" cy="10" r="8" fill="#F79E1B" />
          <path d="M16 3.07a8 8 0 0 1 0 13.86 8 8 0 0 1 0-13.86z" fill="#FF5F00" />
        </svg>
      ) : key === "amex" ? (
        <svg viewBox="0 0 48 30" className="h-full w-full">
          <rect width="48" height="30" fill="#2E77BC" />
          <text
            x="24"
            y="19"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="800"
            fontSize="11"
            fill="#FFFFFF"
          >
            AMEX
          </text>
        </svg>
      ) : (
        <CreditCard className="h-4 w-4 text-[#64748B]" />
      )}
    </span>
  );
};

export default CardBrandLogo;

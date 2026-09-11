import proIcon from "@/assets/fi_5076417.svg";

const SIZES = {
  // The users table's 40px photo.
  sm: { width: 38, height: 16, radius: 10, gap: 2, icon: 10, font: 10, bottom: -7 },
  // The member's own page, with its 72px photo.
  md: { width: 48, height: 21, radius: 13.04, gap: 2.61, icon: 12, font: 11, bottom: -10 },
} as const;

/**
 * The PRO pill from the client's design: a crown and "Pro", sitting on the
 * bottom edge of a member's photo. It is one component so that the users table
 * and the member's own page cannot drift apart.
 *
 * The photo's wrapper must be `position: relative`; the pill centres itself
 * under it.
 */
export const ProBadge = ({ size = "md" }: { size?: keyof typeof SIZES }) => {
  const s = SIZES[size];
  return (
    <div
      className="absolute"
      style={{
        width: `${s.width}px`,
        height: `${s.height}px`,
        borderRadius: `${s.radius}px`,
        background: "#C6FE1F",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: `${s.gap}px`,
        left: "50%",
        transform: "translateX(-50%)",
        bottom: `${s.bottom}px`,
      }}
    >
      <img src={proIcon} alt="" aria-hidden="true" style={{ width: `${s.icon}px`, height: `${s.icon}px` }} />
      <span
        className="font-lufga"
        style={{ fontWeight: 500, fontSize: `${s.font}px`, lineHeight: "120%", color: "#000000" }}
      >
        Pro
      </span>
    </div>
  );
};

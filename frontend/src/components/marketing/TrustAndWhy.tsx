/**
 * The two panels that sit under the subscription screens.
 *
 * They were written inside the Manage Subscription page and are now on the
 * listing wizard's package step as well, which the design shows them on. Moved
 * here rather than copied: two copies of a marketing panel drift, and the one
 * nobody remembers to update is the one people read.
 */

import { Building2, Globe, LayoutGrid } from "lucide-react";

export type Audience = "BUYER" | "SELLER";

const TRUST_STATS = [
  { value: "$3B+", label: "Total Deal Interest" },
  { value: "8 Weeks", label: "Average Time to Close" },
  { value: "1 Deal", label: "Can Change Everything" },
  { value: "190+", label: "Countries Supported" },
];

export const TrustBand = () => (
  <section className="mt-6 rounded-2xl bg-[#FAFAFA] px-5 py-8 sm:px-10">
    <p
      className="m-0 text-center text-[12px] text-[#94A3B8]"
      style={{ fontFamily: "Lufga" }}
    >
      Trusted by <strong className="font-semibold text-[#0F172A]">thousands of users</strong>{" "}
      worldwide
    </p>
    {/* Two by two on a phone, four across from small screens up: four of these
        side by side on a narrow screen leaves each one a few characters wide. */}
    <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
      {TRUST_STATS.map((stat) => (
        <div key={stat.label} className="text-center">
          <p
            className="m-0 text-[22px] font-semibold text-[#0F172A] sm:text-[26px]"
            style={{ fontFamily: "Lufga" }}
          >
            {stat.value}
          </p>
          <p className="m-0 mt-1 text-[11.5px] text-[#94A3B8]" style={{ fontFamily: "Lufga" }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  </section>
);

/**
 * The pitch, in the words of whichever side is reading it.
 *
 * This started as one seller-facing section shown to everybody, because the
 * first design only showed the seller tab. A buyer was being told to "showcase
 * your business" on a page where they were choosing what to pay to *browse*.
 */
const PITCH = {
  SELLER: {
    heading: "Why Sell with Company Exchange?",
    subtitle: "Designed to help business owners connect with buyers and achieve successful exits.",
    points: [
      {
        icon: Globe,
        title: "Buyers from All Over the World",
        body: "Showcase your business to a global audience of entrepreneurs, investors, and acquisition-focused buyers.",
      },
      {
        icon: LayoutGrid,
        title: "Everything in One Place",
        body: "Manage inquiries, communicate with buyers, share documents, and oversee the entire process from one platform.",
      },
      {
        icon: Building2,
        title: "Built for Serious Sellers",
        body: "Built for sellers who don't want to waste time and prefer a secure, professional environment to sell their business.",
      },
    ],
  },
  BUYER: {
    heading: "Why Buy with Company Exchange?",
    subtitle: "Explore opportunities. Connect with sellers. Acquire with confidence.",
    points: [
      {
        icon: Globe,
        title: "Listings from All Over the World",
        body: "Access listings from sellers worldwide and discover opportunities across a wide range of industries and markets.",
      },
      {
        icon: LayoutGrid,
        title: "Everything in One Place",
        body: "Browse listings, communicate with sellers, access documents, and manage inquiries from a single platform.",
      },
      {
        icon: Building2,
        title: "Built for Serious Buyers",
        body: "Designed for entrepreneurs, investors, and acquirers looking to identify and pursue quality acquisition opportunities.",
      },
    ],
  },
} as const;

export const WhyPanel = ({ audience }: { audience: Audience }) => {
  const { heading, subtitle, points } = PITCH[audience];

  return (
    <section className="mt-6 rounded-2xl bg-[#FAFAFA] px-5 py-10 sm:px-10">
      <h2
        className="m-0 text-center text-[20px] font-semibold text-[#0F172A] sm:text-[24px]"
        style={{ fontFamily: "Lufga" }}
      >
        {heading}
      </h2>
      <p
        className="mx-auto mt-2 max-w-[620px] text-center text-[12.5px] text-[#64748B]"
        style={{ fontFamily: "Lufga" }}
      >
        {subtitle}
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl bg-white p-5">
            <Icon className="h-5 w-5 text-[#0F172A]" />
            <h3
              className="m-0 mt-3 text-[13.5px] font-semibold text-[#0F172A]"
              style={{ fontFamily: "Lufga" }}
            >
              {title}
            </h3>
            <p
              className="m-0 mt-2 text-[12px] leading-relaxed text-[#64748B]"
              style={{ fontFamily: "Lufga" }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

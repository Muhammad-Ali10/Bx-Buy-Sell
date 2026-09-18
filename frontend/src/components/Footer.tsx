import type { ReactNode } from "react";
import { Facebook, Instagram, Linkedin, Globe, Languages, ChevronDown, Send } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/_App Icon 1 (2).png";
import { Button } from "./ui/button";
import { HeaderCurrencySelect } from "./HeaderCurrencySelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Currency,Language } from "@/assets/svg";
import cardimg from "@/assets/payment-list.png";
/* The card marks under the blurb. Drawn here rather than imported — there are
   no payment SVGs in assets/, and four tiny tiles are not worth four files.
   Swap in the real brand artwork when it arrives. */
const markClass = "h-6 w-9 shrink-0";

const VisaMark = () => (
  <svg viewBox="0 0 48 32" className={markClass} role="img" aria-label="Visa">
    <rect width="48" height="32" rx="4" fill="#FFFFFF" />
    <text
      x="24"
      y="21"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="13"
      fontWeight="700"
      fontStyle="italic"
      fill="#1A1F71"
    >
      VISA
    </text>
  </svg>
);

const MastercardMark = () => (
  <svg viewBox="0 0 48 32" className={markClass} role="img" aria-label="Mastercard">
    <rect width="48" height="32" rx="4" fill="#FFFFFF" />
    <circle cx="20" cy="16" r="8" fill="#EB001B" />
    <circle cx="28" cy="16" r="8" fill="#F79E1B" fillOpacity="0.85" />
  </svg>
);

const MaestroMark = () => (
  <svg viewBox="0 0 48 32" className={markClass} role="img" aria-label="Maestro">
    <rect width="48" height="32" rx="4" fill="#FFFFFF" />
    <circle cx="20" cy="16" r="8" fill="#ED0006" />
    <circle cx="28" cy="16" r="8" fill="#0099DF" fillOpacity="0.85" />
  </svg>
);

const AmexMark = () => (
  <svg viewBox="0 0 48 32" className={markClass} role="img" aria-label="American Express">
    <rect width="48" height="32" rx="4" fill="#006FCF" />
    <text
      x="24"
      y="20"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="9"
      fontWeight="700"
      fill="#FFFFFF"
    >
      AMEX
    </text>
  </svg>
);

const UnionFlag = () => (
  <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px]" role="img" aria-label="English">
    <rect width="24" height="16" fill="#012169" />
    <path d="M0 0l24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
    <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.8" />
    <path d="M12 0v16M0 8h24" stroke="#FFFFFF" strokeWidth="5.4" />
    <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="3.2" />
  </svg>
);

/* Information, Help & Support, Newsletter and Get In Touch all share one
   heading size; Currency and Language sit a step below them. */
const ColumnHeading = ({ children }: { children: ReactNode }) => (
  <h3
    className="font-lufga mb-4 text-lg sm:text-xl"
    style={{ fontWeight: 300, lineHeight: "140%", color: "rgba(255, 255, 255, 1)" }}
  >
    {children}
  </h3>
);

const linkClass = "font-lufga text-[15px] text-white/70 hover:text-[#C6FE1F] transition-colors";

/* One language ships today. The chooser is here because the design places it
   beside the currency chip; add the rest as translations land. */
const LANGUAGES = ["English"];

const FooterLanguageSelect = () => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className="inline-flex items-center justify-between w-[150px] gap-2 rounded-full border border-white/20 bg-white/[0.06] pl-3 pr-2 py-1.5 focus:outline-none"
      aria-label="Language"
    >
      <UnionFlag />
      <span className="font-lufga text-[13px] font-medium leading-none text-white sm:text-sm">
        English
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-40">
      {LANGUAGES.map((name) => (
        <DropdownMenuItem key={name} className="cursor-pointer font-medium">
          {name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const SocialLink = ({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) => (
  <a
    href={href}
    aria-label={label}
    className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-[#C6FE1F] transition-colors bg-transparent shrink-0"
  >
    {children}
  </a>
);

const Footer = () => {
  return (
    <footer className="bg-black text-white py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand, blurb and the cards we take */}
          <div className="sm:col-span-2 lg:col-span-3">
            <img src={logo} alt="EX" className="h-10 w-10 object-contain" />
            <p
              className="font-lufga mt-5"
              style={{
                fontWeight: 400,
                fontSize: "15px",
                lineHeight: "170%",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              Why start over when you can take over? Whether you&rsquo;re buying your
              next venture or selling the one you built, EX makes it simple.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <img
                src={cardimg}
                alt="Archived Chats"
                className="h-6 w-auto"
              />
            </div>
          </div>

          {/* Information */}
          <div className="lg:col-span-2">
            <ColumnHeading>Information</ColumnHeading>
            <ul className="space-y-3">
              <li><a href="#" className={linkClass}>How EX PAY works</a></li>
              <li><a href="#" className={linkClass}>How to Stay Safe</a></li>
              <li><Link to="/how-to-buy" className={linkClass}>How to Buy</Link></li>
              <li><Link to="/how-to-sell" className={linkClass}>How to Sell</Link></li>
            </ul>
          </div>

          {/* Help & Support */}
          <div className="lg:col-span-2">
            <ColumnHeading>Help &amp; Support</ColumnHeading>
            <ul className="space-y-3">
              <li><a href="#" className={linkClass}>FAQ</a></li>
              <li><a href="#" className={linkClass}>Support</a></li>
              <li><a href="#" className={linkClass}>Terms Conditions</a></li>
              <li><a href="#" className={linkClass}>Privacy Policy</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="sm:col-span-2 lg:col-span-3">
            <ColumnHeading>Newsletter</ColumnHeading>
            <p
              className="font-lufga mb-4"
              style={{ fontSize: "15px", lineHeight: "170%", color: "rgba(255, 255, 255, 0.6)" }}
            >
              Stay always in touch! Subscribe to our newsletter
            </p>
            {/* The button sits inside the field, as the design draws it. */}
            <div className="relative max-w-sm">
              <input
                type="email"
                placeholder="Email Address"
                aria-label="Email Address"
                className="w-full rounded-md border border-white/20 bg-white/[0.06] py-3 pl-4 pr-[124px] font-lufga text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:border-[#C6FE1F]"
              />
              <Button className="absolute right-1.5 top-1.5 bottom-1.5 h-auto rounded-md bg-[#C6FE1F] px-4 py-0 font-lufga text-[13px] font-medium text-black hover:bg-[#C6FE1F]/90">
                <span>Subscribe</span>
                <Send className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Currency, language, and the social row under Get In Touch */}
          <div className="lg:col-span-2">
            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <Currency className="h-4 w-4 text-[#C6FE1F]" />
                <span className="font-lufga text-[14px] text-white">Currency</span>
              </div>
              {/* The same choice as the menu bar makes: changing either changes both. */}
              <HeaderCurrencySelect  onDark infoSide="top" variant="footer" />
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <Language className="h-4 w-4 text-[#C6FE1F]" />
                <span className="font-lufga text-[14px] text-white">Language</span>
              </div>
              <FooterLanguageSelect />
            </div>

            <ColumnHeading>Get In Touch</ColumnHeading>
            <div className="flex gap-3">
              <SocialLink href="#" label="Facebook">
                <Facebook className="w-[18px] h-[18px] text-white" />
              </SocialLink>
              <SocialLink href="#" label="Instagram">
                <Instagram className="w-[18px] h-[18px] text-white" />
              </SocialLink>
              <SocialLink href="#" label="LinkedIn">
                <Linkedin className="w-[18px] h-[18px] text-white" />
              </SocialLink>
            </div>
          </div>
        </div>

        <p
          className="font-lufga mt-14 text-center"
          style={{
            fontWeight: 400,
            fontSize: "15px",
            lineHeight: "150%",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          2026 Company Exchange&trade;
        </p>
      </div>
    </footer>
  );
};

export default Footer;

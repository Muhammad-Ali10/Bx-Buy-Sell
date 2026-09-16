import { Search, ChevronDown, SlidersHorizontal, ArrowUpRight, Layers, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import heroCard1 from "@/assets/hero-card-1.png";
import heroCard2 from "@/assets/hero-card-2.png";
import heroCard3 from "@/assets/hero-card-3.png";
import { ArrowUpSvg } from "@/assets/svg";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import FlagIcon from "./FlagIcon";
import { ALL_COUNTRY_NAMES } from "@/lib/countryUtils";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { AGE_MAX, PRICE_MAX } from "./listings/FilterSidebar";
/**
 * What the search field offers when it is opened.
 *
 * Hand-written, because the last entry is not a category at all — it turns the
 * question around and sends a seller to build a listing.
 *
 * `label` and `category` are separate on purpose. The client asked for
 * "Software Business"; the listings say "Software", and the filter matches the
 * name exactly. Sending the label would have opened an empty page, so the
 * wording they asked for is shown and the name that exists is what gets
 * filtered.
 */
const LOOKING_FOR_OPTIONS: {
  label: string;
  category?: string;
  to?: string;
}[] = [
    { label: "E-Commerce", category: "E-Commerce" },
    { label: "Service Business", category: "Service Business" },
    { label: "Software Business", category: "Software" },
    { label: "Other", category: "Other" },
    { label: "I want to Sell my Business", to: "/dashboard" },
  ];

/**
 * The search filters in the brand's green rather than the theme's blue, which
 * is what the client asked for. Only two parts of a slider are coloured: the
 * filled length of the track and the ring around the thumb, both drawn by
 * ui/slider.tsx from `--primary`. `accent` is the same green as the Pro
 * badge, the lime cards and the "See plans" pill in this panel.
 */
const GREEN_SLIDER =
  "[&_.bg-primary]:!bg-accent [&_[role=slider]]:!border-accent";

/**
 * The topics under the search field.
 *
 * Fixed, and in this order, because the client asked for these four by name.
 * They were read from the listings for a while — busiest category first — and
 * that made the row rearrange itself as listings came and went, which is what
 * the client noticed.
 *
 * `label` and `category` are separate for the same reason as above: the
 * client writes "Service business", the listings say "Service Business", and
 * the filter matches the name exactly.
 */
const TRENDING_TOPICS: { label: string; category: string }[] = [
  { label: "E-Commerce", category: "E-Commerce" },
  { label: "Service business", category: "Service Business" },
  { label: "Other Businesses", category: "Other Businesses" },
  { label: "Pioneers", category: "Pioneers" },
];

interface HeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

/**
 * Whether a click should close an open panel.
 *
 * Containment alone is not the test. Radix renders a Select's list into a
 * portal on `document.body`, so clicking a country in the filter panel lands,
 * by the DOM's reckoning, outside the panel that opened it — the panel closed
 * on the way to the option and took the choice with it. Anything inside a
 * portalled layer counts as inside whatever opened it.
 */
const clickedOutside = (container: HTMLElement | null, target: EventTarget | null) => {
  const node = target as Element | null;
  if (container?.contains(node as Node)) return false;
  return !node?.closest?.("[data-radix-popper-content-wrapper]");
};

const Hero = ({ searchQuery, setSearchQuery }: HeroProps) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * The option picked from the list, if any.
   *
   * Kept apart from `searchQuery` rather than written into it. The listings
   * section below filters on that text as it is typed, so putting "Software
   * Business" there would empty the section the moment the option was chosen —
   * the category is called "Software", and nothing matches the label. Holding
   * it here means choosing an option changes nothing until the search button
   * is pressed, which is what it looks like it should do.
   */
  const [selected, setSelected] = useState<
    (typeof LOOKING_FOR_OPTIONS)[number] | null
  >(null);

  const { canUseAdvancedFilters } = useSubscriptionTier();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX]);
  const [ageRange, setAgeRange] = useState<[number, number]>([0, AGE_MAX]);

  const priceNarrowed = priceRange[0] !== 0 || priceRange[1] !== PRICE_MAX;
  // Age is a paid filter on the listings page, so it only counts as set for
  // someone whose plan includes it — see the panel below.
  const ageNarrowed =
    canUseAdvancedFilters && (ageRange[0] !== 0 || ageRange[1] !== AGE_MAX);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (clickedOutside(filterRef.current, event.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filterOpen]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Closes on a click anywhere else. The menu lives inside `fieldRef`, so
  // choosing an option does not count as an outside click and the selection
  // still lands.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (clickedOutside(fieldRef.current, event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const chooseOption = (option: (typeof LOOKING_FOR_OPTIONS)[number]) => {
    setSelected(option);
    setMenuOpen(false);
  };

  const handleSearch = () => {
    // "I want to sell" is not a search — it leaves for the wizard whatever
    // else is set.
    if (selected?.to) {
      navigate(selected.to);
      return;
    }

    // Everything chosen above the button travels together in one URL: the
    // category from the list, and whatever the filter panel holds.
    const params = new URLSearchParams();
    if (selected?.category) params.set("category", selected.category);
    if (location !== "all") params.set("location", location);
    if (priceNarrowed) params.set("price", `${priceRange[0]}-${priceRange[1]}`);
    if (ageNarrowed) params.set("age", `${ageRange[0]}-${ageRange[1]}`);
    if ([...params].length) {
      navigate(`/all-listings?${params.toString()}`);
      return;
    }
    if (searchQuery.trim()) {
      toast.success(`Searching for: ${searchQuery}`);
      // Scroll to listings section
      const listingsSection = document.getElementById('listings');
      if (listingsSection) {
        listingsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      toast.error("Please enter a search term");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMenuOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      setMenuOpen(false);
      handleSearch();
    }
  };

  return (
    /* The menu bar reads this marker to know its labels are sitting on the
       blue and need light ink. Once this section scrolls past, the bar goes
       back to the dark-on-light look it has everywhere else. */
    <section
      data-dark-hero
      className="relative bg-[#F4F4F4] text-primary-foreground pt-20 sm:pt-24 md:pt-32 pb-0 overflow-visible"
    >
      <div className="container mx-auto  mt-24 px-4 sm:px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center mb-8 sm:mb-12 animate-fade-in">
          <h1 className="font-lufga font-medium text-[32px] sm:text-[48px] md:text-[64px] lg:text-[85px] leading-[120%] text-center mb-4 sm:mb-6 px-2 text-black">
            Buy & Sell Companies<br className="hidden sm:block" /> <span className="sm:hidden"> </span>in 3 simple Steps
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-4 sm:mb-6  max-w-3xl mx-auto leading-relaxed px-4 text-black">
            Join the #1 platform for buying & selling companies. Discover, connect, and exchange with ease—your journey starts here today!
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-12 text-xs sm:text-sm px-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
              <span className="text-black">Secure Payments with EXPay</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
              <span className="text-black">Simple 3-step process</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-black rounded-full" />
              <span className="text-black">Start in 1 Minute</span>
            </div>
          </div>

          {/* Lifted above the hero artwork below it. `backdrop-blur` on the
              bar inside makes its own stacking context, so a z-index on the
              open menu counts only within that box — the images, which come
              later in the document at z-10, painted straight over the lower
              half of the list and swallowed three of the five clicks. */}
          <div className="relative z-30 max-w-4xl mx-auto mb-8 sm:mb-12 px-4">
            <div className="bg-[#E5E5E5] backdrop-blur-xl rounded-[10px] px-3 sm:px-6 py-2 border border-primary-foreground/5">
              <div className="flex gap-2 sm:gap-3 items-center">
                {/* The chevron used to be a picture of a control. Clicking the
                    field now opens the list it always promised — and typing
                    still works, so the free-text search is not lost. */}
                <div className="relative flex-1 min-w-0" ref={fieldRef}>
                  <div className={`bg-black/5 rounded-[10px] flex items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border border-black/10 transition-all ${isSearchFocused ? 'border-accent shadow-glow' : 'border-black/10'
                    }`}>
                    <Layers className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-4 text-black flex-shrink-0" />
                    <input
                      type="text"
                      value={selected ? selected.label : searchQuery}
                      onChange={(e) => {
                        // Typing over a selection makes it a search again.
                        setSelected(null);
                        setSearchQuery(e.target.value);
                      }}
                      onFocus={() => {
                        setIsSearchFocused(true);
                        setMenuOpen(true);
                      }}
                      onBlur={() => setIsSearchFocused(false)}
                      onKeyDown={handleKeyDown}
                      placeholder="What Are You Looking For?"
                      aria-expanded={menuOpen}
                      aria-haspopup="listbox"
                      className="flex-1 bg-transparent text-black placeholder:text-black outline-none text-sm sm:text-base md:text-lg min-w-0"
                    />
                    <button
                      type="button"
                      aria-label="Show categories"
                      onClick={() => setMenuOpen((open) => !open)}
                      className="ml-2 sm:ml-4 flex-shrink-0"
                    >
                      <ChevronDown
                        className={`w-4 h-4 sm:w-5 sm:h-5 text-black transition-transform ${menuOpen ? 'rotate-180' : ''
                          }`}
                      />
                    </button>
                  </div>

                  {menuOpen && (
                    <ul
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[10px] bg-white py-1 text-left shadow-2xl"
                    >
                      {LOOKING_FOR_OPTIONS.map((option) => (
                        <li key={option.label}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => chooseOption(option)}
                            className="block w-full px-4 py-3 text-left text-sm text-black transition-colors hover:bg-[#D3FC50] sm:px-6 sm:text-base"
                          >
                            {option.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* This button had no handler at all — an icon of a control.
                    It now opens the three filters the listings page already
                    understands, and they travel there through the URL. */}
                <div className="relative flex-shrink-0" ref={filterRef}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Filters"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen((open) => !open)}
                    className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl sm:rounded-2xl bg-black/5 hover:bg-black/5  text-black border border-black/10 transition-all"
                  >
                    <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>

                  {filterOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-[10px] bg-white p-4 text-left text-black shadow-2xl sm:w-[340px] sm:p-5">
                      <div className="space-y-2">
                        <label className="font-lufga text-sm font-medium">
                          Business Location
                        </label>
                        <Select value={location} onValueChange={setLocation}>
                          <SelectTrigger className="h-11 w-full rounded-xl border border-black/10 bg-black/[0.03] text-sm">
                            <SelectValue placeholder="Select location">
                              {location !== "all" ? (
                                <span className="flex items-center gap-2">
                                  <FlagIcon country={location} className="h-4 w-4" />
                                  {location}
                                </span>
                              ) : (
                                "All locations"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            <SelectItem value="all">All locations</SelectItem>
                            {ALL_COUNTRY_NAMES.map((country) => (
                              <SelectItem key={country} value={country}>
                                <span className="flex items-center gap-2">
                                  <FlagIcon country={country} className="h-4 w-4" />
                                  {country}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="font-lufga text-sm font-medium">
                            Price Range
                          </label>
                          <span className="font-lufga text-sm text-black/60">
                            ${priceRange[0].toLocaleString()} – $
                            {priceRange[1].toLocaleString()}
                            {priceRange[1] === PRICE_MAX ? "+" : ""}
                          </span>
                        </div>
                        <Slider
                          value={priceRange}
                          onValueChange={(value) =>
                            setPriceRange(value as [number, number])
                          }
                          min={0}
                          max={PRICE_MAX}
                          step={10000}
                          className={GREEN_SLIDER}
                        />
                      </div>

                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 font-lufga text-sm font-medium">
                            Age
                            {!canUseAdvancedFilters && (
                              <Lock className="h-3.5 w-3.5 text-black/50" />
                            )}
                          </label>
                          {canUseAdvancedFilters && (
                            <span className="font-lufga text-sm text-black/60">
                              {ageRange[0]}y – {ageRange[1]}
                              {ageRange[1] === AGE_MAX ? "+" : ""}y
                            </span>
                          )}
                        </div>
                        {canUseAdvancedFilters ? (
                          <Slider
                            value={ageRange}
                            onValueChange={(value) =>
                              setAgeRange(value as [number, number])
                            }
                            min={0}
                            max={AGE_MAX}
                            step={1}
                            className={GREEN_SLIDER}
                          />
                        ) : (
                          /* The same wall the listings page puts here, in the
                             same words — Age is part of the paid plans, and a
                             filter that is locked in one place and free in
                             another is not a filter, it is a leak. */
                          <div className="rounded-xl bg-black/[0.04] p-3 text-center">
                            <p className="font-lufga text-[13px] text-black/70">
                              Age is part of the Starter and Premium plans.
                            </p>
                            <Link
                              to="/manage-subscription"
                              className="mt-2 inline-block rounded-full bg-[#D3FC50] px-4 py-1.5 font-lufga text-[13px] font-semibold text-black"
                            >
                              See plans
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="accent"
                  size="icon"
                  onClick={handleSearch}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-[10px] shadow-lg hover:scale-105 transition-transform flex-shrink-0"
                >
                  <Search className="w-5 h-5 sm:w-6 sm:w-7" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 px-4">
            <span className="text-xs sm:text-sm font-medium text-black/80 mr-2">Trending Topics</span>
            {TRENDING_TOPICS.map((topic) => (
              <Button
                key={topic.label}
                variant="ghost"
                // Opens the listings page already filtered to this category.
                onClick={() =>
                  navigate(`/all-listings?category=${encodeURIComponent(topic.category)}`)
                }
                className="bg-black text-primary-foreground hover:text-white hover:bg-black rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-medium transition-all"
              >
                {topic.label}
                {/* Stroked with currentColor, so it stays white with the label. */}
                <ArrowUpSvg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 text-[#C6FE1F]" />
              </Button>
            ))}
          </div>

          <div className="relative w-full max-w-7xl mx-auto mt-4 sm:mt-8 flex items-end justify-center mb-0 px-4">
            {/* Large center image - positioned at bottom */}
            <img
              src={heroCard1}
              alt="Dashboard"
              className="w-full z-10"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 1200px"
            />

            {/* Small image - top left corner of big image - hidden on mobile, visible on tablet+ */}
            <img
              src={heroCard3}
              alt="Archived Chats"
              className="hidden sm:block absolute left-4 sm:left-2 md:left-4 top-0 w-48 sm:w-56 md:w-72 hover:scale-105 transition-transform z-20"
              decoding="async"
              sizes="(max-width: 1024px) 40vw, 320px"
            />

            {/* Small image - top right corner of big image - hidden on mobile, visible on tablet+ */}
            <img
              src={heroCard2}
              alt="Chat Details"
              className="hidden sm:block absolute right-0 sm:-right-2 md:right-0 -top-4 w-52 sm:w-64 md:w-80 hover:scale-105 transition-transform z-20"
              decoding="async"
              sizes="(max-width: 1024px) 45vw, 360px"
            />
          </div>
        </div>
      </div>
         <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
          {[
            { top: "4%", right: "12%", color: "#E5E5E5" },
            { top: "3%", right: "34%", color: "#E5E5E5" },
            { top: "7%", left: "45%", color: "#E5E5E5" },
            { top: "3%", left: "28%", color: "#E5E5E5" },
            { top: "10%", left: "0%", color: "#E5E5E5" },
            { top: "40%", left: "0%", color: "#E5E5E5" },
            { top: "20%", left: "10%", color: "#C6FE1F" },
            { top: "17%", right: "10%", color: "#000000" },
          ].map((box, index) => (
            <span
              key={index}
              className="absolute   backdrop-blur-[2px]"
              style={{
                top: box.top,
                left: box.left,
                right: box.right,
                backgroundColor: box.color,
                width: 90,
                height: 80,
              }}
            />
          ))}
        </div> 

    </section>
  );
};

export default Hero;

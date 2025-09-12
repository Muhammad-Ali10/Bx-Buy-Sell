"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Bell, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import FilterSidebar from "@/components/shared/filter-sidebar";
import ListingCard from "@/components/shared/listing-card";
import { dummyListings } from "@/lib/dummy-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { LISTING_NAV_PATH } from "@/config/navpath";
import { DialogTitle } from "@radix-ui/react-dialog";
import { MenuSVG } from "@/svg";

export default function AllListings() {
  const [filters, setFilters] = useState({
    search: "",
    niche: "",
    revenueGenerating: null,
    priceRange: [500, 5000],
    location: "",
    targetCountry: "",
    targetMinRevenue: 50,
    ageRange: [0, 15],
    revenueRange: [0, 2000000],
    profitRange: [0, 1500000],
    pageviewsRange: [0, 150000],
    revenueMultipleRange: [0, 8],
    profitMultipleRange: [0, 5],
  });

  const [filteredListings, setFilteredListings] = useState(dummyListings);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  // Get current path for active menu detection
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Apply filters whenever they change
  useEffect(() => {
    const filtered = dummyListings.filter((listing) => {
      // Search filter
      if (
        filters.search &&
        !listing.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !listing.description
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Niche filter
      if (
        filters.niche &&
        filters.niche !== "all" &&
        listing.niche !== filters.niche
      ) {
        return false;
      }

      // Revenue generating filter
      if (
        filters.revenueGenerating !== null &&
        listing.revenueGenerating !== filters.revenueGenerating
      ) {
        return false;
      }

      // Price range filter
      if (
        listing.price < filters.priceRange[0] ||
        listing.price > filters.priceRange[1]
      ) {
        return false;
      }

      // Location filter
      if (
        filters.location &&
        filters.location !== "all" &&
        listing.location !== filters.location
      ) {
        return false;
      }

      // Target country filter
      if (
        filters.targetCountry &&
        filters.targetCountry !== "all" &&
        listing.targetCountry !== filters.targetCountry
      ) {
        return false;
      }

      // Target country filter
      if (
        filters.targetMinRevenue < 0 &&
        listing.targetCountry !== filters.targetCountry
      ) {
        return false;
      }

      // Business age filter
      if (
        listing.businessAge < filters.ageRange[0] ||
        listing.businessAge > filters.ageRange[1]
      ) {
        return false;
      }

      // Monthly revenue filter
      if (
        listing.monthlyRevenue < filters.revenueRange[0] ||
        listing.monthlyRevenue > filters.revenueRange[1]
      ) {
        return false;
      }

      // Monthly profit filter
      if (
        listing.monthlyProfit < filters.profitRange[0] ||
        listing.monthlyProfit > filters.profitRange[1]
      ) {
        return false;
      }

      // Monthly pageviews filter
      if (
        listing.monthlyPageviews < filters.pageviewsRange[0] ||
        listing.monthlyPageviews > filters.pageviewsRange[1]
      ) {
        return false;
      }

      // Revenue multiple filter
      if (
        listing.revenueMultiple < filters.revenueMultipleRange[0] ||
        listing.revenueMultiple > filters.revenueMultipleRange[1]
      ) {
        return false;
      }

      // Profit multiple filter
      if (
        listing.profitMultiple < filters.profitMultipleRange[0] ||
        listing.profitMultiple > filters.profitMultipleRange[1]
      ) {
        return false;
      }

      return true;
    });

    setFilteredListings(filtered);
  }, [filters]);

  const handleFilterChange = (newFilters) => {
    // console.log("Filter changed:", newFilters)
    setFilters({ ...filters, ...newFilters });
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      niche: "",
      revenueGenerating: null,
      priceRange: [500, 100000],
      location: "",
      targetCountry: "",
      targetMinRevenue: 0,
      ageRange: [0, 15],
      revenueRange: [0, 2000000],
      profitRange: [0, 1500000],
      pageviewsRange: [0, 150000],
      revenueMultipleRange: [0, 8],
      profitMultipleRange: [0, 5],
    });
  };

  return (
    <div className="flex min-h-screen sm:max-w-[430px] md:max-w-[1920px] w-full bg-black text-white">
      {/* Desktop sidebar */}
      <div className="hidden md:block max-w-[389px] w-full border-r border-gray-800 overflow-y-auto">
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black border-b min-w-[384px] border-gray-800 px-4 py-3 flex items-center ">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[384px] p-0 bg-black border-gray-800"
              >
                <div className="hidden">
                  <DialogTitle />
                </div>
                <nav className="flex flex-col items-center sm:gap-4 md:gap-2 p-4 border-b border-gray-800">
                  {LISTING_NAV_PATH.map((nav) => (
                    <Link
                      key={nav.path}
                      href={nav.path}
                      className={`px-7 py-3 rounded-[30px] transition-colors ${
                        currentPath === nav.path ||
                        currentPath.includes(nav.path)
                          ? "bg-[#c1ff00] text-black"
                          : "bg-[#0d151b] text-white hover:bg-gray-900"
                      }`}
                    >
                      {nav.label}
                    </Link>
                  ))}
                </nav>
                <div className="overflow-y-auto max-h-[calc(100vh-180px)]">
                  <FilterSidebar
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                    mobile={true}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/" className="flex items-center">
              {/* <div className="bg-[#c1ff00] text-black font-bold p-1.5 rounded text-xl">BX</div> */}
              {/* <Image src={"/logo.png"} height={60} width={60} alt="Logo" /> */}
            </Link>

            {/* Desktop navigation */}
            <Image
              src={"/logo.png"}
              className="block md:hidden"
              height={40}
              width={40}
              alt="Logo"
            />
            <nav className="hidden md:flex items-center gap-6 ml-5 font-lufga">
              <Link
                href="/"
                className={`text-base font-normal px-4 py-1 rounded-full transition-colors ${
                  currentPath === "/"
                    ? "bg-[#c1ff00] text-black font-medium"
                    : "bg-black text-white hover:text-[#c1ff00]"
                }`}
              >
                Home
              </Link>
              <Link
                href="/listings"
                className={`text-base px-4 py-1 rounded-full transition-colors ${
                  currentPath === "/listings" ||
                  currentPath.includes("/listings")
                    ? "bg-[#c1ff00] text-black font-medium"
                    : "bg-black text-white hover:text-[#c1ff00]"
                }`}
              >
                All Listings
              </Link>
              <Link
                href="/how-to-buy"
                className={`text-base px-4 py-1 rounded-full transition-colors ${
                  currentPath === "/how-to-buy"
                    ? "bg-[#c1ff00] text-black font-medium"
                    : "bg-black text-white hover:text-[#c1ff00]"
                }`}
              >
                How To Buy
              </Link>
              <Link
                href="/how-to-sell"
                className={`text-base px-4 py-1 rounded-full transition-colors ${
                  currentPath === "/how-to-sell"
                    ? "bg-[#c1ff00] text-black font-medium"
                    : "bg-black text-white hover:text-[#c1ff00]"
                }`}
              >
                How To Sell
              </Link>
            </nav>
          </div>

          <div className="flex flex-1 justify-end  gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-[#c1ff00] text-black text-xs w-4 h-4 flex items-center justify-center rounded-full">
                2
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full relative"
            >
              <Heart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-[#c1ff00] text-black text-xs w-4 h-4 flex items-center justify-center rounded-full">
                5
              </span>
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 border border-gray-700 cursor-pointer">
                  <AvatarImage src="/abstract-profile.png" alt="User" />
                  <AvatarFallback>M</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-black border border-gray-800 text-white p-1"
              >
                <div className="px-2 py-1.5 mb-1 border-b border-gray-800">
                  <p className="font-medium">Manuel</p>
                  <p className="text-xs text-gray-400">manuel@example.com</p>
                </div>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  My Listings
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Watchlist
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Messages
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Billing
                </DropdownMenuItem>
                <div className="h-px bg-gray-800 my-1"></div>
                <DropdownMenuItem className="text-red-500 hover:bg-gray-900 focus:bg-gray-900 cursor-pointer">
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-col p-4 md:p-6  bg-white">
          {/* <MenuSVG  width={90} height={90} className={"bg-green-600 text-black  text-4xl stroke-2 hover:text-green-100"}/> */}
          <MenuSVG
            className={
              "bg-green-600 text-black w-[100px] h-[140px] stroke-2 hover:text-green-100"
            }
          />
          {/* <ArrowSVG className={"bg-black   w-[140px] h-[140px] text-red-600 hover:text-green-100"}/> */}
          {/* Sell your store banner */}
          <div className="bg-[linear-gradient(to_right,_#C4FC1E,_#D2FF4D)] flex justify-between  text-black   mb-6 relative overflow-hidden sm:h-[210px] md:h-[260px] sm:p-[20px] md:p-[32px] rounded-[20px]">
            <div className="md:max-w-[60%] z-10 flex flex-col gap-[10px]">
              <h2 className="text-xl sm:text-[18px] md:text-[28px] font-bold mb-2">
                Looking to Sell Your Shopify Store?
              </h2>
              <p className="text-sm sm:w-[276px] md:w-full sm:text-[12px] md:text-[18px] mb-4 text-[#00000080]">
                Get the best deal with serious buyers ready to invest! Join a
                marketplace where top-rated businesses meet qualified investors.
              </p>

              <Button className="bg-black md:p-[20px] sm:w-[218px] md:w-[259px] sm:h-[45px] md:h-[52px]  leading-[150%] rounded-[60px] sm:text-[14px] md:text-[16px] text-white sm:py-[12px] sm:p-[20px] hover:bg-gray-800">
                List Your Business Now!
              </Button>
            </div>

            <div className=" block">
              {/* Box & Stars MD */}
              <Image
                src={"/Star 1.png"}
                className="absolute sm:hidden md:block top-[54px] left-[900px] "
                height={51}
                width={51}
                alt="Star 1.png"
              />

              <Image
                src={"/Star 4.png"}
                className="absolute sm:hidden md:block top-[54px] left-[1150px]"
                height={25}
                width={25}
                alt="Star 4.png"
              />
              <Image
                src={"/Star 2.png"}
                className="absolute sm:hidden md:block top-[154px] left-[863px] "
                height={89}
                width={89}
                alt="Star 2.png"
              />
              <Image
                src={"/Star 3.png"}
                className="absolute sm:hidden md:block top-[184px] left-[1170px] "
                height={29}
                width={29}
                alt="Star 3.png"
              />
              <Image
                className="self-center sm:hidden md:block justify-self-center absolute top-[84px] left-[983px] "
                src={"/surprise.png"}
                height={107}
                width={107}
                alt="surprise.png"
              />
            </div>

            {/* Box & Star SM */}
            <Image
              src={"/Star 1.png"}
              className="absolute sm:block md:hidden top-[54px] left-[900px] "
              height={51}
              width={51}
              alt="Star 1.png"
            />

            <Image
              src={"/Star 1.png"}
              className="absolute sm:block md:hidden top-[40.38px] left-[330.38px] "
              height={37}
              width={37}
              alt="Star 3.png"
            />
            <Image
              src={"/Star 3.png"}
              className="absolute sm:block md:hidden top-[120.38px] left-[250.38px] "
              height={23}
              width={23}
              alt="Star 3.png"
            />

            <Image
              src={"/Star 3.png"}
              className="absolute sm:block md:hidden top-[170.38px] left-[250.38px] "
              height={23}
              width={23}
              alt="Star 3.png"
            />
            <Image
              src={"/Star 3.png"}
              className="absolute sm:block md:hidden top-[170.38px] left-[360.38px] "
              height={23}
              width={23}
              alt="Star 3.png"
            />
            <Image
              className="self-center sm:block md:hidden justify-self-center absolute top-[103.38px] left-[305.38px] "
              src={"/surprise.png"}
              height={53.24}
              width={53.24}
              alt="surprise.png"
            />
          </div>

          {/* Premium banner */}
          <div className="bg-[#0000000A] flex flex-col gap-[32px] text-black rounded-xl sm:p-3 md:p-[32px] mb-6">
            <div className="flex sm:flex-col-reverse md:flex-row sm:items-start md:items-center gap-2 ">
              <div className="flex items-center gap-2">
                <span className="p-1  rounded">
                  <Image
                    src={"/dollar-tag.png"}
                    className="sm:h-[28px] sm:w-[28px] md:h-[44px] md:w-[44px] "
                    height={44}
                    width={44}
                    alt="dollar-tag.png"
                  />
                </span>
                <h3 className="font-bold sm:text-[16px] md:text-[28px]">
                  Get Deals First. 21 Days Before the Rest
                </h3>
              </div>
              <Badge className="bg-[#c1ff00] mb-2  h-[28px]  px-[9px] py-[4px] rounded-[60px] flex items-center justify-center text-black hover:bg-[#a8e600]">
                <Image
                  src={"/crown.png"}
                  height={20}
                  width={20}
                  alt="crown.png"
                />
                <span className="text-xs font-[600]">Join Premium</span>
              </Badge>
            </div>
            <p className="sm:text-[14px] md:text-[18px] text-[#00000080] mb-2">
              JOIN Premium now! Gain early access to All Listings 21 days before
              they become public. Don`t wait—Stay ahead of your competition.
              <Link href="#" className="text-blue-600 font-[600] ml-1">
                Learn More
              </Link>
            </p>
            <div className="flex sm:flex-col md:justify-stretch md:flex-row flex-wrap gap-2 mt-4">
              <Button className="bg-[#CBFE36] self-stretch rounded-[60px] h-[52px] sm:!min-w-[100%] md:!min-w-[172px] gap-[10px] text-blac text-[16px] hover:bg-[#a8e600]">
                Join Premium
              </Button>
              <Button
                variant="outline"
                className="text-black bg-[#0000001A] sm:!min-w-[100%] md:!min-w-[172px] rounded-[60px] h-[52px] w-[325px] p-[20px] gap-[10px] border-gray-300"
              >
                Discover 25 Off-Market Listings
              </Button>
            </div>

            {/* Featured listings */}
            <div className="relative mb-6">
              <Button
                variant="outline"
                size="icon"
                className="absolute left-[-10px] top-1/2 -translate-y-1/2 z-10 bg-[#E5E5E5] text-black rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="grid sm:grid-cols-1 md:grid-col-3-2 gap-[15.07px] bg-[white] p-[20px] rounded-[20px] md:grid-cols-3  overflow-x-auto">
                {dummyListings.slice(0, 3).map((listing, index) => (
                  <ListingCard key={index} listing={listing} featured={true} />
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 bg-[#E5E5E5] text-black rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mb-4 border-1 flex-col gap-[32px] rounded-[32px] p-5 border-[#E1E1E1]">
            {/* Results count */}
            <div className="flex flex-col gap-[16px]">
              <h2 className="sm:text-[18px] md:text-[32px] text-[black] font-[700]">
                {filteredListings.length} Results
              </h2>
              <p className="sm:text-[14px] md:text-[18px] h-[54px] mb-4  leading-[150%] text-[#000000B2] ">
                Discover top businesses for sale, explore opportunities, and
                make informed investments with confidence today.
              </p>
            </div>

            {/* Listings grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {filteredListings.map((listing, index) => (
                <ListingCard key={index} listing={listing} />
              ))}
            </div>

            {filteredListings.length === 0 && (
              <div className="text-center py-10">
                <h3 className="text-xl font-bold mb-2">
                  No listings match your filters
                </h3>
                <p className="text-gray-400 mb-4">
                  Try adjusting your filters to see more results
                </p>
                <Button
                  onClick={handleClearFilters}
                  className="bg-[#c1ff00] text-black hover:bg-[#a8e600]"
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

import { UNKNOWN_LABEL } from "@/lib/emptyValue";
import {
  multipleOf,
  listingMultiples,
  profitMultipleLabel,
  revenueMultipleLabel,
} from "@/lib/financialTableUtils";
import ListingCard from "./ListingCard";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { parseMediaUrls } from "@/lib/mediaUtils";
import { formatBusinessAge } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";

import { formatNumber } from "@/lib/formatNumber";
import { getListingCurrencySymbol } from "@/lib/listingCurrency";
import { useDisplayCurrency } from "@/lib/displayCurrency";
import {
  formatFigureIn,
  formatMoneyIn,
  listingFiguresIn,
  listingMultiplesOf,
  listingPriceIn,
} from "@/lib/listingMoney";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { pickHomeSections } from "@/lib/homeSections";
import { showsPremiumBadge } from "@/lib/packageContent";

/**
 * The listings on the home page: three rows, Popular, Featured and Newest,
 * each with a link to the full list. They replaced a single grid of six
 * under a row of category pills. How each row is chosen, and why no listing
 * appears in two of them, is in homeSections.ts. All three come from the one
 * feed request below.
 */
const Listings = () => {
  const viewerCurrency = useDisplayCurrency();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    fetchListings();
  }, [isAuthenticated, authLoading]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      console.log(
        "🔍 Fetching ALL listings (will filter to PUBLISH client-side)",
      );

      // Fetch ALL listings (same as admin) to ensure we get the same data
      // Then filter to PUBLISH client-side to match admin behavior
      /*
       * Ask for all of them, and only the published ones.
       *
       * Neither argument used to be passed, so the server applied its own
       * default of 40 rows and sent whatever the first page happened to hold.
       * The count under the heading was therefore the page size, not a total —
       * and it changed with who was looking: staff are shown drafts, so an
       * admin's 40 rows included two that the client-side filter then dropped,
       * leaving 38 where a member saw 40 and the database held 41. Three
       * numbers for one figure.
       *
       * Filtering by status here also stops unpublished listings being sent to
       * a browser at all, rather than being fetched and hidden.
       */
      const feedParams = { status: 'PUBLISH', limit: 1000 };
      const response = isAuthenticated
        ? await apiClient.getSecureListings(feedParams)
        : await apiClient.getListings(feedParams); // Cached public feed (TTL ~10s, purged on create/update/delete)
      console.log("📦 API Response (ALL):", response);

      if (response.success) {
        let listingsData = Array.isArray(response.data) ? response.data : [];
        console.log("📊 Total listings count (ALL):", listingsData.length);

        // Filter to only show PUBLISH listings (same logic as admin dashboard)
        // Handle different status formats: 'PUBLISH', 'publish', 'Published', etc.
        const publishedListings = listingsData.filter((l: any) => {
          const status = String(l.status || "").toUpperCase();
          return status === "PUBLISH" || status === "PUBLISHED";
        });

        console.log(
          "📊 Published listings count (after filter):",
          publishedListings.length,
        );
        console.log("📊 Status breakdown:", {
          total: listingsData.length,
          published: publishedListings.length,
          draft: listingsData.filter(
            (l: any) => String(l.status || "").toUpperCase() === "DRAFT",
          ).length,
          other: listingsData.filter((l: any) => {
            const s = String(l.status || "").toUpperCase();
            return s !== "PUBLISH" && s !== "PUBLISHED" && s !== "DRAFT";
          }).length,
          statuses: [...new Set(listingsData.map((l: any) => l.status))],
        });

        // Log first listing to see structure
        if (publishedListings.length > 0) {
          console.log(
            "✅ First published listing structure:",
            publishedListings[0],
          );
          console.log("   - Brand data:", publishedListings[0].brand);
          console.log("   - Category data:", publishedListings[0].category);
          console.log("   - Status:", publishedListings[0].status);
          console.log("   - ID:", publishedListings[0].id);
        } else {
          console.warn("⚠️ No PUBLISH listings found!");
          console.log("Total listings:", listingsData.length);
          console.log("Status breakdown:", [
            ...new Set(listingsData.map((l: any) => l.status)),
          ]);
        }

        setListings(publishedListings);
      } else {
        console.error("❌ API returned error:", response.error);
        console.log("Full error response:", response);
        setListings([]);
      }
    } catch (error) {
      console.error("❌ Error fetching listings:", error);
      console.error("Error details:", error);
      setListings([]);
    }
    setLoading(false);
  };

  const renderCard = (listing: any, index: number) => {
    // Extract data from brand questions
    const brandQuestions = listing.brand || [];
    const getBrandAnswer = (searchTerms: string[]) => {
      const question = brandQuestions.find((b: any) =>
        searchTerms.some((term) =>
          b.question?.toLowerCase().includes(term.toLowerCase()),
        ),
      );
      return question?.answer || null;
    };

    const businessName =
      getBrandAnswer([
        "business name",
        "company name",
        "brand name",
        "name",
      ]) ||
      brandQuestions[0]?.answer ||
      listing.title ||
      "Unnamed Business";
    const businessDescription =
      getBrandAnswer([
        "description",
        "about",
        "business description",
      ]) ||
      listing.description ||
      "";

    // Extract from advertisement questions
    const adQuestions = listing.advertisement || [];
    const getAdAnswer = (searchTerms: string[]) => {
      const question = adQuestions.find((a: any) =>
        searchTerms.some((term) =>
          a.question?.toLowerCase().includes(term.toLowerCase()),
        ),
      );
      return question?.answer || null;
    };

    // Get listing price from advertisement questions first (as per InitializeRequiredQuestions.tsx)
    const askingPrice =
      getAdAnswer(["listing price", "price"]) ||
      getBrandAnswer([
        "asking price",
        "price",
        "selling price",
      ]) ||
      listing.price ||
      0;
    const location =
      getBrandAnswer(["country", "location", "address"]) ||
      listing.location ||
      UNKNOWN_LABEL;
    // Calculate business age from user account creation date
    // Use user account creation date to show how long the business has been on the platform
    const userCreatedAt =
      listing.user?.created_at || listing.user?.createdAt;
    const businessAge = userCreatedAt
      ? formatBusinessAge(userCreatedAt)
      : undefined;
    const adDescription =
      getAdAnswer(["description"]) || businessDescription;

    // Get image from advertisement or brand
    let imageUrl = "";
    const photoQuestion = adQuestions.find(
      (a: any) =>
        a.question?.toLowerCase().includes("photo") ||
        a.answer_type === "PHOTO",
    );
    // Same as the full feed: say why the picture is blurred.
    const imageIsLocked = Boolean(
      photoQuestion?.locked || photoQuestion?.blurredPreview,
    );
    if (photoQuestion?.answer) {
      imageUrl = parseMediaUrls(photoQuestion.answer)[0] || "";
    }
    if (!imageUrl) {
      const brandInfo = brandQuestions[0];
      imageUrl =
        brandInfo?.businessPhoto?.[0] ||
        brandInfo?.logo ||
        listing.image_url ||
        listing.photo ||
        "/placeholder.svg";
    }

    // Calculate average financials from all financials
    const allFinancials = listing.financials || [];

    let avgRevenue = 0;
    let avgNetProfit = 0;

    // Check for financial table format (new format)
    const tableFinancial = allFinancials.find(
      (f: any) =>
        f.name === "__FINANCIAL_TABLE__" && f.revenue_amount,
    );

    if (tableFinancial && tableFinancial.revenue_amount) {
      try {
        // Parse JSON data stored in revenue_amount field
        const financialTableData = JSON.parse(
          tableFinancial.revenue_amount,
        );
        const rowLabels = financialTableData.rowLabels || [];
        const columnLabels =
          financialTableData.columnLabels || [];
        const financialData =
          financialTableData.financialData || {};

        if (columnLabels.length > 0 && rowLabels.length > 0) {
          // Calculate net profit for each column
          const columnProfits: number[] = [];
          const columnRevenues: number[] = [];

          columnLabels.forEach((col: any) => {
            let profit = 0;
            let revenue = 0;

            rowLabels.forEach((rowLabel: string) => {
              const value = parseFloat(
                financialData[rowLabel]?.[col.key] || "0",
              );
              if (rowLabel.toLowerCase().includes("revenue")) {
                profit += value;
                revenue += value;
              } else {
                profit -= value;
              }
            });

            columnProfits.push(profit);
            columnRevenues.push(revenue);
          });

          // Calculate averages
          if (columnProfits.length > 0) {
            avgNetProfit =
              columnProfits.reduce((sum, p) => sum + p, 0) /
              columnProfits.length;
            avgRevenue =
              columnRevenues.reduce((sum, r) => sum + r, 0) /
              columnRevenues.length;
          }
        }
      } catch (e) {
        console.error("Error parsing financial table data:", e);
      }
    }

    // If no table data or table data is empty, try old format
    if (avgRevenue === 0 && avgNetProfit === 0) {
      // Filter out the special table marker record
      const validFinancials = allFinancials.filter(
        (f: any) => f.name !== "__FINANCIAL_TABLE__",
      );

      // Separate monthly and yearly financials
      const monthlyFinancials = validFinancials.filter(
        (f: any) => f.type === "monthly",
      );
      const yearlyFinancials = validFinancials.filter(
        (f: any) => f.type === "yearly",
      );

      // Calculate average from monthly data if available
      if (monthlyFinancials.length > 0) {
        const totalMonthlyRevenue = monthlyFinancials.reduce(
          (sum: number, f: any) =>
            sum + parseFloat(f.revenue_amount || 0),
          0,
        );
        const totalMonthlyProfit = monthlyFinancials.reduce(
          (sum: number, f: any) =>
            sum + parseFloat(f.net_profit || 0),
          0,
        );
        avgRevenue =
          totalMonthlyRevenue / monthlyFinancials.length;
        avgNetProfit =
          totalMonthlyProfit / monthlyFinancials.length;
      } else if (yearlyFinancials.length > 0) {
        // If only yearly data, calculate average yearly and convert to monthly
        const totalYearlyRevenue = yearlyFinancials.reduce(
          (sum: number, f: any) =>
            sum + parseFloat(f.revenue_amount || 0),
          0,
        );
        const totalYearlyProfit = yearlyFinancials.reduce(
          (sum: number, f: any) =>
            sum + parseFloat(f.net_profit || 0),
          0,
        );
        const avgYearlyRevenue =
          totalYearlyRevenue / yearlyFinancials.length;
        const avgYearlyProfit =
          totalYearlyProfit / yearlyFinancials.length;
        // Convert to monthly average
        avgRevenue = avgYearlyRevenue / 12;
        avgNetProfit = avgYearlyProfit / 12;
      } else {
        // Fallback: use all financials if type is not specified
        if (validFinancials.length > 0) {
          const totalRevenue = validFinancials.reduce(
            (sum: number, f: any) =>
              sum + parseFloat(f.revenue_amount || 0),
            0,
          );
          const totalProfit = validFinancials.reduce(
            (sum: number, f: any) =>
              sum + parseFloat(f.net_profit || 0),
            0,
          );
          avgRevenue = totalRevenue / validFinancials.length;
          avgNetProfit = totalProfit / validFinancials.length;
        }
      }
    }

    /**
     * Two decimals, and no stand-in number.
     *
     * These defaulted to "Multiple 1.5x Profit" and "0.5x
     * Revenue" — figures nobody worked out, printed as though
     * they had been, and the same on every listing that had no
     * financials. That is what made the whole feed look like it
     * was showing one listing's numbers.
     */
    // Worked out from the seller's grid, the same as the listing's own page.
    const multiples = listingMultiplesOf(listing);
    // In the visitor's currency, from what the server stored.
    const figures = listingFiguresIn(listing, viewerCurrency);
    const profitMultiple = profitMultipleLabel(multiples.profit);
    const revenueMultiple = revenueMultipleLabel(multiples.revenue);

    const categoryInfo = listing.category?.[0];

    // Ensure unique key
    const listingKey =
      listing.id || `listing-${index}-${businessName}`;

    return (
      <div
        key={listingKey}
        className="animate-scale-in w-[85%] flex-shrink-0 snap-start sm:w-[60%] md:w-[45%] lg:w-auto"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <ListingCard
          image={imageUrl}
          imageLocked={imageIsLocked}
          imageLockType={photoQuestion?.lockType ?? null}
          category={categoryInfo?.name || "Other"}
          name={businessName}
          description={adDescription || businessDescription}
          price={
            formatMoneyIn(listingPriceIn(listing, viewerCurrency)) ||
            `${getListingCurrencySymbol(listing)}${formatNumber(Number(askingPrice))}`
          }
          profitMultiple={profitMultiple}
          revenueMultiple={revenueMultiple}
          location={location}
          locationFlag={location}
          businessAge={businessAge}
          netProfit={
            figures.annualProfit !== null
              ? figures.annualProfit > 0
                ? formatFigureIn(figures.annualProfit, figures)
                : undefined
              : avgNetProfit > 0
                ? `${getListingCurrencySymbol(listing)}${formatNumber(Math.round(avgNetProfit))}`
                : undefined
          }
          revenue={
            figures.annualRevenue !== null
              ? figures.annualRevenue > 0
                ? formatFigureIn(figures.annualRevenue, figures)
                : undefined
              : avgRevenue > 0
                ? `${getListingCurrencySymbol(listing)}${formatNumber(Math.round(avgRevenue))}`
                : undefined
          }
          managedByEx={
            listing.managed_by_ex === true ||
            listing.managed_by_ex === 1 ||
            listing.managed_by_ex === "true" ||
            listing.managed_by_ex === "1"
          }
          isPremium={showsPremiumBadge(listing)}
          listingId={listing.id}
          sellerId={listing.userId || listing.user_id}
        />
      </div>
    );
  };

  const sections = pickHomeSections(listings);
  // Shown in the design's order. A row with nothing in it is left out —
  // Featured in particular, which only holds placements sellers paid for.
  const rows = [
    { key: "popular", title: "Popular Listings", items: sections.popular },
    { key: "featured", title: "Featured Listings", items: sections.featured },
    { key: "newest", title: "Newest Listings", items: sections.newest },
  ].filter((row) => row.items.length > 0);

  return (
    <section id="listings" className="py-12 sm:py-16 md:py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center items-center py-12 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No listings found</p>
          </div>
        ) : (
          <div
            className="flex flex-col gap-12 sm:gap-16"
            style={{ maxWidth: "1521px", margin: "0 auto" }}
          >
            {rows.map((row) => (
              <section key={row.key} aria-labelledby={`home-${row.key}-title`}>
                <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-6 sm:gap-4">
                  <h2
                    id={`home-${row.key}-title`}
                    className="m-0 font-sora text-[26px] font-semibold leading-[120%] text-black sm:text-[32px] lg:text-[40px]"
                  >
                    {row.title}
                  </h2>
                  {/* Every row leads to the same full list: All Listings has
                      no ordering to open it in yet. */}
                  <Link
                    to="/all-listings"
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:text-sm"
                  >
                    See All Listings
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                {/* Three across on a wide screen; below that the row scrolls
                    sideways, so three rows of three do not make the page nine
                    cards long on a phone. */}
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0">
                  {row.items.map(renderCard)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Listings;

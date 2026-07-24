import { Button } from "./ui/button";
import ListingCard from "./ListingCard";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useCategories } from "@/hooks/useCategories";
import { formatBusinessAge } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";

interface ListingsProps {
  searchQuery: string;
}

const Listings = ({ searchQuery }: ListingsProps) => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const LISTINGS_PER_PAGE = 6; // Show only 6 listings on home page
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Use the same hook as admin dashboard for consistent category display
  const { data: categoriesData = [], isLoading: categoriesLoading } =
    useCategories({ nocache: true });

  // Extract category names and add "All" option
  const categories = [
    "All",
    ...categoriesData
      .map((c: any) => c.name)
      .filter(
        (name: string) =>
          name !== "Managed by EX" &&
          name !== "🤝 Managed by EX" &&
          name !== "managed by ex" &&
          name?.trim() !== "",
      ),
  ];

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
      const response = isAuthenticated
        ? await apiClient.getSecureListings()
        : await apiClient.getListings(); // Cached public feed (TTL ~10s, purged on create/update/delete)
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

  const filteredListings = listings.filter((listing) => {
    const categoryName = listing.category?.[0]?.name || "";

    // Handle category filter
    let matchesCategory = true;
    if (activeCategory !== "All") {
      // Regular category filter
      matchesCategory = listing.category?.some(
        (cat: any) => cat.name === activeCategory,
      );
    }

    const matchesSearch =
      searchQuery === "" ||
      listing.brand?.[0]?.businessName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="listings" className="py-12 sm:py-16 md:py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 animate-fade-in">
          <h2 className="font-sora font-semibold text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] leading-[130%] text-center mb-3 sm:mb-4">
            Explore the Newest
            <br className="hidden sm:block" />
            Business Listings
          </h2>
          <p className="font-sora font-normal text-base leading-[160%] text-center text-muted-foreground mb-6 sm:mb-8 px-4">
            Discover the latest business opportunities with our newest listings.
            <br className="hidden sm:block" />
            Find your perfect match and grow today!
          </p>

          {/* Category Slider - Mobile: horizontal scroll, Desktop: flex-wrap */}
          <div
            className="mb-6 sm:mb-8 px-4 overflow-x-auto overflow-y-hidden"
            style={{
              scrollbarWidth: "none" /* Firefox */,
              msOverflowStyle: "none" /* IE and Edge */,
              WebkitOverflowScrolling: "touch" /* iOS smooth scrolling */,
            }}
          >
            <style>{`
              .category-scroll::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
              }
            `}</style>
            <div
              className="flex flex-nowrap sm:flex-wrap justify-start sm:justify-center gap-2 sm:gap-3 category-scroll"
              style={{
                width: "max-content",
                minWidth: "100%",
              }}
            >
              {categories.map((category, catIndex) => {
                return (
                  <button
                    key={`category-${catIndex}-${category}`}
                    onClick={() => setActiveCategory(category)}
                    className={`flex-shrink-0 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                      activeCategory === category
                        ? "bg-accent text-accent-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12 sm:py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8"
              style={{
                gap: "24px",
                width: "100%",
                maxWidth: "1521px",
                margin: "0 auto",
                paddingLeft: "0",
                paddingRight: "0",
              }}
            >
              {filteredListings
                .slice(0, LISTINGS_PER_PAGE)
                .map((listing, index) => {
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
                    "Not specified";
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
                  if (photoQuestion?.answer) {
                    imageUrl = Array.isArray(photoQuestion.answer)
                      ? photoQuestion.answer[0]
                      : photoQuestion.answer;
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

                  // Calculate profit multiple (using average monthly profit * 12 for annual)
                  let profitMultiple = "Multiple 1.5x Profit"; // Default
                  if (askingPrice && avgNetProfit > 0) {
                    const annualProfit = avgNetProfit * 12;
                    const multiple = parseFloat(askingPrice) / annualProfit;
                    profitMultiple = `Multiple ${multiple.toFixed(1)}x Profit`;
                  }

                  // Calculate revenue multiple (using average monthly revenue * 12 for annual)
                  let revenueMultiple = "0.5x Revenue"; // Default
                  if (askingPrice && avgRevenue > 0) {
                    const annualRevenue = avgRevenue * 12;
                    const multiple = parseFloat(askingPrice) / annualRevenue;
                    revenueMultiple = `${multiple.toFixed(1)}x Revenue`;
                  }

                  const categoryInfo = listing.category?.[0];

                  // Ensure unique key
                  const listingKey =
                    listing.id || `listing-${index}-${businessName}`;

                  return (
                    <div
                      key={listingKey}
                      className="animate-scale-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <ListingCard
                        image={imageUrl}
                        category={categoryInfo?.name || "Other"}
                        name={businessName}
                        description={adDescription || businessDescription}
                        price={`$${Number(askingPrice).toLocaleString()}`}
                        profitMultiple={profitMultiple}
                        revenueMultiple={revenueMultiple}
                        location={location}
                        locationFlag={location}
                        businessAge={businessAge}
                        netProfit={
                          avgNetProfit > 0
                            ? `$${Math.round(avgNetProfit).toLocaleString()}`
                            : undefined
                        }
                        revenue={
                          avgRevenue > 0
                            ? `$${Math.round(avgRevenue).toLocaleString()}`
                            : undefined
                        }
                        managedByEx={
                          listing.managed_by_ex === true ||
                          listing.managed_by_ex === 1 ||
                          listing.managed_by_ex === "true" ||
                          listing.managed_by_ex === "1"
                        }
                        listingId={listing.id}
                        sellerId={listing.userId || listing.user_id}
                      />
                    </div>
                  );
                })}
            </div>

            {filteredListings.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  No listings found
                </p>
              </div>
            )}
          </>
        )}

        {filteredListings.length > LISTINGS_PER_PAGE && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={() => navigate("/all-listings")}
            >
              View All Listings ({filteredListings.length})
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Listings;

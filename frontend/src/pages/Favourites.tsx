import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { DashboardHeader } from "@/components/listings/DashboardHeader";
import ListingCard from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { readPersisted, writePersisted } from "@/lib/persistentCache";
import { formatBusinessAge } from "@/lib/dateUtils";
import { useCategories } from "@/hooks/useCategories";

const Favourites = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [location, setLocation] = useState("all");
  const [age, setAge] = useState("all");
  const [niche, setNiche] = useState("all");

  // Get categories for niche filter
  const { data: categoriesData = [] } = useCategories({ nocache: true });
  const categories = ["All", ...categoriesData.map((c: any) => c.name).filter((name: string) =>
    name !== "Managed by EX" &&
    name !== "🤝 Managed by EX" &&
    name !== "managed by ex" &&
    name?.trim() !== ""
  )];

  // Redirect unauthenticated users to login.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch favourites through React Query so the result is CACHED. Navigating
  // away and back shows the saved favourites instantly (refreshed in the
  // background) instead of a full-screen "Loading..." spinner on every visit.
  // The favourites endpoint already returns each favourite with its full
  // listing data (brand, advertisement, category, financials, user), so a
  // single request is enough.
  // Persist favourites to localStorage so even a full page reload shows them
  // instantly (initialData) while a fresh copy loads in the background.
  const favouritesKey = `favourites:${user?.id}`;

  const { data: favorites = [], isLoading } = useQuery<any[]>({
    queryKey: ["favourites", user?.id],
    queryFn: async () => {
      const res = await apiClient.getFavorites();
      if (!res.success || !res.data) {
        throw new Error((res.error as string) || "Failed to load favourites");
      }
      const list = Array.isArray(res.data) ? res.data : [];
      // Normalise so each card always has a `listing` object to read from.
      return list.map((favorite: any) => ({
        ...favorite,
        listing: favorite.listing || favorite,
      }));
    },
    enabled: isAuthenticated && !!user?.id,
    initialData: () => (user?.id ? readPersisted<any[]>(favouritesKey) : undefined),
    initialDataUpdatedAt: 0, // persisted data is treated as stale → refetch on mount
    // Default staleTime (0): revisits show cached favourites instantly (no
    // spinner) while a background refetch picks up anything added/removed
    // elsewhere — stale-while-revalidate.
  });

  // Keep the persisted copy in sync with the latest favourites.
  useEffect(() => {
    if (user?.id && favorites.length) writePersisted(favouritesKey, favorites);
  }, [user?.id, favorites, favouritesKey]);

  // Only the (instant, localStorage-based) auth check gates the whole screen.
  // The favourites fetch shows a loader inside the content area instead, so the
  // sidebar and header render immediately.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ListingsSidebar />

      <div className="flex-1 w-full md:w-auto lg:ml-[240px] xl:ml-[280px]">
        {/* Header - Shared across all tabs */}
        <DashboardHeader />

        {/* Main Content */}
        <main className="px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8">
          {/* Favorites List */}
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Favourites</h1>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
                  Your favorite listings will appear here. Start browsing to save companies you're interested in.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="bg-[#D3FC50] text-black rounded-full text-sm sm:text-base"
                >
                  Browse Listings
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {/* Filter Section */}
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                {/* Left Side - All Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 md:gap-3 flex-1 min-w-0 flex-wrap">
                  {/* Search Field */}
                  <div className="relative flex-1 sm:flex-initial sm:w-[180px] md:w-[200px] lg:w-[220px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 flex items-center gap-2 rounded-full border border-black/10 bg-[rgba(250,250,250,1)]">
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 text-black/50 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[11px] sm:text-xs md:text-sm placeholder:text-black/50"
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 400,
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: 'rgba(0, 0, 0, 0.5)',
                      }}
                    />
                  </div>

                  {/* Price Range */}
                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger className="w-full sm:w-[120px] md:w-[140px] lg:w-[160px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 rounded-full border border-black/10 bg-[rgba(250,250,250,1)] text-[11px] sm:text-xs md:text-sm text-black/50">
                      <SelectValue placeholder="Price Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Price Range</SelectItem>
                      <SelectItem value="0-10000">$0 - $10,000</SelectItem>
                      <SelectItem value="10000-50000">$10,000 - $50,000</SelectItem>
                      <SelectItem value="50000-100000">$50,000 - $100,000</SelectItem>
                      <SelectItem value="100000+">$100,000+</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Location */}
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="w-full sm:w-[140px] md:w-[160px] lg:w-[180px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 rounded-full border border-black/10 bg-[rgba(250,250,250,1)] text-[11px] sm:text-xs md:text-sm text-black/50">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Location</SelectItem>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Age */}
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger className="w-full sm:w-[100px] md:w-[120px] lg:w-[130px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 rounded-full border border-black/10 bg-[rgba(250,250,250,1)] text-[11px] sm:text-xs md:text-sm text-black/50">
                      <SelectValue placeholder="Age" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Age</SelectItem>
                      <SelectItem value="0-1">0-1 years</SelectItem>
                      <SelectItem value="1-3">1-3 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Niche */}
                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger className="w-full sm:w-[120px] md:w-[140px] lg:w-[160px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 rounded-full border border-black/10 bg-[rgba(250,250,250,1)] text-[11px] sm:text-xs md:text-sm text-black/50">
                      <SelectValue placeholder="Niche" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category === "All" ? "all" : category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Right Side - Add Favourites Button */}
                <Button
                  onClick={() => navigate("/all-listings")}
                  className="w-full sm:w-auto sm:flex-shrink-0 h-[44px] sm:h-[48px] md:h-[50px] px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3 rounded-full bg-[rgba(174,243,31,1)] font-['Lufga'] font-medium text-[11px] sm:text-xs md:text-sm text-black border-none flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  + Add Favourites
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {favorites
                  .filter((favorite: any) => {
                    const listing = favorite.listing || favorite;
                    const brandQuestions = listing.brand || [];
                    const getBrandAnswer = (searchTerms: string[]) => {
                      const question = brandQuestions.find((b: any) => 
                        searchTerms.some(term => b.question?.toLowerCase().includes(term.toLowerCase()))
                      );
                      return question?.answer || null;
                    };
                    
                    const businessName = getBrandAnswer(['business name', 'company name', 'brand name', 'name']) || 
                                        brandQuestions[0]?.answer || 
                                        listing.title || 
                                        'Unnamed Business';
                    const listingLocation = getBrandAnswer(['country', 'location', 'address']) || 
                                           listing.location || 
                                           'Not specified';
                    const categoryName = listing.category?.[0]?.name || '';
                    
                    // Search filter
                    if (searchQuery) {
                      const searchLower = searchQuery.toLowerCase();
                      if (!businessName.toLowerCase().includes(searchLower) && 
                          !categoryName.toLowerCase().includes(searchLower) &&
                          !listingLocation.toLowerCase().includes(searchLower)) {
                        return false;
                      }
                    }
                    
                    // Niche filter
                    if (niche !== "all" && categoryName !== niche) {
                      return false;
                    }
                    
                    return true;
                  })
                  .map((favorite: any, index: number) => {
                  const listing = favorite.listing || favorite;
                  const listingId = listing.id || favorite.listingId || favorite.id;
                  
                  // Extract data from brand questions (same logic as homepage)
                  const brandQuestions = listing.brand || [];
                  const getBrandAnswer = (searchTerms: string[]) => {
                    const question = brandQuestions.find((b: any) => 
                      searchTerms.some(term => b.question?.toLowerCase().includes(term.toLowerCase()))
                    );
                    return question?.answer || null;
                  };
                  
                  const businessName = getBrandAnswer(['business name', 'company name', 'brand name', 'name']) || 
                                      brandQuestions[0]?.answer || 
                                      listing.title || 
                                      'Unnamed Business';
                  const businessDescription = getBrandAnswer(['description', 'about', 'business description']) || 
                                             listing.description || 
                                             '';
                  
                  // Extract from advertisement questions
                  const adQuestions = listing.advertisement || [];
                  const getAdAnswer = (searchTerms: string[]) => {
                    const question = adQuestions.find((a: any) => 
                      searchTerms.some(term => a.question?.toLowerCase().includes(term.toLowerCase()))
                    );
                    return question?.answer || null;
                  };
                  
                  // Get listing price from advertisement questions first
                  const askingPrice = getAdAnswer(['listing price', 'price']) || 
                                    getBrandAnswer(['asking price', 'price', 'selling price']) || 
                                    listing.price || 
                                    0;
                  const location = getBrandAnswer(['country', 'location', 'address']) || 
                                 listing.location || 
                                 'Not specified';
                  
                  // Calculate business age from user account creation date
                  const userCreatedAt = listing.user?.created_at || listing.user?.createdAt;
                  const businessAge = userCreatedAt ? formatBusinessAge(userCreatedAt) : undefined;
                  const adDescription = getAdAnswer(['description']) || businessDescription;
                  
                  // Get image from advertisement or brand
                  let imageUrl = '';
                  const photoQuestion = adQuestions.find((a: any) => 
                    a.question?.toLowerCase().includes('photo') || a.answer_type === 'PHOTO'
                  );
                  if (photoQuestion?.answer) {
                    imageUrl = Array.isArray(photoQuestion.answer) ? photoQuestion.answer[0] : photoQuestion.answer;
                  }
                  if (!imageUrl) {
                    const brandInfo = brandQuestions[0];
                    imageUrl = brandInfo?.businessPhoto?.[0] || 
                              brandInfo?.logo || 
                              listing.image_url || 
                              listing.photo || 
                              "/placeholder.svg";
                  }
                  
                  // Calculate average financials from all financials (same logic as homepage)
                  const allFinancials = listing.financials || [];
                  
                  let avgRevenue = 0;
                  let avgNetProfit = 0;
                  
                  // Check for financial table format (new format)
                  const tableFinancial = allFinancials.find((f: any) => 
                    f.name === '__FINANCIAL_TABLE__' && f.revenue_amount
                  );
                  
                  if (tableFinancial && tableFinancial.revenue_amount) {
                    try {
                      // Parse JSON data stored in revenue_amount field
                      const financialTableData = JSON.parse(tableFinancial.revenue_amount);
                      const rowLabels = financialTableData.rowLabels || [];
                      const columnLabels = financialTableData.columnLabels || [];
                      const financialData = financialTableData.financialData || {};
                      
                      if (columnLabels.length > 0 && rowLabels.length > 0) {
                        // Calculate net profit for each column
                        const columnProfits: number[] = [];
                        const columnRevenues: number[] = [];
                        
                        columnLabels.forEach((col: any) => {
                          let profit = 0;
                          let revenue = 0;
                          
                          rowLabels.forEach((rowLabel: string) => {
                            const value = parseFloat(financialData[rowLabel]?.[col.key] || '0');
                            if (rowLabel.toLowerCase().includes('revenue')) {
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
                          avgNetProfit = columnProfits.reduce((sum, p) => sum + p, 0) / columnProfits.length;
                          avgRevenue = columnRevenues.reduce((sum, r) => sum + r, 0) / columnRevenues.length;
                        }
                      }
                    } catch (e) {
                      console.error('Error parsing financial table data:', e);
                    }
                  }
                  
                  // If no table data or table data is empty, try old format
                  if (avgRevenue === 0 && avgNetProfit === 0) {
                    // Filter out the special table marker record
                    const validFinancials = allFinancials.filter((f: any) => f.name !== '__FINANCIAL_TABLE__');
                    
                    // Separate monthly and yearly financials
                    const monthlyFinancials = validFinancials.filter((f: any) => f.type === 'monthly');
                    const yearlyFinancials = validFinancials.filter((f: any) => f.type === 'yearly');
                    
                    // Calculate average from monthly data if available
                    if (monthlyFinancials.length > 0) {
                      const totalMonthlyRevenue = monthlyFinancials.reduce((sum: number, f: any) => 
                        sum + parseFloat(f.revenue_amount || 0), 0
                      );
                      const totalMonthlyProfit = monthlyFinancials.reduce((sum: number, f: any) => 
                        sum + parseFloat(f.net_profit || 0), 0
                      );
                      avgRevenue = totalMonthlyRevenue / monthlyFinancials.length;
                      avgNetProfit = totalMonthlyProfit / monthlyFinancials.length;
                    } else if (yearlyFinancials.length > 0) {
                      // If only yearly data, calculate average yearly and convert to monthly
                      const totalYearlyRevenue = yearlyFinancials.reduce((sum: number, f: any) => 
                        sum + parseFloat(f.revenue_amount || 0), 0
                      );
                      const totalYearlyProfit = yearlyFinancials.reduce((sum: number, f: any) => 
                        sum + parseFloat(f.net_profit || 0), 0
                      );
                      const avgYearlyRevenue = totalYearlyRevenue / yearlyFinancials.length;
                      const avgYearlyProfit = totalYearlyProfit / yearlyFinancials.length;
                      // Convert to monthly average
                      avgRevenue = avgYearlyRevenue / 12;
                      avgNetProfit = avgYearlyProfit / 12;
                    } else {
                      // Fallback: use all financials if type is not specified
                      if (validFinancials.length > 0) {
                        const totalRevenue = validFinancials.reduce((sum: number, f: any) => 
                          sum + parseFloat(f.revenue_amount || 0), 0
                        );
                        const totalProfit = validFinancials.reduce((sum: number, f: any) => 
                          sum + parseFloat(f.net_profit || 0), 0
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
                    const multiple = parseFloat(askingPrice.toString()) / annualProfit;
                    profitMultiple = `Multiple ${multiple.toFixed(1)}x Profit`;
                  }
                  
                  // Calculate revenue multiple (using average monthly revenue * 12 for annual)
                  let revenueMultiple = "0.5x Revenue"; // Default
                  if (askingPrice && avgRevenue > 0) {
                    const annualRevenue = avgRevenue * 12;
                    const multiple = parseFloat(askingPrice.toString()) / annualRevenue;
                    revenueMultiple = `${multiple.toFixed(1)}x Revenue`;
                  }
                  
                  const categoryInfo = listing.category?.[0];
                  
                  return (
                    <div
                      key={favorite.id || listingId || `favorite-${index}`}
                      className="animate-scale-in w-full"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <ListingCard
                        image={imageUrl}
                        category={categoryInfo?.name || 'Other'}
                        name={businessName}
                        description={adDescription || businessDescription}
                        price={`$${Number(askingPrice).toLocaleString()}`}
                        profitMultiple={profitMultiple}
                        revenueMultiple={revenueMultiple}
                        location={location}
                        locationFlag={location}
                        businessAge={businessAge}
                        netProfit={avgNetProfit > 0 ? `$${Math.round(avgNetProfit).toLocaleString()}` : undefined}
                        revenue={avgRevenue > 0 ? `$${Math.round(avgRevenue).toLocaleString()}` : undefined}
                        managedByEx={listing.managed_by_ex === true || listing.managed_by_ex === 1 || listing.managed_by_ex === 'true' || listing.managed_by_ex === '1'}
                        listingId={listingId}
                        sellerId={listing.userId || listing.user_id}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Favourites;

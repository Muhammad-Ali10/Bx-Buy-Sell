import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useUserFavorites } from "@/hooks/useUserFavorites";
import { useCategories } from "@/hooks/useCategories";
import { formatBusinessAge } from "@/lib/dateUtils";
import ListingCard from "@/components/ListingCard";

export default function AdminUserFavorites() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: favorites, isLoading, refetch } = useUserFavorites(id);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [location, setLocation] = useState("all");
  const [age, setAge] = useState("all");
  const [niche, setNiche] = useState("all");
  const { data: categoriesData = [] } = useCategories({ nocache: true });
  const categories = ["All", ...categoriesData.map((c: any) => c.name).filter((name: string) =>
    name !== "Managed by EX" &&
    name !== "🤝 Managed by EX" &&
    name !== "managed by ex" &&
    name?.trim() !== ""
  )];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1">
        <AdminHeader title="User Details" />

        <div className="p-8">
          <Button
            variant="ghost"
            className="mb-6 flex items-center gap-2 p-0 hover:bg-transparent"
            onClick={() => navigate(`/admin/users/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 text-black" />
            <span className="font-outfit font-bold text-[18px] leading-[100%] text-black">
              User Details
            </span>
          </Button>

          {/* Listings Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : !favorites || favorites.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No favorites found for this user</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 md:gap-3 flex-1 min-w-0 flex-wrap">
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

                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger className="w-full sm:w-[110px] md:w-[130px] lg:w-[150px] h-[44px] sm:h-[48px] md:h-[50px] px-3 sm:px-4 md:px-4 rounded-full border border-black/10 bg-[rgba(250,250,250,1)] text-[11px] sm:text-xs md:text-sm text-black/50">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: string) => (
                        <SelectItem key={category} value={category === "All" ? "all" : category}>
                          {category === "All" ? "All" : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full sm:w-auto sm:flex-shrink-0 h-[44px] sm:h-[48px] md:h-[50px] px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3 rounded-full bg-[rgba(174,243,31,1)] font-['Lufga'] font-medium text-[11px] sm:text-xs md:text-sm text-black border-none flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  + Add Favourites
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {favorites
                  .filter((favorite: any) => {
                    const listing = favorite.listing || favorite;
                    const statusRaw = String(listing.status || "").toLowerCase();
                    if (statusRaw !== "publish") {
                      return false;
                    }

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

                    if (searchQuery) {
                      const searchLower = searchQuery.toLowerCase();
                      if (!businessName.toLowerCase().includes(searchLower) &&
                          !categoryName.toLowerCase().includes(searchLower) &&
                          !listingLocation.toLowerCase().includes(searchLower)) {
                        return false;
                      }
                    }

                    if (niche !== "all" && categoryName !== niche) {
                      return false;
                    }

                    return true;
                  })
                  .map((favorite: any, index: number) => {
                  const listing = favorite.listing || favorite;
                  const listingId = listing.id || favorite.listingId || favorite.id;

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

                  const adQuestions = listing.advertisement || [];
                  const getAdAnswer = (searchTerms: string[]) => {
                    const question = adQuestions.find((a: any) =>
                      searchTerms.some(term => a.question?.toLowerCase().includes(term.toLowerCase()))
                    );
                    return question?.answer || null;
                  };

                  const askingPrice = getAdAnswer(['listing price', 'price']) ||
                                    getBrandAnswer(['asking price', 'price', 'selling price']) ||
                                    listing.price ||
                                    0;
                  const listingLocation = getBrandAnswer(['country', 'location', 'address']) ||
                                 listing.location ||
                                 'Not specified';

                  const userCreatedAt = listing.user?.created_at || listing.user?.createdAt;
                  const businessAge = userCreatedAt ? formatBusinessAge(userCreatedAt) : undefined;
                  const adDescription = getAdAnswer(['description']) || businessDescription;

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

                  const allFinancials = listing.financials || [];

                  let avgRevenue = 0;
                  let avgNetProfit = 0;

                  const validFinancials = allFinancials.filter((f: any) => f.name !== '__FINANCIAL_TABLE__');
                  const monthlyFinancials = validFinancials.filter((f: any) => f.type === 'monthly');
                  const yearlyFinancials = validFinancials.filter((f: any) => f.type === 'yearly');

                  if (monthlyFinancials.length > 0) {
                    const totalRevenue = monthlyFinancials.reduce((sum: number, f: any) =>
                      sum + parseFloat(f.revenue_amount || 0), 0
                    );
                    const totalProfit = monthlyFinancials.reduce((sum: number, f: any) =>
                      sum + parseFloat(f.net_profit || 0), 0
                    );
                    avgRevenue = totalRevenue / monthlyFinancials.length;
                    avgNetProfit = totalProfit / monthlyFinancials.length;
                  } else if (yearlyFinancials.length > 0) {
                    const totalRevenue = yearlyFinancials.reduce((sum: number, f: any) =>
                      sum + parseFloat(f.revenue_amount || 0), 0
                    );
                    const totalProfit = yearlyFinancials.reduce((sum: number, f: any) =>
                      sum + parseFloat(f.net_profit || 0), 0
                    );
                    avgRevenue = totalRevenue / yearlyFinancials.length / 12;
                    avgNetProfit = totalProfit / yearlyFinancials.length / 12;
                  }

                  let profitMultiple = "Multiple 1.5x Profit";
                  if (askingPrice && avgNetProfit > 0) {
                    const annualProfit = avgNetProfit * 12;
                    const multiple = parseFloat(askingPrice.toString()) / annualProfit;
                    profitMultiple = `Multiple ${multiple.toFixed(1)}x Profit`;
                  }

                  let revenueMultiple = "0.5x Revenue";
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
                        location={listingLocation}
                        locationFlag={listingLocation}
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
        </div>
      </main>
    </div>
  );
}

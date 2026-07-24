import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Settings, LogOut, Rocket, DollarSign, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";
import FlagIcon from "@/components/FlagIcon";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/_App Icon 1 (2).png";

interface FilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  onFind: () => void;
}

export interface FilterState {
  search: string;
  niche: string;
  revenueGenerating: "yes" | "no" | "all";
  priceRange: [number, number];
  businessLocation: string;
  advancedFilters: {
    targetCountry: string;
    targetCountryPercentage: number;
    ageRange: [number, number];
    monthlyRevenue: [number, number];
    monthlyProfit: [number, number];
    monthlyPageviews: [number, number];
    revenueMultiple: [number, number];
    profitMultiple: [number, number];
  };
}

const FilterSidebar = ({ filters, onFiltersChange, onClearFilters, onFind }: FilterSidebarProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const { data: categoriesData = [] } = useCategories({ nocache: true });
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Extract category names for niche dropdown
  const niches = categoriesData
    .map((c: any) => c.name)
    .filter((name: string) => 
      name !== "Managed by EX" && 
      name !== "🤝 Managed by EX" &&
      name !== "managed by ex" &&
      name?.trim() !== ""
    );

  // Common countries list
  const countries = [
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "India",
    "Pakistan",
    "Singapore",
    "UAE",
    "Germany",
    "France",
    "Spain",
    "Italy",
    "Netherlands",
    "Belgium",
    "Sweden",
    "Norway",
    "Denmark",
    "Japan",
    "South Korea",
    "China",
    "Brazil",
    "Mexico",
    "Argentina",
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const updateFilter = (key: string, value: any) => {
    if (key.startsWith("advanced.")) {
      const advancedKey = key.replace("advanced.", "") as keyof FilterState["advancedFilters"];
      onFiltersChange({
        ...filters,
        advancedFilters: {
          ...filters.advancedFilters,
          [advancedKey]: value,
        },
      });
    } else {
      onFiltersChange({
        ...filters,
        [key]: value,
      });
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString()}`;
  };

  // Format number with k suffix
  const formatNumber = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  return (
    <div 
      className="filter-sidebar flex flex-col w-full h-screen" 
      style={{ 
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingLeft: '5px',
        paddingRight: '5px',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo at the top - fixed */}
      <div className="flex-shrink-0 mb-4" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
        <Link to="/" className="flex items-center">
          <img 
            src={logo} 
            alt="EX Logo" 
            className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
          />
        </Link>
      </div>

      {/* Scrollable content area - between logo and buttons */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden w-full px-0 filter-sidebar-scroll"
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Inner container with filters - horizontally centered */}
        <div
          className="flex flex-col"
          style={{
            width: "100%",
            maxWidth: "293px",
            borderRadius: "16px",
            padding: "16px",
            gap: "20px",
            backgroundColor: "rgba(24, 24, 26, 1)",
          }}
        >
        {/* Title */}
        <h2 
          className="font-lufga text-white text-base md:text-lg"
          style={{
            fontWeight: 600,
            fontSize: "18px",
            lineHeight: "140%",
            letterSpacing: "0%",
            color: "rgba(255, 255, 255, 1)",
          }}
        >
          Filter Options
        </h2>

        {/* Search Bar */}
        <div 
          className="relative flex items-center"
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "12px",
            gap: "8px",
            paddingTop: "12px",
            paddingRight: "12px",
            paddingBottom: "12px",
            paddingLeft: "16px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
          }}
        >
          <Search className="w-4 h-4 text-white flex-shrink-0" />
          <input
            type="text"
            placeholder="Search"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="flex-1 bg-transparent border-0 outline-0 font-lufga text-white placeholder:text-white text-xs md:text-sm"
            style={{
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              color: "rgba(255, 255, 255, 1)",
            }}
          />
        </div>

        {/* Niche */}
        <div className="space-y-2">
          <label 
            className="font-lufga text-white text-xs md:text-sm"
            style={{
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              color: "rgba(255, 255, 255, 1)",
            }}
          >
            Niche
          </label>
          <Select
            value={filters.niche}
            onValueChange={(value) => updateFilter("niche", value)}
          >
            <SelectTrigger 
              className="text-white border-0 focus:ring-0 focus:ring-offset-0"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                justifyContent: "space-between",
                paddingTop: "12px",
                paddingRight: "12px",
                paddingBottom: "12px",
                paddingLeft: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                fontSize: "14px",
              }}
            >
              <SelectValue placeholder="Select niche" />
            </SelectTrigger>
            <SelectContent className="bg-[rgba(24,24,26,1)] border-gray-700">
              <SelectItem value="all" className="text-white hover:bg-gray-800">
                All
              </SelectItem>
              {niches.map((niche: string) => (
                <SelectItem key={niche} value={niche} className="text-white hover:bg-gray-800">
                  {niche}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Revenue Generating */}
        <div className="space-y-2">
          <label 
            className="font-lufga text-white text-xs md:text-sm"
            style={{
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              color: "rgba(255, 255, 255, 1)",
            }}
          >
            Revenue generating
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => updateFilter("revenueGenerating", filters.revenueGenerating === "yes" ? "all" : "yes")}
              className={`text-xs md:text-sm ${
                filters.revenueGenerating === "yes"
                  ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90"
                  : "text-white hover:opacity-80"
              }`}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "12px",
                padding: "12px",
                gap: "8px",
                fontSize: "14px",
                backgroundColor: filters.revenueGenerating === "yes" 
                  ? "#D3FC50" 
                  : "rgba(255, 255, 255, 0.05)",
              }}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => updateFilter("revenueGenerating", filters.revenueGenerating === "no" ? "all" : "no")}
              className={`text-xs md:text-sm ${
                filters.revenueGenerating === "no"
                  ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90"
                  : "text-white hover:opacity-80"
              }`}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "12px",
                padding: "12px",
                gap: "8px",
                fontSize: "14px",
                backgroundColor: filters.revenueGenerating === "no" 
                  ? "#D3FC50" 
                  : "rgba(255, 255, 255, 0.05)",
              }}
            >
              No
            </Button>
          </div>
        </div>

        {/* Price */}
        <div className="space-y-2">
          <div 
            className="flex flex-col relative"
            style={{
              width: "100%",
              height: "130px",
              borderRadius: "12px",
              padding: "10px",
              gap: "12px",
              backgroundColor: "rgba(36, 36, 37, 1)",
            }}
          >
            {/* Price Label */}
            <label 
              className="font-lufga text-white"
              style={{
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                letterSpacing: "0%",
                color: "rgba(255, 255, 255, 1)",
              }}
            >
              Price
            </label>
            
            {/* Price Numbers */}
            <div className="flex justify-between items-center">
              <span 
                className="font-lufga text-white"
                style={{
                  fontWeight: 500,
                  fontSize: "12px",
                  lineHeight: "150%",
                  letterSpacing: "0%",
                  color: "rgba(255, 255, 255, 1)",
                }}
              >
                {formatCurrency(filters.priceRange[0])}
              </span>
              <span 
                className="font-lufga text-white"
                style={{
                  fontWeight: 500,
                  fontSize: "12px",
                  lineHeight: "150%",
                  letterSpacing: "0%",
                  textAlign: "right",
                  color: "rgba(255, 255, 255, 1)",
                }}
              >
                {formatCurrency(filters.priceRange[1])}
              </span>
            </div>
            
            {/* Histogram with Slider */}
            <div className="relative" style={{ height: "60px" }}>
              {(() => {
                const minValue = 0;
                const maxValue = 100000;
                const leftPercent = ((filters.priceRange[0] - minValue) / (maxValue - minValue)) * 100;
                const rightPercent = ((filters.priceRange[1] - minValue) / (maxValue - minValue)) * 100;
                const rangeWidth = rightPercent - leftPercent;
                
                // Predefined bar heights for consistent visualization
                const barHeights = [12, 8, 15, 20, 25, 18, 22, 28, 16, 10, 14, 19, 24, 17, 21, 26, 13, 9, 23, 27, 11, 15, 20, 18, 22, 16, 19, 14, 17, 21];
                
                return (
                  <>
                    {/* Vertical bars - positioned directly above track line */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between" style={{ height: "43px", paddingLeft: "12px", paddingRight: "12px" }}>
                      {Array.from({ length: 30 }).map((_, i) => {
                        const barPosition = (i / 29) * 100;
                        const isInRange = barPosition >= leftPercent && barPosition <= rightPercent;
                        const barHeight = barHeights[i] || 15;
                        return (
                          <div
                            key={i}
                            style={{
                              width: "4.76px",
                              height: `${barHeight}px`,
                              backgroundColor: isInRange 
                                ? "rgba(197, 253, 31, 1)" 
                                : "rgba(58, 58, 59, 1)",
                            }}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Track line container - smooth continuous line with rounded ends */}
                    <div className="absolute bottom-0" style={{ left: "12px", width: "269px", height: "6px", borderRadius: "10px", overflow: "hidden", backgroundColor: "rgba(58, 58, 59, 1)" }}>
                      {/* Selected range horizontal line (green) - active, on top of gray background */}
                      <div 
                        className="absolute bottom-0"
                        style={{
                          left: `${Math.max(0, leftPercent)}%`,
                          width: `${rangeWidth}%`,
                          height: "6px",
                          backgroundColor: "rgba(197, 253, 31, 1)",
                          borderRadius: leftPercent <= 0.5 && rightPercent >= 99.5
                            ? "10px" 
                            : leftPercent <= 0.5
                            ? "10px 0 0 10px" 
                            : rightPercent >= 99.5
                            ? "0 10px 10px 0" 
                            : "0",
                        }}
                      />
                    </div>
                    
                    {/* Slider Component - handles only, track is hidden, centered on track line */}
                    <div className="absolute" style={{ bottom: "-7px", left: "12px", width: "269px", height: "20px", backgroundColor: "transparent", pointerEvents: "none" }}>
                      <div style={{ pointerEvents: "auto", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
                        <Slider
                          value={filters.priceRange}
                          onValueChange={(value) => updateFilter("priceRange", value as [number, number])}
                          min={0}
                          max={100000}
                          step={100}
                          className="w-full [&>span:first-child]:hidden [&_[role=slider]]:bg-[rgba(24,24,26,1)] [&_[role=slider]]:border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:z-10 [&_[role=slider]]:relative [&_[role=slider]]:top-0"
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Business Location */}
        <div className="space-y-2">
          <label 
            className="font-lufga text-white"
            style={{
              fontWeight: 500,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              color: "rgba(255, 255, 255, 1)",
            }}
          >
            Business Location
          </label>
          <Select
            value={filters.businessLocation}
            onValueChange={(value) => updateFilter("businessLocation", value)}
          >
            <SelectTrigger 
              className="text-white border-0 focus:ring-0 focus:ring-offset-0"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                justifyContent: "space-between",
                paddingTop: "12px",
                paddingRight: "12px",
                paddingBottom: "12px",
                paddingLeft: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                fontSize: "14px",
              }}
            >
              <SelectValue placeholder="Select location">
                {filters.businessLocation && filters.businessLocation !== "all" ? (
                  <div className="flex items-center gap-2">
                    <FlagIcon country={filters.businessLocation} className="w-4 h-4" />
                    <span>{filters.businessLocation}</span>
                  </div>
                ) : (
                  "Select location"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[rgba(24,24,26,1)] border-gray-700">
              <SelectItem value="all" className="text-white hover:bg-gray-800">
                All Locations
              </SelectItem>
              {countries.map((country) => (
                <SelectItem key={country} value={country} className="text-white hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <FlagIcon country={country} className="w-4 h-4" />
                    <span>{country}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filter Section */}
        <div className="space-y-4">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center justify-between w-full"
          >
            <span 
              className="font-lufga text-white"
              style={{
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                letterSpacing: "0%",
                color: "rgba(255, 255, 255, 1)",
              }}
            >
              Advanced Filter
            </span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>

          {isAdvancedOpen && (
            <div className="space-y-6">
              {/* Target Country */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label 
                    className="font-lufga text-white"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    Target Country
                  </label>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    min. {filters.advancedFilters.targetCountryPercentage}%
                  </span>
                </div>
                <Select
                  value={filters.advancedFilters.targetCountry}
                  onValueChange={(value) => updateFilter("advanced.targetCountry", value)}
                >
                  <SelectTrigger className="bg-[rgba(24,24,26,1)] border-gray-700 text-white rounded-lg">
                    <SelectValue placeholder="Select country">
                      {filters.advancedFilters.targetCountry && filters.advancedFilters.targetCountry !== "all" ? (
                        <div className="flex items-center gap-2">
                          <FlagIcon country={filters.advancedFilters.targetCountry} className="w-4 h-4" />
                          <span>{filters.advancedFilters.targetCountry}</span>
                        </div>
                      ) : (
                        "Select country"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[rgba(24,24,26,1)] border-gray-700">
                    <SelectItem value="all" className="text-white hover:bg-gray-800">
                      All Countries
                    </SelectItem>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country} className="text-white hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <FlagIcon country={country} className="w-4 h-4" />
                          <span>{country}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Slider
                  value={[filters.advancedFilters.targetCountryPercentage]}
                  onValueChange={(value) => updateFilter("advanced.targetCountryPercentage", value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Age */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label 
                    className="font-lufga text-white"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    Age
                  </label>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {filters.advancedFilters.ageRange[0]}y-{filters.advancedFilters.ageRange[1]}y
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.ageRange}
                  onValueChange={(value) => updateFilter("advanced.ageRange", value as [number, number])}
                  min={0}
                  max={20}
                  step={1}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Monthly Revenue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-white" />
                    <label 
                      className="font-lufga text-white"
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        lineHeight: "150%",
                        letterSpacing: "0%",
                        color: "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Monthly Revenue
                    </label>
                  </div>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {formatCurrency(filters.advancedFilters.monthlyRevenue[0])}-{formatCurrency(filters.advancedFilters.monthlyRevenue[1])}
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.monthlyRevenue}
                  onValueChange={(value) => updateFilter("advanced.monthlyRevenue", value as [number, number])}
                  min={0}
                  max={50000}
                  step={100}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Monthly Profit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-white" />
                    <label 
                      className="font-lufga text-white"
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        lineHeight: "150%",
                        letterSpacing: "0%",
                        color: "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Monthly Profit
                    </label>
                  </div>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {formatCurrency(filters.advancedFilters.monthlyProfit[0])}-{formatCurrency(filters.advancedFilters.monthlyProfit[1])}
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.monthlyProfit}
                  onValueChange={(value) => updateFilter("advanced.monthlyProfit", value as [number, number])}
                  min={0}
                  max={50000}
                  step={100}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Monthly Pageviews */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-white" />
                    <label 
                      className="font-lufga text-white"
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        lineHeight: "150%",
                        letterSpacing: "0%",
                        color: "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Monthly Pageviews
                    </label>
                  </div>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {formatNumber(filters.advancedFilters.monthlyPageviews[0])}-{formatNumber(filters.advancedFilters.monthlyPageviews[1])}
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.monthlyPageviews}
                  onValueChange={(value) => updateFilter("advanced.monthlyPageviews", value as [number, number])}
                  min={0}
                  max={1000000}
                  step={1000}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Revenue Multiple */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-white" />
                    <label 
                      className="font-lufga text-white"
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        lineHeight: "150%",
                        letterSpacing: "0%",
                        color: "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Revenue multiple
                    </label>
                  </div>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {filters.advancedFilters.revenueMultiple[0]}x-{filters.advancedFilters.revenueMultiple[1]}x
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.revenueMultiple}
                  onValueChange={(value) => updateFilter("advanced.revenueMultiple", value as [number, number])}
                  min={0}
                  max={50}
                  step={1}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>

              {/* Profit Multiple */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-white" />
                    <label 
                      className="font-lufga text-white"
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        lineHeight: "150%",
                        letterSpacing: "0%",
                        color: "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Profit multiple
                    </label>
                  </div>
                  <span 
                    className="font-lufga"
                    style={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "150%",
                      letterSpacing: "0%",
                      textAlign: "right",
                      color: "rgba(255, 255, 255, 1)",
                    }}
                  >
                    {filters.advancedFilters.profitMultiple[0]}x-{filters.advancedFilters.profitMultiple[1]}x
                  </span>
                </div>
                <Slider
                  value={filters.advancedFilters.profitMultiple}
                  onValueChange={(value) => updateFilter("advanced.profitMultiple", value as [number, number])}
                  min={0}
                  max={50}
                  step={1}
                  className="[&>div:first-child]:!bg-[rgba(58,58,59,1)] [&>div:first-child]:!h-1.5 [&>div:first-child]:!rounded-[10px] [&>div:first-child>div]:!bg-[rgba(197,253,31,1)] [&>div:first-child>div]:!h-1.5 [&_[role=slider]]:!bg-[rgba(24,24,26,1)] [&_[role=slider]]:!border-[5px_solid_rgba(197,253,31,1)] [&_[role=slider]]:!w-5 [&_[role=slider]]:!h-5"
                />
              </div>
            </div>
          )}
        </div>

        {/* Premium Upgrade Banner */}
        <div 
          className="bg-[#D3FC50] rounded-2xl p-4 text-black flex flex-col items-center mt-4"
          style={{ width: "100%", boxSizing: 'border-box', maxWidth: "100%" }}
        >
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-3">
            <Rocket className="w-6 h-6 text-[#D3FC50]" />
          </div>
          <h3 className="text-sm font-bold text-center mb-3" style={{ fontSize: "14px" }}>
            Upgrade Your Account To Premium
          </h3>
          <Button
            className="w-full bg-black text-[#D3FC50] hover:bg-black/90 rounded-full font-semibold"
            style={{ fontSize: "14px", height: "40px" }}
            size="lg"
          >
            Let's Go →
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClearFilters}
            className="font-lufga"
            style={{
              flex: 1,
              height: "48px",
              paddingTop: "12px",
              paddingRight: "16px",
              paddingBottom: "12px",
              paddingLeft: "16px",
              gap: "8px",
              borderRadius: "60px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              fontWeight: 600,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              textTransform: "capitalize",
              color: "rgba(255, 255, 255, 1)",
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={onFind}
            className="font-lufga"
            style={{
              flex: 1,
              height: "48px",
              paddingTop: "12px",
              paddingRight: "16px",
              paddingBottom: "12px",
              paddingLeft: "16px",
              gap: "8px",
              borderRadius: "60px",
              backgroundColor: "rgba(196, 252, 30, 1)",
              fontWeight: 600,
              fontSize: "14px",
              lineHeight: "150%",
              letterSpacing: "0%",
              textTransform: "capitalize",
              color: "rgba(13, 13, 13, 1)",
            }}
          >
            Find
          </Button>
        </div>
        </div>
      </div>

      {/* Settings & Log Out - fixed at bottom */}
      <div 
        className="flex-shrink-0 flex flex-col gap-2 pt-4"
        style={{ width: '100%', paddingLeft: '12px', paddingRight: '12px' }}
      >
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-3 text-white hover:text-[#D3FC50] transition-colors"
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: '150%',
            letterSpacing: '0%',
          }}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-white hover:text-[#D3FC50] transition-colors"
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontSize: '14px',
            lineHeight: '150%',
            letterSpacing: '0%',
          }}
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
};

export default FilterSidebar;


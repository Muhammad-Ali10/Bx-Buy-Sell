import { Search, ChevronDown, SlidersHorizontal, ArrowUpRight, Layers } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import heroCard1 from "@/assets/hero-card-1.png";
import heroCard2 from "@/assets/hero-card-2.png";
import heroCard3 from "@/assets/hero-card-3.png";
import { ArrowUpSvg } from "@/assets/svg";
interface HeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const Hero = ({ searchQuery, setSearchQuery }: HeroProps) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const trendingTopics = ["Shopify", "E-Commerce", "YouTube Automation", "SaaS"];

  const handleSearch = () => {
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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <section className="relative bg-primary text-primary-foreground pt-20 sm:pt-24 md:pt-32 pb-0 overflow-visible">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center mb-8 sm:mb-12 animate-fade-in">
          <h1 className="font-lufga font-medium text-[32px] sm:text-[48px] md:text-[64px] lg:text-[85px] leading-[120%] text-center mb-4 sm:mb-6 px-2">
            Buy & Sell Companies<br className="hidden sm:block" /> <span className="sm:hidden"> </span>in 3 simple Steps
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-4 sm:mb-6 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed px-4">
            Join the #1 platform for buying & selling companies. Discover, connect, and exchange with ease—your journey starts here today!
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-12 text-xs sm:text-sm px-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
              <span>Secure Payments with EXPay</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
              <span>Simple 3-step process</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
              <span>Start in 1 Minute</span>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mb-8 sm:mb-12 px-4">
            <div className="bg-primary-foreground/5 backdrop-blur-xl rounded-[10px] px-3 sm:px-6 py-2 border border-primary-foreground/5">
              <div className="flex gap-2 sm:gap-3 items-center">
                <div className={`flex-1 bg-primary-foreground/10 rounded-[10px] flex items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border transition-all ${
                  isSearchFocused ? 'border-accent shadow-glow' : 'border-transparent'
                }`}>
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-4 text-primary-foreground/80 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="What Are You Looking For?"
                    className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 outline-none text-sm sm:text-base md:text-lg min-w-0"
                  />
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 ml-2 sm:ml-4 text-primary-foreground/80 flex-shrink-0 hidden sm:block" />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl sm:rounded-2xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 transition-all flex-shrink-0"
                >
                  <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
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
            <span className="text-xs sm:text-sm text-primary-foreground/70 mr-2">Trending Topics</span>
            {trendingTopics.map((topic) => (
              <Button
                key={topic}
                variant="ghost"
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20 rounded-full px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-medium transition-all"
              >
                {topic}
                <ArrowUpSvg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
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
    </section>
  );
};

export default Hero;

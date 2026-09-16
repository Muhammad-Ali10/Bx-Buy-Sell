import { Link, useLocation, useNavigate } from "react-router-dom";
import { List, Heart, MessageSquare, User, Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import rocketIcon from "@/assets/roccket.svg";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  UPGRADE_ROUTE,
  showUpgradeCard,
  upgradeableListings,
} from "@/lib/upgradeRoute";

interface ListingsSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isMobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  /*
   * The member's own listings, for the upgrade card: they decide whether there
   * is anything left to upgrade, and so whether the card shows at all. Cached
   * for a minute: this sidebar is on every account page.
   */
  const { data: ownListings = [], isFetched: listingsFetched } = useQuery<any[]>({
    queryKey: ["upgrade-card-listings", user?.id],
    queryFn: async () => {
      const response = await apiClient.getSecureListings({ userId: user?.id, limit: 1000 });
      const payload: any = response.data;
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      return upgradeableListings(rows.filter((row: any) => row?.userId === user?.id));
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const listingsReady = !user?.id || listingsFetched;

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const response = await apiClient.getCurrentSubscription();
      const current: any = response.success ? response.data : null;
      if (current) {
        setIsPro(current.plan?.slug === "pro" && current.status === "ACTIVE");
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onLinkClick) {
      onLinkClick();
    }
  };

  /*
   * Let's Go always opens Manage Your Subscription, as the client asked. It
   * used to route per listing — one listing's own page, or a "which listing?"
   * dialog with several — and before that it sent everyone to /pricing.
   */
  const handleUpgrade = () => {
    navigate(UPGRADE_ROUTE);
    onLinkClick?.();
  };

  /*
   * No "Verify Your Account" here.
   *
   * Account Details → Overview already carries all four of them — phone,
   * email, identity and funds — opening the same dialogs this pointed at, so
   * the entry was a second door onto one room. `/verify-account` still answers
   * for anyone holding the link; it simply is not advertised twice.
   */
  const menuItems: { icon: typeof List; label: string; path: string; also?: string[] }[] = [
    // A listing's subscription page is part of that listing, as in the design.
    { icon: List, label: "My Listings", path: "/my-listings", also: ["/manage-subscription/"] },
    { icon: Heart, label: "Favourites", path: "/favourites" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: User, label: "Account Details", path: "/profile" },
  ];

  return (
    <div 
      className="bg-[hsl(0_0%_0%)] flex flex-col overflow-hidden w-full h-screen px-4 sm:px-5 md:px-6"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 1)',
        height: '100vh',
      }}
    >
      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollable w-full flex flex-col pr-2 sm:pr-3 md:pr-4 pt-6 sm:pt-8 md:pt-10"
      >
        {/* No logo here: the EX mark sits in the top bar, as in the design. */}

        {/* Navigation */}
        <nav className="w-full flex flex-col gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/') ||
              Boolean(item.also?.some((prefix) => location.pathname.startsWith(prefix)));
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center justify-between rounded-full px-3 sm:px-3.5 md:px-4 lg:px-5 py-2 sm:py-2 md:py-2.5 lg:py-3 ${
                  isActive
                    ? "bg-[rgba(174,243,31,1)]" 
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3">
                  <Icon 
                    className="flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" 
                    style={{
                      color: isActive ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.6)',
                      opacity: 1,
                    }}
                  />
                  <span 
                    className="font-medium font-['Lufga'] text-[10px] sm:text-[11px] md:text-xs lg:text-sm leading-[150%]"
                    style={{
                      color: isActive ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Upgrade card — gone once there is nothing left to upgrade: every
            listing on Premium, or, for someone with no listings, the Premium
            buyer plan. */}
        {!loadingSubscription && listingsReady && showUpgradeCard(ownListings, isPro) && (
          <div 
            className="mx-0 mb-3 sm:mb-4 flex-shrink-0 w-full rounded-[24px] sm:rounded-[28px] md:rounded-[32px] p-3 sm:p-4 md:p-5 bg-[rgba(174,243,31,1)] flex flex-col gap-3 sm:gap-4 md:gap-5 items-center"
            style={{
              minHeight: '200px',
            }}
          >
            {/* Logo Container */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 p-2.5 sm:p-3 md:p-3.5 rounded-[32px] sm:rounded-[36px] md:rounded-[42px] bg-[rgba(0,0,0,0.1)] flex items-center justify-center">
              <img 
                src={rocketIcon} 
                alt="Rocket" 
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8"
              />
            </div>

            {/* Text */}
            <h3 className="text-center font-['Lufga'] font-semibold text-[10px] sm:text-xs md:text-sm lg:text-base leading-[130%] capitalize text-black m-0">
              upgrade your
              <br />
              account to pro
            </h3>

            {/* Button */}
            <Button
              onClick={handleUpgrade}
              className="flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto sm:min-w-[160px] md:min-w-[180px] lg:min-w-[200px] h-9 sm:h-10 md:h-11 lg:h-12 py-2 sm:py-2.5 md:py-3 lg:py-3.5 rounded-full bg-black font-['Lufga'] font-medium text-[10px] sm:text-xs md:text-sm lg:text-base leading-[130%] capitalize text-white"
            >
              Let's Go
              <svg 
                width="12" 
                height="10" 
                viewBox="0 0 15 12.5" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="opacity-100"
              >
                <path 
                  d="M0 6.25L10 6.25M10 6.25L6.25 2.5M10 6.25L6.25 10" 
                  stroke="rgba(255, 255, 255, 1)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ListingsSidebar = ({ mobileOpen, onMobileClose, isMobile, open: controlledOpen, onOpenChange }: ListingsSidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleClose = () => {
    setOpen(false);
    onMobileClose?.();
  };

  // Desktop/Laptop sidebar (lg: 1024px+) - Always visible fixed sidebar
  if (isMobile === false) {
    return (
      <aside 
        className="hidden lg:flex bg-black text-white flex-col w-56 lg:w-[240px] xl:w-[280px] flex-shrink-0" 
        style={{ 
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          zIndex: 30
        }}
      >
        <SidebarContent />
      </aside>
    );
  }

  // Mobile/Tablet/Laptop sidebar as Sheet (always drawer when isMobile={true})
  if (isMobile === true) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {/* Given a surface of its own: as a ghost button it was a bare icon
              floating on the page background, which read as a stray mark
              rather than the menu it opens. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="border border-black/10 bg-white shadow-sm hover:bg-black/[0.04]"
            style={{
              padding: '8px',
              borderRadius: '12px',
            }}
          >
            <Menu className="w-6 h-6" style={{ color: 'rgba(0, 0, 0, 1)' }} />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="left" 
          className="p-0 bg-black text-white border-0 w-[280px] sm:w-[320px] md:w-[346px] overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 1)',
          }}
        >
          {/* Screen readers announce the drawer by this; Radix warns without it. */}
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent onLinkClick={handleClose} />
        </SheetContent>
      </Sheet>
    );
  }

  // Default: Fixed sidebar on desktop/laptop (lg: 1024px+), drawer on tablet/mobile
  return (
    <>
      {/* Desktop/Laptop: Fixed sidebar (lg: 1024px+) */}
      <aside 
        className="hidden lg:flex bg-black text-white flex-col w-56 lg:w-[240px] xl:w-[280px] flex-shrink-0" 
        style={{ 
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          zIndex: 30
        }}
      >
        <SidebarContent />
      </aside>

      {/* Tablet/Mobile: Drawer (< lg) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            style={{
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <Menu className="w-6 h-6" style={{ color: 'rgba(0, 0, 0, 1)' }} />
          </Button>
        </SheetTrigger>
        <SheetContent 
          side="left" 
          className="p-0 bg-black text-white border-0 w-[280px] sm:w-[320px] md:w-[346px] overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 1)',
          }}
        >
          {/* Screen readers announce the drawer by this; Radix warns without it. */}
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent onLinkClick={handleClose} />
        </SheetContent>
      </Sheet>
    </>
  );
};

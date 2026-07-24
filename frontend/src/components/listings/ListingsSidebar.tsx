import { Link, useLocation, useNavigate } from "react-router-dom";
import { List, Heart, MessageSquare, User, ShieldCheck, Settings, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/_App Icon 1 (2).png";
import rocketIcon from "@/assets/roccket.svg";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

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
  const { logout } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const response = await apiClient.request("/subscription/current");
      if (response.success && response.data) {
        setIsPro(response.data.plan?.slug === "pro" && response.data.status === "ACTIVE");
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
      onLinkClick?.();
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onLinkClick) {
      onLinkClick();
    }
  };

  const handleUpgrade = () => {
    navigate("/pricing");
    onLinkClick?.();
  };

  const menuItems = [
    { icon: List, label: "My Listings", path: "/my-listings" },
    { icon: Heart, label: "Favourites", path: "/favourites" },
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: User, label: "Account Details", path: "/profile" },
    { icon: ShieldCheck, label: "Verify Your Account", path: "/verify-account" },
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
        {/* Logo */}
        <div className="p-0 flex-shrink-0 mb-4 sm:mb-5 md:mb-6">
          <Link to="/" className="flex items-center justify-start" onClick={onLinkClick}>
            <img 
              src={logo} 
              alt="EX Logo" 
              className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 object-contain"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="w-full flex flex-col gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            
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

        {/* Pro Signup Card - Only show for Free users */}
        {!loadingSubscription && !isPro && (
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

      {/* Bottom Menu - Fixed */}
      <div className="p-0 space-y-1.5 sm:space-y-2 border-t border-white/10 flex-shrink-0 mt-auto pt-3 sm:pt-4 pb-4 sm:pb-5 md:pb-6 w-full pr-2 sm:pr-3 md:pr-4">
        <button
          onClick={() => handleNavigation("/settings")}
          className={`w-full flex items-center justify-between rounded-xl px-3 sm:px-3.5 md:px-4 lg:px-4 py-2 sm:py-2 md:py-2.5 lg:py-3 ${
            location.pathname === "/settings" || location.pathname.startsWith("/settings/")
              ? "bg-[rgba(174,243,31,1)]" 
              : ""
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3">
            <Settings 
              className="flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" 
              style={{
                color: location.pathname === "/settings" || location.pathname.startsWith("/settings/") ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.6)',
                opacity: 1,
              }}
            />
            <span 
              className="font-medium font-['Lufga'] text-[10px] sm:text-[11px] md:text-xs lg:text-sm leading-[150%]"
              style={{
                color: location.pathname === "/settings" || location.pathname.startsWith("/settings/") ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.6)',
              }}
            >
              Settings
            </span>
          </div>
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between rounded-xl px-3 sm:px-3.5 md:px-4 lg:px-4 py-2 sm:py-2 md:py-2.5 lg:py-3"
        >
          <div className="flex items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3">
            <LogOut 
              className="flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" 
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                opacity: 1,
              }}
            />
            <span 
              className="font-medium font-['Lufga'] text-[10px] sm:text-[11px] md:text-xs lg:text-sm leading-[150%]"
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              Log Out
            </span>
          </div>
        </button>
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
          <Button
            variant="ghost"
            size="icon"
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
          <SidebarContent onLinkClick={handleClose} />
        </SheetContent>
      </Sheet>
    </>
  );
};

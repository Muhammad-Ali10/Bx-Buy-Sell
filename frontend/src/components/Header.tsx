import { Heart, User, Plus, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { NotificationDropdown } from "./NotificationDropdown";
import { toast } from "sonner";
import logo from "@/assets/_App Icon 1 (2).png";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderProps {
  /**
   * Set on pages that render the dashboard sidebar, so the floating bar centres
   * in the content area instead of drifting over the sidebar.
   */
  sidebarOffset?: boolean;
}

const Header = ({ sidebarOffset = false }: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [favoritesCount, setFavoritesCount] = useState(0);
  
  // Determine active route
  const isHomeActive = location.pathname === "/";
  const isAllListingsActive = location.pathname === "/all-listings";
  const isMyListingsActive = location.pathname === "/my-listings";

  useEffect(() => {
    if (isAuthenticated && user) {
      loadFavoritesCount();
    }
  }, [isAuthenticated, user]);

  const loadFavoritesCount = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getFavorites();
      if (response.success && response.data) {
        const favorites = Array.isArray(response.data) ? response.data : [];
        setFavoritesCount(favorites.length);
      }
    } catch (error) {
      console.error('Error loading favorites count:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const handleFavoritesClick = () => {
    if (!isAuthenticated || !user) {
      toast.error("Please login to view your favorites");
      navigate("/login");
      return;
    }
    // Navigate to favorites page using React Router
    navigate("/favourites");
  };

  const isHowToBuyActive = location.pathname === "/how-to-buy";
  const isHowToSellActive = location.pathname === "/how-to-sell";
  /**
   * Pages that sit on a light background get the translucent bar. The home page
   * is deliberately not in this list — its hero is blue, and the dark text this
   * treatment uses would not read against it.
   */
  const LIGHT_BAR_PREFIXES = [
    "/listing/",
    "/all-listings",
    "/my-listings",
    "/favourites",
    "/chat",
    "/profile",
    "/verify-account",
  ];
  const useLightBar = LIGHT_BAR_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 sm:pt-4 ${
        sidebarOffset ? "lg:pl-[240px] xl:pl-[280px]" : ""
      }`}
    >
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4">
        <div 
          className={`rounded-full px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between shadow-2xl ${
            useLightBar ? '' : 'bg-primary backdrop-blur-xl'
          }`}
          style={useLightBar ? {
            background: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(10px)'
          } : {}}
        >
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center">
              <img 
                src={logo} 
                alt="EX Logo" 
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
              />
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Button 
              size="sm" 
              className={`rounded-full px-4 py-2 font-lufga ${
                useLightBar 
                  ? (isHomeActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "hover:bg-[#D3FC50] hover:text-black")
                  : (isHomeActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black")
              }`}
              style={useLightBar && !isHomeActive ? {
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.7)',
                fontFamily: 'Lufga',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '150%',
                letterSpacing: '0%',
                textTransform: 'capitalize'
              } : {}}
              asChild
            >
              <Link to="/">Home</Link>
            </Button>
            <Button 
              size="sm" 
              className={`rounded-full px-4 py-2 font-lufga ${
                useLightBar 
                  ? (isAllListingsActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "hover:bg-[#D3FC50] hover:text-black")
                  : (isAllListingsActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black")
              }`}
              style={useLightBar && !isAllListingsActive ? {
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.7)',
                fontFamily: 'Lufga',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '150%',
                letterSpacing: '0%',
                textTransform: 'capitalize'
              } : {}}
              asChild
            >
              <Link to="/all-listings">All Listings</Link>
            </Button>
            <Button 
              size="sm" 
              className={`rounded-full px-4 py-2 font-lufga ${
                useLightBar 
                  ? (isHowToBuyActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "hover:bg-[#D3FC50] hover:text-black")
                  : (isHowToBuyActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black")
              }`}
              style={useLightBar && !isHowToBuyActive ? {
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.7)',
                fontFamily: 'Lufga',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '150%',
                letterSpacing: '0%',
                textTransform: 'capitalize'
              } : {}}
              asChild
            >
              <Link to="/how-to-buy">How To Buy</Link>
            </Button>
            <Button 
              size="sm" 
              className={`rounded-full px-4 py-2 font-lufga ${
                useLightBar 
                  ? (isHowToSellActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "hover:bg-[#D3FC50] hover:text-black")
                  : (isHowToSellActive 
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium" 
                      : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black")
              }`}
              style={useLightBar && !isHowToSellActive ? {
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.7)',
                fontFamily: 'Lufga',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '150%',
                letterSpacing: '0%',
                textTransform: 'capitalize'
              } : {}}
              asChild
            >
              <Link to="/how-to-sell">How To Sell</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3" style={{ gap: useLightBar ? '10px' : undefined }}>
            {/* Notification Dropdown - visible when authenticated */}
            {isAuthenticated && user && (
              <NotificationDropdown userId={user.id} variant={useLightBar ? "dark" : "light"} />
            )}
            
            {/* Favorites Button - visible on all screens */}
            <button 
              onClick={handleFavoritesClick}
              className="relative rounded-full flex items-center justify-center transition-colors"
              style={useLightBar ? {
                width: '52px',
                height: '52px',
                borderRadius: '28px',
                paddingTop: '15px',
                paddingRight: '16px',
                paddingBottom: '15px',
                paddingLeft: '16px',
                background: 'rgba(0, 0, 0, 0.1)'
              } : {
                width: '32px',
                height: '32px'
              }}
            >
              <Heart 
                className={useLightBar ? "w-5 h-5" : "w-5 h-5 sm:w-6 sm:h-6"} 
                style={useLightBar 
                  ? { color: 'rgba(0, 0, 0, 1)' } 
                  : isHomeActive 
                    ? { color: 'rgba(255, 255, 255, 1)' }
                    : {}
                }
              />
              {isAuthenticated && user && favoritesCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs rounded-full">
                  {favoritesCount > 9 ? "9+" : favoritesCount}
                </Badge>
              )}
            </button>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3" style={{ gap: useLightBar ? '10px' : undefined }}>
              {isAuthenticated && user ? (
                <>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full transition-colors"
                    style={useLightBar ? {
                      width: '52px',
                      height: '52px',
                      borderRadius: '28px',
                      paddingTop: '15px',
                      paddingRight: '16px',
                      paddingBottom: '15px',
                      paddingLeft: '16px',
                      background: 'rgba(0, 0, 0, 0.1)'
                    } : {
                      width: '40px',
                      height: '40px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white'
                    }}
                  >
                    <User
                      className="w-6 h-6"
                      style={useLightBar ? { color: 'rgba(0, 0, 0, 1)' } : {}}
                    />
                  </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/my-listings">My Listings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile">Account Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    size="sm" 
                    className={`rounded-full font-medium flex items-center ${
                      useLightBar 
                        ? "" 
                        : "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90"
                    }`}
                    style={useLightBar ? {
                      width: '159px',
                      height: '52px',
                      borderRadius: '60px',
                      paddingTop: '13px',
                      paddingRight: '20px',
                      paddingBottom: '13px',
                      paddingLeft: '20px',
                      gap: '10px',
                      background: 'rgba(0, 0, 0, 1)',
                      color: 'white'
                    } : {}}
                    asChild
                  >
                    <Link to="/dashboard" className="flex items-center" style={useLightBar ? { gap: '10px' } : {}}>
                      <Plus className={useLightBar ? "w-4 h-4" : "w-4 h-4 mr-1"} />
                      Add Listing
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 rounded-full" asChild>
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button
                    size="sm"
                    className={`rounded-full font-medium flex items-center ${
                      useLightBar
                        ? ""
                        : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
                    }`}
                    style={useLightBar ? {
                      width: "159px",
                      height: "52px",
                      borderRadius: "60px",
                      paddingTop: "13px",
                      paddingRight: "20px",
                      paddingBottom: "13px",
                      paddingLeft: "20px",
                      gap: "10px",
                      background: "rgba(0, 0, 0, 1)",
                      color: "white",
                    } : {}}
                    asChild
                  >
                    <Link to="/dashboard" className="flex items-center" style={useLightBar ? { gap: "10px" } : {}}>
                      <Plus className={useLightBar ? "w-4 h-4" : "w-4 h-4 mr-1"} />
                      Add Listing
                    </Link>
                  </Button>
                  <Button size="sm" className="bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 rounded-full font-medium" asChild>
                    <Link to="/register">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden rounded-full transition-colors"
                  style={useLightBar ? {
                    width: '52px',
                    height: '52px',
                    borderRadius: '28px',
                    paddingTop: '15px',
                    paddingRight: '16px',
                    paddingBottom: '15px',
                    paddingLeft: '16px',
                    background: 'rgba(0, 0, 0, 0.1)'
                  } : {
                    width: '32px',
                    height: '32px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white'
                  }}
                >
                  <Menu 
                    className="w-5 h-5 sm:w-6 sm:h-6" 
                    style={useLightBar ? { color: 'rgba(0, 0, 0, 1)' } : {}}
                  />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-primary text-white border-none">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Navigation Links */}
                  <nav className="flex flex-col gap-2">
                    <Link
                      to="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-full px-4 py-3 text-left transition-colors ${
                        isHomeActive 
                          ? "bg-[#D3FC50] text-black font-medium" 
                          : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
                      }`}
                    >
                      Home
                    </Link>
                    <Link
                      to="/all-listings"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-full px-4 py-3 text-left transition-colors ${
                        isAllListingsActive 
                          ? "bg-[#D3FC50] text-black font-medium" 
                          : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
                      }`}
                    >
                      All Listings
                    </Link>
                    <Link
                      to="/how-to-buy"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-full px-4 py-3 text-left transition-colors ${
                        isHowToBuyActive 
                          ? "bg-[#D3FC50] text-black font-medium" 
                          : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
                      }`}
                    >
                      How To Buy
                    </Link>
                    <Link
                      to="/how-to-sell"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-full px-4 py-3 text-left transition-colors ${
                        isHowToSellActive 
                          ? "bg-[#D3FC50] text-black font-medium" 
                          : "bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black"
                      }`}
                    >
                      How To Sell
                    </Link>
                  </nav>

                  {/* Mobile Actions */}
                  <div className="border-t border-white/20 pt-4 mt-4 flex flex-col gap-2">
                    {isAuthenticated && user ? (
                      <>
                        <Link
                          to="/my-listings"
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-full px-4 py-3 bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black transition-colors flex items-center gap-3"
                        >
                          <User className="w-5 h-5" />
                          My Listings
                        </Link>
                        <Link
                          to="/dashboard"
                          onClick={() => setMobileMenuOpen(false)}
                          className={`rounded-full font-medium flex items-center ${
                            useLightBar 
                              ? "" 
                              : "px-4 py-3 bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 gap-3"
                          }`}
                          style={useLightBar ? {
                            width: '159px',
                            height: '52px',
                            borderRadius: '60px',
                            paddingTop: '13px',
                            paddingRight: '20px',
                            paddingBottom: '13px',
                            paddingLeft: '20px',
                            gap: '10px',
                            background: 'rgba(0, 0, 0, 1)',
                            color: 'white'
                          } : {}}
                        >
                          <Plus className="w-5 h-5" />
                          Add Listing
                        </Link>
                        <div className="px-4 py-3">
                          <NotificationDropdown userId={user.id} variant="light" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-full px-4 py-3 bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black transition-colors text-center"
                        >
                          Login
                        </Link>
                        <Link
                          to="/dashboard"
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-full px-4 py-3 bg-[#FFFFFF0D] text-white hover:bg-[#D3FC50] hover:text-black transition-colors flex items-center gap-3"
                        >
                          <Plus className="w-5 h-5" />
                          Add Listing
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setMobileMenuOpen(false)}
                          className="rounded-full px-4 py-3 bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium text-center"
                        >
                          Sign Up
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

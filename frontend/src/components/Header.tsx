import { Heart, Plus, ChevronDown, LogOut, User as UserIcon, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationDropdown } from "./NotificationDropdown";
import { HeaderCurrencySelect } from "./HeaderCurrencySelect";
import { apiClient } from "@/lib/api";
import { AdminSidebar } from "./admin/AdminSidebar";
import { toast } from "sonner";
import logo from "@/assets/_App Icon 1 (2).png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderProps {
  /**
   * The admin panel. Same bar, three differences it cannot work without: it
   * sits in the flow of the content column rather than floating over the
   * viewport (the admin sidebar collapses, so there is no fixed width to
   * offset against, and none of the eighteen admin screens leaves room for a
   * floating bar); it carries the sidebar trigger below `lg`, where that
   * sidebar is hidden and the trigger is the only way to reach any page; and
   * the account menu points at admin destinations instead of seller ones.
   */
  admin?: boolean;
  /**
   * Sit inside the surrounding content column instead of floating over the
   * viewport.
   *
   * The alternative was pushing a viewport-fixed bar clear of the sidebar by a
   * hardcoded width, which only worked where that width was the one it assumed.
   * On All Listings the sidebar is 250px with a 58px gap, so the bar landed
   * 24px short and its rounded edge sat on the black frame. Rendering in the
   * column removes the arithmetic: the bar is as wide as whatever contains it.
   */
  inColumn?: boolean;
  /**
   * Keep the bar on its dark treatment regardless of what is behind it.
   *
   * The portal screens beside a black sidebar used it so the bar's strip
   * carried that black on. The client has since asked for those screens to
   * open on a white strip with the light bar, like every other page, so none
   * passes it now: the ink is decided by what the bar is over — see `onDark`.
   */
  dark?: boolean;
  /**
   * Something to sit at the start of the bar, before the logo — the chat
   * page's menu button below 1280px. Floating beside the bar, it landed on the
   * logo once the bar reached the left edge of the screen.
   */
  leading?: ReactNode;
}

/**
 * The bar is the same translucent pill on every page. What changes is only the
 * ink: the home page opens on a saturated blue hero and every other page opens
 * on a light background, and near-black labels cannot be read on that blue.
 * Shape, spacing, blur and the lime active pill are identical either way.
 */
const THEME = {
  light: {
    bar: {
      background: "rgba(0, 0, 0, 0.05)",
      border: "1px solid rgba(0, 0, 0, 0.05)",
      backdropFilter: "blur(10px)",
    },
    chip: { background: "#D8D8D8", color: "rgba(0, 0, 0, 0.7)" },
    circle: { background: "rgba(0, 0, 0, 0.1)" },
    ink: "rgba(0, 0, 0, 1)",
    text: "text-black",
    hover: "hover:bg-black/5",
  },
  dark: {
    bar: {
      
      background: "rgba(0, 0, 0, 0.05)",
      border: "1px solid rgba(0, 0, 0, 0.05)",
      backdropFilter: "blur(10px)",
    },
    chip: { background: "#D8D8D8", color: "rgba(0, 0, 0, 0.7)" },
    circle: { background: "rgba(255, 255, 255, 0.12)" },
    ink: "rgba(255, 255, 255, 1)",
    text: "text-white",
    hover: "hover:bg-white/10",
  },
} as const;

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/all-listings", label: "All Listings" },
  { to: "/how-to-buy", label: "How To Buy" },
  { to: "/how-to-sell", label: "How To Sell" },
] as const;

/**
 * The site's menu bar.
 *
 * There used to be two of these in one file: a translucent bar for a handful of
 * listed paths and a solid blue one everywhere else, with every button written
 * twice so it could be styled both ways. The blue version is gone — the bar is
 * translucent on every page now — which is why nothing here branches on the
 * route except to mark the active link.
 */
const Header = ({
  admin = false,
  inColumn = false,
  dark = false,
  leading,
}: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  /*
   * The currency chooser and the favourites shortcut belong to the public
   * pages. The portal screens beside a sidebar follow the design without
   * them — their sidebar already has Favourites.
   */
  const showExtras = !inColumn && !admin;
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    if (showExtras && isAuthenticated && user) {
      loadFavoritesCount();
    }
  }, [showExtras, isAuthenticated, user]);

  const loadFavoritesCount = async () => {
    if (!user) return;

    try {
      const response = await apiClient.getFavorites();
      if (response.success && response.data) {
        const favorites = Array.isArray(response.data) ? response.data : [];
        setFavoritesCount(favorites.length);
      }
    } catch (error) {
      console.error("Error loading favorites count:", error);
    }
  };
  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate(admin ? "/admin/login" : "/");
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
    navigate("/favourites");
  };

  /**
   * Taken from the session rather than fetched. The bar is on every page, so a
   * request per page load to learn a name the app already holds would be paid
   * on every navigation.
   */
  const userName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "Account";

  /**
   * Whether a dark hero is currently behind the bar.
   *
   * Keyed to the scroll position, not the route. The home page opens on a blue
   * hero but everything below it is white, so a bar that decided by path alone
   * was wrong half the time: dark labels were unreadable on the blue at the
   * top, and light ones vanished the moment the page scrolled onto the white.
   * A section marks itself with `data-dark-hero`; while it still covers the
   * bar, the bar carries light ink.
   */
  const [overHero, setOverHero] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // A bar that is dark by declaration has nothing to track.
    const hero = dark ? null : document.querySelector("[data-dark-hero]");
    if (!hero) {
      setOverHero(false);
      return;
    }

    /*
     * Measured off the bar itself rather than a fixed number, so it turns over
     * at the same moment on a phone as on a desktop.
     *
     * The threshold sits low in the pill, not at its middle. While the hero's
     * bottom edge is crossing the bar there is a band of a few pixels where the
     * labels straddle blue and white and no single colour reads; taking the
     * lower line means light ink is only used while the blue still covers the
     * writing, and the brief awkward frame is dark text over a thin blue strip
     * rather than white text over white.
     */
    const update = () => {
      const bar = barRef.current?.getBoundingClientRect();
      const line = bar ? bar.top + (bar.bottom - bar.top) * 0.75 : 64;
      setOverHero(hero.getBoundingClientRect().bottom > line);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [location.pathname, dark]);

  const onDark = dark || overHero;
  const t = onDark ? THEME.dark : THEME.light;

  /*
   * Nothing behind the bar but the page.
   *
   * Beside a sidebar the header used to sit on a full-width white strip, which
   * cut a band across the top of the page and hid the cards scrolling under
   * it. The client wants the bar alone, floating as it does on the home page;
   * it blurs whatever passes beneath it, so it stays readable over content.
   * The dark variant keeps its black, which is part of that page's design.
   */
  return (
    <header
      ref={barRef}
      className={
        admin || inColumn
          ? `sticky top-0 z-40 flex justify-center pt-2 pb-2 sm:pt-4 sm:pb-3 ${
              dark ? "bg-black" : "bg-transparent"
            }`
          : "fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 sm:pt-4"
      }
    >
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4">
        <div
          className="rounded-full px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 shadow-2xl"
          style={t.bar}
        >
          {admin && (
            <div className="shrink-0">
              <AdminSidebar isMobile />
            </div>
          )}
          {leading && <div className="shrink-0">{leading}</div>}

          {/* The EX mark, on every page and at every width. The sidebars no
              longer carry it — as in the design — so this is the one place it is. */}
          <Link to="/" className="flex items-center shrink-0">
            <img
              src={logo}
              alt="EX Logo"
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
            />
          </Link>

          {/* Desktop navigation.
              The full bar needs about 924px. Held back to `lg` rather than
              `md`, because between 768 and 1023 the links plus the currency
              chip and the round controls overflow the pill.

              Where the bar sits inside a column a sidebar takes 250px or more
              out of its width, and the measured minimum is 1366: at 1280 the
              pill has 885px against the 924px the full bar needs. Written as an
              arbitrary variant because `2xl` is Tailwind's default 1536 here —
              the 1400 in the config is `container.screens`, which sets a
              container's max width and not a breakpoint. */}
          <nav
            className={`hidden items-center gap-2 ${
              admin || inColumn ? "min-[1366px]:flex" : "lg:flex"
            }`}
          >
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = location.pathname === to;
              return (
                <Button
                  key={to}
                  size="sm"
                  className={`rounded-full px-4 py-2 font-lufga ${
                    isActive
                      ? "bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 font-medium"
                      : "hover:bg-[#D3FC50] hover:text-black"
                  }`}
                  style={
                    isActive
                      ? undefined
                      : {
                          ...t.chip,
                          fontFamily: "Lufga",
                          fontWeight: 400,
                          fontSize: "16px",
                          lineHeight: "150%",
                          textTransform: "capitalize",
                        }
                  }
                  asChild
                >
                  <Link to={to}>{label}</Link>
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-[10px]">
            {showExtras && <HeaderCurrencySelect onDark={onDark} />}
            {isAuthenticated && user ? (
              <>
                {showExtras && (
                  <button
                    onClick={handleFavoritesClick}
                    aria-label="Favourites"
                    className="relative rounded-full flex items-center justify-center transition-colors h-10 w-10 sm:h-[52px] sm:w-[52px]"
                    style={t.circle}
                  >
                    <Heart className="w-5 h-5" style={{ color: t.ink }} />
                    {favoritesCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs rounded-full">
                        {favoritesCount > 9 ? "9+" : favoritesCount}
                      </Badge>
                    )}
                  </button>
                )}

                <NotificationDropdown userId={user.id} variant={onDark ? "glassDark" : "glass"} />

                <DropdownMenu>
                  <DropdownMenuTrigger className={`flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors focus:outline-none ${t.hover}`}>
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                      {user.profile_pic ? (
                        <AvatarImage src={user.profile_pic} alt={userName} />
                      ) : null}
                      {/* Falls back to the shared placeholder artwork. */}
                      <AvatarFallback />
                    </Avatar>
                    <span className={`hidden sm:inline font-lufga text-sm font-medium max-w-[120px] truncate ${t.text}`}>
                      {userName}
                    </span>
                    <ChevronDown className="w-4 h-4 shrink-0 opacity-60" style={{ color: t.ink }} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {admin ? (
                      // No "Profile" entry: it pointed at /admin/profile, which
                      // is not a route — the click landed on the 404 page.
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/my-listings">
                            <Settings className="mr-2 h-4 w-4" />
                            My Listings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/profile">
                            <UserIcon className="mr-2 h-4 w-4" />
                            Account Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Listing
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`bg-[#C6FE1F] rounded-full font-lufga `}
                  asChild
                >
                  <Link to="/login">Login</Link>
                </Button>
                <Button
                  size="sm"
                  className="rounded-full font-medium flex items-center gap-[10px] h-10 px-4 sm:h-[52px] sm:px-5"
                  style={{
                    borderRadius: "60px",
                    background: "rgba(0, 0, 0, 1)",
                    color: "white",
                  }}
                  asChild
                >
                  <Link to="/dashboard" className="flex items-center gap-[10px]">
                    <Plus className="w-4 h-4" />
                    <span className="whitespace-nowrap">Add Listing</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

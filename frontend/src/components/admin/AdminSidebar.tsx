import { Menu, ChevronDown, ChevronRight } from "lucide-react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import logo from "@/assets/_App Icon 1 (2).png";
import {
  AccountsSvg,
  AdInformationsSvg,
  AllChatsSvg,
  AdditionalInfosSvg,
  BrandInformationSvg,
  CategorySvg,
  ChatSvg,
  ChatListSvg,
  ContentManagementSvg,
  DashboardSvg,
  DetectWordsSvg,
  FinancialsSvg,
  HandoverSvg,
  ListingsSvg,
  LogOutSvg,
  MonitoringAlertsSvg,
  PackagesSvg,
  SettingsSvg,
  TeamMembersSvg,
  ToolsSvg,
  UsersSvg,
} from "@/assets/svg";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarSubItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  iconColorMode?: "path" | "filter";
};

type SidebarMenuItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  iconColorMode?: "path" | "filter";
  subItems?: SidebarSubItem[];
};

// ─── Menu config ──────────────────────────────────────────────────────────────

const menuItems: SidebarMenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: DashboardSvg, path: "/admin/dashboard" },
  { id: "listings", label: "Listings", icon: ListingsSvg, path: "/admin/listings" },
  { id: "users", label: "Users", icon: UsersSvg, path: "/admin/users" },
  { id: "team", label: "Team Members", icon: TeamMembersSvg, path: "/admin/team" },
  {
    id: "chat",
    label: "Chat",
    icon: ChatSvg,
    path: "/admin/chats",
    subItems: [
      { id: "all-chats", label: "All Chats", icon: AllChatsSvg, path: "/admin/chats" },
      { id: "monitoring", label: "Monitoring Alerts", icon: MonitoringAlertsSvg, path: "/admin/monitoring-alerts" },
      { id: "chat-list", label: "Chat List", icon: ChatListSvg, path: "/admin/chat-list", iconColorMode: "filter" },
      { id: "detect-words", label: "Detect Words", icon: DetectWordsSvg, path: "/admin/detect-words", iconColorMode: "filter" },
      { id: "analytics", label: "Analytics", icon: DashboardSvg, path: "/admin/chat-analytics" },
  
    ],
  },
  {
    id: "content",
    label: "Content Management",
    icon: ContentManagementSvg,
    path: "/admin/content",
    subItems: [
      { id: "category", label: "Category", icon: CategorySvg, path: "/admin/content/category" },
      { id: "brand-info", label: "Brand Information", icon: BrandInformationSvg, path: "/admin/content/brand-info" },
      { id: "tools", label: "Tools", icon: ToolsSvg, path: "/admin/content/tools" },
      { id: "financials", label: "Financials", icon: FinancialsSvg, path: "/admin/content/financials" },
      { id: "additional-infos", label: "Additional Infos", icon: AdditionalInfosSvg, path: "/admin/content/additional-infos" },
      { id: "accounts", label: "Accounts", icon: AccountsSvg, path: "/admin/content/accounts" },
      { id: "ad-informations", label: "Ad Informations", icon: AdInformationsSvg, path: "/admin/content/ad-informations" },
      { id: "handover", label: "Handover", icon: HandoverSvg, path: "/admin/content/handover" },
      { id: "packages", label: "Packages", icon: PackagesSvg, path: "/admin/content/packages" },
    ],
  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACTIVE_BG = "rgba(174, 243, 31, 1)";
const ACTIVE_TEXT = "rgba(0, 0, 0, 1)";
const INACTIVE_TEXT = "#999999";

const activeItemStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "48px",
  borderRadius: "12px",
  padding: "12px 16px",
  backgroundColor: ACTIVE_BG,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  transition: "background 0.15s",
};

const inactiveItemStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "48px",
  borderRadius: "12px",
  padding: "12px 16px",
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  transition: "background 0.15s",
};


interface SidebarIconProps {
  icon: React.ElementType;
  active: boolean;
  size?: number;
  mode?: "path" | "filter";
}

const SidebarIcon = ({ icon: Icon, active, size = 20, mode = "path" }: SidebarIconProps) => (
  <span
    className="sidebar-icon"
    style={
      {
        "--sidebar-icon-color": active ? ACTIVE_TEXT : INACTIVE_TEXT,
        "--sidebar-icon-opacity": active ? "1" : "0.6",
        filter: mode === "filter" && active ? "brightness(0)" : "none",
        opacity: mode === "filter" ? (active ? 1 : 0.6) : 1,
        display: "inline-flex",
      } as React.CSSProperties
    }
  >
    <Icon
      style={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    />
  </span>
);



// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + "/");
}

function isMenuItemActive(item: SidebarMenuItem, pathname: string): boolean {
  if (isPathActive(pathname, item.path)) return true;
  return item.subItems?.some((sub) => isPathActive(pathname, sub.path)) ?? false;
}

function hoverHandlers(isActive: boolean) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
    },
  };
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

const AdminSidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(["chat", "content"]);

  const userRole = user?.role?.toUpperCase();
  const isModerator = userRole === "MONITER" || userRole === "MODERATOR";

  const filteredMenuItems = isModerator
    ? menuItems.filter((item) => item.id !== "dashboard" && item.id !== "content")
    : menuItems;

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  const toggleExpanded = (id: string) =>
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose?.();
  };

  const settingsActive = isPathActive(location.pathname, "/admin/settings");

  return (
    <div
      style={{
        width: "346px",
        maxWidth: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "20px 0 12px 12px",
        backgroundColor: "rgba(0, 0, 0, 1)",
      }}
    >
      <style>{`
        .sidebar-icon path[stroke]:not([stroke="none"]) {
          stroke: var(--sidebar-icon-color) !important;
        }
        .sidebar-icon path[fill]:not([fill="none"]) {
          fill: var(--sidebar-icon-color) !important;
        }
        .sidebar-icon path[stroke-opacity] {
          stroke-opacity: var(--sidebar-icon-opacity) !important;
        }
        .sidebar-icon path[fill-opacity] {
          fill-opacity: var(--sidebar-icon-opacity) !important;
        }
        .sidebar-icon [opacity] {
          opacity: var(--sidebar-icon-opacity) !important;
        }
      `}</style>
      {/* Logo — stays as <img>, it's a raster asset not an icon */}
      <div style={{ flexShrink: 0, marginBottom: "16px" }}>
        <Link to="/" onClick={onClose}>
          <img
            src={logo}
            alt="EX Logo"
            className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 object-contain"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav
        className="admin-sidebar-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          paddingRight: "12px",
        }}
      >
        {filteredMenuItems.map((item) => {
          const active = isMenuItemActive(item, location.pathname);
          const hasChildren = !!item.subItems?.length;
          const isExpanded = expandedItems.includes(item.id);
          const textColor = active ? ACTIVE_TEXT : INACTIVE_TEXT;

          return (
            <div key={item.id}>
              {/* Parent row */}
              <button
                onClick={() =>
                  hasChildren ? toggleExpanded(item.id) : handleNavigation(item.path)
                }
                style={active ? activeItemStyle : inactiveItemStyle}
                {...hoverHandlers(active)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SidebarIcon icon={item.icon} active={active} mode={item.iconColorMode} />
                  <span
                    className="font-lufga"
                    style={{ fontWeight: 500, fontSize: "20px", lineHeight: "150%", color: textColor }}
                  >
                    {item.label}
                  </span>
                </div>

                {hasChildren && (
                  isExpanded
                    ? <ChevronDown style={{ width: 16, height: 16, flexShrink: 0, color: textColor }} />
                    : <ChevronRight style={{ width: 16, height: 16, flexShrink: 0, color: textColor }} />
                )}
              </button>

              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div
                  style={{
                    marginLeft: "16px",
                    marginTop: "2px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {item.subItems!.map((sub) => {
                    const subActive = isPathActive(location.pathname, sub.path);
                    const subTextColor = subActive ? ACTIVE_TEXT : INACTIVE_TEXT;

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNavigation(sub.path)}
                        style={subActive ? activeItemStyle : inactiveItemStyle}
                        {...hoverHandlers(subActive)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <SidebarIcon icon={sub.icon} active={subActive} mode={sub.iconColorMode} />
                          <span
                            className="font-lufga"
                            style={{ fontWeight: 500, fontSize: "20px", lineHeight: "150%", color: subTextColor }}
                          >
                            {sub.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: Settings + Logout */}
      <div
        style={{
          flexShrink: 0,
          marginTop: "16px",
          paddingTop: "16px",
          paddingRight: "12px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {/* Settings */}
        <button
          onClick={() => handleNavigation("/admin/settings")}
          style={settingsActive ? activeItemStyle : inactiveItemStyle}
          {...hoverHandlers(settingsActive)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SidebarIcon icon={SettingsSvg} active={settingsActive} />
            <span
              className="font-lufga"
              style={{
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                color: settingsActive ? ACTIVE_TEXT : INACTIVE_TEXT,
              }}
            >
              Settings
            </span>
          </div>
        </button>

        {/* Logout — never "active", just always muted white */}
        <button
          onClick={handleLogout}
          style={inactiveItemStyle}
          {...hoverHandlers(false)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LogOutSvg style={{ width: 20, height: 20, flexShrink: 0, opacity: 0.6 }} />
            <span
              className="font-lufga"
              style={{ fontWeight: 500, fontSize: "14px", lineHeight: "150%", color: INACTIVE_TEXT }}
            >
              Log Out
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const AdminSidebar = ({ isMobile = false }: { isMobile?: boolean }) => {
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 border-0 w-[346px] sm:w-[346px] overflow-hidden flex flex-col"
          style={{ backgroundColor: "rgba(0, 0, 0, 1)" }}
        >
          <AdminSidebarContent onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="hidden lg:flex">
      <AdminSidebarContent />
    </aside>
  );
};
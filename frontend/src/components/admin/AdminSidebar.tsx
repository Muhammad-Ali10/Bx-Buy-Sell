import { Menu, ChevronDown, ChevronRight, GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useListingAreaOrder, useSaveListingAreaOrder } from "@/hooks/useListingAreaOrder";
import { isListingArea } from "@/lib/listingAreaOrder";
import { SortableQuestionList } from "@/components/admin/content/SortableQuestionList";
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
  // Team members are users with a staff role, so they live on this screen too,
  // behind its own role filter. The separate "Team Members" entry pointed at
  // the same place with `?role=team` on the end — two doors into one room.
  { id: "users", label: "Users", icon: UsersSvg, path: "/admin/users" },
  {
    id: "acquisition-capacity",
    label: "Acquisition Capacity",
    icon: UsersSvg,
    path: "/admin/acquisition-capacity",
  },
  {
    id: "chat",
    label: "Chat",
    icon: ChatSvg,
    path: "/admin/chats",
    subItems: [
      { id: "all-chats", label: "All Chats", icon: AllChatsSvg, path: "/admin/chats" },
      { id: "monitoring", label: "Monitoring Alerts", icon: MonitoringAlertsSvg, path: "/admin/monitoring-alerts" },
      // "Chat List" is off the menu: its search, assignment and assigned /
      // unassigned filter all live on All Chats now. The page itself is still
      // at /admin/chat-list.
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
  const base = path.split("?")[0];
  return pathname === base || pathname.startsWith(base + "/");
}

function isMenuItemActive(item: SidebarMenuItem, pathname: string): boolean {
  // Two entries used to share /admin/users and were told apart by `?role=`.
  // With one left, the path is enough again — and so the query string, which
  // was only ever read to separate them, is no longer needed here.
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

const SubItemButton = ({
  sub,
  active,
  onClick,
}: {
  sub: SidebarSubItem;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={active ? activeItemStyle : inactiveItemStyle}
    {...hoverHandlers(active)}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <SidebarIcon icon={sub.icon} active={active} mode={sub.iconColorMode} />
      <span
        className="font-lufga"
        style={{ fontWeight: 500, fontSize: "20px", lineHeight: "150%", color: active ? ACTIVE_TEXT : INACTIVE_TEXT }}
      >
        {sub.label}
      </span>
    </div>
  </button>
);

/**
 * A Content Management area an administrator can drag into a new place.
 *
 * The grip sits in the indent left of the icon, so the labels stay lined up
 * with the rows that do not move, and it is the only part that drags — a click
 * anywhere else on the row still opens the area.
 */
const SortableSubItem = ({
  sub,
  active,
  onClick,
}: {
  sub: SidebarSubItem;
  active: boolean;
  onClick: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sub.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted while it moves, so it is not painted under its neighbours.
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.9 : undefined,
      }}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${sub.label}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: "-16px",
          top: 0,
          bottom: 0,
          width: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: INACTIVE_TEXT,
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <GripVertical style={{ width: 14, height: 14 }} />
      </button>
      <SubItemButton sub={sub} active={active} onClick={onClick} />
    </div>
  );
};

const AdminSidebarContent = ({
  onClose,
  collapsed = false,
  onToggleCollapse,
  onExpand,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onExpand?: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(["chat", "content"]);
  const areaOrder = useListingAreaOrder();
  const saveAreaOrder = useSaveListingAreaOrder();

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

  const renderSubItem = (sub: SidebarSubItem) => (
    <SubItemButton
      key={sub.id}
      sub={sub}
      active={isPathActive(location.pathname, sub.path)}
      onClick={() => handleNavigation(sub.path)}
    />
  );

  /**
   * Content Management's rows, with the listing form's areas in the order an
   * administrator arranged. Category and Packages keep their places; the areas
   * between them drag, and the seller's form asks them in the same order.
   *
   * The questions' drag list does this job one level down, so it is reused
   * here rather than copied.
   */
  const renderContentSubItems = (subItems: SidebarSubItem[]) => {
    const firstArea = subItems.findIndex((sub) => isListingArea(sub.id));
    if (firstArea < 0) return subItems.map(renderSubItem);

    const pinnedTop = subItems.slice(0, firstArea);
    const pinnedBottom = subItems.filter(
      (sub, index) => index > firstArea && !isListingArea(sub.id),
    );
    const areas = areaOrder.flatMap((id) => subItems.filter((sub) => sub.id === id));

    return (
      <>
        {pinnedTop.map(renderSubItem)}
        <SortableQuestionList
          items={areas}
          onReorder={(ordered) =>
            saveAreaOrder.mutate(ordered.map((sub) => sub.id).filter(isListingArea))
          }
        >
          {/* A box of their own, so a dragged area stays among the areas and
              cannot be dropped above Category or below Packages. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {areas.map((sub) => (
              <SortableSubItem
                key={sub.id}
                sub={sub}
                active={isPathActive(location.pathname, sub.path)}
                onClick={() => handleNavigation(sub.path)}
              />
            ))}
          </div>
        </SortableQuestionList>
        {pinnedBottom.map(renderSubItem)}
      </>
    );
  };

  const settingsActive = isPathActive(location.pathname, "/admin/settings");

  return (
    <div
      style={{
        // Collapsed is an icon-only rail: wide enough for the icon and its
        // touch target, narrow enough to leave All Chats its three columns.
        width: collapsed ? "72px" : "346px",
        maxWidth: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: collapsed ? "20px 0 12px 0" : "20px 0 12px 12px",
        backgroundColor: "rgba(0, 0, 0, 1)",
        transition: "width 160ms ease",
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
      <div
        style={{
          flexShrink: 0,
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          paddingRight: collapsed ? 0 : "12px",
        }}
      >
        {!collapsed && (
          <Link to="/" onClick={onClose}>
            <img
              src={logo}
              alt="EX Logo"
              className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 object-contain"
            />
          </Link>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
            title={collapsed ? "Expand the menu" : "Collapse the menu"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              flexShrink: 0,
              color: INACTIVE_TEXT,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
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

          // Collapsed, a section with children has nowhere to show them, so
          // opening one widens the menu rather than doing nothing.
          const handleParentClick = () => {
            if (collapsed) {
              if (hasChildren) {
                onExpand?.();
                if (!isExpanded) toggleExpanded(item.id);
                return;
              }
              handleNavigation(item.path);
              return;
            }
            if (hasChildren) {
              toggleExpanded(item.id);
              return;
            }
            handleNavigation(item.path);
          };

          return (
            <div key={item.id}>
              {/* Parent row */}
              <button
                onClick={handleParentClick}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                style={{
                  ...(active ? activeItemStyle : inactiveItemStyle),
                  ...(collapsed
                    ? { justifyContent: "center", padding: "12px 0", width: "100%" }
                    : null),
                }}
                {...hoverHandlers(active)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: collapsed ? 0 : "8px",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <SidebarIcon icon={item.icon} active={active} mode={item.iconColorMode} />
                  {!collapsed && (
                    <span
                      className="font-lufga"
                      style={{ fontWeight: 500, fontSize: "20px", lineHeight: "150%", color: textColor }}
                    >
                      {item.label}
                    </span>
                  )}
                </div>

                {hasChildren && !collapsed && (
                  isExpanded
                    ? <ChevronDown style={{ width: 16, height: 16, flexShrink: 0, color: textColor }} />
                    : <ChevronRight style={{ width: 16, height: 16, flexShrink: 0, color: textColor }} />
                )}
              </button>

              {/* Sub-items */}
              {hasChildren && isExpanded && !collapsed && (
                <div
                  style={{
                    marginLeft: "16px",
                    marginTop: "2px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {item.id === "content"
                    ? renderContentSubItems(item.subItems!)
                    : item.subItems!.map(renderSubItem)}
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
          title={collapsed ? "Settings" : undefined}
          aria-label={collapsed ? "Settings" : undefined}
          style={{
            ...(settingsActive ? activeItemStyle : inactiveItemStyle),
            ...(collapsed ? { justifyContent: "center", padding: "12px 0", width: "100%" } : null),
          }}
          {...hoverHandlers(settingsActive)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : "8px" }}>
            <SidebarIcon icon={SettingsSvg} active={settingsActive} />
            {!collapsed && (
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
            )}
          </div>
        </button>

        {/* Logout — never "active", just always muted white */}
        <button
          onClick={handleLogout}
          title={collapsed ? "Log Out" : undefined}
          aria-label={collapsed ? "Log Out" : undefined}
          style={{
            ...inactiveItemStyle,
            ...(collapsed ? { justifyContent: "center", padding: "12px 0", width: "100%" } : null),
          }}
          {...hoverHandlers(false)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : "8px" }}>
            <LogOutSvg style={{ width: 20, height: 20, flexShrink: 0, opacity: 0.6 }} />
            {!collapsed && (
              <span
                className="font-lufga"
                style={{ fontWeight: 500, fontSize: "14px", lineHeight: "150%", color: INACTIVE_TEXT }}
              >
                Log Out
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const AdminSidebar = ({ isMobile = false }: { isMobile?: boolean }) => {
  const [open, setOpen] = useState(false);
  // The sheet on mobile is always full width — there is nothing to collapse
  // when the menu is an overlay rather than a column.
  const { collapsed, toggle, expand } = useSidebarCollapsed();

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
      <AdminSidebarContent
        collapsed={collapsed}
        onToggleCollapse={toggle}
        onExpand={expand}
      />
    </aside>
  );
};
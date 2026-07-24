import { LayoutGrid, Building2, Wrench, CreditCard, Users, Megaphone, HandHeart, Package, TrendingUp, ShoppingBag, Target, Menu } from "lucide-react";
import type { DashboardStep } from "@/pages/Dashboard";
import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/_App Icon 1 (2).png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface DashboardSidebarProps {
  activeStep: DashboardStep;
  onStepChange: (step: DashboardStep) => void;
  isMobile?: boolean;
}

const menuItems = [
  { id: "category" as DashboardStep, label: "Category", icon: LayoutGrid },
  { id: "brand-information" as DashboardStep, label: "Brand Information", icon: Building2 },
  { id: "tools" as DashboardStep, label: "Tools you use", icon: Wrench },
  { id: "financials" as DashboardStep, label: "Financials", icon: CreditCard },
  { id: "statistics" as DashboardStep, label: "Statistics", icon: TrendingUp },
  { id: "products" as DashboardStep, label: "Products", icon: ShoppingBag },
  { id: "management" as DashboardStep, label: "Management", icon: Target },
  { id: "accounts" as DashboardStep, label: "Accounts", icon: Users },
  { id: "ad-informations" as DashboardStep, label: "Ad Informations", icon: Megaphone },
  { id: "handover" as DashboardStep, label: "Handover", icon: HandHeart },
  { id: "packages" as DashboardStep, label: "Packages", icon: Package },
];

const SidebarContent = ({ activeStep, onStepChange, onLinkClick }: { activeStep: DashboardStep; onStepChange: (step: DashboardStep) => void; onLinkClick?: () => void }) => {
  const handleStepChange = (step: DashboardStep) => {
    onStepChange(step);
    onLinkClick?.();
  };

  return (
    <>
      <div className="p-4 sm:p-6">
        <Link to="/" className="flex items-center justify-start" onClick={onLinkClick}>
          <img 
            src={logo} 
            alt="EX Logo" 
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
          />
        </Link>
      </div>
      
      <nav
        className="flex-1 overflow-y-auto"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          paddingRight: "12px",
          paddingLeft: "12px",
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeStep === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleStepChange(item.id)}
              className={`w-full flex items-center transition-all ${
                isActive ? "" : "hover:bg-white/5 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3"
              }`}
              style={
                isActive
                  ? {
                      width: "100%",
                      minHeight: "48px",
                      borderRadius: "12px",
                      paddingTop: "12px",
                      paddingRight: "16px",
                      paddingBottom: "12px",
                      paddingLeft: "16px",
                      gap: "6px",
                      backgroundColor: "rgba(174, 243, 31, 1)",
                    }
                  : { gap: "6px" }
              }
            >
              <Icon
                className="flex-shrink-0"
                style={{
                  width: "20px",
                  height: "20px",
                  color: isActive ? "rgba(0, 0, 0, 1)" : "rgba(255, 255, 255, 1)",
                  opacity: 1,
                }}
              />
              <span
                className="font-medium"
                style={{
                  fontFamily: "Lufga",
                  fontWeight: 500,
                  fontSize: "14px",
                  lineHeight: "150%",
                  letterSpacing: "0%",
                  color: isActive ? "rgba(0, 0, 0, 1)" : "rgba(255, 255, 255, 1)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export const DashboardSidebar = ({ activeStep, onStepChange, isMobile }: DashboardSidebarProps) => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  // Desktop sidebar
  if (isMobile === false) {
    return (
      <aside className="hidden md:flex w-60 bg-[hsl(0_0%_0%)] text-white flex flex-col">
        <SidebarContent activeStep={activeStep} onStepChange={onStepChange} />
      </aside>
    );
  }

  // Mobile sidebar as Sheet
  if (isMobile === true) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] sm:w-[320px] bg-[hsl(0_0%_0%)] text-white border-none p-0">
          <div className="flex flex-col h-full">
            <SidebarContent activeStep={activeStep} onStepChange={onStepChange} onLinkClick={handleClose} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Default: Desktop sidebar when isMobile is undefined
  return (
    <aside className="hidden md:flex w-60 bg-[hsl(0_0%_0%)] text-white flex flex-col">
      <SidebarContent activeStep={activeStep} onStepChange={onStepChange} />
    </aside>
  );
};

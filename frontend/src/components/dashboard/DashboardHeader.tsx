import { ChevronDown, User, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import type { User } from "@/hooks/useAuth";
import searchIcon from "@/assets/seach icon.svg";

interface DashboardHeaderProps {
  user: User;
}

export const DashboardHeader = ({ user }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiClient.getUserById(user.id);
        if (response.success && response.data) {
          const firstName = response.data.first_name || '';
          const lastName = response.data.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          setUserName(fullName || user.email || "User");
        } else {
          // Fallback to user data from hook
          const firstName = user.first_name || '';
          const lastName = user.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          setUserName(fullName || user.email || "User");
        }
      } catch (error) {
        // Fallback to user data from hook
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        setUserName(fullName || user.email || "User");
      }
    };

    loadProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error: any) {
      toast.error("Failed to log out");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-14 sm:h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-40">
      <div />
      <div className="hidden sm:flex items-center gap-3 flex-1 max-w-md mx-4 justify-end">
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          <img
            src={searchIcon}
            alt="Search"
            style={{ width: "20px", height: "20px", opacity: 1 }}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationDropdown userId={user.id} variant="dark" />
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-muted px-2 sm:px-3 py-2 rounded-lg transition-colors focus:outline-none">
            <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
              <AvatarImage src="" alt={userName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium">{userName}</span>
            <ChevronDown className="hidden sm:block w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/profile")}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/my-listings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>My Listings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Minimal top bar when building a listing without an account (no user menu / notifications).
 */
export function DashboardGuestBar() {
  return (
    <header className="h-14 sm:h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-40">
      <span className="text-sm font-medium text-muted-foreground">Create listing</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/login">Log in</Link>
        </Button>
        <Button size="sm" variant="accent" asChild>
          <Link to="/register">Sign up</Link>
        </Button>
      </div>
    </header>
  );
}

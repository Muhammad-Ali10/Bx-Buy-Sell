import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

/**
 * AdminProtectedRoute - Ensures user is authenticated AND has admin role
 * Shows loading state until auth check completes, then redirects if not authenticated or not admin
 */
export const AdminProtectedRoute = ({ children, allowedRoles }: AdminProtectedRouteProps) => {
  const { user, isAuthenticated, loading } = useAuth();

  // Wait for auth check to complete
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to admin login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  /**
   * Blocked, so not a team member either.
   *
   * This checked the role and nothing else, so a blocked moderator still got
   * the whole team area drawn around them — sidebar, header, every screen —
   * and only the data inside it failed, one 403 at a time. The area itself is
   * the thing they should not be seeing.
   */
  if ((user as any).blocked === true) {
    return <Navigate to="/admin/login?blocked=1" replace />;
  }

  // Check if user has required role
  const userRole = user.role?.toUpperCase();
  const roleAllowlist = (allowedRoles?.length
    ? allowedRoles
    : ["ADMIN", "MONITER", "MODERATOR"]
  ).map((role) => role.toUpperCase());
  const isAllowed = userRole ? roleAllowlist.includes(userRole) : false;

  // Redirect to admin login if not authorized
  if (!isAllowed) {
    return <Navigate to="/admin/login" replace />;
  }

  // Render children if authenticated and admin
  return <>{children}</>;
};

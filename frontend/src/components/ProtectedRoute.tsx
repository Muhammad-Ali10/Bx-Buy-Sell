import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute - Ensures user is authenticated before rendering children
 * Shows loading state until auth check completes, then redirects if not authenticated
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /**
   * A blocked account is not a signed-in one.
   *
   * The api client ends the session as soon as the server answers, but that
   * answer only comes with the next request. Reading the flag here closes the
   * gap on a page that has not asked the server for anything yet.
   */
  if ((user as any)?.blocked === true) {
    return <Navigate to="/login?blocked=1" replace />;
  }

  // Render children if authenticated
  return <>{children}</>;
};

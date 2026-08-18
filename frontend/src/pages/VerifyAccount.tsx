import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import Header from "@/components/Header";
import { AccountVerification } from "@/components/account/AccountVerification";
import { useAuth } from "@/hooks/useAuth";

const VerifyAccount = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ListingsSidebar />
      <Header sidebarOffset />

      {/* The same component the Account Details tab renders, so the sidebar
          link keeps working and there is only one version of this screen. */}
      <div className="flex-1 px-4 pb-8 pt-28 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <AccountVerification />
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;

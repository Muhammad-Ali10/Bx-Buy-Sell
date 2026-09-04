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

      {/* The sidebar is fixed, so it takes no width in this row: without a
          margin of its own the page starts at x=0 and the first 240px of every
          heading disappears behind it. `Header` already offsets itself through
          `sidebarOffset`, which is why only the body needed this. */}
      <div className="flex-1 min-w-0 md:w-auto lg:ml-[240px] xl:ml-[280px]">
        <Header sidebarOffset />
        <div className="h-20 sm:h-24" />

        {/* The same component the Account Details tab renders, so the sidebar
            link keeps working and there is only one version of this screen. */}
        <main className="px-4 pb-10 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-3xl">
            <AccountVerification />
          </div>
        </main>
      </div>
    </div>
  );
};

export default VerifyAccount;

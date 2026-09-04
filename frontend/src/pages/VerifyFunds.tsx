import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import Header from "@/components/Header";
import AcquisitionCapacityUpload from "@/components/AcquisitionCapacityUpload";
import { useAuth } from "@/hooks/useAuth";

/**
 * Proof of funds, on a page of its own.
 *
 * It used to open inside the Funds row of the verification list, which left no
 * room for the two-step header the design carries and, worse, put it behind a
 * condition: once a moderator finished the review the row read "Verified" and
 * the panel stopped rendering, so a buyer who wanted to add a later statement
 * had nowhere to add it. A page is always reachable.
 */
const VerifyFunds = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
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

        <main className="px-4 pb-10 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <AcquisitionCapacityUpload />
          </div>
        </main>
      </div>
    </div>
  );
};

export default VerifyFunds;

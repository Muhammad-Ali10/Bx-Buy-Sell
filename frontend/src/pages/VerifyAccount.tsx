import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
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

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Verify Your Account</h1>
          <p className="text-muted-foreground mb-8">
            Get verified to build trust with buyers and sellers. Verified accounts get priority placement and enhanced features.
          </p>
          <Button className="bg-[#D3FC50] text-black hover:bg-[#D3FC50]/90 rounded-full">
            Start Verification
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;

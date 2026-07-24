import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [activating, setActivating] = useState(true);

  useEffect(() => {
    if (sessionId) {
      activateSubscription();
    }
  }, [sessionId]);

  const activateSubscription = async () => {
    try {
      console.log('🔄 Activating subscription with session:', sessionId);
      
      // Call backend to manually sync subscription (for local testing)
      const response = await apiClient.request("/subscription/sync-session", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });

      console.log('📨 Sync response:', response);

      if (response.success) {
        console.log('✅ Subscription activated successfully');
        toast.success("Subscription activated!");
        setActivating(false);
        
        // Force reload to clear any cached subscription data
        setTimeout(() => {
          window.location.href = "/my-listings";
        }, 2000);
      } else {
        console.error('❌ Activation failed:', response.error);
        toast.error(response.error || "Failed to activate subscription");
        setActivating(false);
      }
    } catch (error: any) {
      console.error("❌ Activation error:", error);
      toast.error(error.message || "Failed to activate subscription");
      setActivating(false);
      
      // Still redirect even on error
      setTimeout(() => {
        navigate("/my-listings");
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div
        style={{
          maxWidth: "500px",
          width: "100%",
          background: "rgba(255, 255, 255, 1)",
          borderRadius: "24px",
          padding: "48px 32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(197, 253, 31, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Check style={{ width: "40px", height: "40px", color: "rgba(0, 0, 0, 1)" }} />
        </div>

        <h1
          style={{
            fontFamily: "Lufga",
            fontWeight: 600,
            fontSize: "32px",
            lineHeight: "120%",
            color: "rgba(0, 0, 0, 1)",
            marginBottom: "16px",
          }}
        >
          Subscription Activated!
        </h1>

        <p
          style={{
            fontFamily: "Lufga",
            fontWeight: 400,
            fontSize: "16px",
            lineHeight: "140%",
            color: "rgba(0, 0, 0, 0.6)",
            marginBottom: "32px",
          }}
        >
          Your Pro subscription is now active. You'll be redirected to your listings shortly.
        </p>

        <button
          onClick={() => navigate("/my-listings")}
          style={{
            width: "100%",
            height: "56px",
            borderRadius: "62px",
            background: "rgba(197, 253, 31, 1)",
            border: "none",
            cursor: "pointer",
            fontFamily: "Lufga",
            fontWeight: 600,
            fontSize: "18px",
            color: "rgba(0, 0, 0, 1)",
          }}
        >
          Go to My Listings
        </button>
      </div>
    </div>
  );
};

export default CheckoutSuccess;

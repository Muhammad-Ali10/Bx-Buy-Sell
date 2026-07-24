import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface Subscription {
  plan: {
    name: string;
    title: string;
    slug: string;
    monthlyPrice: string;
    yearlyPrice: string;
  };
  status: string;
  billingCycle?: string;
  stripeCurrentPeriodEnd?: string;
  cancelledAt?: string;
  isFree: boolean;
}

export const SubscriptionStatus = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await apiClient.request("/subscription/current");
      if (response.success && response.data) {
        setSubscription(response.data);
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleManageBilling = async () => {
    try {
      const response = await apiClient.request("/subscription/portal?returnUrl=" + window.location.href);
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to open billing portal");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll lose access to Pro features at the end of your billing period.")) {
      return;
    }

    setCancelling(true);
    try {
      const response = await apiClient.request("/subscription/cancel", {
        method: "POST",
        body: JSON.stringify({ immediately: false }),
      });

      if (response.success) {
        toast.success("Subscription cancelled. You'll have access until the end of your billing period.");
        loadSubscription();
      } else {
        toast.error(response.error || "Failed to cancel subscription");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "24px",
          background: "rgba(250, 250, 250, 1)",
          borderRadius: "12px",
        }}
      >
        <p style={{ fontFamily: "Lufga", fontSize: "14px", color: "rgba(0, 0, 0, 0.6)" }}>
          Loading subscription...
        </p>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const isPro = subscription.plan?.slug === "pro";
  const isCancelled = subscription.cancelledAt;

  return (
    <div
      style={{
        background: "rgba(250, 250, 250, 1)",
        borderRadius: "12px",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <h3
            style={{
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "20px",
              color: "rgba(0, 0, 0, 1)",
              margin: 0,
            }}
          >
            Current Plan
          </h3>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "60px",
              background: isPro ? "rgba(197, 253, 31, 1)" : "rgba(0, 0, 0, 0.1)",
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "12px",
              color: isPro ? "rgba(0, 0, 0, 1)" : "rgba(0, 0, 0, 0.6)",
            }}
          >
            {subscription.plan?.name || "Free"}
          </div>
        </div>

        <p
          style={{
            fontFamily: "Lufga",
            fontWeight: 400,
            fontSize: "14px",
            color: "rgba(0, 0, 0, 0.6)",
            margin: 0,
          }}
        >
          {subscription.plan?.title}
        </p>
      </div>

      {isPro && subscription.stripeCurrentPeriodEnd && (
        <div style={{ marginBottom: "20px" }}>
          <p
            style={{
              fontFamily: "Lufga",
              fontWeight: 400,
              fontSize: "14px",
              color: "rgba(0, 0, 0, 0.6)",
            }}
          >
            {isCancelled ? "Access ends:" : "Renews:"}{" "}
            {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
          </p>
          {isCancelled && (
            <p
              style={{
                fontFamily: "Lufga",
                fontWeight: 500,
                fontSize: "14px",
                color: "rgba(255, 0, 0, 1)",
                marginTop: "8px",
              }}
            >
              Subscription cancelled - access continues until {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        {subscription.isFree ? (
          <button
            onClick={handleUpgrade}
            style={{
              flex: 1,
              height: "48px",
              borderRadius: "62px",
              background: "rgba(197, 253, 31, 1)",
              border: "none",
              cursor: "pointer",
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "16px",
              color: "rgba(0, 0, 0, 1)",
            }}
          >
            Upgrade to Pro
          </button>
        ) : (
          <>
            <button
              onClick={handleManageBilling}
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "62px",
                background: "rgba(197, 253, 31, 1)",
                border: "none",
                cursor: "pointer",
                fontFamily: "Lufga",
                fontWeight: 600,
                fontSize: "16px",
                color: "rgba(0, 0, 0, 1)",
              }}
            >
              Manage Billing
            </button>
            {!isCancelled && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  flex: 1,
                  height: "48px",
                  borderRadius: "62px",
                  background: "rgba(250, 250, 250, 1)",
                  border: "none",
                  cursor: cancelling ? "not-allowed" : "pointer",
                  fontFamily: "Lufga",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "rgba(0, 0, 0, 1)",
                  opacity: cancelling ? 0.5 : 1,
                }}
              >
                {cancelling ? "Cancelling..." : "Cancel Plan"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionStatus;

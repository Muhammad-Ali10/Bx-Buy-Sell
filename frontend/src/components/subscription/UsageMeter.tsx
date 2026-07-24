import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

interface Usage {
  current: number;
  max: number;
  unlimited: boolean;
  canCreate: boolean;
  remaining: number;
}

export const UsageMeter = () => {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const response = await apiClient.request("/subscription/usage");
      if (response.success && response.data) {
        setUsage(response.data);
      }
    } catch (error) {
      console.error("Error loading usage:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) {
    return null;
  }

  const percentage = usage.unlimited ? 100 : Math.min(100, (usage.current / usage.max) * 100);
  const isNearLimit = !usage.unlimited && percentage >= 80;
  const isAtLimit = !usage.canCreate;

  return (
    <div
      style={{
        background: "rgba(250, 250, 250, 1)",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span
            style={{
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "14px",
              color: "rgba(0, 0, 0, 1)",
            }}
          >
            Active Listings
          </span>
          <span
            style={{
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "14px",
              color: isAtLimit ? "rgba(255, 0, 0, 1)" : "rgba(0, 0, 0, 0.6)",
            }}
          >
            {usage.current} / {usage.unlimited ? "∞" : usage.max}
          </span>
        </div>

        {/* Progress bar */}
        {!usage.unlimited && (
          <div
            style={{
              width: "100%",
              height: "8px",
              background: "rgba(0, 0, 0, 0.1)",
              borderRadius: "60px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: "100%",
                background: isAtLimit
                  ? "rgba(255, 0, 0, 1)"
                  : isNearLimit
                  ? "rgba(255, 165, 0, 1)"
                  : "rgba(197, 253, 31, 1)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {isAtLimit && (
        <p
          style={{
            fontFamily: "Lufga",
            fontWeight: 500,
            fontSize: "13px",
            color: "rgba(255, 0, 0, 1)",
            margin: 0,
          }}
        >
          Listing limit reached. Upgrade to Pro for unlimited listings.
        </p>
      )}
    </div>
  );
};

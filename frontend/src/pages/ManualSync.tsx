import { useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ManualSync = () => {
  const [sessionId, setSessionId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  const handleSync = async () => {
    if (!sessionId.trim()) {
      toast.error("Please enter session ID");
      return;
    }

    setSyncing(true);
    try {
      const response = await apiClient.request("/subscription/sync-session", {
        method: "POST",
        body: JSON.stringify({ sessionId: sessionId.trim() }),
      });

      console.log("Sync response:", response);

      if (response.success) {
        toast.success("Subscription activated!");
        setTimeout(() => {
          window.location.href = "/my-listings";
        }, 1000);
      } else {
        toast.error(response.error || "Failed to sync");
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync");
    } finally {
      setSyncing(false);
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
          padding: "32px",
        }}
      >
        <h1
          style={{
            fontFamily: "Lufga",
            fontWeight: 600,
            fontSize: "24px",
            color: "rgba(0, 0, 0, 1)",
            marginBottom: "16px",
          }}
        >
          Manual Subscription Sync
        </h1>

        <p
          style={{
            fontFamily: "Lufga",
            fontWeight: 400,
            fontSize: "14px",
            color: "rgba(0, 0, 0, 0.6)",
            marginBottom: "24px",
          }}
        >
          Enter your Stripe checkout session ID to activate your subscription:
        </p>

        <input
          type="text"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="cs_test_..."
          style={{
            width: "100%",
            height: "48px",
            padding: "0 16px",
            borderRadius: "12px",
            background: "rgba(250, 250, 250, 1)",
            border: "none",
            fontFamily: "Lufga",
            fontSize: "14px",
            marginBottom: "16px",
          }}
        />

        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "62px",
            background: "rgba(197, 253, 31, 1)",
            border: "none",
            cursor: syncing ? "not-allowed" : "pointer",
            fontFamily: "Lufga",
            fontWeight: 600,
            fontSize: "16px",
            color: "rgba(0, 0, 0, 1)",
            opacity: syncing ? 0.5 : 1,
          }}
        >
          {syncing ? "Syncing..." : "Activate Subscription"}
        </button>

        <p
          style={{
            fontFamily: "Lufga",
            fontWeight: 400,
            fontSize: "12px",
            color: "rgba(0, 0, 0, 0.5)",
            marginTop: "16px",
            textAlign: "center",
          }}
        >
          Find session ID in Stripe Dashboard → Payments → Click payment → Copy session ID
        </p>
      </div>
    </div>
  );
};

export default ManualSync;

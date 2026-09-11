import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

/**
 * Where Stripe sends someone after paying — for a buyer plan and for a
 * listing's package alike.
 *
 * It said "Your Pro subscription is now active" whatever was bought, and went
 * to My Listings either way. Worse, for a buyer plan the record it asked the
 * server to make always failed, so the plan never appeared under Account
 * Details. Now it says what actually happened and goes where that purchase is
 * managed.
 */
type State = "working" | "buyer" | "listing" | "error";

const COPY: Record<State, { title: string; body: string }> = {
  working: { title: "Confirming Your Payment", body: "One moment while we record your purchase." },
  buyer: { title: "Your Plan Is Active", body: "Taking you to your subscriptions…" },
  listing: {
    title: "Payment Received",
    body: "Your listing's package switches on in a moment. Taking you to My Listings…",
  },
  error: { title: "We Could Not Confirm It Yet", body: "" },
};

const LIME = "rgba(197, 253, 31, 1)";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<State>(sessionId ? "working" : "error");
  const [detail, setDetail] = useState(sessionId ? "" : "This page was opened without a checkout.");
  const ranRef = useRef(false);

  useEffect(() => {
    if (!sessionId || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const response: any = await apiClient.syncCheckoutSession(sessionId);
      const data = response?.data?.data ?? response?.data ?? {};
      if (response?.success === false || data?.success === false) {
        setState("error");
        setDetail(data?.error || response?.error || "Please check again in a minute.");
        return;
      }
      // Anything cached before the purchase describes the account without it.
      void queryClient.invalidateQueries();
      if (data?.kind === "listing") {
        setState("listing");
        window.setTimeout(() => navigate("/my-listings"), 2500);
        return;
      }
      setState("buyer");
      window.setTimeout(() => navigate("/profile?tab=subscriptions"), 2500);
    })();
  }, [sessionId, navigate, queryClient]);

  const copy = COPY[state];

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
            background: state === "error" ? "rgba(254, 226, 226, 1)" : LIME,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          {state === "working" ? (
            <Loader2 className="animate-spin" style={{ width: "36px", height: "36px" }} />
          ) : state === "error" ? (
            <AlertCircle style={{ width: "38px", height: "38px", color: "rgba(220, 38, 38, 1)" }} />
          ) : (
            <Check style={{ width: "40px", height: "40px", color: "rgba(0, 0, 0, 1)" }} />
          )}
        </div>

        <h1
          style={{
            fontFamily: "Lufga",
            fontWeight: 600,
            fontSize: "30px",
            lineHeight: "120%",
            color: "rgba(0, 0, 0, 1)",
            marginBottom: "16px",
          }}
        >
          {copy.title}
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
          {state === "error" ? detail : copy.body}
        </p>

        {state === "error" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Go to My Subscriptions", to: "/profile?tab=subscriptions" },
              { label: "Go to My Listings", to: "/my-listings" },
            ].map((action) => (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                style={{
                  width: "100%",
                  height: "52px",
                  borderRadius: "62px",
                  background: LIME,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "Lufga",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "rgba(0, 0, 0, 1)",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutSuccess;

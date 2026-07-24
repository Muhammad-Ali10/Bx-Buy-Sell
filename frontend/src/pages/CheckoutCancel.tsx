import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const CheckoutCancel = () => {
  const navigate = useNavigate();

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
            background: "rgba(250, 250, 250, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <X style={{ width: "40px", height: "40px", color: "rgba(0, 0, 0, 0.5)" }} />
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
          Checkout Cancelled
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
          No worries! You can upgrade to Pro anytime.
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => navigate("/pricing")}
            style={{
              flex: 1,
              height: "56px",
              borderRadius: "62px",
              background: "rgba(250, 250, 250, 1)",
              border: "none",
              cursor: "pointer",
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "18px",
              color: "rgba(0, 0, 0, 1)",
            }}
          >
            View Plans
          </button>
          <button
            onClick={() => navigate("/")}
            style={{
              flex: 1,
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
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancel;

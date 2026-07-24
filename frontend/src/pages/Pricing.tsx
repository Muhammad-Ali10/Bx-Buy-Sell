import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  feature: string[];
  maxListings: number;
  isDefault: boolean;
}

const Pricing = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await apiClient.request("/subscription/plans");
      if (response.success && response.data) {
        setPlans(response.data);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planSlug: string) => {
    if (!isAuthenticated) {
      toast.error("Please log in to subscribe");
      navigate("/login");
      return;
    }

    if (planSlug === "free") {
      toast.info("You're already on the Free plan");
      return;
    }

    setCheckingOut(planSlug);
    try {
      const response = await apiClient.request("/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({
          planSlug,
          billingCycle,
        }),
      });

      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error(response.error || "Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setCheckingOut(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="text-center mb-12">
          <h1
            style={{
              fontFamily: "Lufga",
              fontWeight: 600,
              fontSize: "48px",
              lineHeight: "120%",
              color: "rgba(0, 0, 0, 1)",
              marginBottom: "16px",
            }}
          >
            Choose Your Plan
          </h1>
          <p
            style={{
              fontFamily: "Lufga",
              fontWeight: 400,
              fontSize: "18px",
              lineHeight: "140%",
              color: "rgba(0, 0, 0, 0.6)",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            Start free, upgrade when you're ready to grow your business sales
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "6px",
              background: "rgba(250, 250, 250, 1)",
              borderRadius: "60px",
            }}
          >
            <button
              onClick={() => setBillingCycle("MONTHLY")}
              style={{
                padding: "10px 24px",
                borderRadius: "60px",
                background: billingCycle === "MONTHLY" ? "rgba(197, 253, 31, 1)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "Lufga",
                fontWeight: 500,
                fontSize: "16px",
                color: "rgba(0, 0, 0, 1)",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("YEARLY")}
              style={{
                padding: "10px 24px",
                borderRadius: "60px",
                background: billingCycle === "YEARLY" ? "rgba(197, 253, 31, 1)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "Lufga",
                fontWeight: 500,
                fontSize: "16px",
                color: "rgba(0, 0, 0, 1)",
              }}
            >
              Yearly <span style={{ color: "rgba(0, 0, 0, 0.6)" }}>(Save $90)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const price = billingCycle === "MONTHLY" ? plan.monthlyPrice : plan.yearlyPrice;
            const isFree = plan.slug === "free";
            const isPro = plan.slug === "pro";
            
            return (
              <div
                key={plan.id}
                style={{
                  background: isPro ? "rgba(0, 0, 0, 1)" : "rgba(255, 255, 255, 1)",
                  borderRadius: "24px",
                  padding: "32px",
                  position: "relative",
                }}
              >
                {isPro && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(197, 253, 31, 1)",
                      padding: "6px 20px",
                      borderRadius: "60px",
                      fontFamily: "Lufga",
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "rgba(0, 0, 0, 1)",
                    }}
                  >
                    RECOMMENDED
                  </div>
                )}

                <div style={{ marginBottom: "24px" }}>
                  <h3
                    style={{
                      fontFamily: "Lufga",
                      fontWeight: 600,
                      fontSize: "24px",
                      color: isPro ? "rgba(255, 255, 255, 1)" : "rgba(0, 0, 0, 1)",
                      marginBottom: "8px",
                    }}
                  >
                    {plan.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "Lufga",
                      fontWeight: 400,
                      fontSize: "14px",
                      color: isPro ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)",
                    }}
                  >
                    {plan.description}
                  </p>
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span
                      style={{
                        fontFamily: "Lufga",
                        fontWeight: 700,
                        fontSize: "48px",
                        color: isPro ? "rgba(197, 253, 31, 1)" : "rgba(0, 0, 0, 1)",
                      }}
                    >
                      ${price}
                    </span>
                    {!isFree && (
                      <span
                        style={{
                          fontFamily: "Lufga",
                          fontWeight: 400,
                          fontSize: "16px",
                          color: isPro ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)",
                        }}
                      >
                        /{billingCycle === "MONTHLY" ? "month" : "year"}
                      </span>
                    )}
                  </div>
                </div>

                <ul style={{ marginBottom: "32px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {plan.feature.map((feature, index) => (
                    <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "rgba(197, 253, 31, 1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check style={{ width: "12px", height: "12px", color: "rgba(0, 0, 0, 1)" }} />
                      </div>
                      <span
                        style={{
                          fontFamily: "Lufga",
                          fontWeight: 400,
                          fontSize: "16px",
                          lineHeight: "140%",
                          color: isPro ? "rgba(255, 255, 255, 1)" : "rgba(0, 0, 0, 1)",
                        }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={checkingOut === plan.slug}
                  style={{
                    width: "100%",
                    height: "56px",
                    borderRadius: "62px",
                    background: isPro ? "rgba(197, 253, 31, 1)" : "rgba(0, 0, 0, 1)",
                    border: "none",
                    cursor: checkingOut === plan.slug ? "not-allowed" : "pointer",
                    fontFamily: "Lufga",
                    fontWeight: 600,
                    fontSize: "18px",
                    color: isPro ? "rgba(0, 0, 0, 1)" : "rgba(255, 255, 255, 1)",
                    opacity: checkingOut === plan.slug ? 0.5 : 1,
                  }}
                >
                  {checkingOut === plan.slug
                    ? "Loading..."
                    : isFree
                    ? "Get Started Free"
                    : "Upgrade to Pro"}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="text-center mt-16">
          <p
            style={{
              fontFamily: "Lufga",
              fontWeight: 400,
              fontSize: "14px",
              color: "rgba(0, 0, 0, 0.6)",
            }}
          >
            All plans include secure payment processing. Cancel anytime.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;

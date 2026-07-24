import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardGuestBar } from "@/components/dashboard/DashboardGuestBar";
import { GuestListingAuthDialog } from "@/components/dashboard/GuestListingAuthDialog";
import { Button } from "@/components/ui/button";
import { CategoryStep } from "@/components/dashboard/steps/CategoryStep";
import { BrandInformationStep } from "@/components/dashboard/steps/BrandInformationStep";
import { ToolsStep } from "@/components/dashboard/steps/ToolsStep";
import { FinancialsStep } from "@/components/dashboard/steps/FinancialsStep";
import { AdditionalInformationStep } from "@/components/dashboard/steps/AdditionalInformationStep";
import { StatisticsStep } from "@/components/dashboard/steps/StatisticsStep";
import { ProductsStep } from "@/components/dashboard/steps/ProductsStep";
import { ManagementStep } from "@/components/dashboard/steps/ManagementStep";
import { AccountsStep } from "@/components/dashboard/steps/AccountsStep";
import { AdInformationsStep } from "@/components/dashboard/steps/AdInformationsStep";
import { HandoverStep } from "@/components/dashboard/steps/HandoverStep";
import { PackagesStep } from "@/components/dashboard/steps/PackagesStep";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import {
  clearInvalidDraftListing,
  readDraftListing,
  writeDraftListing,
} from "@/lib/draftListingStorage";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";
import { toast } from "sonner";
import { getAdminFinancialsTemplateVersion } from "@/lib/financialTableUtils";

export type DashboardStep = 
  | "category" 
  | "brand-information" 
  | "tools" 
  | "financials" 
  | "statistics"
  | "products"
  | "management"
  | "accounts" 
  | "ad-informations" 
  | "handover" 
  | "packages";

export type ListingFormMode = "create" | "edit";

export type ListingFormProps = {
  /** When set with `mode="edit"`, used instead of the URL (e.g. embedded wizard). */
  mode?: ListingFormMode;
  listingId?: string;
};

const Dashboard = ({ mode: modeProp, listingId: listingIdProp }: ListingFormProps = {}) => {
  const navigate = useNavigate();
  const matchListingEdit = useMatch({ path: "/listing/:id/edit", end: true });
  const matchDashboardEdit = useMatch({ path: "/dashboard/edit/:id", end: true });
  const listingIdFromRoute =
    matchListingEdit?.params.id ?? matchDashboardEdit?.params.id;
  const id = listingIdProp ?? listingIdFromRoute;
  const isEditMode =
    (modeProp === "edit" && Boolean(listingIdProp)) ||
    Boolean(matchListingEdit || matchDashboardEdit);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeStep, setActiveStep] = useState<DashboardStep>("category");
  const [formData, setFormData] = useState<any>({});
  /** Edit flow: start true so we never paint steps with empty formData before hydrate (fixes broken pre-fill). */
  const [loadingListing, setLoadingListing] = useState(() =>
    Boolean(isEditMode && id),
  );
  const hasLoadedListingRef = useRef(false);
  const loadedListingIdRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const [resumePublishNonce, setResumePublishNonce] = useState(0);
  const resumeFromSessionDoneRef = useRef(false);

  const isGuestCreateFlow = !isEditMode && !isAuthenticated;

  useEffect(() => {
    if (!authLoading && !isAuthenticated && isEditMode) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate, isEditMode]);

  // Avoid stuck spinner on edit when user is not signed in (load effect requires user id)
  useEffect(() => {
    if (!isEditMode || !id) return;
    if (!authLoading && !isAuthenticated) {
      setLoadingListing(false);
    }
  }, [isEditMode, id, authLoading, isAuthenticated]);

  // Hydrate listing draft from localStorage (guests, or returning users finishing publish)
  useEffect(() => {
    if (authLoading) return;
    clearInvalidDraftListing();

    if (isEditMode) {
      setDraftHydrated(true);
      return;
    }

    if (isAuthenticated) {
      const pendingSession =
        typeof window !== "undefined" &&
        sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY) === "1";
      const draft = readDraftListing();
      if (pendingSession || draft?.pendingPublish) {
        if (draft?.formData && typeof draft.formData === "object") {
          setFormData(draft.formData);
        }
        if (draft?.activeStep) {
          setActiveStep(draft.activeStep);
        }
      }
      setDraftHydrated(true);
      return;
    }

    const draft = readDraftListing();
    if (draft) {
      setFormData(draft.formData);
      setActiveStep(draft.activeStep);
    }
    setDraftHydrated(true);
  }, [authLoading, isAuthenticated, isEditMode]);

  // Persist guest progress to localStorage (progressive save)
  useEffect(() => {
    if (!draftHydrated || isEditMode || isAuthenticated) return;
    const handle = window.setTimeout(() => {
      const prev = readDraftListing();
      writeDraftListing({
        activeStep,
        formData,
        pendingPublish: prev?.pendingPublish === true,
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [formData, activeStep, draftHydrated, isEditMode, isAuthenticated]);

  // After register redirect: session flag tells us to auto-run publish once (after draft is hydrated)
  useEffect(() => {
    if (!draftHydrated || authLoading || !isAuthenticated || !user || isEditMode) return;
    if (activeStep !== "packages") return;
    if (resumeFromSessionDoneRef.current) return;
    if (sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY) !== "1") return;
    resumeFromSessionDoneRef.current = true;
    sessionStorage.removeItem(LISTING_PUBLISH_PENDING_SESSION_KEY);
    writeDraftListing({
      activeStep,
      formData,
      pendingPublish: false,
    });
    setResumePublishNonce((n) => n + 1);
  }, [draftHydrated, authLoading, isAuthenticated, user, isEditMode, activeStep, formData]);

  const persistGuestDraft = useCallback(
    (opts?: { pendingPublish?: boolean }) => {
      if (isEditMode || isAuthenticated) return;
      const prev = readDraftListing();
      writeDraftListing({
        activeStep,
        formData,
        pendingPublish: opts?.pendingPublish ?? prev?.pendingPublish === true,
      });
    },
    [activeStep, formData, isEditMode, isAuthenticated]
  );

  const handleGuestAuthDialogSuccess = useCallback(() => {
    sessionStorage.removeItem(LISTING_PUBLISH_PENDING_SESSION_KEY);
    writeDraftListing({
      activeStep,
      formData,
      pendingPublish: false,
    });
    setResumePublishNonce((n) => n + 1);
  }, [activeStep, formData]);

  // Load listing data if in edit mode
  useEffect(() => {
    // Only load if:
    // 1. We're in edit mode
    // 2. We have an id
    // 3. We have a user ID
    // 4. We haven't already loaded this listing (or the listing ID changed)
    if (isEditMode && id && user?.id) {
      // Check if we've already loaded this specific listing
      if (!hasLoadedListingRef.current || loadedListingIdRef.current !== id) {
        hasLoadedListingRef.current = true;
        loadedListingIdRef.current = id;
        loadListingData();
      }
    }
  }, [isEditMode, id, user?.id]); // Use user?.id instead of user to prevent re-runs

  const loadListingData = async () => {
    if (!id) return;

    setLoadingListing(true);
    try {
      const getTodayDate = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
      };

      /** DB often stores arrays/objects as JSON strings; never collapse arrays to first element. */
      const pickAnswer = (item: any) => {
        const raw = item?.answer;
        if (raw === undefined || raw === null) return null;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
          const t = raw.trim();
          if (
            (t.startsWith("[") && t.endsWith("]")) ||
            (t.startsWith("{") && t.endsWith("}"))
          ) {
            try {
              return JSON.parse(t);
            } catch {
              /* keep string */
            }
          }
          return raw;
        }
        return raw;
      };

      const hasUsableAnswer = (answer: unknown) => {
        if (answer === null || answer === undefined) return false;
        if (typeof answer === "boolean") return true;
        if (typeof answer === "number") return !Number.isNaN(answer);
        if (typeof answer === "string") return answer.trim() !== "";
        if (Array.isArray(answer)) return answer.length > 0;
        if (typeof answer === "object") return Object.keys(answer as object).length > 0;
        return true;
      };

      // Same secure listing fetch as ListingDetail when authenticated
      const [
        listingResponse,
        brandQuestionsRes,
        statisticQuestionsRes,
        productQuestionsRes,
        managementQuestionsRes,
        adQuestionsRes,
        handoverQuestionsRes,
        accountsRes,
        accountQuestionsRes,
      ] = await Promise.all([
        apiClient.getSecureListingById(id),
        apiClient.getAdminQuestionsByType("BRAND"),
        apiClient.getAdminQuestionsByType("STATISTIC"),
        apiClient.getAdminQuestionsByType("PRODUCT"),
        apiClient.getAdminQuestionsByType("MANAGEMENT"),
        apiClient.getAdminQuestionsByType("ADVERTISMENT"),
        apiClient.getAdminQuestionsByType("HANDOVER"),
        apiClient.getSocialAccounts(),
        apiClient.getAdminQuestionsByType("SOCIAL"),
      ]);
      
      if (!listingResponse.success || !listingResponse.data) {
        hasLoadedListingRef.current = false;
        loadedListingIdRef.current = null;
        toast.error("Failed to load listing data");
        navigate("/my-listings");
        return;
      }
      
      // Type the listing properly to avoid TypeScript errors
      const listing = listingResponse.data as any;
      
      // Extract question arrays
      const brandQuestions = brandQuestionsRes.success && Array.isArray(brandQuestionsRes.data) ? brandQuestionsRes.data : [];
      const statisticQuestions = statisticQuestionsRes.success && Array.isArray(statisticQuestionsRes.data) ? statisticQuestionsRes.data : [];
      const productQuestions = productQuestionsRes.success && Array.isArray(productQuestionsRes.data) ? productQuestionsRes.data : [];
      const managementQuestions = managementQuestionsRes.success && Array.isArray(managementQuestionsRes.data) ? managementQuestionsRes.data : [];
      const adQuestions = adQuestionsRes.success && Array.isArray(adQuestionsRes.data) ? adQuestionsRes.data : [];
      const handoverQuestions = handoverQuestionsRes.success && Array.isArray(handoverQuestionsRes.data) ? handoverQuestionsRes.data : [];
      const socialAccounts = accountsRes.success && Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const accountQuestions =
        accountQuestionsRes.success && Array.isArray(accountQuestionsRes.data)
          ? accountQuestionsRes.data
          : [];
      
      const normalizeQuestionKey = (s: string) =>
        (s || "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/['"`]/g, "")
          .replace(/[?:.,!]+$/g, "")
          .trim();

      /** Map saved listing.question text to current admin question id (handles minor text drift). */
      const matchQuestionToId = (questionText: string, questions: any[]): string | null => {
        if (!questionText || !questions?.length) return null;
        const a = normalizeQuestionKey(questionText);
        if (!a) return null;

        const exact = questions.find(
          (q: any) => normalizeQuestionKey(String(q.question || "")) === a,
        );
        if (exact?.id) return exact.id;

        const loose = questions.filter((q: any) => {
          const b = normalizeQuestionKey(String(q.question || ""));
          if (!b || b.length < 3) return false;
          return a.includes(b) || b.includes(a);
        });
        if (loose.length === 1 && loose[0].id) return loose[0].id;

        const starts = questions.filter((q: any) => {
          const b = normalizeQuestionKey(String(q.question || ""));
          return b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
        });
        if (starts.length === 1 && starts[0].id) return starts[0].id;

        return null;
      };
      
      // Transform listing data from API format to form data format
      const transformedData: any = {};
      
      // Category on listing is ListingCategory: `id` is join-row UUID, not Business Category id — prefer `name` for wizard matching
      if (listing.category && Array.isArray(listing.category) && listing.category.length > 0) {
        const c0 = listing.category[0] as any;
        const byName =
          (typeof c0?.name === "string" && c0.name.trim()) ||
          (typeof c0?.category?.name === "string" && c0.category.name.trim()) ||
          "";
        transformedData.category =
          byName ||
          (c0?.categoryId != null && String(c0.categoryId)) ||
          (c0?.category?.id != null && String(c0.category.id)) ||
          "";
        if (!transformedData.category && (c0?.id || c0?._id)) {
          transformedData.category = String(c0.id || c0._id);
        }
      }
      
      // Extract brand questions - match by question text
      if (listing.brand && Array.isArray(listing.brand)) {
        listing.brand.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, brandQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract statistics questions
      if (listing.statistics && Array.isArray(listing.statistics)) {
        listing.statistics.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, statisticQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract product questions
      if (listing.productQuestion && Array.isArray(listing.productQuestion)) {
        listing.productQuestion.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, productQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract management questions
      if (listing.managementQuestion && Array.isArray(listing.managementQuestion)) {
        listing.managementQuestion.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, managementQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract advertisement questions
      if (listing.advertisement && Array.isArray(listing.advertisement)) {
        listing.advertisement.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, adQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract handover questions
      if (listing.handover && Array.isArray(listing.handover)) {
        listing.handover.forEach((item: any) => {
          const answer = pickAnswer(item);
          if (item.question && hasUsableAnswer(answer)) {
            const questionId = matchQuestionToId(item.question, handoverQuestions);
            if (questionId) {
              transformedData[questionId] = answer;
            }
          }
        });
      }

      // Extract financials (detailed table JSON or legacy rows)
      if (listing.financials && Array.isArray(listing.financials)) {
        const tableFinancial = listing.financials.find(
          (f: any) => f.name === "__FINANCIAL_TABLE__" && f.revenue_amount
        );
        if (tableFinancial && tableFinancial.revenue_amount) {
          try {
            const tableData = JSON.parse(tableFinancial.revenue_amount);
            if (tableData) {
              transformedData.financialType = tableData.financialType || "detailed";
              transformedData.rowLabels = tableData.rowLabels || [
                "Revenue",
                "Net Revenue",
                "Cost of Goods",
                "Advertising costs",
                "Freelancer/Employees",
                "Transaction Costs",
                "Other Expenses",
              ];
              transformedData.columnLabels = tableData.columnLabels || [
                { key: "2023", label: "2023" },
                { key: "2024", label: "2024" },
                { key: "today", label: getTodayDate() },
                { key: "Forecast 2025", label: "Forecast 2025" },
              ];
              transformedData.financialData = tableData.financialData || {};
              transformedData.financialsFromListing = true;
            }
          } catch {
            /* fall through to legacy */
          }
        }
        if (!transformedData.months && !transformedData.financialData) {
          const months = listing.financials
            .filter((fin: any) => fin.name !== "__FINANCIAL_TABLE__")
            .map((fin: any) => ({
              period: fin.name || "",
              revenue: fin.revenue_amount || "0",
              revenue2: fin.revenue_amount || "0",
              cost: fin.annual_cost || "0",
            }));
          transformedData.months = months;
          transformedData.financialType =
            listing.financials[0]?.type === "yearly" ? "yearly" : "monthly";
        }
      }

      // ListingTool: `id` is join-row UUID — wizard resolves ServiceTool by catalog `name` (or id)
      if (listing.tools && Array.isArray(listing.tools)) {
        transformedData.tools = listing.tools
          .map((tool: any) => {
            const name = typeof tool?.name === "string" ? tool.name.trim() : "";
            return name || (tool?.id != null ? String(tool.id) : "");
          })
          .filter(Boolean);
      }

      // Extract social accounts (platform fields + SOCIAL account questions)
      if (listing.social_account && Array.isArray(listing.social_account)) {
        const socialAccountsData: Record<string, { url?: string; followers?: string }> = {};
        const socialAccountQuestionsData: Record<string, string> = {};

        listing.social_account.forEach((acc: any) => {
          const questionText = (acc.question || "").toLowerCase();
          const rawAns = pickAnswer(acc);
          let answerText = "";
          if (hasUsableAnswer(rawAns)) {
            if (Array.isArray(rawAns)) {
              answerText = rawAns.map((x) => String(x)).filter(Boolean).join(", ");
            } else if (typeof rawAns === "object") {
              answerText = JSON.stringify(rawAns);
            } else {
              answerText = String(rawAns);
            }
          }

          if (accountQuestions.length > 0 && acc.question) {
            const qId = matchQuestionToId(acc.question, accountQuestions);
            if (qId && answerText) {
              socialAccountQuestionsData[qId] = answerText;
              return;
            }
          }

          const platform = socialAccounts.find((sa: any) => {
            const platformName = (sa.platform || sa.social_account_option || "").toLowerCase();
            if (!platformName) return false;
            return (
              questionText.includes(platformName) ||
              (acc.answer_for &&
                platformName.includes(String(acc.answer_for).toLowerCase()))
            );
          });

          if (platform) {
            const platformId = platform.id;
            if (!socialAccountsData[platformId]) {
              socialAccountsData[platformId] = {};
            }
            if (answerText) {
              const parts = answerText.includes("|")
                ? answerText.split("|").map((p: string) => p.trim()).filter(Boolean)
                : [answerText];
              let urlPart = "";
              let followersPart = "";
              for (const part of parts) {
                const low = part.toLowerCase();
                if (low.includes("follower")) {
                  const m = part.match(/\d[\d,]*/);
                  if (m) followersPart = m[0].replace(/,/g, "");
                } else if (/^https?:\/\//i.test(part) || /\.[a-z]{2,}\b/i.test(part) || /^@\S+/i.test(part)) {
                  urlPart = urlPart || part;
                } else if (/^\d+$/.test(part.replace(/\s/g, ""))) {
                  followersPart = part.replace(/\s/g, "");
                } else {
                  urlPart = urlPart || part;
                }
              }
              if (followersPart) {
                socialAccountsData[platformId].followers = followersPart;
              }
              if (urlPart) {
                socialAccountsData[platformId].url = urlPart;
              }
            }
          }
        });

        if (Object.keys(socialAccountsData).length > 0) {
          transformedData.socialAccounts = socialAccountsData;
        }
        if (Object.keys(socialAccountQuestionsData).length > 0) {
          transformedData.socialAccountQuestions = socialAccountQuestionsData;
        }
      }
      
      // Extract portfolio link
      if (listing.portfolioLink) {
        transformedData.portfolioLink = listing.portfolioLink;
      }
      
      // Set status
      if (listing.status) {
        transformedData.listingStatus = listing.status === "PUBLISH" ? "PUBLISH" : "DRAFT";
      }

      transformedData.confidentialControl = Boolean(listing.confidentialControl);
      transformedData.featuredOnCategoryPage = Boolean(listing.featuredOnCategoryPage);
      transformedData.featuredOnStartPage = Boolean(listing.featuredOnStartPage);

      setFormData(transformedData);
      toast.success("Listing data loaded successfully");
    } catch (error: any) {
      console.error("Error loading listing:", error);
      hasLoadedListingRef.current = false;
      loadedListingIdRef.current = null;
      toast.error("Failed to load listing data");
      navigate("/my-listings");
    } finally {
      setLoadingListing(false);
    }
  };

  const updateFormData = (stepData: any) => {
    setFormData((prev: any) => ({ ...prev, ...stepData }));
  };

  const renderStep = () => {
    switch (activeStep) {
      case "category":
        return <CategoryStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("brand-information"); }} />;
      case "brand-information":
        return <BrandInformationStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("tools"); }} onBack={() => setActiveStep("category")} />;
      case "tools":
        return <ToolsStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("financials"); }} onBack={() => setActiveStep("brand-information")} />;
      case "financials":
        return (
          <FinancialsStep
            key={`financials-${getAdminFinancialsTemplateVersion()}`}
            isEditListing={isEditMode}
            formData={formData}
            onNext={(data) => {
              updateFormData(data);
              setActiveStep("statistics");
            }}
            onBack={() => setActiveStep("tools")}
          />
        );
      case "statistics":
        return (
          <AdditionalInformationStep
            formData={formData}
            onNext={(data) => { updateFormData(data); setActiveStep("products"); }}
            onBack={() => setActiveStep("financials")}
            defaultTab="statistics"
          />
        );
      case "products":
        return (
          <AdditionalInformationStep
            formData={formData}
            onNext={(data) => { updateFormData(data); setActiveStep("management"); }}
            onBack={() => setActiveStep("statistics")}
            defaultTab="products"
          />
        );
      case "management":
        return (
          <AdditionalInformationStep
            formData={formData}
            onNext={(data) => { updateFormData(data); setActiveStep("accounts"); }}
            onBack={() => setActiveStep("products")}
            defaultTab="management"
          />
        );
      case "accounts":
        return <AccountsStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("ad-informations"); }} onBack={() => setActiveStep("management")} />;
      case "ad-informations":
        return <AdInformationsStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("handover"); }} onBack={() => setActiveStep("accounts")} />;
      case "handover":
        return <HandoverStep formData={formData} onNext={(data) => { updateFormData(data); setActiveStep("packages"); }} onBack={() => setActiveStep("ad-informations")} />;
      case "packages":
        return (
          <PackagesStep
            formData={formData}
            listingId={id}
            onBack={() => setActiveStep("handover")}
            isGuest={isGuestCreateFlow}
            onGuestPersistDraft={persistGuestDraft}
            onGuestAuthOpenChange={setGuestAuthOpen}
            resumePublishNonce={resumePublishNonce}
            afterSuccessRedirect={isEditMode ? "listing-detail" : "my-listings"}
          />
        );
      default:
        return null;
    }
  };

  if (authLoading || loadingListing || !draftHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{loadingListing ? "Loading listing data..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (isEditMode && (!isAuthenticated || !user)) {
    return null;
  }

  if (!isEditMode && isAuthenticated && !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <DashboardSidebar activeStep={activeStep} onStepChange={setActiveStep} isMobile={false} />
      
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        {/* Mobile Header with Hamburger Menu */}
        <div className="md:hidden border-b border-border bg-background sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 py-3">
            <DashboardSidebar activeStep={activeStep} onStepChange={setActiveStep} isMobile={true} />
            <h1 className="text-lg font-semibold shrink-0">
              {isEditMode ? "Edit Listing" : "Create Listing"}
            </h1>
            {isGuestCreateFlow && (
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button size="sm" variant="accent" asChild>
                  <Link to="/register">Sign up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden md:block">
          {isGuestCreateFlow ? <DashboardGuestBar /> : user ? <DashboardHeader user={user} /> : null}
        </div>
        
        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {renderStep()}
        </main>
      </div>

      {isGuestCreateFlow && (
        <GuestListingAuthDialog
          open={guestAuthOpen}
          onOpenChange={setGuestAuthOpen}
          onAuthSuccess={handleGuestAuthDialogSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard;
/** Same listing wizard as the dashboard; use when you want a named import. */
export { Dashboard as ListingForm };

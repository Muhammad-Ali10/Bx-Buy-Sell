import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { normalizeDomainAnswer } from "@/lib/domainUtils";
import { serializeMediaUrls } from "@/lib/mediaUtils";
import { usePlans } from "@/hooks/usePlans";
import { Check, Crown, Info, Lock, UserRoundCheck, Ban, CircleCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ADDON_LABELS,
  BILLING_CYCLES,
  PACKAGE_LABELS,
  getAddonPrice,
  SUCCESS_FEE_INFO_TEXT,
  buildPricingOverview,
  formatUsd,
  getListingPriceFromForm,
  getPackageMonthlyPrice,
  getPricingTier,
  type AddonId,
  type BillingCycleId,
  type PackageId,
  type PackageSelection,
} from "@/lib/packagePricing";
import { useBrandQuestions } from "@/hooks/useBrandQuestions";
import { useStatisticQuestions } from "@/hooks/useStatisticQuestions";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { useManagementQuestions } from "@/hooks/useManagementQuestions";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
import { clearDraftListing } from "@/lib/draftListingStorage";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";

interface PackagesStepProps {
  formData: any;
  listingId?: string;
  onBack: () => void;
  /** Logged-out user creating a new listing (not edit mode). */
  isGuest?: boolean;
  onGuestPersistDraft?: (opts?: { pendingPublish?: boolean }) => void;
  onGuestAuthOpenChange?: (open: boolean) => void;
  /** Incremented after sign-in to run the same submit path as logged-in users. */
  resumePublishNonce?: number;
  /** After a successful save, where to send the user (edit flow defaults to listing detail via parent). */
  afterSuccessRedirect?: "my-listings" | "listing-detail";
}

export const PackagesStep = ({
  formData,
  listingId,
  onBack,
  isGuest = false,
  onGuestPersistDraft,
  onGuestAuthOpenChange,
  resumePublishNonce = 0,
  afterSuccessRedirect = "my-listings",
}: PackagesStepProps) => {
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingStatus, setListingStatus] = useState<"DRAFT" | "PUBLISH">(
    formData.listingStatus === 'PUBLISH' ? 'PUBLISH' : 'DRAFT'
  );
  const [sellerFeatures, setSellerFeatures] = useState({
    confidentialControl: Boolean(formData.confidentialControl),
    featuredOnCategoryPage: Boolean(formData.featuredOnCategoryPage),
    featuredOnStartPage: Boolean(formData.featuredOnStartPage),
  });
  const [rules, setRules] = useState<any>(null);

  /** The step walks through: packages → confidentiality (paid only) → agreement. */
  const [screen, setScreen] = useState<"packages" | "confidentiality" | "agreement">("packages");
  const [selection, setSelection] = useState<PackageSelection>({
    packageId: (formData.selectedPackage as PackageId) || null,
    addon: (formData.packageAddon as AddonId) || "NONE",
    billingCycle: (formData.packageBillingCycle as BillingCycleId) || "MONTHLY",
  });
  // Requirement: this must start switched off.
  const [approveBuyersManually, setApproveBuyersManually] = useState(
    formData.approveBuyersManually === true,
  );
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: brandQuestions } = useBrandQuestions();
  const { data: statisticQuestions } = useStatisticQuestions();
  const { data: productQuestions } = useProductQuestions();
  const { data: managementQuestions } = useManagementQuestions();
  const { data: adQuestions } = useAdInformationQuestions();
  const { data: handoverQuestions } = useHandoverQuestions();
  const { data: socialAccounts } = useAccounts();
  const { data: accountQuestions } = useAccountQuestions();

  // Mirrors handleSubmit, which returns the saved listing id for the checkout flow.
  const handleSubmitRef = useRef<
    (status?: "DRAFT" | "PUBLISH", opts?: { skipRedirect?: boolean }) => Promise<string | null>
  >(async () => null);
  const lastResumeNonce = useRef(0);

  // Every amount on this step is derived from the listing price the seller
  // entered in the Ad Information step.
  const listingPrice = getListingPriceFromForm(formData, adQuestions);
  const tier = listingPrice !== null ? getPricingTier(listingPrice) : null;
  const overview =
    listingPrice !== null ? buildPricingOverview(listingPrice, selection) : null;

  /**
   * Final check before publishing. Only questions the admin explicitly marked
   * mandatory are enforced here — each step already applies its own rules as the
   * seller passes through it, and treating every legacy question as mandatory
   * flagged fields the seller was never asked for.
   */
  const getMissingMandatoryFields = (): string[] => {
    const missing: string[] = [];
    const isEmpty = (v: any) =>
      !v || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

    const categoryValue = formData.category;
    if (isEmpty(categoryValue)) missing.push("Category");

    /** A conditional question the seller never saw cannot be missing. */
    const isHidden = (q: any) => {
      if (!q?.dependsOnQuestionId) return false;
      const parent = String(formData[q.dependsOnQuestionId] ?? "").trim().toLowerCase();
      const expected = String(q.dependsOnValue ?? "").trim().toLowerCase();
      return expected ? parent !== expected : parent === "";
    };

    const checkSet = (questions: any[] | undefined, answers: Record<string, any>) => {
      (questions || []).forEach((q: any) => {
        if (q?.required !== true) return;
        const type = String(q?.answer_type || "").toUpperCase();
        if (["PHOTO", "PHOTO_UPLOAD", "FILE", "FILE_UPLOAD"].includes(type)) return;
        if (isHidden(q)) return;
        if (isEmpty(answers?.[q.id])) missing.push(q.question || "Required field");
      });
    };

    checkSet(brandQuestions, formData);
    checkSet(statisticQuestions, formData);
    checkSet(productQuestions, formData);
    checkSet(managementQuestions, formData);
    checkSet(adQuestions, formData);
    checkSet(handoverQuestions, formData);
    checkSet(accountQuestions, formData.socialAccountQuestions || {});

    return missing;
  };

  /** Manual buyer approval is offered with the paid packages only. */
  const isPaidPackage = selection.packageId === "STARTER" || selection.packageId === "PREMIUM";

  const handleNextStep = () => {
    const missing = getMissingMandatoryFields();
    if (missing.length > 0) {
      // Naming the fields turns a dead end into something the seller can act on.
      const shown = missing.slice(0, 3).join(", ");
      const rest = missing.length > 3 ? ` and ${missing.length - 3} more` : "";
      toast.error(
        `Before you can publish your listing, please fill out all required fields. Missing: ${shown}${rest}`,
      );
      return;
    }
    setScreen(isPaidPackage ? "confidentiality" : "agreement");
  };

  console.log("Form data accumulated:", formData);
  console.log("Selected package:", selectedPackage);
  console.log("Listing status:", listingStatus);

  useEffect(() => {
    const loadRules = async () => {
      const response = isGuest
        ? await apiClient.getSubscriptionRulesPreview()
        : await apiClient.getSubscriptionRules();
      if (response.success) {
        setRules(response.data);
      }
    };

    loadRules();
  }, [isGuest]);

  // Helper function to transform question answers to Question format
  const transformQuestions = (questions: any[], answers: Record<string, any>, answerFor: string) => {
    if (!questions || !Array.isArray(questions)) return [];
    
    // Valid answer types according to backend DTO
    const validAnswerTypes = ['TEXT', 'SELECT', 'CHECKBOX', 'BOOLEAN', 'NUMBER', 'FILE', 'PHOTO', 'DATE', 'URL'];
    
    return questions.map((question) => {
      const answer = answers[question.id];
      
      // Skip unanswered questions (but allow 0 and false as valid answers)
      if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
        return null;
      }
      
      // Convert answer to string and ensure it's at least 2 characters
      const isArrayAnswer = Array.isArray(answer);
      const isObjectArrayAnswer =
        isArrayAnswer && answer.some((item) => typeof item === "object" && item !== null);
      const answerValue = isArrayAnswer
        ? (answer as any[]).map((item) =>
            typeof item === "object" && item !== null ? JSON.stringify(item) : String(item),
          )
        : String(answer);
      // Photos/attachments are stored as a JSON array of URLs (comma-safe, explicit
      // multi-value) via the shared media helper; everything else keeps its format.
      const isMediaType = ["PHOTO", "PHOTO_UPLOAD", "FILE", "FILE_UPLOAD"].includes(
        String(question.answer_type || "").toUpperCase(),
      );
      const answerStr = isMediaType && isArrayAnswer
        ? serializeMediaUrls(answer)
        : isObjectArrayAnswer
          ? JSON.stringify(answer)
          : (Array.isArray(answerValue) ? answerValue.join(", ") : answerValue);
      
      // Skip if answer is too short (backend requires min 2 characters)
      if (answerStr.length < 2) {
        console.warn(`Skipping question "${question.question}" - answer too short: "${answerStr}"`);
        return null;
      }
      
      // Map answer_type: if it's not in the valid list, default to TEXT
      // This handles cases like 'DATE' which should be converted to 'TEXT'
      let answerType = question.answer_type || 'TEXT';
      if (!validAnswerTypes.includes(answerType)) {
        console.warn(`Invalid answer_type "${answerType}" for question "${question.question}", converting to TEXT`);
        answerType = 'TEXT';
      }
      
      // Ensure question text is at least 2 characters if provided
      const questionText = question.question || '';
      if (questionText && questionText.length < 2) {
        console.warn(`Question text too short: "${questionText}", skipping`);
        return null;
      }
      
      const rawAnswer =
        question.answer_type === "CHECKBOX" && Array.isArray(answerValue)
          ? answerValue
          : answerStr;
      const normalizedAnswer = normalizeDomainAnswer(rawAnswer, questionText);

      return {
        question: questionText,
        answer: normalizedAnswer,
        answer_type: answerType,
        answer_for: answerFor,
        option: question.option || [],
      };
    }).filter(q => q !== null);
  };

  // Helper function to transform financials
  const transformFinancials = () => {
    // Check for new table format (financialData, rowLabels, columnLabels)
    if (formData.financialData && formData.rowLabels && formData.columnLabels) {
      // Store the table structure as JSON in revenue_amount field
      // Use special marker name and 'yearly' type to be backend-compatible
      const tableData = {
        financialType: formData.financialType || 'detailed',
        rowLabels: formData.rowLabels,
        columnLabels: formData.columnLabels,
        financialData: formData.financialData,
        currency: formData.currency || 'USD',
      };
      
      return [{
        type: 'yearly' as const, // Backend requires 'monthly' or 'yearly'
        name: '__FINANCIAL_TABLE__', // Special marker name
        revenue_amount: JSON.stringify(tableData), // Store JSON data here
        annual_cost: '0',
        net_profit: '0',
      }];
    }
    
    // Fallback to old format for backward compatibility
    if (!formData.months || !Array.isArray(formData.months)) return [];
    
    return formData.months
      .filter((month: any) => {
        const revenue = parseFloat(month.revenue || month.revenue2 || '0');
        const cost = parseFloat(month.cost || '0');
        return revenue > 0 || cost > 0;
      })
      .map((month: any) => {
        const revenue = parseFloat(month.revenue || month.revenue2 || '0');
        const cost = parseFloat(month.cost || '0');
        const profit = revenue - cost;
        
        return {
          type: formData.financialType === 'yearly' ? 'yearly' : 'monthly',
          name: month.period || month.month || 'Financial Period',
          revenue_amount: String(revenue),
          annual_cost: String(cost),
          net_profit: String(profit),
        };
      });
  };

  // Helper function to transform social accounts
  const transformSocialAccounts = () => {
    if (!formData.socialAccounts || typeof formData.socialAccounts !== 'object') return [];
    
    const accounts: any[] = [];
    Object.keys(formData.socialAccounts).forEach((platform) => {
      const accountData = formData.socialAccounts[platform];
      if (!accountData || !(accountData.url || accountData.followers)) return;

      const urlPart = String(accountData.url || "").trim();
      const followersStr = String(accountData.followers ?? "").trim();
      const followersNum = parseInt(followersStr, 10);
      const followerSegment =
        followersStr !== "" && !Number.isNaN(followersNum)
          ? followersNum > 0
            ? `${followersNum.toLocaleString("en-US")} Followers`
            : "0 followers"
          : "";

      const segments = [urlPart, followerSegment].filter(Boolean);
      const answer = segments.join("|");

      if (answer.length < 2) {
        console.warn(`Skipping ${platform} account - answer too short: "${answer}"`);
        return;
      }

      accounts.push({
        question: `${platform} account`,
        answer,
        answer_type: "TEXT",
        answer_for: "SOCIAL",
        option: [],
      });
    });
    
    return accounts;
  };

  // The Draft / Checkout buttons decide the status, so it is passed in rather
  // than read from state (which would still hold the previous value here).
  const handleSubmit = async (
    statusOverride?: "DRAFT" | "PUBLISH",
    opts?: { skipRedirect?: boolean },
  ): Promise<string | null> => {
    const status = statusOverride ?? listingStatus;

    if (isGuest) {
      setIsSubmitting(true);
      try {
        if (status === "DRAFT") {
          onGuestPersistDraft?.({});
          toast.success("Draft saved on this device. Log in when you're ready to publish.");
          return;
        }
        onGuestPersistDraft?.({ pendingPublish: true });
        sessionStorage.setItem(LISTING_PUBLISH_PENDING_SESSION_KEY, "1");
        onGuestAuthOpenChange?.(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Fetch categories and tools to get names from IDs
      const categoriesResponse = await apiClient.getCategories();
      const toolsResponse = await apiClient.getTools();
      
      const categories = categoriesResponse.success && Array.isArray(categoriesResponse.data) 
        ? categoriesResponse.data 
        : [];
      const tools = toolsResponse.success && Array.isArray(toolsResponse.data) 
        ? toolsResponse.data 
        : [];
      
      // Transform category from ID to { name }
      let categoryArray: any[] = [];
      if (formData.category) {
        if (Array.isArray(formData.category)) {
          // If category is already an array, map each ID to name
          categoryArray = formData.category.map((catId: string) => {
            const cat = categories.find((c: any) => c.id === catId);
            return { name: cat?.name || catId };
          });
        } else {
          // If category is a single ID, find the name
          const categoryName = categories.find((c: any) => c.id === formData.category)?.name || formData.category;
          if (categoryName) {
            categoryArray = [{ name: categoryName }];
          }
        }
      }
      
      // Transform tools from IDs to { name }
      const toolsArray = (formData.tools || []).map((toolId: string) => {
        const tool = tools.find((t: any) => t.id === toolId);
        return { name: tool?.name || toolId };
      });
      
      // Transform all question-based data
      const brandArray = transformQuestions(brandQuestions || [], formData, 'BRAND');
      const statisticsArray = transformQuestions(statisticQuestions || [], formData, 'STATISTIC');
      const productQuestionArray = transformQuestions(productQuestions || [], formData, 'PRODUCT');
      const managementQuestionArray = transformQuestions(managementQuestions || [], formData, 'MANAGEMENT');
      const advertisementArray = transformQuestions(adQuestions || [], formData, 'ADVERTISMENT');
      const handoverArray = transformQuestions(handoverQuestions || [], formData, 'HANDOVER');
      const socialAccountPlatformsArray = transformSocialAccounts();
      // Transform account questions (questions created by admin)
      const accountQuestionsArray = transformQuestions(
        accountQuestions || [], 
        formData.socialAccountQuestions || {}, 
        'SOCIAL'
      );
      // Combine social account platforms and account questions
      const socialAccountArray = [...socialAccountPlatformsArray, ...accountQuestionsArray];
      
      // Transform financials
      const financialsArray = transformFinancials();
      console.log('💰 Transformed financials array:', JSON.stringify(financialsArray, null, 2));
      
      // Prepare listing data for API
      // Backend REQUIRES these fields as arrays (even if empty):
      // - productQuestion, managementQuestion, social_account
      // Other fields can be omitted if empty
      const listingPayload: any = {
        status, // DRAFT (Save as Draft) or PUBLISH (checkout)
        confidentialControl: sellerFeatures.confidentialControl,
        featuredOnCategoryPage: sellerFeatures.featuredOnCategoryPage,
        featuredOnStartPage: sellerFeatures.featuredOnStartPage,
        // Chosen package + add-ons. These record what the seller picked; the
        // paid features themselves are switched on once payment is wired up.
        selectedPackage: selection.packageId,
        packageBillingCycle: isPaidPackage ? selection.billingCycle : null,
        packageAddons: selection.addon === "NONE" ? [] : [selection.addon],
        successFeePercent: overview ? overview.successFeePercent : null,
        approveBuyersManually: isPaidPackage ? approveBuyersManually : false,
        // Required fields - always send as arrays (even if empty)
        productQuestion: productQuestionArray, // REQUIRED by backend
        managementQuestion: managementQuestionArray, // REQUIRED by backend
        social_account: socialAccountArray, // REQUIRED by backend
        // Other required fields
        brand: brandArray.length > 0 ? brandArray : [],
        category: categoryArray.length > 0 ? categoryArray : [],
        tools: toolsArray.length > 0 ? toolsArray : [],
        financials: financialsArray.length > 0 ? financialsArray : [],
        statistics: statisticsArray.length > 0 ? statisticsArray : [],
        advertisement: advertisementArray.length > 0 ? advertisementArray : [],
        handover: handoverArray.length > 0 ? handoverArray : [],
      };

      // Optional fields - only include if they have data
      if (formData.portfolioLink && formData.portfolioLink.trim()) {
        listingPayload.portfolioLink = formData.portfolioLink.trim();
      }
      
      console.log("Transformed listing payload:", JSON.stringify(listingPayload, null, 2));

      console.log("Submitting listing:", listingPayload);

      let response;
      if (listingId) {
        // Update existing listing
        response = await apiClient.updateListing(listingId, listingPayload);
      } else {
        // Create new listing
        response = await apiClient.createListing(listingPayload);
      }

      if (response.success) {
        clearDraftListing();
        const statusMessage = listingId
          ? (status === 'PUBLISH'
              ? "Listing updated and published successfully!"
              : "Listing updated successfully!")
          : (status === 'PUBLISH'
              ? "Listing published successfully!"
              : "Listing created successfully! You can publish it later from My Listings.");
        toast.success(statusMessage);
        console.log(listingId ? "Updated listing:" : "Created listing:", response.data);

        const savedId = listingId || (response.data as any)?.id || null;
        // The checkout flow needs the id and sends the user to Stripe instead.
        if (opts?.skipRedirect) return savedId;

        setTimeout(() => {
          if (listingId && afterSuccessRedirect === "listing-detail") {
            window.location.href = `/listing/${listingId}`;
          } else {
            window.location.href = "/my-listings";
          }
        }, 1500);
        return savedId;
      } else {
        console.error(`Failed to ${listingId ? 'update' : 'create'} listing:`, response.error);
        const errorMessage = response.error || "Failed to create listing";
        toast.error(errorMessage);
        
        // If it's a validation error, show more details
        if (typeof errorMessage === 'string' && errorMessage.includes('_errors')) {
          try {
            const errorObj = JSON.parse(errorMessage);
            console.error("Validation errors:", errorObj);
          } catch (e) {
            // Not JSON, just show the error as is
          }
        }
      }
    } catch (error) {
      console.error("Error creating listing:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
    return null;
  };

  /**
   * Publish the listing, then hand the seller over to Stripe for the package.
   * A free selection has nothing to pay, so it goes straight to My Listings.
   */
  const handleAcceptAndCheckout = async () => {
    const savedId = await handleSubmit("PUBLISH", { skipRedirect: true });
    if (!savedId) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.createListingPackageCheckout(savedId, {
        packageId: selection.packageId || "MINIMUM",
        addon: selection.addon,
        billingCycle: selection.billingCycle,
      });

      const checkoutUrl = (response.data as any)?.checkoutUrl;
      if (response.success && checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      if (response.success) {
        window.location.href = "/my-listings";
        return;
      }
      toast.error(response.error || "Could not start checkout");
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Could not start checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (!resumePublishNonce || resumePublishNonce === lastResumeNonce.current) return;
    if (isGuest) return;
    lastResumeNonce.current = resumePublishNonce;
    void handleSubmitRef.current();
  }, [resumePublishNonce, isGuest]);

  if (plansLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Packages</h1>
        <div className="text-muted-foreground">Loading packages...</div>
      </div>
    );
  }

  // Without a listing price there is nothing to calculate pricing from.
  if (listingPrice === null || !tier || !overview) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Packages</h1>
        <div className="rounded-2xl border border-border bg-muted/40 p-6 text-muted-foreground">
          Please enter a listing price before accessing the Packages section. Pricing is
          calculated automatically based on the listing price you provide
        </div>
      </div>
    );
  }

  const packageCards: Array<{ id: PackageId; blurb: string; features: string[] }> = [
    {
      id: "MINIMUM",
      blurb: "Everything you need to get started — with no upfront costs.",
      features: [
        "Start for free",
        "Publish your listing",
        "Access all essential features",
        "Success fee is paid after the business is sold",
      ],
    },
    {
      id: "STARTER",
      blurb: "For a solid mid-tier solution, choose our Starter plan.",
      features: [
        "All options from the Minimum plan",
        "Standard reach for your listing",
        "Manually approve buyers",
        "Success fee is paid after the business is sold",
      ],
    },
    {
      id: "PREMIUM",
      blurb: "Everything you need instantly — choose our premium package.",
      features: [
        "All options from the Starter plan",
        "Extended reach for your listing",
        "Stand out with a premium badge",
        "Manually approve buyers",
        "Success fee is paid after the business is sold",
      ],
    },
  ];

  const addonCards: Array<{ id: AddonId; description: string }> = [
    {
      id: "CATEGORY_PAGE",
      description:
        "Your listing appears alongside other featured listings in the same category for increased visibility.",
    },
    {
      id: "BUNDLE",
      description:
        "Your listing is featured on both the homepage and category pages for maximum exposure.",
    },
    {
      id: "START_PAGE",
      description:
        "Your listing is featured on the platform homepage for maximum reach and visibility.",
    },
  ];

  /* ---------------------------------------------------------------- screen 2 */
  if (screen === "confidentiality") {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl border border-border bg-card p-6 md:p-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
            <UserRoundCheck className="h-9 w-9 text-accent-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Confidentiality Options</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            All buyers must accept our platform confidentiality agreement before they can access
            confidential listing information. Otherwise, only public listing details will be
            visible.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-muted/40 p-4 text-sm">
          Because you have selected a{" "}
          <span className="font-semibold">
            {selection.packageId ? PACKAGE_LABELS[selection.packageId] : "package"}
          </span>
          , you can additionally choose to manually approve buyers.
        </div>

        <div className="mt-6 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="approve-buyers" className="text-base font-semibold">
              Approve Buyers Manually
            </Label>
            <Switch
              id="approve-buyers"
              checked={approveBuyersManually}
              onCheckedChange={setApproveBuyersManually}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                <Ban className="h-4 w-4" />
                When Disabled
              </div>
              <p className="text-xs text-muted-foreground">
                Buyers can access confidential listing details immediately after accepting the
                official confidentiality agreement provided by the Company Exchange Marketplace.
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                <CircleCheck className="h-4 w-4" />
                When Enabled
              </div>
              <p className="text-xs text-muted-foreground">
                Buyers must first accept our confidentiality agreement and then be approved by you
                before they can access confidential listing details. This option may significantly
                slow down the sales process and is generally not recommended unless you wish to
                personally review buyers or require an additional NDA.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setScreen("packages")}
            className="rounded-full h-12 px-8"
          >
            Back
          </Button>
          <Button
            onClick={() => setScreen("agreement")}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 flex-1 font-semibold"
          >
            Next Step
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- screen 3 */
  if (screen === "agreement") {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl border border-border bg-card p-6 md:p-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
            <Lock className="h-9 w-9 text-accent-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Seller Agreement</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            You are about to publish your listing. Before your listing can go live, you must accept
            our seller agreement.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-muted/40 p-5">
          <p className="text-sm font-semibold mb-3">By continuing, you agree to:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>→ Keep all communication confidential</li>
            <li>→ Not contact buyers outside the platform</li>
            <li>→ Conduct all communication through the EX Platform</li>
          </ul>
        </div>

        <label className="mt-6 flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={agreementAccepted}
            onCheckedChange={(checked) => setAgreementAccepted(checked === true)}
            className="mt-0.5 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
          />
          <span className="text-sm">I agree to the confidentiality terms</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Breaching these terms may result in listing removal, account suspension, legal action, and
          other remedies available under our Terms and Conditions.
        </p>

        <div className="mt-8 flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setScreen(isPaidPackage ? "confidentiality" : "packages")}
            className="rounded-full h-12 px-8"
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            onClick={handleAcceptAndCheckout}
            disabled={!agreementAccepted || isSubmitting}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 flex-1 font-semibold"
          >
            {isSubmitting ? "Please wait..." : "Accept & Go to Checkout"}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- screen 1 */
  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-border bg-card p-6 md:p-10">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold">Packages and Options</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prices are calculated automatically from your listing price of{" "}
          <span className="font-semibold text-foreground">{formatUsd(listingPrice)}</span>.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2 text-sm">
          <span className="font-semibold">{overview.successFeePercent}% Success Fee</span>
          <span className="relative group inline-flex">
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-6 z-20 w-72 -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-left text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            >
              {SUCCESS_FEE_INFO_TEXT}
            </span>
          </span>
        </div>
      </div>

      {/* Packages */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {packageCards.map((card) => {
          const isSelected = selection.packageId === card.id;
          const price = getPackageMonthlyPrice(tier, card.id);
          const isPremium = card.id === "PREMIUM";
          return (
            <div
              key={card.id}
              onClick={() =>
                setSelection((prev) => ({
                  ...prev,
                  packageId: prev.packageId === card.id ? null : card.id,
                }))
              }
              className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-colors ${
                isSelected ? "border-accent bg-accent/10" : "border-border bg-muted/30 hover:border-accent/50"
              }`}
            >
              {isPremium && (
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                  <Crown className="h-3 w-3" />
                  Premium
                </div>
              )}
              <h3 className="text-xl font-bold">{PACKAGE_LABELS[card.id]}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{card.blurb}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">{formatUsd(price)}</span>
                <span className="ml-1 text-sm text-muted-foreground">/monthly</span>
              </div>
              <div className="mt-4 space-y-2">
                {card.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div
                className={`mt-5 rounded-xl py-2.5 text-center text-sm font-semibold ${
                  isSelected ? "bg-accent text-accent-foreground" : "bg-background border border-border"
                }`}
              >
                {isSelected ? "Selected" : "Select"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Billing cycle — the free Minimum plan has nothing to bill. */}
      {selection.packageId && selection.packageId !== "MINIMUM" && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-3">Select Billing Cycle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BILLING_CYCLES.map((cycle) => {
              const isSelected = selection.billingCycle === cycle.id;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelection((prev) => ({ ...prev, billingCycle: cycle.id }))}
                  className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                    isSelected ? "border-accent bg-accent/10" : "border-border bg-muted/30 hover:border-accent/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{cycle.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {cycle.discountPercent > 0 ? `${cycle.discountPercent}% Discount` : "No discount"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add-ons — a single choice; picking one replaces the other. */}
      <div className="mt-8">
        <h2 className="text-base font-semibold mb-3">Add-ons</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {addonCards.map((addon) => {
            const isSelected = selection.addon === addon.id;
            const isBundle = addon.id === "BUNDLE";
            return (
              <div
                key={addon.id}
                onClick={() =>
                  setSelection((prev) => ({
                    ...prev,
                    addon: prev.addon === addon.id ? "NONE" : addon.id,
                  }))
                }
                className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-colors ${
                  isSelected ? "border-accent bg-accent/10" : "border-border bg-muted/30 hover:border-accent/50"
                }`}
              >
                {isBundle && (
                  <div className="absolute top-3 right-3 rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-semibold text-background">
                    Best Option
                  </div>
                )}
                <div className="text-2xl font-bold">
                  {formatUsd(getAddonPrice(tier, addon.id))}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/monthly</span>
                </div>
                <h3 className="mt-2 font-semibold text-sm">
                  {ADDON_LABELS[addon.id as Exclude<AddonId, "NONE">]}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{addon.description}</p>
                <div
                  className={`mt-4 rounded-xl py-2 text-center text-sm font-semibold ${
                    isSelected ? "bg-accent text-accent-foreground" : "bg-background border border-border"
                  }`}
                >
                  {isSelected ? "Selected" : "Select"}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The bundle costs {formatUsd(tier.addonBundle)} instead of{" "}
          {formatUsd(tier.addonCategoryPage + tier.addonStartPage)} when booked separately.
        </p>
      </div>

      {/* Overview */}
      <div className="mt-8 rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Billing Cycle</th>
                <th className="px-5 py-3 font-semibold">Discount</th>
                <th className="px-5 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {overview.lines.length === 0 ? (
                <tr className="border-t border-border">
                  <td className="px-5 py-4 text-muted-foreground" colSpan={4}>
                    No package or add-on selected yet.
                  </td>
                </tr>
              ) : (
                overview.lines.map((line) => (
                  <tr key={line.key} className="border-t border-border">
                    <td className="px-5 py-4 text-muted-foreground">{line.item}</td>
                    <td className="px-5 py-4 text-muted-foreground">{line.billingCycleLabel}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {line.discount > 0 ? `-${formatUsd(line.discount)} Discount` : "$0"}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{formatUsd(line.total)}</td>
                  </tr>
                ))
              )}
              <tr className="border-t border-border bg-muted/30">
                <td className="px-5 py-4 font-bold" colSpan={3}>
                  Amount Due Today
                </td>
                <td className="px-5 py-4 text-right font-bold">
                  {formatUsd(overview.amountDueToday)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
        <Button
          variant="outline"
          onClick={() => handleSubmit("DRAFT")}
          disabled={isSubmitting}
          className="rounded-full h-12 px-10 w-full sm:w-auto"
        >
          {isSubmitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          onClick={handleNextStep}
          disabled={isSubmitting}
          className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 flex-1 w-full font-semibold"
        >
          Next Step
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Plans renew automatically according to the selected billing cycle unless cancelled.
      </p>

      <div className="mt-6">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
      </div>
    </div>
  );
};

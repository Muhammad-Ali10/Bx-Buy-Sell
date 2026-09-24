import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { normalizeDomainAnswer } from "@/lib/domainUtils";
import { serializeMediaUrls } from "@/lib/mediaUtils";
import { isQuestionHidden, isQuestionRequired } from "@/lib/questionRequired";
import { financialsComplete, REQUIRED_FIELDS_MESSAGE } from "@/lib/listingPublishCheck";
import { usePlans } from "@/hooks/usePlans";
import { LockNew, UserLock } from "@/assets/svg";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Crown,
  Dot,
  Rocket,
  Info,
  Lock,
  UserRoundCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ADDON_LABELS,
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
import { useListingCategoryId } from "@/hooks/useListingCategoryId";
import { useStatisticQuestions } from "@/hooks/useStatisticQuestions";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { useManagementQuestions } from "@/hooks/useManagementQuestions";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
import { clearDraftListing } from "@/lib/draftListingStorage";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";
import { ADDON_CARDS, PACKAGE_CARDS } from "@/lib/packageContent";
import { BillingCycleChooser } from "@/components/listings/BillingCycleChooser";
import { TrustBand, WhyPanel } from "@/components/marketing/TrustAndWhy";

/** The brand lime, the same value the Manage Subscription page uses. */
const LIME = "rgba(197, 253, 31, 1)";

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
  /**
   * Open a particular step.
   *
   * Publishing is the first time the server sees the whole listing, so a field
   * it refuses is a field several steps back. The seller was told on this page
   * that a domain was wrong and left here, with no way to tell which of the
   * eleven steps to reopen.
   */
  onGoToStep?: (step: string) => void;
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
  onGoToStep,
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
    addonBillingCycle: (formData.addonBillingCycle as BillingCycleId) || "MONTHLY",
  });
  // Requirement: this must start switched off.
  const [approveBuyersManually, setApproveBuyersManually] = useState(
    formData.approveBuyersManually === true,
  );
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [approveOpen, setApproveOpen] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);

  const { data: plans, isLoading: plansLoading } = usePlans();
  // The seller is asked their own category's questions, not everybody's.
  const categoryId = useListingCategoryId(formData);
  const { data: brandQuestions, isFetched: brandFetched } = useBrandQuestions(categoryId);
  const { data: statisticQuestions, isFetched: statisticFetched } = useStatisticQuestions(categoryId);
  const { data: productQuestions, isFetched: productFetched } = useProductQuestions(categoryId);
  const { data: managementQuestions, isFetched: managementFetched } =
    useManagementQuestions(categoryId);
  const { data: adQuestions, isFetched: adFetched } = useAdInformationQuestions(categoryId);
  const { data: handoverQuestions, isFetched: handoverFetched } = useHandoverQuestions(categoryId);
  const { data: socialAccounts } = useAccounts();
  const { data: accountQuestions, isFetched: accountFetched } = useAccountQuestions(categoryId);

  /*
   * Every answer is written against a question, so the questions have to be here.
   *
   * The listing is built by walking the loaded questions and picking each one's
   * answer out of the form. A guest who signs up is brought straight back here
   * and the publish runs at once — before the category was resolved and before
   * the questions had arrived. It walked empty lists, and a listing went out
   * with its category, tools and figures and not one answer besides: the
   * seller's brand, statistics, products, handover and ad text all dropped.
   * Until everything has loaded for the listing's own category, nothing is sent.
   */
  const categoryResolved = !formData?.category || Boolean(categoryId);
  const questionsReady =
    categoryResolved &&
    brandFetched &&
    statisticFetched &&
    productFetched &&
    managementFetched &&
    adFetched &&
    handoverFetched &&
    accountFetched;

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
   * Final check before publishing: everything the steps themselves demand.
   *
   * The sidebar lets a seller jump straight here, past every step's own
   * "Continue", so this is the only check some sellers meet. It skipped the
   * photo and file questions and never looked at Financials at all, and with
   * one of those empty "Next Step" went through without a word — which is how
   * the client came to ask for a message that already existed.
   */
  const getMissingMandatoryFields = (): string[] => {
    const missing: string[] = [];
    const isEmpty = (v: any) =>
      !v || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

    const categoryValue = formData.category;
    if (isEmpty(categoryValue)) missing.push("Category");

    const checkSet = (questions: any[] | undefined, answers: Record<string, any>) => {
      (questions || []).forEach((q: any) => {
        // One shared rule, so this cannot disagree with the step that asked.
        // Photos and files included: the steps that ask them enforce them.
        if (!isQuestionRequired(q)) return;
        /*
         * Likewise for whether the seller was shown it at all. A question the
         * step folded away cannot be missing from a form that never asked it —
         * this used to know only about configured dependencies, and refused to
         * publish over the two inventory follow-ups the step hides by wording.
         */
        if (isQuestionHidden(q, answers, questions || [])) return;
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

    if (!financialsComplete(formData)) missing.push("Financials");

    return missing;
  };

  /** Manual buyer approval is offered with the paid packages only. */
  const isPaidPackage = selection.packageId === "STARTER" || selection.packageId === "PREMIUM";

  const handleNextStep = () => {
    // The client's sentence, exactly as they wrote it, and first: an empty
    // field is the thing to fix before a package is worth choosing.
    const missing = getMissingMandatoryFields();
    if (missing.length > 0) {
      toast.error(REQUIRED_FIELDS_MESSAGE);
      return;
    }

    /*
     * A package is a choice, not a default.
     *
     * Nothing asked for one, so a seller could walk past these cards and
     * publish with `selectedPackage` still null — and because `isPaidPackage`
     * reads null as "not paid", they were quietly sent down the free route.
     * Thirty of the listings now live were published that way.
     */
    if (!selection.packageId) {
      toast.error("Please choose a package before continuing.");
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

      /*
       * Only an empty answer is left out.
       *
       * This used to drop anything shorter than two characters, because the
       * server once refused them — so "5" employees and a "3" per cent
       * conversion rate were thrown away without a word, and a listing could
       * go out with most of its figures missing. The server takes one
       * character now.
       */
      if (String(answerStr).trim().length === 0) {
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
        // The figures are in that currency, exactly as typed. Tables saved
        // before this was written down hold US dollars instead.
        amountsIn: formData.currency || 'USD',
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

      // Nothing given for this account; one character still counts.
      if (answer.trim().length === 0) {
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
        addonBillingCycle:
          selection.addon === "NONE" ? null : selection.addonBillingCycle,
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

        /*
         * Take the seller to the field, not just to the complaint.
         *
         * The domain lives on Brand Information, nine steps back from here, and
         * being told about it on the last page with no way to reach it is how a
         * listing gets abandoned.
         */
        if (typeof errorMessage === "string" && /valid domain/i.test(errorMessage)) {
          onGoToStep?.("brand-information");
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
        addonBillingCycle: selection.addonBillingCycle,
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
    // Held, not dropped: this runs again once the questions are in.
    if (!questionsReady) return;
    lastResumeNonce.current = resumePublishNonce;
    void handleSubmitRef.current();
  }, [resumePublishNonce, isGuest, questionsReady]);

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
        <Button variant="ghost" className="mt-6" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  // The words live in `lib/packageContent`, shared with the Manage
  // Subscription page so the two never describe the same package differently.
  const packageCards = PACKAGE_CARDS;
  const addonCards = ADDON_CARDS;

  /* ---------------------------------------------------------------- screen 2 */
  if (screen === "confidentiality") {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl border border-border bg-card p-6 md:p-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
            <UserLock className="h-9 w-9 text-accent-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Confidentiality Options</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            All buyers must accept our platform confidentiality agreement before they can access
            confidential listing information. Otherwise, only public listing details will be
            visible.
          </p>
        </div>

        {/* The design names the two packages this offer belongs to rather than
            the one in hand — this screen is only reached on Starter or
            Premium, so it reads as the rule it is. */}
        <div className="mt-8 rounded-2xl bg-muted/40 p-4 text-sm">
          Because you have selected a{" "}
          <span className="font-semibold">Starter or Premium package</span>, you can
          additionally choose to manually approve buyers.
        </div>

        <div className="mt-6 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            {/* The chevron in the design does something: it folds the two
                explanations away once they have been read. */}
            <button
              type="button"
              onClick={() => setApproveOpen((shown) => !shown)}
              aria-expanded={approveOpen}
              className="flex items-center gap-2 text-base font-semibold"
            >
              Approve Buyers Manually
              {approveOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <Switch
              id="approve-buyers"
              checked={approveBuyersManually}
              onCheckedChange={setApproveBuyersManually}
            />
          </div>

          {approveOpen && (
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
          )}
        </div>

        {/* One button, as the design has it. Going back is the sidebar's job —
            its step list is clickable, and picking Packages there brings this
            component back to its first screen. */}
        <div className="mt-8">
          <Button
            onClick={() => setScreen("agreement")}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 w-full font-semibold"
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
            <LockNew className="h-9 w-9" />
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

          {/* In the design and missing here. There is no terms page on the
              platform to link to — the footer's own "Terms Conditions" points
              at "#" — so it opens what the seller is agreeing to rather than
              pointing at a page that does not exist. */}
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="mt-4 text-sm font-medium underline underline-offset-2"
          >
            View Full Terms
          </button>
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

        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Seller Agreement — Full Terms</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="m-0">By publishing a listing on this platform, you agree to:</p>
              <ul className="m-0 list-disc space-y-1.5 pl-5">
                <li>Keep all communication with buyers confidential.</li>
                <li>Not contact buyers outside the platform.</li>
                <li>Conduct all communication through the EX Platform.</li>
              </ul>
              <p className="m-0">
                Breaching these terms may result in listing removal, account suspension,
                legal action, and other remedies available under our Terms and Conditions.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-8">
          <Button
            onClick={handleAcceptAndCheckout}
            disabled={!agreementAccepted || isSubmitting}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-12 w-full font-semibold"
          >
            {/*
              * Minimum costs nothing, so there is no checkout to go to — the
              * listing is activated the moment it is chosen. Promising a
              * checkout and then publishing is a small lie the seller notices.
              */}
            {isSubmitting
              ? "Please wait..."
              : isPaidPackage
                ? "Accept & Go to Checkout"
                : "Accept & Publish Listing"}
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

      {/*
        * Minimum, Premium, Starter — Premium in the middle.
        *
        * Display order only; the shared list keeps its own order because the
        * Manage Subscription page reads the same data.
        */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
        {(["MINIMUM", "PREMIUM", "STARTER"] as PackageId[])
          .map((id) => packageCards.find((entry) => entry.id === id))
          .filter((card): card is (typeof packageCards)[number] => Boolean(card))
          .map((card) => {
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
                className="relative cursor-pointer rounded-2xl p-6 transition-colors"
                style={{
                  // Premium is the card being sold, so it is lime whatever is
                  // selected — the selection shows as a dark outline instead.
                  background: isPremium ? LIME : "#FFFFFF",
                  border: isSelected ? "2px solid #000000" : "1px solid #E9EBF2",
                }}
              >
                {/* The name in a dark pill, top left, as the design has it. */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                  style={{ fontFamily: "Lufga" }}
                >
                  {card.id === "MINIMUM" ? (
                    <Dot className="h-4 w-4" />
                  ) : card.id === "STARTER" ? (
                    <Rocket className="h-3 w-3" />
                  ) : (
                    <Crown className="h-3 w-3" />
                  )}
                  {PACKAGE_LABELS[card.id]}
                </span>
                <p className="mt-3 text-sm text-black/60">{card.blurb}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{formatUsd(price)}</span>
                  <span className="ml-1 text-sm text-black/50">/monthly</span>
                </div>
                <div className="mt-4 space-y-2">
                  {card.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                {/*
                * Still a div, not a button.
                *
                * The whole card is the click target and always has been; a
                * real button inside it would fire the selection twice.
                */}
                <div
                  className="mt-5 rounded-full py-2.5 text-center text-sm font-semibold"
                  style={{
                    background: isSelected ? "#000000" : LIME,
                    color: isSelected ? "#FFFFFF" : "#000000",
                  }}
                >
                  {isSelected ? "Selected" : "Select"}
                </div>

                {/*
                * The billing cycle lives inside the card it belongs to.
                *
                * It was a full-width panel under all three, which is not what
                * the design shows — and it read as a separate question rather
                * than part of the package being bought. Minimum is free, so it
                * has nothing to bill and shows none of this.
                *
                * The condition and the handler are the ones that were here
                * before; only where it renders has changed.
                */}
                {isSelected && card.id !== "MINIMUM" && (
                  <BillingCycleChooser
                    value={selection.billingCycle}
                    onChange={(cycle) =>
                      setSelection((prev) => ({ ...prev, billingCycle: cycle }))
                    }
                  />
                )}
              </div>
            );
          })}
      </div>

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
                className="relative cursor-pointer rounded-2xl p-5 transition-colors"
                style={{
                  // The bundle is the one being recommended, so it carries the
                  // lime whatever is selected — as on the packages above.
                  background: isBundle ? LIME : "#FFFFFF",
                  border: isSelected ? "2px solid #000000" : "1px solid #E9EBF2",
                }}
              >
                {isBundle && (
                  <div className="mb-2 inline-flex rounded-full bg-black px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    Best Option
                  </div>
                )}
                <div className="text-2xl font-bold">
                  {formatUsd(getAddonPrice(tier, addon.id))}
                  <span className="ml-1 text-xs font-normal text-black/50">/monthly</span>
                </div>
                {/* A radio beside the name: the add-ons are one choice, not
                    three switches, and the design shows them that way. */}
                <h3 className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border"
                    style={{ borderColor: "#000000", borderWidth: isSelected ? "4px" : "1px" }}
                    aria-hidden
                  />
                  {ADDON_LABELS[addon.id as Exclude<AddonId, "NONE">]}
                </h3>
                <p className="mt-1 text-xs text-black/55">{addon.description}</p>
                <div
                  className="mt-4 rounded-full py-2 text-center text-sm font-semibold"
                  style={{
                    background: isSelected ? "#000000" : LIME,
                    color: isSelected ? "#FFFFFF" : "#000000",
                  }}
                >
                  {isSelected ? "Selected" : "Select"}
                </div>

                {/*
                  * The add-on's own billing cycle.
                  *
                  * The client asked for it explicitly, and it is the same
                  * control the package above uses — the add-on had no cycle
                  * at all before, only a fixed monthly charge.
                  */}
                {isSelected && (
                  <BillingCycleChooser
                    value={selection.addonBillingCycle}
                    onChange={(cycle) =>
                      setSelection((prev) => ({ ...prev, addonBillingCycle: cycle }))
                    }
                  />
                )}
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
        {/* Always pressable. It used to be held closed until a package was
            picked, and a press on a closed button does nothing — no message
            about empty fields or about the package, only silence. */}
        <Button
          onClick={handleNextStep}
          disabled={isSubmitting}
          title={selection.packageId ? undefined : "Choose a package to continue"}
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

      {/* The two panels the design shows under this step. Shared with the
          Manage Subscription page rather than copied. */}
      <TrustBand />
      <WhyPanel audience="SELLER" />
    </div>
  );
};

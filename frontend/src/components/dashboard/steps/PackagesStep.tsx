import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { normalizeDomainAnswer } from "@/lib/domainUtils";
import { serializeMediaUrls } from "@/lib/mediaUtils";
import { isQuestionHidden, isQuestionRequired } from "@/lib/questionRequired";
import { financialsComplete, REQUIRED_FIELDS_MESSAGE } from "@/lib/listingPublishCheck";
import { usePlans } from "@/hooks/usePlans";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
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
import {
  LISTING_PUBLISH_PENDING_SESSION_KEY,
  clearGuestListingPayload,
  clearServerDraft,
  readServerDraft,
  saveGuestListingPayload,
} from "@/lib/listingGuestSession";
import { ADDON_CARDS, PACKAGE_CARDS } from "@/lib/packageContent";
import { TrustBand, WhyPanel } from "@/components/marketing/TrustAndWhy";
import {
  AddonPlanCard,
  AddonTray,
  BlackBadge,
  CardButton,
  CyclePanel,
  LIME,
  PackagePlanCard,
  PageButton,
  RenewNote,
  SuccessFeePill,
  SummaryTable,
  addonDisplayName,
  addonSurfaceColor,
  DesignToggle,
  UserLockDisc,
} from "@/components/packages/PlanCards";
import chevronDown from "@/assets/packages/chevron-down.svg";
import whenDisabled from "@/assets/packages/when-disabled.svg";
import whenEnabled from "@/assets/packages/when-enabled.svg";
import agreementLock from "@/assets/packages/agreement-lock.svg";
import agreementArrow from "@/assets/packages/agreement-arrow.svg";
import checkboxEmpty from "@/assets/packages/checkbox-empty.svg";

/* ------------------------------------------------ confidentiality, agreement */

/** The white card the Confidentiality and Seller Agreement screens sit in. */
const StepCard = ({ children }: { children: ReactNode }) => (
  <div
    className="mx-auto w-full max-w-[860px] rounded-[34px] bg-white px-[20px] py-[40px] md:px-[40px]"
    style={{ border: "0.8px solid rgba(0,0,0,0.1)" }}
  >
    {children}
  </div>
);

const StepButton = ({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="mt-[36px] flex h-[60px] w-full items-center justify-center rounded-full p-[10px] text-[16px] font-medium leading-[1.2] text-black disabled:opacity-60"
    style={{ fontFamily: "Lufga", background: LIME }}
  >
    {children}
  </button>
);

/** The design's square box; ticked, it fills black. */
const DesignCheckbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label="I agree to the confidentiality terms"
    onClick={(event) => {
      // Inside a <label>: stop the label from sending a second click.
      event.preventDefault();
      onChange(!checked);
    }}
    className="relative block h-[21px] w-[21px] shrink-0"
  >
    {checked ? (
      <span className="flex h-full w-full items-center justify-center rounded-[4px] bg-black">
        <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} />
      </span>
    ) : (
      <img alt="" src={checkboxEmpty} className="block h-full w-full" aria-hidden />
    )}
  </button>
);

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
  /**
   * The body "create listing" takes, built from everything the steps
   * collected. Used to publish, and — for a guest — sent with the sign-up so
   * the server keeps the listing even if they confirm elsewhere or later.
   */
  const buildListingPayload = async (status: "DRAFT" | "PUBLISH") => {
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

    return listingPayload;
  };

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
        // Sent with the sign-up, so the server keeps it as a draft in the
        // account however long confirming takes and on whichever device.
        try {
          saveGuestListingPayload(await buildListingPayload("DRAFT"));
        } catch (error) {
          console.warn("Could not prepare the listing for sign-up; it still waits on this device.", error);
        }
        onGuestAuthOpenChange?.(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const listingPayload = await buildListingPayload(status);

      console.log("Transformed listing payload:", JSON.stringify(listingPayload, null, 2));

      console.log("Submitting listing:", listingPayload);

      // A guest's listing the server already keeps as a draft (made when the
      // account was confirmed) is published onto that draft, not created again.
      const targetId = listingId || readServerDraft();
      let response;
      if (targetId) {
        // Update existing listing
        response = await apiClient.updateListing(targetId, listingPayload);
      } else {
        // Create new listing
        response = await apiClient.createListing(listingPayload);
      }

      if (response.success) {
        clearDraftListing();
        clearServerDraft();
        clearGuestListingPayload();
        const statusMessage = listingId
          ? (status === 'PUBLISH'
            ? "Listing updated and published successfully!"
            : "Listing updated successfully!")
          : (status === 'PUBLISH'
            ? "Listing published successfully!"
            : "Listing created successfully! You can publish it later from My Listings.");
        toast.success(statusMessage);
        console.log(listingId ? "Updated listing:" : "Created listing:", response.data);

        const savedId = targetId || (response.data as any)?.id || null;
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
      <StepCard>
        <div className="flex flex-col items-center gap-[34px]">
          <UserLockDisc size={124} />
          <div className="flex flex-col items-center gap-[10px] text-center">
            <h1 className="m-0 text-[28px] font-medium leading-[1.2] text-black" style={{ fontFamily: "Lufga" }}>
              Confidentiality Options
            </h1>
            <p
              className="m-0 max-w-[590px] text-[17px] leading-[1.5]"
              style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}
            >
              All buyers must accept our platform confidentiality agreement before they can access
              confidential listing information. Otherwise, only public listing details will be
              visible.
            </p>
          </div>
        </div>

        <div className="mt-[36px] flex flex-col gap-[17px]">
          {/* The design names the two packages this offer belongs to rather than
              the one in hand — this screen is only reached on Starter or
              Premium, so it reads as the rule it is. */}
          <div className="rounded-[24px] bg-[#FAFAFA] p-[20px]">
            <p className="m-0 text-[17px] leading-[1.5]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}>
              Because you have selected a{" "}
              <span className="font-medium" style={{ color: "rgba(0,0,0,0.8)" }}>
                Starter or Premium package,
              </span>{" "}
              you can additionally choose to manually approve buyers.
            </p>
          </div>

          <div className="flex flex-col gap-[17px] rounded-[24px] bg-[#FAFAFA] p-[20px]">
            <div className="flex items-center justify-between gap-4">
              {/* The chevron folds the two explanations away once read. */}
              <button
                type="button"
                onClick={() => setApproveOpen((shown) => !shown)}
                aria-expanded={approveOpen}
                className="flex items-center gap-[9px] text-left"
              >
                <span className="text-[17px] font-medium leading-[1.5] text-black" style={{ fontFamily: "Lufga" }}>
                  Approve Buyers Manually
                </span>
                <img
                  alt=""
                  src={chevronDown}
                  className="block h-[20px] w-[20px] transition-transform"
                  style={{ transform: approveOpen ? "rotate(180deg)" : undefined }}
                  aria-hidden
                />
              </button>
              <DesignToggle
                id="approve-buyers"
                checked={approveBuyersManually}
                onChange={setApproveBuyersManually}
                label="Approve Buyers Manually"
              />
            </div>

            {approveOpen && (
              <div className="grid grid-cols-1 gap-[10px] rounded-[24px] bg-white p-[14px] md:grid-cols-2">
                <div className="flex flex-col gap-[5px] rounded-[20px] bg-[#FAFAFA] p-[14px]">
                  <div className="flex items-center gap-[7px]">
                    <img alt="" src={whenDisabled} className="block h-[17px] w-[17px]" aria-hidden />
                    <span className="text-[15.5px] font-medium leading-[1.5] text-black" style={{ fontFamily: "Lufga" }}>
                      When Disabled
                    </span>
                  </div>
                  <p className="m-0 text-[14px] leading-[1.5]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}>
                    Buyers can access confidential listing details immediately after accepting the
                    official confidentiality agreement provided by the Company Exchange Marketplace.
                  </p>
                </div>
                <div className="flex flex-col gap-[5px] rounded-[20px] bg-[#FAFAFA] p-[14px]">
                  <div className="flex items-center gap-[7px]">
                    <img alt="" src={whenEnabled} className="block h-[20px] w-[20px]" aria-hidden />
                    <span className="text-[15.5px] font-medium leading-[1.5] text-black" style={{ fontFamily: "Lufga" }}>
                      When Enabled
                    </span>
                  </div>
                  <p className="m-0 text-[14px] leading-[1.5]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}>
                    Buyers must first accept our confidentiality agreement and then be approved by you
                    before they can access confidential listing details. This option may significantly
                    slow down the sales process and is generally not recommended unless you wish to
                    personally review buyers or require an additional NDA.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* One button, as the design has it. Going back is the sidebar's job —
            its step list is clickable, and picking Packages there brings this
            component back to its first screen. */}
        <StepButton onClick={() => setScreen("agreement")}>Next Step</StepButton>
      </StepCard>
    );
  }

  /* ---------------------------------------------------------------- screen 3 */
  if (screen === "agreement") {
    return (
      <StepCard>
        <div className="flex flex-col items-center gap-[60px]">
          <img alt="" src={agreementLock} className="block h-[124px] w-[124px]" aria-hidden />
          <div className="flex flex-col items-center gap-[10px] text-center">
            <h1 className="m-0 text-[28px] font-medium leading-[1.2] text-black" style={{ fontFamily: "Lufga" }}>
              Seller Agreement
            </h1>
            <p
              className="m-0 max-w-[600px] text-[17px] leading-[1.5]"
              style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}
            >
              You are about to publish your listing. Before your listing can go live, you must accept
              our seller agreement.
            </p>
          </div>
        </div>

        <div className="mt-[36px] flex flex-col gap-[27px]">
          <div className="flex flex-col gap-[17px] rounded-[24px] bg-[#FAFAFA] p-[20px]">
            <div className="flex flex-col gap-[18px]">
              <p className="m-0 text-[17px] font-medium leading-[1.5] text-black" style={{ fontFamily: "Lufga" }}>
                By continuing, you agree to:
              </p>
              <ul className="m-0 flex list-none flex-col gap-[14px] p-0">
                {[
                  "Keep all communication confidential",
                  "Not contact buyers outside the platform",
                  "Conduct all communication through the EX Platform",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-[14px]">
                    <img alt="" src={agreementArrow} className="block h-[7.5px] w-[14px] shrink-0" aria-hidden />
                    <span className="text-[15.5px] leading-[1.5]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.8)" }}>
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* There is no terms page on the platform to link to — the footer's
                own "Terms Conditions" points at "#" — so it opens what the
                seller is agreeing to rather than a page that does not exist. */}
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="w-fit text-left text-[15.5px] font-semibold leading-[1.5] underline underline-offset-2"
              style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.8)" }}
            >
              View Full Terms
            </button>
          </div>

          <div className="flex flex-col gap-[17px]">
            <label className="flex w-fit cursor-pointer items-center gap-[10px]">
              <DesignCheckbox checked={agreementAccepted} onChange={setAgreementAccepted} />
              <span className="text-[17px] font-medium leading-[1.5] text-black" style={{ fontFamily: "Lufga" }}>
                I agree to the confidentiality terms
              </span>
            </label>
            <p className="m-0 text-[15.5px] leading-[1.5]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}>
              Breaching these terms may result in listing removal, account suspension, legal action, and
              other remedies available under our Terms and Conditions.
            </p>
          </div>
        </div>

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

        <StepButton onClick={handleAcceptAndCheckout} disabled={!agreementAccepted || isSubmitting}>
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
        </StepButton>
      </StepCard>
    );
  }

  /* ---------------------------------------------------------------- screen 1 */
  return (
    <div className="mx-auto flex w-full max-w-[1408px] flex-col gap-[24px]">
      <div
        className="flex w-full flex-col items-center gap-[34px] rounded-[34px] bg-white px-[20px] py-[32px] md:px-[40px]"
        style={{ border: "0.8px solid rgba(0,0,0,0.1)" }}
      >
        <div className="flex flex-col items-center gap-[7px] text-center">
          <h1 className="m-0 text-[28px] font-medium leading-[1.4] text-black" style={{ fontFamily: "Lufga" }}>
            Packages and Options
          </h1>
          <p className="m-0 text-[15.5px] leading-[1.4]" style={{ fontFamily: "Lufga", color: "rgba(0,0,0,0.5)" }}>
            Select your billing option and optional add-ons
            <br />
            Note: Selling a business typically takes 3–6 months
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-[13px]">
          <SuccessFeePill percent={overview.successFeePercent} info={SUCCESS_FEE_INFO_TEXT} />

          {/*
            * Minimum, Premium, Starter — Premium in the middle, and lime whatever
            * is chosen, because it is the one being sold.
            *
            * The whole card is the click target. A package that bills shows its
            * billing cycles in place of the button once chosen, as the design
            * has it; Minimum is free and has nothing to bill.
            */}
          <div className="grid w-full grid-cols-1 items-start gap-[14px] md:grid-cols-3">
            {(["MINIMUM", "PREMIUM", "STARTER"] as PackageId[])
              .map((id) => packageCards.find((entry) => entry.id === id))
              .filter((card): card is (typeof packageCards)[number] => Boolean(card))
              .map((card) => {
                const isSelected = selection.packageId === card.id;
                const isPremium = card.id === "PREMIUM";
                const showCycles = isSelected && card.id !== "MINIMUM";
                return (
                  <PackagePlanCard
                    key={card.id}
                    id={card.id}
                    blurb={card.blurb}
                    features={card.features}
                    price={`${Math.round(getPackageMonthlyPrice(tier, card.id))}$`}
                    highlighted={isPremium}
                    onClick={() =>
                      setSelection((prev) => ({
                        ...prev,
                        packageId: prev.packageId === card.id ? null : card.id,
                      }))
                    }
                    footer={
                      showCycles ? (
                        <CyclePanel
                          title="Select Billing Cycle"
                          value={selection.billingCycle}
                          onChange={(cycle) =>
                            setSelection((prev) => ({ ...prev, billingCycle: cycle }))
                          }
                          surface={isPremium ? LIME : "#FFFFFF"}
                        />
                      ) : (
                        <CardButton
                          asDiv
                          label={isSelected ? "Selected" : "Select"}
                          tone={isSelected || isPremium ? "dark" : "accent"}
                        />
                      )
                    }
                  />
                );
              })}
          </div>
        </div>

        <div className="flex w-full flex-col gap-[30px]">
          {/* Add-ons — a single choice; picking one replaces the other. Each has
              its own billing cycle, the same control the packages use. */}
          <AddonTray>
            {addonCards.map((addon) => {
              const isSelected = selection.addon === addon.id;
              const isBundle = addon.id === "BUNDLE";
              const surface = isBundle ? "lime" : addon.id === "START_PAGE" ? "grey" : "plain";
              return (
                <AddonPlanCard
                  key={addon.id}
                  price={formatUsd(getAddonPrice(tier, addon.id))}
                  name={addonDisplayName(addon.id)}
                  description={addon.description}
                  radioOn={isSelected}
                  surface={surface}
                  badge={isBundle ? <BlackBadge>Best Option</BlackBadge> : undefined}
                  onClick={() =>
                    setSelection((prev) => ({
                      ...prev,
                      addon: prev.addon === addon.id ? "NONE" : addon.id,
                    }))
                  }
                  footer={
                    isSelected ? (
                      <CyclePanel
                        title="Select Billing Cycle"
                        value={selection.addonBillingCycle}
                        onChange={(cycle) =>
                          setSelection((prev) => ({ ...prev, addonBillingCycle: cycle }))
                        }
                        surface={addonSurfaceColor(surface)}
                      />
                    ) : (
                      <CardButton asDiv size="addon" label="Select" tone={isBundle ? "dark" : "accent"} />
                    )
                  }
                />
              );
            })}
          </AddonTray>

          <SummaryTable
            rows={overview.lines.map((line) => ({
              key: line.key,
              item: line.item,
              cycle: line.billingCycleLabel,
              discount: line.discount > 0 ? `-${formatUsd(line.discount)} Discount` : "$0",
              total: formatUsd(line.total),
            }))}
            totalLabel="Amount Due Today"
            total={formatUsd(overview.amountDueToday)}
          />

          <div className="flex flex-col gap-[16px] sm:flex-row">
            <PageButton
              primary={false}
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting}
              className="sm:flex-1"
            >
              {isSubmitting ? "Saving..." : "Save as Draft"}
            </PageButton>
            {/* Always pressable. It used to be held closed until a package was
                picked, and a press on a closed button does nothing — no message
                about empty fields or about the package, only silence. */}
            <PageButton
              primary
              onClick={handleNextStep}
              disabled={isSubmitting}
              title={selection.packageId ? undefined : "Choose a package to continue"}
              className="sm:flex-1"
            >
              Next Step
            </PageButton>
          </div>
        </div>

        <RenewNote />
      </div>

      {/* The two panels the design shows under this step. Shared with the
          Manage Subscription page rather than copied. */}
      <TrustBand />
      <WhyPanel audience="SELLER" />
    </div>
  );
};

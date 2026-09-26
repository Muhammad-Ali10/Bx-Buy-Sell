import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackagesStep } from "./PackagesStep";
import { LISTING_PUBLISH_PENDING_SESSION_KEY } from "@/lib/listingGuestSession";
import * as draftListingStorage from "@/lib/draftListingStorage";
import { toast } from "sonner";

jest.mock("@/hooks/usePlans", () => ({
  usePlans: () => ({
    data: [{ id: "p1", title: "Free", price: "0", feature: [], description: "", type: "free" }],
    isLoading: false,
  }),
}));
/*
 * Whether the questions have arrived from the server.
 *
 * The step will not build a listing until they have — answers are written
 * against questions, and a listing built from empty lists loses every one — so
 * each question hook reports it, the way React Query does.
 */
// Read when a hook is called, never when the mock is built: the mocks are
// hoisted above this line.
let mockQuestionsLoaded = true;

jest.mock("@/hooks/useBrandQuestions", () => ({
  useBrandQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
jest.mock("@/hooks/useStatisticQuestions", () => ({
  useStatisticQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
jest.mock("@/hooks/useProductQuestions", () => ({
  useProductQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
jest.mock("@/hooks/useManagementQuestions", () => ({
  useManagementQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
// The step prices everything from the listing price, and refuses to draw the
// packages at all without one. These tests are about publishing, so the
// question the price is answered under has to be here.
jest.mock("@/hooks/useAdInformationQuestions", () => ({
  useAdInformationQuestions: () => ({
    data: [{ id: "q-price", question: "Listing Price" }],
    isFetched: mockQuestionsLoaded,
  }),
}));
const PRICED = { "q-price": "250000" };
/*
 * A listing with everything publishing asks for: its category, and a revenue
 * and a cost in the P&L. Without them "Next Step" stops at the list of empty
 * fields, which is right, but is not what these tests are about.
 */
const READY = {
  ...PRICED,
  category: "E-Commerce",
  financialType: "detailed",
  rowLabels: ["Revenue", "Cost of Goods"],
  columnLabels: [{ key: "2026", label: "2026", year: 2026, kind: "ytd", dataThrough: "01.06.2026" }],
  financialData: { Revenue: { "2026": "1000" }, "Cost of Goods": { "2026": "100" } },
};

/**
 * Publishing, the way a seller does it now: choose a package, Next Step,
 * tick the agreement, Accept. Minimum is free, so it goes straight to the
 * Seller Agreement and its button publishes rather than checking out.
 */
const publishThroughAgreement = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText("Everything you need to get started — with no upfront costs."));
  await user.click(screen.getByRole("button", { name: /^next step$/i }));
  await user.click(screen.getByRole("checkbox", { name: /i agree to the confidentiality terms/i }));
  await user.click(screen.getByRole("button", { name: /accept & publish listing/i }));
};
jest.mock("@/hooks/useHandoverQuestions", () => ({
  useHandoverQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
jest.mock("@/hooks/useAccounts", () => ({ useAccounts: () => ({ data: [] }) }));
jest.mock("@/hooks/useAccountQuestions", () => ({
  useAccountQuestions: () => ({ data: [], isFetched: mockQuestionsLoaded }),
}));
// The step asks which category the listing is in so the questions it checks
// are that category's. Without this the hook reaches for React Query, which
// this test deliberately does not set up.
jest.mock("@/hooks/useListingCategoryId", () => ({ useListingCategoryId: () => undefined }));

jest.mock("@/lib/api", () => ({
  apiClient: {
    getSubscriptionRules: jest.fn().mockResolvedValue({ success: true, data: { actions: {} } }),
    getSubscriptionRulesPreview: jest
      .fn()
      .mockResolvedValue({ success: true, data: { actions: {} } }),
    getCategories: jest.fn(),
    getTools: jest.fn(),
    createListing: jest.fn(),
    updateListing: jest.fn(),
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("PackagesStep guest listing flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    mockQuestionsLoaded = true;
  });

  /*
   * The client signed up from a listing, confirmed the account, and the listing
   * arrived with its category, tools and figures — and not one answer besides.
   * The publish ran the moment sign-up brought them back, before the questions
   * had come from the server, so it walked empty lists and wrote nothing.
   */
  it("waits for the questions before publishing after sign-up", async () => {
    const { apiClient } = require("@/lib/api");
    apiClient.getCategories.mockResolvedValue({ success: true, data: [] });
    apiClient.getTools.mockResolvedValue({ success: true, data: [] });
    apiClient.createListing.mockResolvedValue({ success: true, data: {} });
    mockQuestionsLoaded = false;

    const { rerender } = render(
      <PackagesStep formData={PRICED} onBack={() => {}} isGuest={false} resumePublishNonce={1} />
    );

    // Nothing is sent while the questions are still on their way.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(apiClient.createListing).not.toHaveBeenCalled();

    // Once they are in, the same resume goes ahead — once.
    mockQuestionsLoaded = true;
    rerender(
      <PackagesStep formData={PRICED} onBack={() => {}} isGuest={false} resumePublishNonce={1} />
    );
    await waitFor(() => {
      expect(apiClient.createListing).toHaveBeenCalledTimes(1);
    });
  });

  it("persists draft locally when guest saves as draft", async () => {
    const user = userEvent.setup();
    const onPersist = jest.fn();
    render(
      <PackagesStep
        formData={PRICED}
        onBack={() => {}}
        isGuest
        onGuestPersistDraft={onPersist}
        onGuestAuthOpenChange={jest.fn()}
      />
    );

    const saveDraftButtons = screen.getAllByRole("button", { name: /^save as draft$/i });
    await user.click(saveDraftButtons[saveDraftButtons.length - 1]);

    expect(onPersist).toHaveBeenCalledWith({});
    expect(toast.success).toHaveBeenCalled();
  });

  it("opens auth flow when guest publishes", async () => {
    const user = userEvent.setup();
    const onPersist = jest.fn();
    const onAuthOpen = jest.fn();
    render(
      <PackagesStep
        formData={READY}
        onBack={() => {}}
        isGuest
        onGuestPersistDraft={onPersist}
        onGuestAuthOpenChange={onAuthOpen}
      />
    );

    await publishThroughAgreement(user);

    expect(onPersist).toHaveBeenCalledWith({ pendingPublish: true });
    expect(sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY)).toBe("1");
    expect(onAuthOpen).toHaveBeenCalledWith(true);
  });

  it("does not set guest session flag when user is logged in", async () => {
    const user = userEvent.setup();
    const { apiClient } = require("@/lib/api");
    apiClient.getCategories.mockResolvedValue({ success: true, data: [] });
    apiClient.getTools.mockResolvedValue({ success: true, data: [] });
    apiClient.createListing.mockResolvedValue({ success: true, data: {} });

    render(<PackagesStep formData={READY} onBack={() => {}} />);

    await publishThroughAgreement(user);

    // Signed in, it publishes for real instead of waiting for an account.
    await waitFor(() => expect(apiClient.createListing).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY)).toBeNull();
  });

  it("submits listing when resumePublishNonce increments after authentication", async () => {
    const clearSpy = jest.spyOn(draftListingStorage, "clearDraftListing");
    const { apiClient } = require("@/lib/api");
    apiClient.getCategories.mockResolvedValue({ success: true, data: [] });
    apiClient.getTools.mockResolvedValue({ success: true, data: [] });
    apiClient.createListing.mockResolvedValue({ success: true, data: {} });

    const { rerender } = render(
      <PackagesStep formData={PRICED} onBack={() => {}} isGuest={false} resumePublishNonce={0} />
    );

    rerender(
      <PackagesStep formData={PRICED} onBack={() => {}} isGuest={false} resumePublishNonce={1} />
    );

    await waitFor(() => {
      expect(apiClient.createListing).toHaveBeenCalled();
    });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

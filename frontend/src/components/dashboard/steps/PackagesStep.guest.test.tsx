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
jest.mock("@/hooks/useBrandQuestions", () => ({ useBrandQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useStatisticQuestions", () => ({ useStatisticQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useProductQuestions", () => ({ useProductQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useManagementQuestions", () => ({ useManagementQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useAdInformationQuestions", () => ({ useAdInformationQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useHandoverQuestions", () => ({ useHandoverQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useAccounts", () => ({ useAccounts: () => ({ data: [] }) }));
jest.mock("@/hooks/useAccountQuestions", () => ({ useAccountQuestions: () => ({ data: [] }) }));

jest.mock("@/lib/api", () => ({
  apiClient: {
    getSubscriptionRules: jest.fn().mockResolvedValue({ success: true, data: { actions: {} } }),
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
  });

  it("persists draft locally when guest saves as draft", async () => {
    const user = userEvent.setup();
    const onPersist = jest.fn();
    render(
      <PackagesStep
        formData={{}}
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
        formData={{}}
        onBack={() => {}}
        isGuest
        onGuestPersistDraft={onPersist}
        onGuestAuthOpenChange={onAuthOpen}
      />
    );

    await user.click(screen.getAllByText("Publish Now")[0]);
    await user.click(screen.getByRole("button", { name: /publish listing/i }));

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

    render(<PackagesStep formData={{}} onBack={() => {}} />);

    await user.click(screen.getAllByText("Publish Now")[0]);
    await user.click(screen.getByRole("button", { name: /publish listing/i }));

    expect(sessionStorage.getItem(LISTING_PUBLISH_PENDING_SESSION_KEY)).toBeNull();
  });

  it("submits listing when resumePublishNonce increments after authentication", async () => {
    const clearSpy = jest.spyOn(draftListingStorage, "clearDraftListing");
    const { apiClient } = require("@/lib/api");
    apiClient.getCategories.mockResolvedValue({ success: true, data: [] });
    apiClient.getTools.mockResolvedValue({ success: true, data: [] });
    apiClient.createListing.mockResolvedValue({ success: true, data: {} });

    const { rerender } = render(
      <PackagesStep formData={{}} onBack={() => {}} isGuest={false} resumePublishNonce={0} />
    );

    rerender(
      <PackagesStep formData={{}} onBack={() => {}} isGuest={false} resumePublishNonce={1} />
    );

    await waitFor(() => {
      expect(apiClient.createListing).toHaveBeenCalled();
    });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManualApprovalLockedDialog } from "./ManualApprovalLockedDialog";
import { ConfidentialAccessRequests } from "./ConfidentialAccessRequests";
import { showsPremiumBadge } from "@/lib/packageContent";

jest.mock("@/lib/api", () => ({
  apiClient: {
    disableManualApproval: jest.fn(),
    getConfidentialRequests: jest.fn(),
    approveConfidentialAccess: jest.fn(),
    declineConfidentialAccess: jest.fn(),
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const { apiClient } = jest.requireMock("@/lib/api");

/**
 * The client: when a paid package lapses the seller still sees confidential
 * requests but cannot answer them — Accept or Decline opens this dialog, which
 * offers an upgrade or carrying on without manual approval.
 */
describe("the dialog a seller sees once their package has lapsed", () => {
  beforeEach(() => jest.clearAllMocks());

  const open = (onSwitchedOff = jest.fn()) =>
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
          <Route
            path="/chat"
            element={
              <ManualApprovalLockedDialog
                open
                onOpenChange={() => {}}
                listingId="listing-1"
                onSwitchedOff={onSwitchedOff}
              />
            }
          />
          <Route path="/manage-subscription/:listingId" element={<p>Manage page</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("says why, in the design's words", () => {
    open();
    expect(screen.getByText("Confidentiality Options")).toBeInTheDocument();
    expect(screen.getByText("Minimum Plan.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /approve buyers manually/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("changes nothing when Save is pressed with the switch still on", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(apiClient.disableManualApproval).not.toHaveBeenCalled();
  });

  it("switches manual approval off on Save", async () => {
    const user = userEvent.setup();
    const onSwitchedOff = jest.fn();
    apiClient.disableManualApproval.mockResolvedValue({ success: true, data: { approved: 2 } });
    open(onSwitchedOff);

    await user.click(screen.getByRole("switch", { name: /approve buyers manually/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(apiClient.disableManualApproval).toHaveBeenCalledWith("listing-1"));
    expect(onSwitchedOff).toHaveBeenCalledWith(2);
  });

  it("takes the seller to Manage Your Subscription to upgrade", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /upgrade to use this function/i }));
    expect(screen.getByText("Manage page")).toBeInTheDocument();
  });
});

describe("the requests list", () => {
  beforeEach(() => jest.clearAllMocks());

  const renderList = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ConfidentialAccessRequests />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const request = (approvalLocked: boolean) => ({
    id: "r1",
    listingId: "listing-1",
    listing: { advertisement: [], brand: [] },
    chatId: "chat-1",
    requestedAt: new Date().toISOString(),
    approvalLocked,
    buyer: { id: "buyer-1", first_name: "Daniel", last_name: "Brooks" },
  });

  it("opens the dialog on Accept for a lapsed package, and sends nothing", async () => {
    const user = userEvent.setup();
    apiClient.getConfidentialRequests.mockResolvedValue({ success: true, data: [request(true)] });
    renderList();

    await user.click(await screen.findByRole("button", { name: /approve daniel brooks/i }));

    expect(await screen.findByText("Confidentiality Options")).toBeInTheDocument();
    expect(apiClient.approveConfidentialAccess).not.toHaveBeenCalled();
  });

  it("opens it on Decline too", async () => {
    const user = userEvent.setup();
    apiClient.getConfidentialRequests.mockResolvedValue({ success: true, data: [request(true)] });
    renderList();

    await user.click(await screen.findByRole("button", { name: /decline daniel brooks/i }));

    expect(await screen.findByText("Confidentiality Options")).toBeInTheDocument();
    expect(apiClient.declineConfidentialAccess).not.toHaveBeenCalled();
  });

  it("opens it when the server refuses because the package lapsed meanwhile", async () => {
    const user = userEvent.setup();
    apiClient.getConfidentialRequests.mockResolvedValue({ success: true, data: [request(false)] });
    apiClient.approveConfidentialAccess.mockResolvedValue({
      success: false,
      error: "Your package has expired.",
      code: "PACKAGE_REQUIRED",
    });
    renderList();

    await user.click(await screen.findByRole("button", { name: /approve daniel brooks/i }));

    expect(await screen.findByText("Confidentiality Options")).toBeInTheDocument();
  });
});

describe("the Premium badge", () => {
  it("shows only while the Premium package runs", () => {
    expect(showsPremiumBadge({ selectedPackage: "PREMIUM", packageActive: true })).toBe(true);
    // Visitors are never sent packageActive; a lapsed package reaches them as Minimum.
    expect(showsPremiumBadge({ selectedPackage: "PREMIUM" })).toBe(true);
    expect(showsPremiumBadge({ selectedPackage: "PREMIUM", packageActive: false })).toBe(false);
    expect(showsPremiumBadge({ selectedPackage: "MINIMUM" })).toBe(false);
    expect(showsPremiumBadge(null)).toBe(false);
  });
});

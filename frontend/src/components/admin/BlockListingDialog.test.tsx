jest.mock("@/lib/api", () => ({ apiClient: { updateListing: jest.fn() } }));
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "@/lib/api";
import { BlockListingDialog } from "./BlockListingDialog";

/**
 * "Blocking a listing must only affect that one listing, never the user's
 * account" — and the owner is shown why, so there has to be a why.
 */
describe("BlockListingDialog", () => {
  const renderDialog = (onBlocked = jest.fn(), onOpenChange = jest.fn()) =>
    render(
      <BlockListingDialog
        listingId="l1"
        listingTitle="Beauty Online Shop"
        open
        onOpenChange={onOpenChange}
        onBlocked={onBlocked}
      />,
    );

  beforeEach(() => {
    (apiClient.updateListing as jest.Mock).mockReset();
  });

  it("will not block without a reason", () => {
    renderDialog();
    const button = screen.getByRole("button", { name: "Block listing" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "   " } });
    expect(button).toBeDisabled();
  });

  it("blocks the listing, not the account, with the reason given", async () => {
    (apiClient.updateListing as jest.Mock).mockResolvedValue({ success: true, data: {} });
    const onBlocked = jest.fn();
    const onOpenChange = jest.fn();
    renderDialog(onBlocked, onOpenChange);

    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "  The revenue figures do not match.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Block listing" }));

    await waitFor(() => expect(onBlocked).toHaveBeenCalled());
    expect(apiClient.updateListing).toHaveBeenCalledWith("l1", {
      status: "BLOCKED",
      blockedReason: "The revenue figures do not match.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open when the save fails", async () => {
    (apiClient.updateListing as jest.Mock).mockResolvedValue({ success: false, error: "Nope" });
    const onBlocked = jest.fn();
    const onOpenChange = jest.fn();
    renderDialog(onBlocked, onOpenChange);

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Block listing" }));

    await waitFor(() => expect(apiClient.updateListing).toHaveBeenCalled());
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackagesStep } from "./PackagesStep";

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
jest.mock("@/hooks/useHandoverQuestions", () => ({ useHandoverQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useAccounts", () => ({ useAccounts: () => ({ data: [] }) }));
jest.mock("@/hooks/useAccountQuestions", () => ({ useAccountQuestions: () => ({ data: [] }) }));
jest.mock("@/hooks/useListingCategoryId", () => ({ useListingCategoryId: () => "cat-1" }));
jest.mock("@/hooks/useAdInformationQuestions", () => ({
  useAdInformationQuestions: () => ({ data: [] }),
}));

jest.mock("@/lib/api", () => ({
  apiClient: {
    getSubscriptionRules: jest.fn().mockResolvedValue({ success: true, data: { actions: {} } }),
    getCategories: jest.fn(),
    getTools: jest.fn(),
    createListing: jest.fn(),
    updateListing: jest.fn(),
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

/**
 * "I get the following error message when I try to jump to the Packages
 * section via the left-hand menu… the listing price is clearly filled out."
 *
 * The sidebar no longer refuses the step, so this screen is what a seller who
 * really has no price sees. It has to say why, and let them back out.
 */
describe("Packages with no listing price", () => {
  it("explains what is missing instead of a blank screen", () => {
    render(<PackagesStep formData={{}} onBack={() => {}} />);

    expect(
      screen.getByText(/Please enter a listing price before accessing the Packages section/),
    ).toBeInTheDocument();
  });

  it("is not a dead end", async () => {
    const onBack = jest.fn();
    render(<PackagesStep formData={{}} onBack={onBack} />);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });
});

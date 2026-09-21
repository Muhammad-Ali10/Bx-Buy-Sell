import { fireEvent, render, screen } from "@testing-library/react";

import AcquisitionCapacityCard from "./AcquisitionCapacityCard";
import { ACQUISITION_CAPACITY_INFO } from "@/lib/acquisitionCapacity";

/**
 * The client could not read the explanation behind the ⓘ in the chat's
 * Details panel: it was the browser's `title`, which a tap never opens.
 */
describe("the Acquisition Capacity ⓘ", () => {
  it("shows the explanation when tapped", async () => {
    render(<AcquisitionCapacityCard verifiedFunds={50_000} listingPrice={100_000} />);
    expect(screen.queryByText(/based on the buyer's verified capital/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "What Acquisition Capacity means" }));

    const shown = await screen.findAllByText(ACQUISITION_CAPACITY_INFO);
    expect(shown.length).toBeGreaterThan(0);
  });

  it("closes again on a second tap", async () => {
    render(<AcquisitionCapacityCard verifiedFunds={null} listingPrice={100_000} />);
    const info = screen.getByRole("button", { name: "What Acquisition Capacity means" });

    fireEvent.click(info);
    await screen.findAllByText(ACQUISITION_CAPACITY_INFO);
    fireEvent.click(info);

    expect(screen.queryAllByText(ACQUISITION_CAPACITY_INFO)).toHaveLength(0);
  });
});

import { render, screen } from "@testing-library/react";
import { PrefixedNumberInput } from "./PrefixedNumberInput";

/**
 * "When I select CHF it's not responsive": the currency was written over the
 * seller's own number, because the field always kept the same 36px for it.
 */
describe("PrefixedNumberInput", () => {
  const paddingFor = (prefix?: string) => {
    const { unmount } = render(<PrefixedNumberInput prefix={prefix} placeholder="Enter a number" />);
    const field = screen.getByPlaceholderText("Enter a number");
    const padding = parseFloat(field.style.paddingLeft || "0");
    unmount();
    return padding;
  };

  it("leaves more room for a currency written as a code than for a single sign", () => {
    expect(paddingFor("CHF")).toBeGreaterThan(paddingFor("$"));
    expect(paddingFor("kr")).toBeGreaterThan(paddingFor("%"));
  });

  it("shows the label and keeps the number clear of it", () => {
    render(<PrefixedNumberInput prefix="CHF" placeholder="Enter a number" />);

    expect(screen.getByText("CHF")).toBeInTheDocument();
    // Where the label starts, plus its width, plus a gap.
    expect(parseFloat(screen.getByPlaceholderText("Enter a number").style.paddingLeft)).toBeGreaterThanOrEqual(50);
  });

  it("leaves a field without a label alone", () => {
    render(<PrefixedNumberInput placeholder="Enter a number" />);

    expect(screen.getByPlaceholderText("Enter a number").style.paddingLeft).toBe("");
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OffMarketCard, offMarketProgress } from "./OffMarketCard";

const listing = (overrides: Record<string, unknown> = {}) => ({
  id: "l1",
  daysRemaining: 21,
  locked: true,
  category: [{ name: "E-Commerce" }],
  advertisement: [
    { question: "Title", answer: "E-commerce Store" },
    { question: "Description", answer: "Easily manage your listings with images, pricing and status." },
    { question: "Listing price", answer: "12000" },
  ],
  brand: [{ question: "Country", answer: "India" }],
  ...overrides,
});

const renderCard = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <OffMarketCard listing={listing(props)} />
    </MemoryRouter>,
  );

/**
 * The off-market card, as the client's design shows it: the whole listing card
 * behind a lock and a countdown to the day it goes public.
 */
describe("OffMarketCard", () => {
  it("shows the countdown and the whole card when the server sends the listing", () => {
    renderCard();

    expect(screen.getByText(/Off-Market Ends in/)).toBeInTheDocument();
    expect(screen.getByText("21 days")).toBeInTheDocument();
    expect(screen.getByText("E-commerce Store")).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getByText("Location:")).toBeInTheDocument();
    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("Business Age:")).toBeInTheDocument();
    expect(screen.getByText("Net Profit:")).toBeInTheDocument();
    expect(screen.getByText("Revenue:")).toBeInTheDocument();
  });

  it("sends a member without early access to the plans, and one with it to the listing", () => {
    const { unmount } = renderCard();
    expect(screen.getByRole("link", { name: "View Listing" })).toHaveAttribute("href", "/manage-subscription");
    expect(screen.getByRole("link", { name: "Contact Seller" })).toHaveAttribute("href", "/manage-subscription");
    unmount();

    renderCard({ locked: false });
    expect(screen.getByRole("link", { name: "View Listing" })).toHaveAttribute("href", "/listing/l1");
    expect(screen.getByRole("link", { name: "Contact Seller" })).toHaveAttribute("href", "/listing/l1?contact=1");
  });

  it("makes do with the category and price from an older server", () => {
    renderCard({ advertisement: undefined, brand: undefined, askingPrice: 600, daysRemaining: 1 });

    expect(screen.getByText("E-Commerce")).toBeInTheDocument();
    expect(screen.getByText("$600")).toBeInTheDocument();
    expect(screen.getByText("1 day")).toBeInTheDocument();
    expect(screen.queryByText("Location:")).toBeNull();
  });

  it("places the marker by how much of the off-market week has passed", () => {
    expect(offMarketProgress(7)).toBe(6);
    expect(offMarketProgress(21)).toBe(6);
    expect(offMarketProgress(1)).toBeCloseTo(85.71, 1);
    expect(offMarketProgress(-3)).toBe(94);
  });
});

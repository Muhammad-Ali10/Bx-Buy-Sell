// The API client reads `import.meta.env`, which this runner cannot parse, and
// the card pulls it in through its dialogs. Nothing here calls it.
jest.mock("@/lib/api", () => ({ apiClient: {} }));
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListingCardDashboard } from "./ListingCardDashboard";

/**
 * The seller's own cards show the description.
 *
 * It was absent from this card entirely — the page that builds these cards
 * dropped the field while mapping, so no amount of markup here could have
 * shown one. This checks the card end of that contract.
 */
const renderCard = (props: Record<string, unknown> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ListingCardDashboard
          id="l1"
          title="Beauty Online Shop For Sale"
          price={2011}
          status="published"
          managed_by_ex={false}
          created_at="2026-05-17T00:00:00.000Z"
          requests_count={0}
          unread_messages_count={0}
          onUpdate={() => {}}
          {...(props as any)}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ListingCardDashboard description", () => {
  it("shows the seller's description", () => {
    renderCard({ description: "A profitable online cosmetics shop." });
    expect(screen.getByText("A profitable online cosmetics shop.")).toBeInTheDocument();
  });

  it("shows nothing at all when there isn't one", () => {
    // The card closes up rather than printing a placeholder on the seller's
    // own dashboard, where they already know they have not written one.
    const { container } = renderCard({ description: "" });
    expect(screen.getByText("Beauty Online Shop For Sale")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Unknown");
    expect(container.textContent).not.toContain("No description");
  });

  it("treats whitespace as no description", () => {
    const { container } = renderCard({ description: "   " });
    expect(container.textContent).not.toContain("No description");
  });

  it("works when the prop is not passed at all", () => {
    // The admin page listed props one by one and would have omitted it.
    expect(() => renderCard()).not.toThrow();
  });
});

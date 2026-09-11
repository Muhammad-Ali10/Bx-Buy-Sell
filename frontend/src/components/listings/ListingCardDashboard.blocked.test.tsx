// The API client reads `import.meta.env`, which this runner cannot parse, and
// the card pulls it in through its dialogs. Nothing here calls it.
jest.mock("@/lib/api", () => ({ apiClient: {} }));
jest.mock("@/lib/apiBase", () => ({ apiBaseUrl: "http://api.test" }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListingCardDashboard } from "./ListingCardDashboard";

/**
 * "The owner can still see the listing there, but it shows a Blocked status
 * tag — same style and same position as the existing Draft and Published tags.
 * Please add there also the reason why the listing got blocked."
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

describe("ListingCardDashboard blocked", () => {
  it("shows the Blocked tag and the reason, in the open", () => {
    renderCard({ status: "blocked", blockedReason: "The revenue figures do not match." });
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("The revenue figures do not match.")).toBeInTheDocument();
  });

  it("still says it was blocked when no reason was recorded", () => {
    renderCard({ status: "blocked", blockedReason: null });
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText(/Blocked by our team/)).toBeInTheDocument();
  });

  it("says nothing about blocking on a published listing", () => {
    const { container } = renderCard({ status: "published" });
    expect(container.textContent).not.toContain("Blocked");
    expect(container.textContent).not.toContain("Reason:");
  });
});

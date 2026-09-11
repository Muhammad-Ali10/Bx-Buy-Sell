jest.mock("@/lib/api", () => ({ apiClient: { getActivityLogByUser: jest.fn() } }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { ActivityEntry } from "@/lib/activityLog";
import { MemberActivityLog } from "./MemberActivityLog";

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: "e1",
  action: "auth.sign-in",
  category: "security",
  message: "Signed in",
  createdAt: "2026-09-11T10:00:00.000Z",
  ipAddress: "203.0.113.7",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  entityType: "user",
  entityId: "member-1",
  actor: { id: "member-1", name: "Jane Doe", role: "USER" },
  subject: { id: "member-1", name: "Jane Doe", role: "USER" },
  ...overrides,
});

const page = (items: ActivityEntry[], nextBefore: string | null = null) => ({
  success: true,
  data: { items, nextBefore },
});

const renderLog = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberActivityLog memberId="member-1" />
    </QueryClientProvider>,
  );

/**
 * "Maybe you show there simply the logs from the user like (login, messages
 * sent, etc.)"
 */
describe("MemberActivityLog", () => {
  beforeEach(() => (apiClient.getActivityLogByUser as jest.Mock).mockReset());

  it("shows each sign-in with where it came from, and what the team did, by whom", async () => {
    (apiClient.getActivityLogByUser as jest.Mock).mockResolvedValue(
      page([
        entry(),
        entry({
          id: "e2",
          action: "team.account-blocked",
          category: "team",
          message: "Account blocked",
          ipAddress: null,
          userAgent: null,
          actor: { id: "admin-1", name: "hello rao0", role: "ADMIN" },
        }),
      ]),
    );
    renderLog();

    expect(await screen.findByText("Signed in")).toBeInTheDocument();
    expect(screen.getByText("IP 203.0.113.7")).toBeInTheDocument();
    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Account blocked")).toBeInTheDocument();
    expect(screen.getByText(/by hello rao0/)).toBeInTheDocument();
  });

  it("fetches the next page from where the last ended, and one kind at a time", async () => {
    (apiClient.getActivityLogByUser as jest.Mock)
      .mockResolvedValueOnce(page([entry()], "2026-09-11T10:00:00.000Z"))
      .mockResolvedValueOnce(page([entry({ id: "e0", message: "Signed out", action: "auth.sign-out" })]))
      .mockResolvedValue(page([]));
    renderLog();

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(apiClient.getActivityLogByUser).toHaveBeenLastCalledWith(
      "member-1",
      expect.objectContaining({ before: "2026-09-11T10:00:00.000Z" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    await waitFor(() =>
      expect(apiClient.getActivityLogByUser).toHaveBeenLastCalledWith(
        "member-1",
        expect.objectContaining({ category: "messages" }),
      ),
    );
    expect(await screen.findByText("Nothing recorded that matches these filters.")).toBeInTheDocument();
  });
});

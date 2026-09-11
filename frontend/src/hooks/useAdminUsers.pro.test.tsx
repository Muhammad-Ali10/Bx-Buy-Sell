jest.mock("@/lib/api", () => ({
  apiClient: { getAllUsers: jest.fn(), getListings: jest.fn() },
}));
jest.mock("@/lib/adminUserNotes", () => ({ getAdminUserNotes: () => ({}) }));

import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAdminUsers } from "./useAdminUsers";

/**
 * The users table marks PRO members from the plan that comes with each row of
 * /user: the Pro plan, while it is paid for.
 */
describe("useAdminUsers, marking PRO members", () => {
  it("marks members on an active Pro plan, and not Starter or an ended Pro plan", async () => {
    (apiClient.getAllUsers as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        { id: "pro", first_name: "On", last_name: "Pro", subscription: { status: "ACTIVE", plan: { slug: "pro", name: "Pro" } } },
        { id: "starter", first_name: "On", last_name: "Starter", subscription: { status: "ACTIVE", plan: { slug: "starter", name: "Starter" } } },
        { id: "ended", first_name: "Pro", last_name: "Ended", subscription: { status: "CANCELLED", plan: { slug: "pro", name: "Pro" } } },
        { id: "none", first_name: "No", last_name: "Plan", subscription: null },
      ],
    });
    (apiClient.getListings as jest.Mock).mockResolvedValue({ success: true, data: [] });

    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAdminUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const proById = Object.fromEntries((result.current.data ?? []).map((u) => [u.id, u.is_pro]));
    expect(proById).toEqual({ pro: true, starter: false, ended: false, none: false });
  });
});

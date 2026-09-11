jest.mock("@/lib/api", () => ({ apiClient: {} }));
jest.mock("@/components/admin/AdminSidebar", () => ({ AdminSidebar: () => null }));
jest.mock("@/components/admin/AdminHeader", () => ({ AdminHeader: () => null }));
jest.mock("@/components/admin/DuplicateAccountsNotice", () => ({
  DuplicateAccountsNotice: () => null,
}));
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1", role: "ADMIN" } }),
}));

let mockUsers: AdminUser[] = [];
jest.mock("@/hooks/useAdminUsers", () => ({
  useAdminUsers: () => ({ data: mockUsers, isLoading: false, error: null }),
}));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminUser } from "@/hooks/useAdminUsers";
import AdminUsers from "./AdminUsers";

const member = (overrides: Partial<AdminUser>): AdminUser => ({
  id: "u-0",
  email: "someone@example.com",
  phone: null,
  created_at: "2025-06-01T00:00:00.000Z",
  email_confirmed_at: null,
  phone_confirmed_at: null,
  last_sign_in_at: null,
  full_name: "Someone",
  avatar_url: null,
  user_type: "user",
  listings_count: 0,
  verified: null,
  blocked: false,
  blocked_reason: null,
  is_online: false,
  last_seen: null,
  is_pro: false,
  plan_name: null,
  note: null,
  ...overrides,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/admin/users"]}>
        <AdminUsers />
      </MemoryRouter>
    </QueryClientProvider>,
  );

/**
 * "When the user is a pro user the PRO label should be also placed there",
 * pointing at the member's photo in the users table.
 */
describe("AdminUsers, the PRO pill", () => {
  it("sits on a Pro member's photo and nobody else's", () => {
    mockUsers = [
      member({ id: "u-1", full_name: "hello naqvi", is_pro: true, plan_name: "Pro" }),
      member({ id: "u-2", full_name: "string string" }),
    ];
    renderPage();

    const pills = screen.getAllByText("Pro");
    expect(pills).toHaveLength(1);
    expect(screen.getByText("hello naqvi").closest("tr")).toContainElement(pills[0]);
  });
});

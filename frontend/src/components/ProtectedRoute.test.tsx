import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

const mockUseAuth = jest.fn();

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

/**
 * This app guards routes on the client (ProtectedRoute) rather than Next.js middleware.
 * These tests cover the same responsibility: only authenticated users reach protected UI.
 */
describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("shows loading spinner while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: true });
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false });
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });
});

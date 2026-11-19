import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
  useAccount: () => null,
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

import App from "@/App";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("App routing (SPA)", () => {
  it("renders the landing page at /", () => {
    renderAt("/");
    expect(screen.getByText("Best booking experience")).toBeInTheDocument();
  });
  it("renders the sign-in page at /login", () => {
    renderAt("/login");
    expect(screen.getByText("Welcome back.")).toBeInTheDocument();
  });
  it("redirects a signed-out visitor from /barbers to /login", () => {
    renderAt("/barbers");
    expect(screen.getByText("Welcome back.")).toBeInTheDocument();
  });
  it("shows the 404 page for unknown routes", () => {
    renderAt("/nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
  useAccount: () => null,
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
// Data calls fail fast in tests; pages must still render their shell.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {},
    from: () => {
      throw new Error("no network in tests");
    },
  },
}));

import App from "@/App";

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
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
  it("lets a signed-out visitor browse /barbers", () => {
    renderAt("/barbers");
    expect(screen.getByText("Find a barber who gets you.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
  });
  it.each(["/bookings", "/shop", "/shop/bookings"])(
    "redirects a signed-out visitor from %s to /login",
    (path) => {
      renderAt(path);
      expect(screen.getByText("Welcome back.")).toBeInTheDocument();
    },
  );
  it("shows the 404 page for unknown routes", () => {
    renderAt("/nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
  it("has no admin page", () => {
    renderAt("/admin");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});

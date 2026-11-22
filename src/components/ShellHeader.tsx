import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import { useProfile } from "@/hooks/useProfile";

/**
 * App header, role-based (profiles.role). Signed out: Browse barbers + Login.
 * Customer: Browse barbers, My bookings. Shop: Browse barbers, My shop,
 * Management (/shop/bookings), Orders (/shop/orders). "Booking" wording is customer-only.
 */
export function ShellHeader() {
  const user = useAccount();
  const { role, isLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    navigate("/login", { replace: true });
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "shell-link active" : "shell-link";

  return (
    <header className="site-header shell-header border-b border-border">
      <Link to="/" className="wordmark">
        Barberly.
      </Link>
      <div className="shell-actions flex items-center gap-3">
        {!user && (
          <>
            <NavLink to="/barbers" className={navClass}>
              Browse barbers
            </NavLink>
            <Button variant="pill" asChild>
              <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>Login</Link>
            </Button>
          </>
        )}
        {user && !isLoading && role === "shop" && (
          <nav className="shell-nav" aria-label="Shop">
            <NavLink to="/barbers" end className={navClass}>
              Browse barbers
            </NavLink>
            <NavLink to="/shop" end className={navClass}>
              My shop
            </NavLink>
            <NavLink to="/shop/bookings" className={navClass}>
              Management
            </NavLink>
            <NavLink to="/shop/orders" className={navClass}>
              Orders
            </NavLink>
          </nav>
        )}
        {user && !isLoading && role === "customer" && (
          <nav className="shell-nav" aria-label="Customer">
            <NavLink to="/barbers" end className={navClass}>
              Browse barbers
            </NavLink>
            <NavLink to="/bookings" end className={navClass}>
              My bookings
            </NavLink>
          </nav>
        )}
        {user && (
          <>
            <span className="break-all">Hi {user.email}</span>
            {role === "shop" && <span className="service-chip rounded-full">barber</span>}
            <Button variant="chip" disabled={busy} onClick={signOut}>
              <LogOut />
              Sign Out
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}

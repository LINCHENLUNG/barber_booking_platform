import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import { useProfile } from "@/hooks/useProfile";

/**
 * App header. Signed out: Barbers + Login. Customers: Barbers, My bookings, Become a shop.
 * Shops: Barbers, Shop setup, Bookings. Role comes from profiles.role.
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
              Barbers
            </NavLink>
            <Button variant="pill" asChild>
              <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>Login</Link>
            </Button>
          </>
        )}
        {user && !isLoading && role === "shop" && (
          <nav className="flex items-center gap-1" aria-label="Shop">
            <NavLink to="/barbers" end className={navClass}>
              Barbers
            </NavLink>
            <NavLink to="/shop" end className={navClass}>
              Shop setup
            </NavLink>
            <NavLink to="/shop/bookings" className={navClass}>
              Bookings
            </NavLink>
          </nav>
        )}
        {user && !isLoading && role === "customer" && (
          <nav className="flex items-center gap-1" aria-label="Customer">
            <NavLink to="/barbers" end className={navClass}>
              Barbers
            </NavLink>
            <NavLink to="/bookings" className={navClass}>
              My bookings
            </NavLink>
          </nav>
        )}
        {user && !isLoading && role === "customer" && (
          <Button variant="chip" asChild>
            <Link to="/shop">
              <Store />
              開店 / Become a shop
            </Link>
          </Button>
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

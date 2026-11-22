import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useProfile } from "@/hooks/useProfile";

/**
 * Route guard for /admin/*: signed-out → /login, any non-admin → /barbers.
 * UX only — the real enforcement is RLS on payouts/bookings/profiles and the admin-guarded RPCs.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { role, isLoading } = useProfile();
  if (user === undefined || (user && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login?next=%2Fadmin%2Fpayouts" replace />;
  if (role !== "admin") return <Navigate to="/barbers" replace />;
  return <>{children}</>;
}

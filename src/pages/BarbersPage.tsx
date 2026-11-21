import { Navigate } from "react-router-dom";
import { LoaderCircle, MapPin } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProfile } from "@/hooks/useProfile";
import { ShellHeader } from "@/components/ShellHeader";

/** Customer landing. Shops are routed to their own dashboard (role read from profiles.role). */
export default function BarbersPage() {
  usePageTitle("Your Barberly Account");
  const { role, isLoading } = useProfile();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (role === "shop") return <Navigate to="/shop" replace />;
  return (
    <>
      <ShellHeader />
      <main className="shell-body fade-in">
        <div className="inline-flex p-5 rounded-full bg-secondary mb-7">
          <MapPin size={30} strokeWidth={1.3} />
        </div>
        <p className="eyebrow">Something good is growing</p>
        <h1 className="section-heading mt-4">Your next great barber is closer.</h1>
        <p className="text-muted-foreground mt-6 leading-8">
          Barbers near you are coming soon — browse &amp; booking arrive in the next milestone.
        </p>
        <p className="text-sm text-muted-foreground mt-4 leading-7" lang="zh-Hant">
          附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。
        </p>
      </main>
    </>
  );
}

import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, CircleDashed, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProfile } from "@/hooks/useProfile";
import { useMyBarbers } from "@/hooks/useShopData";
import { isOnboardingComplete } from "@/lib/shop";
import { ShellHeader } from "@/components/ShellHeader";
import { BecomeShopCard } from "@/components/shop/BecomeShopCard";
import { PayoutSettingsForm } from "@/components/shop/PayoutSettingsForm";
import { BarbersManager } from "@/components/shop/BarbersManager";

/** /shop — shop onboarding (payout settings + barbers + photos). Customers see the upgrade card. */
export default function ShopPage() {
  usePageTitle("Shop setup — Barberly");
  const { profile, role, isLoading, error } = useProfile();
  const { data: barbers = [] } = useMyBarbers();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const payoutDone = isOnboardingComplete(profile);
  const ready = payoutDone && barbers.length > 0;

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        {error || !profile ? (
          <p role="alert" className="text-destructive">
            We couldn't load your profile. Please sign in again.
          </p>
        ) : role !== "shop" ? (
          <BecomeShopCard />
        ) : (
          <>
            <header className="mb-8">
              <p className="eyebrow">理髮店上架 / Shop onboarding</p>
              <h1 className="section-heading mt-3">
                {profile.display_name ? profile.display_name : "Set up your shop"}
              </h1>
              <ul className="onboarding-steps mt-5" aria-label="Onboarding progress">
                <li className={payoutDone ? "done" : ""}>
                  {payoutDone ? <CheckCircle2 /> : <CircleDashed />}
                  Shop name &amp; payout account
                </li>
                <li className={barbers.length ? "done" : ""}>
                  {barbers.length ? <CheckCircle2 /> : <CircleDashed />}
                  At least one barber
                </li>
              </ul>
              {ready ? (
                <Button variant="pill" className="mt-6" asChild>
                  <Link to="/shop/bookings">
                    <CalendarClock />
                    Manage services &amp; time slots
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">
                  Finish both steps to publish services and bookable time slots.
                </p>
              )}
            </header>
            <div className="space-y-8">
              <PayoutSettingsForm profile={profile} />
              <BarbersManager />
            </div>
          </>
        )}
      </main>
    </>
  );
}

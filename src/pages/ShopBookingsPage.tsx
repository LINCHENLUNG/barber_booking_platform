import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProfile } from "@/hooks/useProfile";
import { useMyBarbers } from "@/hooks/useShopData";
import { ShellHeader } from "@/components/ShellHeader";
import { ServicesEditor } from "@/components/shop/ServicesEditor";
import { SlotPublisher } from "@/components/shop/SlotPublisher";

/** /shop/bookings — services & prices + bookable slots, per barber. Shops with barbers only. */
export default function ShopBookingsPage() {
  usePageTitle("Services & time slots — Barberly");
  const { role, isLoading } = useProfile();
  const { data: barbers = [], isLoading: barbersLoading } = useMyBarbers();
  const [barberId, setBarberId] = useState<string>();

  useEffect(() => {
    if (!barbers.length) return;
    if (!barberId || !barbers.some((b) => b.id === barberId)) setBarberId(barbers[0]!.id);
  }, [barbers, barberId]);

  if (isLoading || (role === "shop" && barbersLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blocked =
    role !== "shop"
      ? { text: "This page is for shop accounts.", cta: "Become a shop" }
      : barbers.length === 0
        ? {
            text: "Add a barber first, then publish their services and time slots.",
            cta: "Go to shop setup",
          }
        : null;

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <p className="eyebrow">理髮店後台 / Shop dashboard</p>
        <h1 className="section-heading mt-3">Services &amp; time slots</h1>
        {blocked ? (
          <div className="shop-card mt-8 text-center">
            <p className="text-muted-foreground">{blocked.text}</p>
            <Button variant="pill" className="mt-5" asChild>
              <Link to="/shop">{blocked.cta}</Link>
            </Button>
          </div>
        ) : (
          <>
            {barbers.length > 1 && (
              <div role="tablist" aria-label="Barber" className="barber-tabs mt-6">
                {barbers.map((b) => (
                  <Button
                    key={b.id}
                    role="tab"
                    aria-selected={b.id === barberId}
                    variant={b.id === barberId ? "selected" : "chip"}
                    onClick={() => setBarberId(b.id)}
                  >
                    {b.name}
                  </Button>
                ))}
              </div>
            )}
            {barbers.length === 1 && (
              <p className="text-muted-foreground mt-2">for {barbers[0]!.name}</p>
            )}
            {barberId && (
              <div className="shop-columns mt-8" key={barberId}>
                <ServicesEditor barberId={barberId} />
                <SlotPublisher barberId={barberId} />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

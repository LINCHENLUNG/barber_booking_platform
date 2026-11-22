import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck, LoaderCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAccount } from "@/components/AuthProvider";
import {
  barberWithShop,
  orderPhotos,
  useBarber,
  useBarberSlots,
  useShopNames,
} from "@/hooks/useBuyerData";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/useShopData";
import { ShellHeader } from "@/components/ShellHeader";
import { PhotoCarousel } from "@/components/buyer/PhotoCarousel";
import { BookingDialog } from "@/components/buyer/BookingDialog";
import { validStarts } from "@/lib/booking";
import { formatMoney } from "@/lib/shop";
import { DISPLAY_TZ_LABEL, dayKey, fmtDay, fmtTime } from "@/lib/time";

/** /barbers/:id — public barber detail: photo carousel, info, services, open slots, Book. */
export default function BarberDetailPage() {
  const { id } = useParams();
  const user = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: barber, isLoading, error } = useBarber(id);
  const { data: slots = [] } = useBarberSlots(id);
  const { data: settings } = usePlatformSettings();
  const { profile } = useProfile();
  const { data: shopNames } = useShopNames(barber ? [barber.shop_id] : []);
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string>();
  const title = barber ? barberWithShop(barber.name, shopNames?.get(barber.shop_id)) : "";
  usePageTitle(barber ? `${title} — Barberly` : "Barber — Barberly");
  // Only customer accounts can book (create_booking enforces this server-side too).
  const notCustomer = !!user && !!profile && profile.role !== "customer";

  const currency = settings?.currency ?? "twd";
  const minor = settings?.currency_minor_units ?? 0;
  const slotMinutes = settings?.slot_minutes ?? 30;
  const photos = useMemo(() => orderPhotos(barber?.barber_photos ?? []), [barber]);
  const free = slots.filter((s) => !s.held && new Date(s.starts_at).getTime() > Date.now());
  const byDay = free.reduce<Record<string, typeof free>>((acc, s) => {
    (acc[dayKey(s.starts_at)] ??= []).push(s);
    return acc;
  }, {});

  function book(sid?: string) {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (notCustomer) return;
    setServiceId(sid);
    setOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <ShellHeader />
      <main className="detail-main fade-in">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/barbers">
            <ArrowLeft />
            All barbers
          </Link>
        </Button>
        {error || !barber ? (
          <p role="alert" className="text-muted-foreground">
            We couldn't find that barber.
          </p>
        ) : (
          <div className="detail-grid">
            <PhotoCarousel photos={photos} name={barber.name} />

            <div>
              <p className="eyebrow">Barber</p>
              <h1 className="section-heading mt-2">{title}</h1>
              {barber.address && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <MapPin size={14} />
                  {barber.address}
                </p>
              )}
              {barber.intro && <p className="mt-4 leading-7 whitespace-pre-line">{barber.intro}</p>}

              <Button
                variant="pill"
                className="h-12 mt-6 w-full sm:w-auto"
                disabled={!barber.services.length || notCustomer}
                onClick={() => book()}
              >
                <CalendarCheck />
                Book
              </Button>
              {notCustomer && (
                <p role="note" className="text-sm text-muted-foreground mt-3">
                  Please use a customer account to book.
                </p>
              )}

              <section className="mt-9" aria-labelledby="services-h">
                <h2 id="services-h" className="shop-heading text-2xl">
                  Services
                </h2>
                {barber.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">No services listed yet.</p>
                ) : (
                  <ul className="divide-y divide-border mt-2">
                    {barber.services.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-medium">
                            {s.name}{" "}
                            <span className="service-chip capitalize ml-1">{s.category}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.required_slots * slotMinutes} min ·{" "}
                            {validStarts(slots, s.required_slots).length} start times open
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <strong>{formatMoney(s.price, currency, minor)}</strong>
                          {!notCustomer && (
                            <Button size="sm" variant="chip" onClick={() => book(s.id)}>
                              Book
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-8" aria-labelledby="slots-h">
                <h2 id="slots-h" className="shop-heading text-2xl">
                  Available slots
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {slotMinutes}-minute slots · {DISPLAY_TZ_LABEL}
                </p>
                {free.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-3">No open slots right now.</p>
                ) : (
                  <div className="space-y-3 mt-3">
                    {Object.entries(byDay).map(([d, list]) => (
                      <div key={d}>
                        <p className="text-sm font-medium">{fmtDay(d)}</p>
                        <ul className="slot-chips mt-2">
                          {list.map((s) => (
                            <li key={s.id}>
                              <span>{fmtTime(s.starts_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {barber && (
        <BookingDialog
          open={open}
          onOpenChange={setOpen}
          barberId={barber.id}
          barberName={barber.name}
          services={barber.services}
          slots={slots}
          initialServiceId={serviceId}
          currency={currency}
          minorUnits={minor}
          slotMinutes={slotMinutes}
        />
      )}
    </>
  );
}

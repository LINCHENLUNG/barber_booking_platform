import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProfile } from "@/hooks/useProfile";
import { useMyBarbers, usePlatformSettings } from "@/hooks/useShopData";
import { useAccount } from "@/components/AuthProvider";
import { ShellHeader } from "@/components/ShellHeader";
import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/shop";
import { DISPLAY_TZ_LABEL, dayKey, fmtDay, fmtTime } from "@/lib/time";

const STATUS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Pending payment", className: "status-pending" },
  paid: { label: "Paid", className: "status-paid" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
};

/**
 * Incoming bookings for every barber this shop owns. Reads go through the existing
 * bookings_select_shop_owner RLS (bookings → services → barbers.shop_id = auth.uid()) via the
 * security_invoker bookings_with_start view — no service-role key in the browser.
 */
function useIncomingBookings(barberIds: string[]) {
  const user = useAccount();
  return useQuery({
    queryKey: ["incoming-bookings", user?.id, barberIds],
    enabled: !!user && barberIds.length > 0,
    queryFn: async () => {
      const { data: services, error: sErr } = await supabase
        .from("services")
        .select("id, name, category, barber_id")
        .in("barber_id", barberIds);
      if (sErr) throw sErr;
      if (!services.length) return [];
      const { data: bookings, error } = await supabase
        .from("bookings_with_start")
        .select("id, service_id, status, price, starts_at, ends_at, created_at, refunded_at")
        .in(
          "service_id",
          services.map((s) => s.id),
        )
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const byId = new Map(services.map((s) => [s.id, s]));
      return bookings.map((b) => ({ ...b, service: byId.get(b.service_id ?? "") ?? null }));
    },
  });
}

/** /shop/orders — shop only. Filter by barber and date. */
export default function ShopOrdersPage() {
  usePageTitle("Orders — Barberly");
  const { role, isLoading: profileLoading } = useProfile();
  const { data: barbers = [], isLoading: barbersLoading } = useMyBarbers();
  const { data: settings } = usePlatformSettings();
  const barberIds = useMemo(() => barbers.map((b) => b.id), [barbers]);
  const barberName = useMemo(() => new Map(barbers.map((b) => [b.id, b.name])), [barbers]);
  const {
    data: bookings = [],
    isLoading,
    error,
  } = useIncomingBookings(role === "shop" ? barberIds : []);
  const [barberFilter, setBarberFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const shown = bookings.filter(
    (b) =>
      (barberFilter === "all" || b.service?.barber_id === barberFilter) &&
      (!dateFilter || (b.starts_at && dayKey(b.starts_at) === dateFilter)),
  );

  if (profileLoading || (role === "shop" && barbersLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const money = (v: number) =>
    formatMoney(v, settings?.currency ?? "twd", settings?.currency_minor_units ?? 0);

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <p className="eyebrow">理髮店後台 / Shop dashboard</p>
        <h1 className="section-heading mt-3">Orders</h1>
        <p className="text-xs text-muted-foreground mt-2">Times are {DISPLAY_TZ_LABEL}.</p>

        {role !== "shop" ? (
          <div className="shop-card mt-8 text-center">
            <p className="text-muted-foreground">This page is for shop accounts.</p>
            <Button variant="pill" className="mt-5" asChild>
              <Link to="/barbers">Browse barbers</Link>
            </Button>
          </div>
        ) : barbers.length === 0 ? (
          <div className="shop-card mt-8 text-center">
            <p className="text-muted-foreground">Add a barber first to receive orders.</p>
            <Button variant="pill" className="mt-5" asChild>
              <Link to="/shop">Go to My shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="orders-filters mt-6">
              <label className="block text-sm">
                Barber
                <select
                  className="auth-field"
                  value={barberFilter}
                  onChange={(e) => setBarberFilter(e.target.value)}
                >
                  <option value="all">All barbers</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Date
                <input
                  type="date"
                  className="auth-field"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </label>
              {(barberFilter !== "all" || dateFilter) && (
                <Button
                  variant="chip"
                  className="self-end mb-1"
                  onClick={() => {
                    setBarberFilter("all");
                    setDateFilter("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {isLoading && <LoaderCircle className="animate-spin text-muted-foreground mt-8" />}
            {error && (
              <p role="alert" className="text-destructive mt-6">
                {errMessage(error, "We couldn't load orders.")}
              </p>
            )}
            {!isLoading && !error && shown.length === 0 && (
              <p className="text-muted-foreground mt-8">
                {bookings.length ? "No orders match these filters." : "No orders yet."}
              </p>
            )}

            {shown.length > 0 && (
              <div className="orders-table mt-6" role="table" aria-label="Orders">
                <div className="orders-row orders-head" role="row">
                  <span role="columnheader">Date &amp; time</span>
                  <span role="columnheader">Barber</span>
                  <span role="columnheader">Service</span>
                  <span role="columnheader">Price</span>
                  <span role="columnheader">Status</span>
                </div>
                {shown.map((b) => {
                  const status =
                    b.status === "cancelled" && b.refunded_at
                      ? { label: "Refunded", className: "status-refunded" }
                      : (STATUS[b.status ?? ""] ?? { label: b.status, className: "" });
                  return (
                    <div key={b.id} className="orders-row" role="row">
                      <span role="cell">
                        {b.starts_at && b.ends_at ? (
                          <>
                            {fmtDay(dayKey(b.starts_at))}
                            <br />
                            <span className="text-muted-foreground text-sm">
                              {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">Released</span>
                        )}
                      </span>
                      <span role="cell">{barberName.get(b.service?.barber_id ?? "") ?? "—"}</span>
                      <span role="cell">
                        {b.service?.name ?? "—"}
                        {b.service && (
                          <span className="service-chip capitalize ml-1">{b.service.category}</span>
                        )}
                      </span>
                      <span role="cell">{money(b.price ?? 0)}</span>
                      <span role="cell">
                        <span className={`status-pill ${status.className}`}>{status.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShellHeader } from "@/components/ShellHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/useShopData";
import { useOwedBookings, usePayouts, useShopPaidOutBookings } from "@/hooks/usePayoutData";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/shop";
import { dayKey, fmtDay, todayKey } from "@/lib/time";
import { PAYOUT_STATUS, totals } from "@/lib/payouts";

/**
 * /shop/earnings — read-only mirror for a shop (all its barbers combined).
 * Owed = own paid bookings with payout_id NULL (owed_bookings view). In a payout = own paid
 * bookings with payout_id set, grouped by that payout + its status. Cancelled payouts never
 * show here: cancelling nulls payout_id, so those bookings are back in Owed.
 */
export default function ShopEarningsPage() {
  usePageTitle("Earnings — Barberly");
  const { role, isLoading: profileLoading } = useProfile();
  const isShop = role === "shop";
  const { data: settings } = usePlatformSettings();
  const owedQ = useOwedBookings(isShop);
  const payoutsQ = usePayouts(isShop);
  const paidOutQ = useShopPaidOutBookings(isShop);

  const money = (v: number) =>
    formatMoney(v, settings?.currency ?? "twd", settings?.currency_minor_units ?? 0);

  const owedData = owedQ.data;
  const payoutsData = payoutsQ.data;
  const paidOutData = paidOutQ.data;
  const owed = useMemo(() => owedData ?? [], [owedData]);
  const batches = useMemo(() => {
    const live = (payoutsData ?? []).filter((p) => p.status !== "cancelled");
    const byPayout = new Map<string, NonNullable<typeof paidOutData>>();
    (paidOutData ?? []).forEach((b) => {
      const list = byPayout.get(b.payout_id!) ?? [];
      list.push(b);
      byPayout.set(b.payout_id!, list);
    });
    return live.map((p) => ({ payout: p, bookings: byPayout.get(p.id) ?? [] }));
  }, [payoutsData, paidOutData]);

  const owedSum = totals(owed);
  const month = todayKey().slice(0, 7);
  const all = useMemo(() => {
    const rows = [
      ...owed.map((o) => ({
        paid_at: o.paid_at,
        gross: o.price ?? 0,
        platform: o.platform_cut ?? 0,
        shop: o.shop_cut ?? 0,
      })),
      ...batches.flatMap(({ payout, bookings }) =>
        bookings.map((b) => {
          const platform = Math.round(b.price * Number(payout.platform_pct));
          return { paid_at: b.paid_at, gross: b.price, platform, shop: b.price - platform };
        }),
      ),
    ];
    const sum = (list: typeof rows) =>
      list.reduce(
        (t, r) => ({
          count: t.count + 1,
          gross: t.gross + r.gross,
          platform: t.platform + r.platform,
          shop: t.shop + r.shop,
        }),
        { count: 0, gross: 0, platform: 0, shop: 0 },
      );
    return {
      month: sum(rows.filter((r) => r.paid_at && dayKey(r.paid_at).startsWith(month))),
      total: sum(rows),
    };
  }, [owed, batches, month]);

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const loading = owedQ.isLoading || payoutsQ.isLoading || paidOutQ.isLoading;
  const error = owedQ.error ?? payoutsQ.error ?? paidOutQ.error;

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <p className="eyebrow">理髮店後台 / Shop dashboard</p>
        <h1 className="section-heading mt-3">Earnings</h1>
        <p className="text-sm text-muted-foreground mt-2">
          平台會分批結算並撥款給你 · We settle and pay out your earnings in batches.
        </p>

        {!isShop ? (
          <div className="shop-card mt-8 text-center">
            <p className="text-muted-foreground">This page is for shop accounts.</p>
            <Button variant="pill" className="mt-5" asChild>
              <Link to="/barbers">Browse barbers</Link>
            </Button>
          </div>
        ) : loading ? (
          <LoaderCircle className="animate-spin text-muted-foreground mt-8" />
        ) : error ? (
          <p role="alert" className="text-destructive mt-6">
            {errMessage(error, "We couldn't load your earnings.")}
          </p>
        ) : (
          <>
            <div className="shop-grid-2 mt-8">
              {(
                [
                  ["本月 · This month", all.month],
                  ["累計 · All time", all.total],
                ] as const
              ).map(([label, s]) => (
                <div key={label} className="shop-card">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-display text-3xl mt-2">{money(s.shop)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    你的收入 · Your earnings — {s.count} paid booking(s), gross {money(s.gross)},
                    platform {money(s.platform)}
                  </p>
                </div>
              ))}
            </div>

            <section className="mt-10" aria-labelledby="owed-h">
              <h2 id="owed-h" className="shop-heading">
                尚未撥款 · Owed{" "}
                <span className="text-muted-foreground text-lg">{money(owedSum.shop)}</span>
              </h2>
              {owed.length === 0 ? (
                <p className="text-muted-foreground mt-3">Nothing waiting to be paid out.</p>
              ) : (
                <div className="orders-table mt-4" role="table" aria-label="Owed bookings">
                  <div className="orders-row earn-row orders-head" role="row">
                    <span role="columnheader">Paid</span>
                    <span role="columnheader">Barber · service</span>
                    <span role="columnheader">Price</span>
                    <span role="columnheader">Platform</span>
                    <span role="columnheader">Your cut</span>
                  </div>
                  {owed.map((o) => (
                    <div key={o.booking_id} className="orders-row earn-row" role="row">
                      <span role="cell">{o.paid_at ? fmtDay(dayKey(o.paid_at)) : "—"}</span>
                      <span role="cell">
                        {o.barber_name}
                        <span className="block text-xs text-muted-foreground">
                          {o.service_name}
                        </span>
                      </span>
                      <span role="cell">{money(o.price ?? 0)}</span>
                      <span role="cell">{money(o.platform_cut ?? 0)}</span>
                      <span role="cell">
                        <strong>{money(o.shop_cut ?? 0)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10" aria-labelledby="paid-h">
              <h2 id="paid-h" className="shop-heading">
                已納入撥款 · In a payout
              </h2>
              {batches.length === 0 ? (
                <p className="text-muted-foreground mt-3">No payouts yet.</p>
              ) : (
                <div className="space-y-4 mt-4">
                  {batches.map(({ payout: p, bookings }) => {
                    const status = PAYOUT_STATUS[p.status] ?? { label: p.status, className: "" };
                    return (
                      <div key={p.id} className="shop-card">
                        <div className="booking-row">
                          <div>
                            <span className={`status-pill ${status.className}`}>
                              {status.label}
                            </span>
                            <p className="mt-2">
                              Built {fmtDay(dayKey(p.created_at))}
                              {p.marked_transferred_at &&
                                ` · transferred ${fmtDay(dayKey(p.marked_transferred_at))}`}
                            </p>
                            {p.note && <p className="text-sm text-muted-foreground">{p.note}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-display text-2xl">{money(p.shop_cut)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.bookings_count} booking(s) · gross {money(p.gross)} · platform{" "}
                              {money(p.platform_cut)}
                            </p>
                          </div>
                        </div>
                        {bookings.length > 0 && (
                          <ul className="text-sm text-muted-foreground mt-3 space-y-1">
                            {bookings.map((b) => (
                              <li key={b.id}>
                                {b.paid_at ? fmtDay(dayKey(b.paid_at)) : "—"} ·{" "}
                                {b.services.barbers.name} · {b.services.name} · {money(b.price)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CircleCheck, LoaderCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShellHeader } from "@/components/ShellHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlatformSettings } from "@/hooks/useShopData";
import { useOwedBookings, usePayouts, useProfileLabels } from "@/hooks/usePayoutData";
import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/shop";
import { dayKey, fmtDay, todayKey } from "@/lib/time";
import { PAYOUT_STATUS, filterOwed, owedForShopMonth, totals } from "@/lib/payouts";

/**
 * /admin/payouts — admin only (RequireAdmin route guard + RLS + admin-guarded RPCs).
 * Part 1: the live owed pool (paid bookings with payout_id NULL) → filter, pick one shop's
 * bookings, Build payout. Part 2: the payout ledger with Mark as transferred / Cancel.
 * No money moves here — the bank transfer happens outside the app and is only recorded.
 */
export default function AdminPayoutsPage() {
  usePageTitle("Payouts — Barberly admin");
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: owed = [], isLoading: owedLoading, error: owedError } = useOwedBookings();
  const { data: payouts = [], isLoading: payoutsLoading, error: payoutsError } = usePayouts();
  const { data: customerLabel } = useProfileLabels(
    owed.map((o) => o.customer_id).filter((id): id is string => !!id),
  );

  const [shopId, setShopId] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string>();

  const money = (v: number) =>
    formatMoney(v, settings?.currency ?? "twd", settings?.currency_minor_units ?? 0);

  const shops = useMemo(() => {
    const m = new Map<string, string>();
    owed.forEach((o) => o.shop_id && m.set(o.shop_id, o.shop_name || "Unnamed shop"));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [owed]);
  const customers = useMemo(
    () => [...new Set(owed.map((o) => o.customer_id).filter((id): id is string => !!id))],
    [owed],
  );

  const shown = filterOwed(owed, { shopId, customerId, from, to });
  const checked = owed.filter((o) => o.booking_id && selected.has(o.booking_id));
  const selectedShop = checked[0]?.shop_id ?? null;
  const sum = totals(checked);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectShopMonth() {
    if (shopId === "all") return;
    const ids = owedForShopMonth(owed, shopId, month)
      .map((o) => o.booking_id)
      .filter((id): id is string => !!id);
    setSelected(new Set(ids));
    if (!ids.length) toast.message("Nothing owed for that shop in that month.");
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["owed-bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["payouts"] }),
    ]);
  }

  async function build() {
    if (!checked.length) return;
    setBusy("build");
    const { error } = await supabase.rpc("build_payout", {
      p_booking_ids: checked.map((c) => c.booking_id!),
      ...(note.trim() ? { p_note: note.trim() } : {}),
    });
    setBusy(undefined);
    if (error) {
      toast.error(errMessage(error, "Could not build the payout."));
      await refresh();
      return;
    }
    toast.success("Payout built", {
      description: `${checked[0]?.shop_name ?? "Shop"} · ${sum.count} booking(s) · shop cut ${money(sum.shop)}. Transfer it, then mark it transferred.`,
    });
    setSelected(new Set());
    setNote("");
    await refresh();
  }

  async function markTransferred(id: string, shopName: string, amount: number) {
    const ref = window.prompt(
      `Record the bank transfer of ${money(amount)} to ${shopName}.\nBank reference / memo (optional):`,
      "",
    );
    if (ref === null) return;
    setBusy(id);
    const { error } = await supabase.rpc("mark_payout_transferred", {
      p_payout_id: id,
      ...(ref.trim() ? { p_bank_reference: ref.trim() } : {}),
    });
    setBusy(undefined);
    if (error) toast.error(errMessage(error, "Could not mark it transferred."));
    else toast.success("Marked as transferred");
    await refresh();
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this payout? Its bookings go back to the owed pool.")) return;
    setBusy(id);
    const { error } = await supabase.rpc("cancel_payout", { p_payout_id: id });
    setBusy(undefined);
    if (error) toast.error(errMessage(error, "Could not cancel the payout."));
    else toast.success("Payout cancelled — its bookings are owed again");
    await refresh();
  }

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <p className="eyebrow">平台管理 / Admin</p>
        <h1 className="section-heading mt-3">Payouts</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Pick one shop&apos;s paid bookings that haven&apos;t been paid out, build a payout,
          transfer the shop cut from your bank, then mark it transferred. No money moves in the app.
        </p>

        {/* ── Part 1: owed pool ── */}
        <section className="mt-10" aria-labelledby="owed-heading">
          <h2 id="owed-heading" className="shop-heading">
            欠款池 · Owed bookings
          </h2>

          <div className="orders-filters mt-4">
            <label className="block text-sm">
              Shop
              <select
                className="auth-field"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
              >
                <option value="all">All shops</option>
                {shops.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Customer
              <select
                className="auth-field"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="all">All customers</option>
                {customers.map((id) => (
                  <option key={id} value={id}>
                    {customerLabel?.get(id) ?? id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Paid from
              <input
                type="date"
                className="auth-field"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Paid to
              <input
                type="date"
                className="auth-field"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          <div className="orders-filters mt-3">
            <label className="block text-sm">
              Month
              <input
                type="month"
                className="auth-field"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <Button
              variant="chip"
              className="self-end mb-1"
              disabled={shopId === "all"}
              title={shopId === "all" ? "Choose a shop first" : undefined}
              onClick={selectShopMonth}
            >
              全選此店本月欠款 · Select all owed for this shop this month
            </Button>
            {selected.size > 0 && (
              <Button
                variant="chip"
                className="self-end mb-1"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
            )}
          </div>

          {owedLoading && <LoaderCircle className="animate-spin text-muted-foreground mt-6" />}
          {owedError && (
            <p role="alert" className="text-destructive mt-6">
              {errMessage(owedError, "We couldn't load the owed bookings.")}
            </p>
          )}
          {!owedLoading && !owedError && shown.length === 0 && (
            <p className="text-muted-foreground mt-6">
              {owed.length ? "No owed bookings match these filters." : "Nothing is owed right now."}
            </p>
          )}

          {shown.length > 0 && (
            <div className="orders-table mt-5" role="table" aria-label="Owed bookings">
              <div className="orders-row owed-row orders-head" role="row">
                <span role="columnheader" className="sr-only">
                  Select
                </span>
                <span role="columnheader">Shop</span>
                <span role="columnheader">Barber · service</span>
                <span role="columnheader">Customer</span>
                <span role="columnheader">Paid</span>
                <span role="columnheader">Price</span>
                <span role="columnheader">Platform</span>
                <span role="columnheader">Shop cut</span>
              </div>
              {shown.map((o) => {
                const id = o.booking_id!;
                const otherShop = !!selectedShop && o.shop_id !== selectedShop;
                return (
                  <label
                    key={id}
                    className={`orders-row owed-row ${otherShop ? "opacity-50" : ""}`}
                    role="row"
                    title={
                      otherShop ? "A payout pays one shop — clear the selection first" : undefined
                    }
                  >
                    <span role="cell">
                      <input
                        type="checkbox"
                        aria-label={`Select booking ${id.slice(0, 8)}`}
                        checked={selected.has(id)}
                        disabled={otherShop}
                        onChange={() => toggle(id)}
                      />
                    </span>
                    <span role="cell">{o.shop_name || "—"}</span>
                    <span role="cell">
                      {o.barber_name}
                      <span className="block text-xs text-muted-foreground">{o.service_name}</span>
                    </span>
                    <span role="cell" className="break-all">
                      {customerLabel?.get(o.customer_id ?? "") ?? "—"}
                    </span>
                    <span role="cell">{o.paid_at ? fmtDay(dayKey(o.paid_at)) : "—"}</span>
                    <span role="cell">{money(o.price ?? 0)}</span>
                    <span role="cell">{money(o.platform_cut ?? 0)}</span>
                    <span role="cell">
                      <strong>{money(o.shop_cut ?? 0)}</strong>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="shop-card payout-builder mt-5" role="status">
            <div>
              <p className="text-sm text-muted-foreground">
                Selected: <strong>{sum.count}</strong> booking(s)
                {checked[0]?.shop_name ? ` · ${checked[0].shop_name}` : ""}
              </p>
              <p className="mt-1">
                Gross <strong>{money(sum.gross)}</strong> · Platform{" "}
                <strong>{money(sum.platform)}</strong> · Shop cut <strong>{money(sum.shop)}</strong>
              </p>
            </div>
            <label className="block text-sm flex-1 min-w-[200px]">
              Note (optional)
              <input
                className="auth-field"
                placeholder="e.g. November payout"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <Button
              variant="pill"
              disabled={!checked.length || busy === "build"}
              onClick={() => void build()}
            >
              {busy === "build" ? <LoaderCircle className="animate-spin" /> : <Wallet />}
              建立撥款 · Build payout
            </Button>
          </div>
        </section>

        {/* ── Part 2: payout ledger ── */}
        <section className="mt-14" aria-labelledby="ledger-heading">
          <h2 id="ledger-heading" className="shop-heading">
            撥款紀錄 · Payouts
          </h2>
          {payoutsLoading && <LoaderCircle className="animate-spin text-muted-foreground mt-6" />}
          {payoutsError && (
            <p role="alert" className="text-destructive mt-6">
              {errMessage(payoutsError, "We couldn't load payouts.")}
            </p>
          )}
          {!payoutsLoading && !payoutsError && payouts.length === 0 && (
            <p className="text-muted-foreground mt-4">No payouts yet.</p>
          )}
          {payouts.length > 0 && (
            <div className="orders-table mt-5" role="table" aria-label="Payouts">
              <div className="orders-row ledger-row orders-head" role="row">
                <span role="columnheader">Shop · bank</span>
                <span role="columnheader">Created</span>
                <span role="columnheader">Bookings</span>
                <span role="columnheader">Gross</span>
                <span role="columnheader">Platform</span>
                <span role="columnheader">Shop cut</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Actions</span>
              </div>
              {payouts.map((p) => {
                const status = PAYOUT_STATUS[p.status] ?? { label: p.status, className: "" };
                const pending = p.status === "pending_transfer";
                return (
                  <div key={p.id} className="orders-row ledger-row" role="row">
                    <span role="cell">
                      {p.shop_name || "—"}
                      <span className="block text-xs text-muted-foreground break-all">
                        {p.shop?.bank_account_name ?? "—"} ·{" "}
                        {p.shop?.bank_account_number ?? "no bank details"}
                      </span>
                      {p.note && (
                        <span className="block text-xs text-muted-foreground">{p.note}</span>
                      )}
                    </span>
                    <span role="cell">{fmtDay(dayKey(p.created_at))}</span>
                    <span role="cell">{p.bookings_count}</span>
                    <span role="cell">{money(p.gross)}</span>
                    <span role="cell">
                      {money(p.platform_cut)}
                      <span className="block text-xs text-muted-foreground">
                        {Math.round(Number(p.platform_pct) * 100)}%
                      </span>
                    </span>
                    <span role="cell">
                      <strong>{money(p.shop_cut)}</strong>
                    </span>
                    <span role="cell">
                      <span className={`status-pill ${status.className}`}>{status.label}</span>
                      {p.marked_transferred_at && (
                        <span className="block text-xs text-muted-foreground mt-1">
                          {fmtDay(dayKey(p.marked_transferred_at))}
                          {p.bank_reference ? ` · ${p.bank_reference}` : ""}
                        </span>
                      )}
                    </span>
                    <span role="cell" className="flex flex-wrap gap-2">
                      {pending ? (
                        <>
                          <Button
                            size="sm"
                            variant="pill"
                            disabled={busy === p.id}
                            onClick={() =>
                              void markTransferred(p.id, p.shop_name ?? "the shop", p.shop_cut)
                            }
                          >
                            <CircleCheck />
                            標記為已轉帳 · Mark as transferred
                          </Button>
                          <Button
                            size="sm"
                            variant="chip"
                            disabled={busy === p.id}
                            onClick={() => void cancel(p.id)}
                          >
                            <Ban />
                            取消 · Cancel
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

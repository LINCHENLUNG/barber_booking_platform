import { dayKey } from "@/lib/time";

export type OwedRow = {
  booking_id: string | null;
  shop_id: string | null;
  customer_id: string | null;
  paid_at: string | null;
  price: number | null;
  platform_cut: number | null;
  shop_cut: number | null;
};

export type OwedFilters = {
  shopId: string; // "all" or a shop id
  customerId: string; // "all" or a customer id
  from: string; // YYYY-MM-DD (Taipei) or ""
  to: string; // YYYY-MM-DD (Taipei) or ""
};

/** UI-only filters over the live owed pool (plain WHERE clauses, no schema grouping). */
export function filterOwed<T extends OwedRow>(rows: T[], f: OwedFilters): T[] {
  return rows.filter((r) => {
    const day = r.paid_at ? dayKey(r.paid_at) : "";
    return (
      (f.shopId === "all" || r.shop_id === f.shopId) &&
      (f.customerId === "all" || r.customer_id === f.customerId) &&
      (!f.from || day >= f.from) &&
      (!f.to || day <= f.to)
    );
  });
}

/** Running total of the checked rows — the same numbers build_payout will snapshot. */
export function totals(rows: OwedRow[]) {
  return rows.reduce(
    (t, r) => ({
      count: t.count + 1,
      gross: t.gross + (r.price ?? 0),
      platform: t.platform + (r.platform_cut ?? 0),
      shop: t.shop + (r.shop_cut ?? 0),
    }),
    { count: 0, gross: 0, platform: 0, shop: 0 },
  );
}

/** "Select all owed for this shop this month" helper. month = YYYY-MM (Taipei). */
export function owedForShopMonth<T extends OwedRow>(rows: T[], shopId: string, month: string) {
  return rows.filter(
    (r) => r.shop_id === shopId && !!r.paid_at && dayKey(r.paid_at).startsWith(month),
  );
}

export const PAYOUT_STATUS: Record<string, { label: string; className: string }> = {
  pending_transfer: { label: "待轉帳 · Pending", className: "status-pending" },
  transferred: { label: "已轉帳 · Transferred", className: "status-paid" },
  cancelled: { label: "已取消 · Cancelled", className: "status-cancelled" },
};

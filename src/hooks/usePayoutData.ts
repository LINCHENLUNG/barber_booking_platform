import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type OwedBooking = Tables<"owed_bookings">;
export type Payout = Tables<"payouts">;

/**
 * The live owed pool (paid bookings with payout_id NULL), from the security_invoker
 * owed_bookings view: an admin sees every shop, a shop only its own rows.
 */
export function useOwedBookings(enabled = true) {
  const user = useAccount();
  return useQuery({
    queryKey: ["owed-bookings", user?.id],
    enabled: !!user && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owed_bookings")
        .select("*")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Contact labels for customer ids (admin can read every profile; others get their own only). */
export function useProfileLabels(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["profile-labels", sorted],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", sorted);
      if (error) throw error;
      return new Map(data.map((p) => [p.id, p.display_name || p.email || "—"]));
    },
  });
}

/** Payout batches (RLS: admin → all, shop → own), newest first, with the shop's bank details. */
export function usePayouts(enabled = true) {
  const user = useAccount();
  return useQuery({
    queryKey: ["payouts", user?.id],
    enabled: !!user && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*, shop:profiles!payouts_shop_id_fkey(bank_account_name, bank_account_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * A shop's own paid bookings that are already in a (non-cancelled) payout, with the payout's
 * status. Owed ones come from useOwedBookings. RLS: bookings_select_shop_owner + payouts own.
 */
export function useShopPaidOutBookings(enabled = true) {
  const user = useAccount();
  return useQuery({
    queryKey: ["shop-paid-out", user?.id],
    enabled: !!user && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, price, paid_at, payout_id, services!inner(name, barbers!inner(name, shop_id)), payouts!bookings_payout_id_fkey(id, status, created_at, marked_transferred_at, platform_pct, note)",
        )
        .eq("status", "paid")
        .not("payout_id", "is", null)
        .eq("services.barbers.shop_id", user!.id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

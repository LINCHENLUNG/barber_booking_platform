import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import type { SlotLite } from "@/lib/booking";
import type { Tables } from "@/integrations/supabase/types";

type Photo = Pick<
  Tables<"barber_photos">,
  "id" | "storage_path" | "caption" | "is_featured" | "sort_order" | "created_at"
>;

/** Featured photos first, then by sort order. */
export const orderPhotos = <T extends Pick<Photo, "is_featured" | "sort_order" | "created_at">>(
  photos: T[],
) =>
  [...photos].sort(
    (a, b) =>
      Number(b.is_featured) - Number(a.is_featured) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );

/** /barbers — every barber with its service categories and portfolio (all public reads). */
export function useBarberDirectory() {
  return useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select(
          "id, shop_id, name, intro, address, services(category, price), barber_photos(id, storage_path, caption, is_featured, sort_order, created_at)",
        )
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Shop (storefront) names for a set of shop ids, via the get_shop_names RPC — which returns only
 * id + display_name for accounts that own a barber (never email or bank fields).
 */
export function useShopNames(shopIds: string[]) {
  const ids = [...new Set(shopIds)].sort();
  return useQuery({
    queryKey: ["shop-names", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shop_names", { shop_ids: ids });
      if (error) throw error;
      return new Map(data.map((s) => [s.id, s.display_name]));
    },
  });
}

export { barberWithShop } from "@/lib/shop";

/** /barbers/:id — one barber with services and photos. */
export function useBarber(id: string | undefined) {
  return useQuery({
    queryKey: ["barber", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select(
          "id, shop_id, name, intro, address, services(id, name, category, price, required_slots), barber_photos(id, storage_path, caption, is_featured, sort_order, created_at)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Upcoming slots for a barber with a `held` flag. Slots have NO status: a slot is held when a
 * booking_slots row references it (the anti-join, done on the embedded rows).
 */
export function useBarberSlots(barberId: string | undefined) {
  return useQuery({
    queryKey: ["barber-slots", barberId],
    enabled: !!barberId,
    queryFn: async (): Promise<SlotLite[]> => {
      const { data, error } = await supabase
        .from("bookable_slots")
        .select("id, starts_at, ends_at, booking_slots(slot_id)")
        .eq("barber_id", barberId!)
        .gt("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data.map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        held: (s.booking_slots?.length ?? 0) > 0,
      }));
    },
  });
}

/** /bookings — the signed-in customer's own bookings (RLS), with derived start time + service. */
export function useMyBookings() {
  const user = useAccount();
  return useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from("bookings_with_start")
        .select("*")
        .eq("customer_id", user!.id)
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const ids = [...new Set(bookings.map((b) => b.service_id).filter(Boolean))] as string[];
      const { data: services, error: sErr } = ids.length
        ? await supabase
            .from("services")
            .select("id, name, category, required_slots, barbers(id, name, address)")
            .in("id", ids)
        : { data: [], error: null };
      if (sErr) throw sErr;
      const byId = new Map(services.map((s) => [s.id, s]));
      return bookings.map((b) => ({ ...b, service: byId.get(b.service_id ?? "") ?? null }));
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";

export type Barber = Tables<"barbers">;
export type Service = Tables<"services">;
export type Slot = Tables<"bookable_slots">;
export type BarberPhoto = Tables<"barber_photos">;

/** Single-row platform config (currency + slot length). World-readable. */
export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform_settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*").single();
      if (error) throw error;
      return data;
    },
  });
}

/** The signed-in shop's barbers (one shop → many barbers). */
export function useMyBarbers() {
  const user = useAccount();
  return useQuery({
    queryKey: ["barbers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("shop_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useServices(barberId: string | undefined) {
  return useQuery({
    queryKey: ["services", barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", barberId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useSlots(barberId: string | undefined) {
  return useQuery({
    queryKey: ["slots", barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookable_slots")
        .select("*")
        .eq("barber_id", barberId!)
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });
}

export function usePhotos(barberId: string | undefined) {
  return useQuery({
    queryKey: ["photos", barberId],
    enabled: !!barberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_photos")
        .select("*")
        .eq("barber_id", barberId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export const photoUrl = (path: string) =>
  supabase.storage.from("barber-photos").getPublicUrl(path).data.publicUrl;

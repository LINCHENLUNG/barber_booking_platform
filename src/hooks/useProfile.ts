import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import { accountKind } from "@/lib/account";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

/** The signed-in user's own `profiles` row (RLS: profiles_select_own). Role checks read this. */
export function useProfile() {
  const user = useAccount();
  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return { ...query, profile: query.data, role: accountKind(query.data?.role) };
}

/** Reads the role for a just-signed-in user, used for the post-login redirect. */
export async function fetchRole(userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return accountKind(data?.role);
}

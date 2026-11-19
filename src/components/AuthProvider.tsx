import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// undefined = still checking the session; null = signed out.
type AuthState = { user: User | null | undefined };
const AuthContext = createContext<AuthState>({ user: undefined });

export const useAuth = () => useContext(AuthContext);
export const useAccount = () => useContext(AuthContext).user ?? null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void queryClient.invalidateQueries();
    });
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Scissors, LogOut, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { accountKind } from "@/lib/account";
export const Route = createFileRoute("/_authenticated/barbers")({
  head: () => ({ meta: [{ title: "Your Barberly Account" }, { name: "description", content: "Your personal Barberly space. More great hair days are coming soon." }, { property: "og:title", content: "Your Barberly Account" }, { property: "og:description", content: "Your personal space for better hair days." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Barbers,
});
function Barbers() {
  const { user } = Route.useRouteContext();
  const isBarber = accountKind(user.user_metadata) === "shop";
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function signOut() { setBusy(true); await queryClient.cancelQueries(); queryClient.clear(); const { error } = await supabase.auth.signOut(); if(error) { setError(error.message); setBusy(false); return; } await navigate({ to:"/login", replace:true }); }
  return <><header className="site-header shell-header border-b border-border"><Link to="/" className="wordmark">Barberly.</Link><div className="shell-actions flex items-center gap-3"><span className="break-all">Hi {user.email}</span>{isBarber && <span className="service-chip rounded-full">barber</span>}<Button variant="chip" disabled={busy} onClick={signOut}><LogOut/>Sign Out</Button></div></header><main className="shell-body fade-in"><div className="inline-flex p-5 rounded-full bg-secondary mb-7">{isBarber ? <Scissors size={30} strokeWidth={1.3}/> : <MapPin size={30} strokeWidth={1.3}/>}</div><p className="eyebrow">Something good is growing</p><h1 className="section-heading mt-4">{isBarber ? "Your next chapter starts here." : "Your next great barber is closer."}</h1><p className="text-muted-foreground mt-6 leading-8">{isBarber ? "Your barber dashboard is coming soon — profile, services & schedule arrive in the next milestone." : "Barbers near you are coming soon — browse & booking arrive in the next milestone."}</p><p className="text-sm text-muted-foreground mt-4 leading-7" lang="zh-Hant">{isBarber ? "理髮師後台即將上線 — 下一個里程碑會加上個人檔案、服務項目與排班管理。" : "附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。"}</p>{error && <p role="alert" className="text-destructive mt-4">{error}</p>}</main></>;
}
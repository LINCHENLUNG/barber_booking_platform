import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";

/** Customer → shop upgrade. Writes the caller's own profiles.role (RLS + role guard allow only this). */
export function BecomeShopCard() {
  const user = useAccount();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upgrade() {
    if (!user) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("profiles").update({ role: "shop" }).eq("id", user.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <section className="shop-card text-center max-w-xl mx-auto">
      <div className="inline-flex p-5 rounded-full bg-secondary mb-6">
        <Store size={30} strokeWidth={1.3} />
      </div>
      <p className="eyebrow">開店 / Become a shop</p>
      <h1 className="section-heading mt-3">List your barbers on Barberly.</h1>
      <p className="text-muted-foreground mt-4 leading-7">
        Turn this account into a shop. You can then add one or more barbers, their services and
        prices, sample hairstyle photos, and publish bookable time slots.
      </p>
      <p className="text-sm text-muted-foreground mt-2" lang="zh-Hant">
        把帳號升級成理髮店，就能上架理髮師、服務與價格、作品照，並發布可預約時段。
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive mt-4">
          {error}
        </p>
      )}
      <Button variant="pill" className="h-12 mt-7" disabled={busy} onClick={upgrade}>
        {busy ? <LoaderCircle className="animate-spin" /> : "Become a shop"}
      </Button>
    </section>
  );
}

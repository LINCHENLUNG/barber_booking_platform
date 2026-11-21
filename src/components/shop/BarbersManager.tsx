import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/AuthProvider";
import { useMyBarbers, type Barber } from "@/hooks/useShopData";
import { BarberForm, type BarberDraft } from "./BarberForm";
import { BarberPhotoManager } from "./BarberPhotoManager";

/** B. My barbers — a shop may run MANY barbers (no one-barber limit). */
export function BarbersManager() {
  const user = useAccount();
  const queryClient = useQueryClient();
  const { data: barbers = [], isLoading } = useMyBarbers();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["barbers"] });

  const toRow = (d: BarberDraft) => ({
    name: d.name,
    intro: d.intro || null,
    address: d.address || null,
  });

  async function create(d: BarberDraft) {
    const { error } = await supabase.from("barbers").insert({ ...toRow(d), shop_id: user!.id });
    if (error) return error.message;
    setAdding(false);
    await refresh();
    return null;
  }

  async function save(id: string, d: BarberDraft) {
    const { error } = await supabase.from("barbers").update(toRow(d)).eq("id", id);
    if (error) return error.message;
    setEditing(null);
    await refresh();
    return null;
  }

  async function remove(barber: Barber) {
    if (
      !window.confirm(
        `Delete ${barber.name}? Their services, time slots and photo records are removed too.`,
      )
    )
      return;
    setError("");
    const { data: photos } = await supabase
      .from("barber_photos")
      .select("storage_path")
      .eq("barber_id", barber.id);
    if (photos?.length) {
      await supabase.storage.from("barber-photos").remove(photos.map((p) => p.storage_path));
    }
    const { error } = await supabase.from("barbers").delete().eq("id", barber.id);
    if (error) setError(error.message);
    await refresh();
  }

  return (
    <section className="shop-card" aria-labelledby="barbers-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">B · 我的理髮師</p>
          <h2 id="barbers-heading" className="shop-heading">
            My barbers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            One shop can list as many barbers as it runs.
          </p>
        </div>
        {!adding && (
          <Button variant="chip" onClick={() => setAdding(true)}>
            <Plus />
            {barbers.length ? "Add another barber" : "Add a barber"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive mt-4">
          {error}
        </p>
      )}

      {adding && (
        <div className="barber-panel mt-6">
          <p className="text-sm font-medium mb-4">新增一位理髮師 / New barber</p>
          <BarberForm
            submitLabel="Add barber"
            onSubmit={create}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {!isLoading && barbers.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground mt-6">
          No barbers yet — add your first barber to start publishing services and time slots.
        </p>
      )}

      <ul className="mt-6 space-y-5">
        {barbers.map((barber) => (
          <li key={barber.id} className="barber-panel">
            {editing === barber.id ? (
              <BarberForm
                initial={{
                  name: barber.name,
                  intro: barber.intro ?? "",
                  address: barber.address ?? "",
                }}
                submitLabel="Save barber"
                onSubmit={(d) => save(barber.id, d)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-2xl">{barber.name}</h3>
                  {barber.address && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin size={14} />
                      {barber.address}
                    </p>
                  )}
                  {barber.intro && (
                    <p className="text-sm mt-3 leading-6 whitespace-pre-line">{barber.intro}</p>
                  )}
                </div>
                <div className="flex shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${barber.name}`}
                    onClick={() => setEditing(barber.id)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${barber.name}`}
                    onClick={() => void remove(barber)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )}
            <BarberPhotoManager barberId={barber.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

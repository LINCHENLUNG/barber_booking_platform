import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings, useServices, type Service } from "@/hooks/useShopData";
import { formatMoney, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/shop";

type Draft = { name: string; category: ServiceCategory; price: string; required_slots: string };
const EMPTY: Draft = { name: "", category: "cut", price: "", required_slots: "1" };

/** A. Services & price editor for one barber. Price is stored as WHOLE units (300 = NT$300). */
export function ServicesEditor({ barberId }: { barberId: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: services = [], isLoading } = useServices(barberId);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const slotMinutes = settings?.slot_minutes ?? 30;
  const currency = settings?.currency ?? "twd";
  const minor = settings?.currency_minor_units ?? 0;

  const price = Number(draft.price);
  const slots = Number(draft.required_slots);
  const valid =
    draft.name.trim().length > 0 &&
    draft.price !== "" &&
    Number.isInteger(price) &&
    price >= 0 &&
    Number.isInteger(slots) &&
    slots >= 1;

  function edit(s: Service) {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      category: s.category as ServiceCategory,
      price: String(s.price),
      required_slots: String(s.required_slots),
    });
  }

  function reset() {
    setEditingId(null);
    setDraft(EMPTY);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    const row = {
      name: draft.name.trim(),
      category: draft.category,
      price, // whole currency units — never ×100 here
      required_slots: slots,
    };
    const { error } = editingId
      ? await supabase.from("services").update(row).eq("id", editingId)
      : await supabase.from("services").insert({ ...row, barber_id: barberId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    reset();
    await queryClient.invalidateQueries({ queryKey: ["services", barberId] });
  }

  async function remove(s: Service) {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) setError(error.message);
    if (editingId === s.id) reset();
    await queryClient.invalidateQueries({ queryKey: ["services", barberId] });
  }

  return (
    <section className="shop-card" aria-labelledby="services-heading">
      <p className="eyebrow">A · 服務與價格</p>
      <h2 id="services-heading" className="shop-heading">
        Services &amp; prices
      </h2>

      {!isLoading && services.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4">No services yet.</p>
      )}
      {services.length > 0 && (
        <ul className="divide-y divide-border mt-4">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.name} <span className="service-chip ml-1 capitalize">{s.category}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(s.price, currency, minor)} · {s.required_slots} slot
                  {s.required_slots > 1 ? "s" : ""} ({s.required_slots * slotMinutes} min)
                </p>
              </div>
              <div className="flex shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => edit(s)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => void remove(s)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="barber-panel mt-5">
        <p className="text-sm font-medium mb-3">{editingId ? "Edit service" : "Add a service"}</p>
        <div className="service-form">
          <label className="block text-sm">
            名稱 Name
            <input
              required
              className="auth-field"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            分類 Category
            <select
              className="auth-field"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as ServiceCategory })}
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            價格 Price ({currency.toUpperCase()})
            <input
              required
              type="number"
              min={0}
              step={1}
              className="auth-field"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="300"
            />
          </label>
          <label className="block text-sm">
            所需時段數 Slots needed
            <input
              required
              type="number"
              min={1}
              step={1}
              className="auth-field"
              value={draft.required_slots}
              onChange={(e) => setDraft({ ...draft, required_slots: e.target.value })}
            />
          </label>
        </div>
        <p className="field-hint">
          Each slot is {slotMinutes} min — a 90-minute service needs {Math.ceil(90 / slotMinutes)}.
          Enter the price as a whole amount (300 = {formatMoney(300, currency, minor)}).
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive mt-3">
            {error}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="pill" disabled={busy || !valid}>
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : editingId ? (
              "Save service"
            ) : (
              <>
                <Plus />
                Add service
              </>
            )}
          </Button>
          {editingId && (
            <Button type="button" variant="chip" onClick={reset}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BarberDraft = { name: string; intro: string; address: string };

/** Create/edit form for one barber profile (name required; intro + address optional). */
export function BarberForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<BarberDraft>;
  submitLabel: string;
  onSubmit: (draft: BarberDraft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const err = await onSubmit({ name: name.trim(), intro: intro.trim(), address: address.trim() });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        名稱 Barber name <span className="text-destructive">*</span>
        <input
          required
          className="auth-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        簡介 Intro
        <textarea
          className="auth-field min-h-24"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="簡短介紹一下這位理髮師 / a short bio"
        />
      </label>
      <label className="block text-sm">
        地址 Address
        <input
          className="auth-field"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="pill" disabled={busy || !name.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="chip" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

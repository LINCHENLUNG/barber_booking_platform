import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useProfile";

/**
 * A. Shop-level payout settings → the caller's own `profiles` row.
 * Shop name + bank account name + number are ALL required to finish onboarding.
 * Bank fields are readable only by this shop and an admin (RLS on profiles).
 */
export function PayoutSettingsForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [shopName, setShopName] = useState(profile.display_name ?? "");
  const [accountName, setAccountName] = useState(profile.bank_account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setShopName(profile.display_name ?? "");
    setAccountName(profile.bank_account_name ?? "");
    setAccountNumber(profile.bank_account_number ?? "");
  }, [profile.display_name, profile.bank_account_name, profile.bank_account_number]);

  const filled = [shopName, accountName, accountNumber].every((v) => v.trim().length > 0);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!filled) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: shopName.trim(),
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <form className="shop-card" onSubmit={save} aria-labelledby="payout-heading">
      <p className="eyebrow">A · 撥款設定</p>
      <h2 id="payout-heading" className="shop-heading">
        Payout settings
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Shared by all your barbers. <strong>先用測試資料即可 / Use test data first.</strong>
      </p>

      <label className="block text-sm mt-6">
        店名 Shop name <span className="text-destructive">*</span>
        <input
          required
          className="auth-field"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="e.g. Downtown Cuts"
        />
        <span className="field-hint">
          你的理髮店名稱，會顯示在撥款紀錄上 / your shop's name, shown on payout records
        </span>
      </label>

      <div className="shop-grid-2 mt-5">
        <label className="block text-sm">
          匯款戶名 Account name <span className="text-destructive">*</span>
          <input
            required
            className="auth-field"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          匯款帳號 Account number <span className="text-destructive">*</span>
          <input
            required
            className="auth-field"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            autoComplete="off"
            inputMode="numeric"
          />
        </label>
      </div>
      <p className="field-hint">
        你的理髮店收款的銀行帳戶 / the bank account where your shop gets paid. Only you and the
        platform admin can see it.
      </p>

      {error && (
        <p role="alert" className="text-sm text-destructive mt-4">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-muted-foreground mt-4">
          Payout settings saved.
        </p>
      )}
      <Button variant="pill" className="mt-6" disabled={busy || !filled}>
        {busy ? <LoaderCircle className="animate-spin" /> : "Save payout settings"}
      </Button>
    </form>
  );
}

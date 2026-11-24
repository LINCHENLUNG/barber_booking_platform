import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { photoUrl, type BarberPhoto } from "@/hooks/useShopData";
import { requestAutofill, type AutofillDraft } from "@/lib/autofill";
import { errMessage } from "@/lib/errors";

/**
 * M4「AI 自動填寫」: sends the photos the shop ticked for AI to /api/ai/autofill, shows the
 * returned DRAFT in a dialog for editing, and only「套用」writes barbers.intro +
 * barber_photos.caption — with the shop's own session, through the M1.1 RLS.
 */
export function BarberAutofill({
  barberId,
  photos,
  selectedIds,
}: {
  barberId: string;
  photos: BarberPhoto[];
  selectedIds: string[];
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AutofillDraft | null>(null);
  const [intro, setIntro] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const photoById = new Map(photos.map((p) => [p.id, p]));
  const count = selectedIds.length;
  const hint =
    photos.length === 0
      ? "先上傳作品照，AI 才能幫你寫"
      : count === 0
        ? "勾選照片的 AI，再按『AI 自動填寫』"
        : `AI 會為勾選的 ${count} 張照片撰寫說明`;

  async function run() {
    setLoading(true);
    try {
      const result = await requestAutofill(barberId, selectedIds);
      setDraft(result);
      setIntro(result.intro);
      setCaptions(Object.fromEntries(result.photo_captions.map((c) => [c.photo_id, c.caption])));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!draft) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("barbers")
        .update({ intro: intro.trim() || null })
        .eq("id", barberId);
      if (error) throw error;
      for (const c of draft.photo_captions) {
        const text = (captions[c.photo_id] ?? "").trim();
        if (!text) continue;
        const { error: photoError } = await supabase
          .from("barber_photos")
          .update({ caption: text })
          .eq("id", c.photo_id);
        if (photoError) throw photoError;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["barbers"] }),
        queryClient.invalidateQueries({ queryKey: ["photos", barberId] }),
      ]);
      setDraft(null);
      toast.success("已套用 / Applied");
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="pill"
        disabled={loading || count === 0}
        onClick={() => void run()}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        {loading ? "AI 撰寫中…" : "AI 自動填寫"}
      </Button>
      <p className="text-sm text-muted-foreground">{hint}</p>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 草稿 / AI draft</DialogTitle>
            <DialogDescription>
              確認或修改後按「套用」才會存檔；按「取消」什麼都不會寫入。
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-6">
              <div>
                <label htmlFor={`ai-intro-${barberId}`} className="text-sm font-medium">
                  自我介紹 / Intro
                </label>
                <Textarea
                  id={`ai-intro-${barberId}`}
                  className="mt-2"
                  rows={5}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm font-medium">作品照說明 / Photo captions</p>
                <ul className="mt-3 space-y-4">
                  {draft.photo_captions.map((c) => {
                    const photo = photoById.get(c.photo_id);
                    return (
                      <li key={c.photo_id} className="flex gap-3">
                        {photo && (
                          <img
                            src={photoUrl(photo.storage_path)}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <Input
                            value={captions[c.photo_id] ?? ""}
                            aria-label="Photo caption"
                            onChange={(e) =>
                              setCaptions((prev) => ({ ...prev, [c.photo_id]: e.target.value }))
                            }
                          />
                          {c.refs.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              參考：
                              {c.refs.map((r) => (
                                <Badge key={r.id} variant="secondary">
                                  {r.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {draft.refs.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  AI 參考了這些髮型範本：{draft.refs.map((r) => r.name).join("、")}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="chip" disabled={saving} onClick={() => setDraft(null)}>
              取消 / Cancel
            </Button>
            <Button type="button" variant="pill" disabled={saving} onClick={() => void apply()}>
              {saving && <LoaderCircle className="animate-spin" />}
              套用 / Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

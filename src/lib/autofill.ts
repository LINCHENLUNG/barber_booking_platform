import { supabase } from "@/integrations/supabase/client";

export type AutofillDraft = {
  intro: string;
  photo_captions: { photo_id: string; caption: string; refs: { id: string; name: string }[] }[];
  refs: { id: string; name: string; similarity: number }[];
};

/**
 * Ask our server (/api/ai/autofill) for an AI-written DRAFT intro + captions for one of the
 * signed-in shop's barbers, based on the photos the shop ticked for AI. The server writes
 * nothing: the shop reviews the draft and saves it with its own session.
 */
export async function requestAutofill(
  barberId: string,
  photoIds: string[],
): Promise<AutofillDraft> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("請重新登入 / Please sign in again.");

  const res = await fetch("/api/ai/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ barber_id: barberId, photo_ids: photoIds }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<AutofillDraft> & { error?: string };
  if (res.ok && typeof body.intro === "string") return body as AutofillDraft;
  if (res.status === 401) throw new Error("請重新登入 / Please sign in again.");
  if (res.status === 403) throw new Error("這不是你的理髮師 / This is not your barber.");
  if (res.status === 400) throw new Error("請先勾選要讓 AI 撰寫的照片");
  throw new Error("AI 服務暫時無法使用，請稍後再試");
}

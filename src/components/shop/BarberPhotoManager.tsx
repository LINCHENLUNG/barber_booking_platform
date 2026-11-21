import { useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { photoUrl, usePhotos, type BarberPhoto } from "@/hooks/useShopData";
import { photoPath } from "@/lib/shop";

/**
 * C. Sample hairstyle photos for one barber. Files go to the public `barber-photos` bucket under
 * `<barber_id>/<uuid>.<ext>` (the Storage policy only lets the owning shop write there); each file
 * gets a `barber_photos` row. Delete removes both the object and the row.
 */
export function BarberPhotoManager({ barberId }: { barberId: string }) {
  const queryClient = useQueryClient();
  const { data: photos = [], isLoading } = usePhotos(barberId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["photos", barberId] });

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    let order = photos.reduce((max, p) => Math.max(max, p.sort_order), -1);
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} is not an image.`);
        continue;
      }
      const path = photoPath(barberId, file.name);
      const up = await supabase.storage
        .from("barber-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) {
        setError(up.error.message);
        continue;
      }
      order += 1;
      const row = await supabase
        .from("barber_photos")
        .insert({ barber_id: barberId, storage_path: path, sort_order: order });
      if (row.error) {
        await supabase.storage.from("barber-photos").remove([path]);
        setError(row.error.message);
      }
    }
    setBusy(false);
    await refresh();
  }

  async function update(id: string, patch: Partial<BarberPhoto>) {
    const { error } = await supabase.from("barber_photos").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  async function remove(photo: BarberPhoto) {
    setError("");
    const st = await supabase.storage.from("barber-photos").remove([photo.storage_path]);
    if (st.error) {
      setError(st.error.message);
      return;
    }
    const { error } = await supabase.from("barber_photos").delete().eq("id", photo.id);
    if (error) setError(error.message);
    await refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const other = photos[index + dir];
    const photo = photos[index];
    if (!other || !photo) return;
    // Normalise to positions so equal sort_orders still swap cleanly.
    await update(photo.id, { sort_order: index + dir });
    await update(other.id, { sort_order: index });
    await refresh();
  }

  async function saveCaption(photo: BarberPhoto, caption: string) {
    if ((photo.caption ?? "") === caption) return;
    await update(photo.id, { caption: caption || null });
    await refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">作品照 Sample hairstyle photos</p>
          <p className="field-hint mt-0">Public portfolio. Star your best work as Featured.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={upload}
          aria-label="Upload sample hairstyle photos"
        />
        <Button type="button" variant="chip" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          Upload photos
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive mt-3">
          {error}
        </p>
      )}
      {isLoading ? null : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-4">No photos yet.</p>
      ) : (
        <ul className="photo-wall mt-4">
          {photos.map((photo, i) => (
            <li key={photo.id} className="photo-tile">
              <div className="photo-frame">
                <img src={photoUrl(photo.storage_path)} alt={photo.caption ?? "Sample hairstyle"} />
                {photo.is_featured && <span className="popular-badge">Featured</span>}
              </div>
              <input
                className="photo-caption"
                defaultValue={photo.caption ?? ""}
                placeholder="Caption"
                aria-label="Photo caption"
                onBlur={(e) => void saveCaption(photo, e.target.value.trim())}
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={photo.is_featured ? "Unmark featured" : "Mark as featured"}
                  aria-pressed={photo.is_featured}
                  onClick={async () => {
                    await update(photo.id, { is_featured: !photo.is_featured });
                    await refresh();
                  }}
                >
                  <Star className={photo.is_featured ? "fill-current" : ""} />
                </Button>
                <div className="flex">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Move earlier"
                    disabled={i === 0}
                    onClick={() => void move(i, -1)}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Move later"
                    disabled={i === photos.length - 1}
                    onClick={() => void move(i, 1)}
                  >
                    <ArrowRight />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Delete photo"
                    onClick={() => void remove(photo)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

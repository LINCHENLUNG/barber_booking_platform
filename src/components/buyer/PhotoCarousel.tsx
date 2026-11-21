import { useState } from "react";
import { ChevronLeft, ChevronRight, Scissors, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { photoUrl } from "@/hooks/useShopData";

type Photo = { id: string; storage_path: string; caption: string | null; is_featured: boolean };

/** Product-detail style carousel: main image, prev/next, thumbnails, click to zoom. */
export function PhotoCarousel({ photos, name }: { photos: Photo[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);

  if (!photos.length) {
    return (
      <div className="carousel-main photo-placeholder">
        <Scissors size={44} strokeWidth={1.1} />
        <p className="text-sm text-muted-foreground mt-3">No portfolio photos yet</p>
      </div>
    );
  }

  const current = photos[Math.min(index, photos.length - 1)]!;
  const go = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const alt = current.caption || `${name}'s hairstyle ${index + 1}`;

  return (
    <div>
      <div
        className="carousel-main"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <button
          type="button"
          className="carousel-image"
          aria-label="Zoom photo"
          onClick={() => setZoom(true)}
        >
          <img src={photoUrl(current.storage_path)} alt={alt} />
          <span className="carousel-zoom">
            <ZoomIn size={16} />
          </span>
        </button>
        {current.is_featured && <span className="popular-badge">Featured</span>}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="carousel-arrow left"
              aria-label="Previous photo"
              onClick={() => go(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="carousel-arrow right"
              aria-label="Next photo"
              onClick={() => go(1)}
            >
              <ChevronRight />
            </button>
            <span className="carousel-count">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {current.caption && <p className="text-sm text-muted-foreground mt-2">{current.caption}</p>}
      {photos.length > 1 && (
        <div className="carousel-thumbs" role="tablist" aria-label="Photos">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              className={i === index ? "active" : ""}
              onClick={() => setIndex(i)}
            >
              <img src={photoUrl(p.storage_path)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="lightbox">
          <DialogTitle className="sr-only">{name}'s work</DialogTitle>
          <DialogDescription className="sr-only">{alt}</DialogDescription>
          <img src={photoUrl(current.storage_path)} alt={alt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

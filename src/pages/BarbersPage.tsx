import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Scissors, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { orderPhotos, useBarberDirectory } from "@/hooks/useBuyerData";
import { photoUrl, usePlatformSettings } from "@/hooks/useShopData";
import { ShellHeader } from "@/components/ShellHeader";
import { formatMoney, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/shop";

const FILTERS = ["all", ...SERVICE_CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

/** /barbers — public marketplace grid of every barber, with search + category chips. */
export default function BarbersPage() {
  usePageTitle("Find your barber — Barberly");
  const { data: barbers = [], isLoading, error } = useBarberDirectory();
  const { data: settings } = usePlatformSettings();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return barbers.filter((b) => {
      const text = `${b.name} ${b.address ?? ""} ${b.intro ?? ""}`.toLowerCase();
      const cats = new Set(b.services.map((s) => s.category as ServiceCategory));
      return (!q || text.includes(q)) && (filter === "all" || cats.has(filter));
    });
  }, [barbers, query, filter]);

  return (
    <>
      <ShellHeader />
      <main className="popular-section fade-in">
        <p className="eyebrow">Barbers near you</p>
        <h1 className="section-heading mt-2">Find a barber who gets you.</h1>

        <div className="browse-tools mt-6">
          <label className="hero-search browse-search">
            <Search size={16} />
            <input
              aria-label="Search barbers"
              placeholder="Search by name or area"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="filter-row justify-start" role="group" aria-label="Service category">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={f === filter ? "selected" : "chip"}
                aria-pressed={f === filter}
                className="capitalize"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-destructive mt-8">
            We couldn't load barbers right now.
          </p>
        )}
        {!isLoading && !error && shown.length === 0 && (
          <p className="text-muted-foreground mt-10">
            {barbers.length ? "No barbers match that search." : "No barbers have listed yet."}
          </p>
        )}

        <div className="barber-grid">
          {shown.map((b) => {
            const cover = orderPhotos(b.barber_photos)[0];
            const cats = [...new Set(b.services.map((s) => s.category))];
            const from = b.services.length ? Math.min(...b.services.map((s) => s.price)) : null;
            return (
              <Link key={b.id} to={`/barbers/${b.id}`} className="barber-card">
                <div className="barber-photo">
                  {cover ? (
                    <img
                      src={photoUrl(cover.storage_path)}
                      alt={`${b.name}'s work`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="photo-placeholder">
                      <Scissors size={34} strokeWidth={1.2} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-display text-xl">{b.name}</h2>
                  {b.address && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin size={12} />
                      {b.address}
                    </p>
                  )}
                  {b.intro && <p className="text-sm mt-2 line-clamp-2">{b.intro}</p>}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {cats.map((c) => (
                      <span key={c} className="service-chip capitalize">
                        {c}
                      </span>
                    ))}
                  </div>
                  {from !== null && (
                    <p className="text-sm mt-3">
                      from{" "}
                      <strong>
                        {formatMoney(
                          from,
                          settings?.currency ?? "twd",
                          settings?.currency_minor_units ?? 0,
                        )}
                      </strong>
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useState } from "react";
import { ArrowUpRight, Search, Scissors, BadgeCheck, CalendarCheck, ShieldCheck, Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import hair from "@/assets/editorial-hair.jpg";
import woman from "@/assets/editorial-woman.jpg";
import portrait0 from "@/assets/barber-0.jpg";
import portrait1 from "@/assets/barber-1.jpg";
import portrait2 from "@/assets/barber-2.jpg";
import portrait3 from "@/assets/barber-3.jpg";
const portraits = [portrait0, portrait1, portrait2, portrait3];

const barbers = [
  { name: "Alex Morgan", shop: "The Modern Chair", location: "Brooklyn, NY", services: ["Cut", "Beard"], rating: "4.9", reviews: 128, price: 35 },
  { name: "Sofia Chen", shop: "Studio & Strand", location: "Manhattan, NY", services: ["Cut", "Color"], rating: "4.9", reviews: 96, price: 45 },
  { name: "Leo Bennett", shop: "Good Company", location: "Brooklyn, NY", services: ["Cut", "Perm", "Beard"], rating: "4.8", reviews: 84, price: 30 },
  { name: "Emma Davis", shop: "The Hair Edit", location: "Queens, NY", services: ["Cut", "Color", "Perm"], rating: "4.9", reviews: 112, price: 40 },
];
export default function HomePage() {
  usePageTitle("Barberly — Style with Confident Hair");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const visible = barbers.map((barber, index) => ({ ...barber, index })).filter(b => (filter === "All" || b.services.includes(filter)) && `${b.name} ${b.shop} ${b.location} ${b.services.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <><SiteHeader onSearch={setQuery}/><main>
    <section className="hero fade-in">
      <img src={hair} width={800} height={1024} alt="A textured, wavy haircut" className="hero-photo left"/>
      <img src={woman} width={800} height={1024} alt="A softly layered brunette bob" className="hero-photo right"/>
      <p className="eyebrow">A fresh start. A new you. <span className="ml-2">✳</span> New Look</p>
      <h1>Style with<br/><em>Confident Hair</em></h1>
      <p className="hero-subtitle">Great hair starts with the right hands.<br/>Find a barber who gets you, and a look that feels like you.</p>
      <form className="hero-search" onSubmit={e => { e.preventDefault(); document.getElementById("popular")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={18} className="text-muted-foreground"/><input aria-label="Find your stylist or search a style" placeholder="Find your stylist or search a style" value={query} onChange={e => setQuery(e.target.value)}/><Button variant="pill" size="icon" aria-label="Search"><ArrowUpRight/></Button></form>
      <div className="filter-row">{["All", "Cut", "Color", "Perm", "Beard"].map(service => <Button key={service} size="sm" variant={filter === service ? "selected" : "chip"} aria-pressed={filter === service} onClick={() => setFilter(service)}>{service === "Cut" && <Scissors/>}{service}</Button>)}</div>
    </section>
    <section className="trust-strip"><p className="eyebrow">In good company</p><div className="partner-logos" aria-label="Salon brand inspiration"><span>L’Oréal <small className="text-xs">PROFESSIONNEL</small></span><span className="sans-logo">WELLA <small>PROFESSIONALS</small></span><span>Schwarzkopf</span><span className="sans-logo">REDKEN</span><span>Davines</span></div></section>
    <section className="feature-section"><h2 className="section-heading">Best booking experience</h2><div className="features">{[[BadgeCheck, "Verified Barbers"], [CalendarCheck, "Instant Booking"], [ShieldCheck, "Secure Payment"], [Star, "Top-Rated Styles"]].map(([Icon, label]) => { const FeatureIcon = Icon as typeof Star; return <div className="feature" key={String(label)}><span className="feature-icon"><FeatureIcon size={21} strokeWidth={1.4}/></span><span>{String(label)}</span></div>; })}</div></section>
    <section className="popular-section" id="popular"><div className="flex items-end justify-between"><div><p className="eyebrow mb-2">Good hair. Great people.</p><h2 className="section-heading">Popular</h2></div><span className="text-xs text-muted-foreground">The names worth knowing</span></div><div className="barber-grid">{visible.map(b => <Link to="/barbers" className="barber-card" key={b.name}><div className="barber-photo"><img src={portraits[b.index]} width={480} height={1024} loading="lazy" alt={`${b.name}, hairstylist`}/><span className="popular-badge">Popular</span></div><div className="p-4"><h3 className="font-semibold text-base">{b.name}</h3><p className="text-xs text-muted-foreground mt-1">{b.shop}</p><p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><MapPin size={11}/>{b.location}</p><div className="flex flex-wrap gap-1 mt-3">{b.services.map(s => <span className="service-chip" key={s}>{s}</span>)}</div><div className="flex justify-between items-center mt-4 border-t border-border pt-3 gap-1"><span className="text-xs flex items-center gap-1"><Star size={12} fill="currentColor"/>{b.rating} <span className="text-muted-foreground text-[10px]">({b.reviews})</span></span><span className="text-xs text-muted-foreground">from <strong className="text-foreground">${b.price}</strong></span></div></div></Link>)}</div>{visible.length === 0 && <p className="py-10 text-center text-muted-foreground">No featured barbers match your search.</p>}</section>
  </main><footer className="site-footer"><span className="wordmark text-foreground">Barberly.</span><span>© 2026 Barberly</span></footer></>;
}

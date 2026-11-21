import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "./AuthProvider";
import { useProfile } from "@/hooks/useProfile";
import { homePathFor } from "@/lib/account";
export function SiteHeader({ onSearch }: { onSearch?: (query: string) => void }) {
  const user = useAccount();
  const { role } = useProfile();
  return <header className="site-header"><Link to="/" className="wordmark">Barberly<span className="text-muted-foreground">.</span></Link><label className="nav-search"><Search size={16}/><input aria-label="Search barbers" placeholder="Search for your next great look" onChange={e => onSearch?.(e.target.value)}/></label><Button variant="pill" asChild><Link to={user ? homePathFor(role) : "/login"}>{user ? "My account" : "Login"}</Link></Button></header>;
}
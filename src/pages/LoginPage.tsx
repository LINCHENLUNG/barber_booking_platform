import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { homePathFor, safeNext, signupOptions, type AccountKind } from "@/lib/account";
import { fetchRole } from "@/hooks/useProfile";
import woman from "@/assets/editorial-woman.jpg";

export default function LoginPage() {
  usePageTitle("Join Barberly — Sign In & Sign Up");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [signup, setSignup] = useState(false);
  const [role, setRole] = useState<AccountKind>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = signup ? await supabase.auth.signUp({ email, password, options: signupOptions(role, window.location.origin) }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) { setError(result.error.message); return; }
      if (!result.data.session) { setNotice("Check your email to confirm your account before signing in."); return; }
      // Branch on profiles.role (shop / customer), not on auth metadata.
      navigate(safeNext(searchParams.get("next")) ?? homePathFor(await fetchRole(result.data.session.user.id)), { replace: true });
    } catch { setError("We couldn't connect. Please try again."); } finally { setBusy(false); }
  }
  return <><header className="site-header"><Link to="/" className="wordmark">Barberly.</Link><Button variant="ghost" asChild><Link to="/"><ArrowLeft/>Back home</Link></Button></header><main className="auth-layout"><div className="auth-photo"><img src={woman} width={800} height={1024} alt="A fresh, layered haircut"/></div><div className="auth-form-wrap"><div className="auth-form fade-in"><p className="eyebrow">Your next chapter</p><h1 className="section-heading mt-3">{signup ? "Good hair starts here." : "Welcome back."}</h1><p className="text-sm text-muted-foreground mt-3 mb-8">{signup ? "A fresh look. A stylist who gets you." : "A great hair day is always worth coming back for."}</p><div className="flex gap-6 border-b border-border mb-7"><Button variant="ghost" className={!signup ? "border-b-2 border-primary rounded-none" : "text-muted-foreground"} onClick={() => { setSignup(false); setError(""); setNotice(""); }}>Sign In</Button><Button variant="ghost" className={signup ? "border-b-2 border-primary rounded-none" : "text-muted-foreground"} onClick={() => { setSignup(true); setError(""); setNotice(""); }}>Sign Up</Button></div><form onSubmit={submit}>{signup && <div role="tablist" aria-label="Account type" className="segment mb-6"><Button role="tab" aria-selected={role === "customer"} variant={role === "customer" ? "tab" : "ghost"} className="flex-1" onClick={() => setRole("customer")} type="button">Customer</Button><Button role="tab" aria-selected={role === "shop"} variant={role === "shop" ? "tab" : "ghost"} className="flex-1" onClick={() => setRole("shop")} type="button">Barber</Button></div>}<label className="block text-sm mb-5">Email address<input required type="email" autoComplete="email" className="auth-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/></label><label className="block text-sm">Password<div className="relative"><input required minLength={6} type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} className="auth-field pr-12" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}/><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-3">{showPassword ? <EyeOff/> : <Eye/>}</Button></div></label>{error && <p role="alert" className="text-sm text-destructive mt-4">{error}</p>}{notice && <p role="status" className="text-sm text-muted-foreground mt-4">{notice}</p>}<Button variant="pill" className="w-full h-12 mt-7" disabled={busy}>{busy ? <LoaderCircle className="animate-spin"/> : <>{signup ? "Create account" : "Sign in"}<ArrowRight/></>}</Button></form><p className="text-xs text-muted-foreground text-center mt-6">{signup ? "Already found your people?" : "New to Barberly?"} <Button variant="link" size="sm" onClick={() => setSignup(!signup)}>{signup ? "Sign in" : "Create an account"}</Button></p></div></div></main></>;
}
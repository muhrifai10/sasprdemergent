import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Sparkles, Globe, Menu, X } from "lucide-react";

const t = {
  id: { features: "Fitur", how: "Cara Kerja", pricing: "Harga", faq: "FAQ", login: "Masuk", dashboard: "Dashboard", start: "Mulai Gratis" },
  en: { features: "Features", how: "How It Works", pricing: "Pricing", faq: "FAQ", login: "Sign In", dashboard: "Dashboard", start: "Start Free" },
};

export default function Navbar() {
  const { lang, toggle } = useLang();
  const { user, login } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const c = t[lang];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    api.get("/site-settings").then((res) => setLogoUrl(res.data.logo_url)).catch(() => {});
  }, []);

  return (
    <header className={`landing-nav fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "is-scrolled" : ""}`}>
       <nav className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-3">
         <a href="#top" className="flex items-center gap-2.5" data-testid="nav-logo">
           {logoUrl ? <img src={logoUrl} alt="PRD CreativeAI" className="h-8 max-w-[180px] rounded-xl object-contain" /> : <><span className="landing-logo-mark flex h-8 w-8 items-center justify-center rounded-xl"><Sparkles size={15} className="text-white" aria-hidden="true" /></span><span className="font-display text-[15px] font-semibold tracking-tight">PRD <span className="lp-coral">CreativeAI</span></span></>}
        </a>
         <div className="lp-muted hidden items-center gap-7 text-[13px] md:flex">
          <a href="#manifesto" className="hover:text-white transition-colors" data-testid="nav-how">{c.how}</a>
          <a href="#features" className="hover:text-white transition-colors" data-testid="nav-features">{c.features}</a>
          <a href="#pricing" className="hover:text-white transition-colors" data-testid="nav-pricing">{c.pricing}</a>
          <a href="#faq" className="hover:text-white transition-colors" data-testid="nav-faq">{c.faq}</a>
        </div>
         <div className="hidden items-center gap-3 md:flex">
           <button onClick={toggle} className="landing-lang lp-muted flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-mono transition-colors" data-testid="lang-toggle">
             <Globe size={13} aria-hidden="true" /> {lang.toUpperCase()}
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary text-sm px-5 py-2 rounded-full font-semibold" data-testid="nav-dashboard-btn">{c.dashboard}</Link>
          ) : (
            <button onClick={login} className="btn-primary text-sm px-5 py-2 rounded-full font-semibold" data-testid="nav-login-btn">{c.login}</button>
          )}
         </div>
         <button onClick={() => setMobileOpen((open) => !open)} className="rounded-full border border-white/10 p-2 text-white md:hidden" aria-label="Toggle navigation" aria-expanded={mobileOpen} data-testid="mobile-nav-menu-btn">
           {mobileOpen ? <X size={18} /> : <Menu size={18} />}
         </button>
       </nav>
       {mobileOpen && <div className="absolute inset-x-0 top-16 border-b border-white/10 bg-[#0b080e]/95 p-4 shadow-2xl backdrop-blur-xl md:hidden" data-testid="mobile-landing-menu">
         <div className="flex flex-col gap-1 text-sm">
           {[["#manifesto", c.how, "nav-how"], ["#features", c.features, "nav-features"], ["#pricing", c.pricing, "nav-pricing"], ["#faq", c.faq, "nav-faq"]].map(([href, label, testid]) => <a key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-lg px-4 py-3 text-zinc-300 hover:bg-white/5" data-testid={`mobile-${testid}`}>{label}</a>)}
           <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-3">
             <button onClick={toggle} className="landing-lang lp-muted flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-mono" data-testid="mobile-lang-toggle"><Globe size={13} />{lang.toUpperCase()}</button>
             {user ? <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="btn-primary flex-1 rounded-full px-5 py-2 text-center text-sm font-semibold" data-testid="mobile-nav-dashboard-btn">{c.dashboard}</Link> : <button onClick={() => { setMobileOpen(false); login(); }} className="btn-primary flex-1 rounded-full px-5 py-2 text-sm font-semibold" data-testid="mobile-nav-login-btn">{c.login}</button>}
           </div>
         </div>
       </div>}
     </header>
  );
}

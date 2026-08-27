import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { api } from "../lib/api";
import { LayoutDashboard, FolderKanban, Plus, LogOut, Sparkles, Globe, ShieldCheck, CreditCard, Menu, X } from "lucide-react";

const t = {
  id: { dashboard: "Dashboard", projects: "Projects", create: "Buat Project", logout: "Keluar", admin: "Admin", upgrade: "Upgrade Pro" },
  en: { dashboard: "Dashboard", projects: "Projects", create: "Create Project", logout: "Sign Out", admin: "Admin", upgrade: "Upgrade Pro" },
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { lang, toggle } = useLang();
  const location = useLocation();
  const c = t[lang];
  const [logoUrl, setLogoUrl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api.get("/site-settings").then((res) => setLogoUrl(res.data.logo_url)).catch(() => {});
  }, []);

  const nav = [
    { to: "/dashboard", icon: LayoutDashboard, label: c.dashboard, testid: "sidebar-dashboard" },
    { to: "/projects", icon: FolderKanban, label: c.projects, testid: "sidebar-projects" },
    { to: "/projects/new", icon: Plus, label: c.create, testid: "sidebar-create" },
    ...(user?.plan === "free" ? [{ to: "/upgrade", icon: CreditCard, label: c.upgrade, testid: "sidebar-upgrade" }] : []),
    ...(user?.role === "admin" ? [{ to: "/admin", icon: ShieldCheck, label: c.admin, testid: "sidebar-admin" }] : []),
  ];

  return (
    <div className="app-shell min-h-screen bg-[#0A0A0A] text-white flex">
      <aside className="app-sidebar hidden md:flex flex-col w-60 border-r border-white/10 fixed inset-y-0 left-0 bg-[#0D0D0F] z-30">
        <Link to="/" className="flex items-center gap-2.5 px-6 h-16 border-b border-white/10" data-testid="sidebar-logo">
          {logoUrl ? <img src={logoUrl} alt="PRD CreativeAI" className="h-8 max-w-[180px] rounded-lg object-contain" /> : <><span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><Sparkles size={14} /></span><span className="font-display font-bold text-sm">PRD CreativeAI</span></>}
        </Link>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} data-testid={item.testid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${active ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20" : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"}`}>
                <item.icon size={17} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <button onClick={toggle} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors" data-testid="app-lang-toggle">
            <Globe size={13} /> {lang === "id" ? "Bahasa Indonesia" : "English"}
          </button>
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{user?.name?.[0] || "U"}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" data-testid="user-name">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-[9px] font-mono uppercase tracking-widest text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 rounded-full px-2 py-0.5" data-testid="user-plan-badge">{user?.plan || "free"}</span>
            </div>
            <button onClick={logout} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid="logout-btn" aria-label="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

       <div className="app-mobile-bar md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center justify-between gap-3 px-4 glass">
         <Link to="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
            {logoUrl ? <img src={logoUrl} alt="PRD CreativeAI" className="h-6 max-w-[150px] rounded-md object-contain" /> : <><span className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center"><Sparkles size={12} /></span><span className="font-display font-bold text-sm">PRD CreativeAI</span></>}
         </Link>
         <button onClick={() => setMobileOpen((open) => !open)} className="shrink-0 rounded-lg p-2 text-zinc-300 hover:bg-white/10" aria-label="Toggle navigation" aria-expanded={mobileOpen} data-testid="mobile-menu-btn">
           {mobileOpen ? <X size={20} /> : <Menu size={20} />}
         </button>
       </div>
       {mobileOpen && <>
         <button className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
         <nav className="fixed left-3 right-3 top-[4.25rem] z-40 space-y-1 rounded-2xl border border-white/10 bg-[#17101c] p-3 shadow-2xl md:hidden" data-testid="mobile-navigation">
           {nav.map((item) => <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} data-testid={`mobile-${item.testid}`} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${location.pathname === item.to ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-300 hover:bg-white/5"}`}><item.icon size={17} />{item.label}</Link>)}
           <div className="mt-2 border-t border-white/10 pt-2">
             <button onClick={toggle} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-zinc-400 hover:bg-white/5" data-testid="mobile-lang-toggle"><Globe size={17} />{lang === "id" ? "Bahasa Indonesia" : "English"}</button>
             <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-red-300 hover:bg-red-500/10" data-testid="mobile-logout-btn"><LogOut size={17} />{c.logout}</button>
           </div>
         </nav>
       </>}

       <main className="app-main min-w-0 flex-1 md:ml-60 pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}

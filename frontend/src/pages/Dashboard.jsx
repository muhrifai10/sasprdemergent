import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { FolderKanban, FileText, Bot, Zap, Plus, ArrowRight, CreditCard } from "lucide-react";

const t = {
  id: { hi: "Halo", sub: "Ubah ide berikutnya menjadi PRD hari ini.", projects: "Total Project", prds: "PRD Dihasilkan", prompts: "Agent Prompt", gens: "Total Generasi", recent: "Project Terbaru", empty: "Belum ada project. Buat yang pertama!", create: "Buat Project Baru", open: "Buka", plan: "Plan", prdQuota: "PRD", promptQuota: "Agent Prompt", upgrade: "Upgrade ke Pro" },
  en: { hi: "Hello", sub: "Turn your next idea into a PRD today.", projects: "Total Projects", prds: "PRDs Generated", prompts: "Agent Prompts", gens: "Total Generations", recent: "Recent Projects", empty: "No projects yet. Create your first one!", create: "Create New Project", open: "Open", plan: "Plan", prdQuota: "PRD", promptQuota: "Agent Prompt", upgrade: "Upgrade to Pro" },
};

export default function Dashboard() {
  const { lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const c = t[lang];
  const [stats, setStats] = useState(null);
  const [limits, setLimits] = useState(null);

  const loadDashboard = useCallback(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => setStats({ total_projects: 0, total_prds: 0, total_prompts: 0, total_generations: 0, recent_projects: [] }));
    api.get("/me/limits").then((r) => setLimits(r.data)).catch(() => {});
  }, []);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const cards = [
    { id: "projects", icon: FolderKanban, label: c.projects, value: stats?.total_projects },
    { id: "prds", icon: FileText, label: c.prds, value: stats?.total_prds },
    { id: "prompts", icon: Bot, label: c.prompts, value: stats?.total_prompts },
    { id: "generations", icon: Zap, label: c.gens, value: stats?.total_generations },
  ];

  return (
    <AppLayout>
       <div className="dashboard-view w-full max-w-6xl p-4 sm:p-6 lg:p-12" data-testid="dashboard-page">
        <div className="dashboard-intro flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dashboard-eyebrow text-[10px] font-mono uppercase tracking-[0.28em] text-indigo-300">PRD CREATIVEAI / WORKSPACE</p>
            <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight mt-3">{c.hi}, {user?.name?.split(" ")[0]}</h1>
            <p className="text-zinc-500 mt-2 text-sm">{c.sub}</p>
            {limits && (
              <p className="mt-3 text-[11px] font-mono text-zinc-500" data-testid="plan-limits-line">
                <span className="text-indigo-300 uppercase tracking-widest">{limits.plan_name}</span>
                {" · "}{limits.projects_used}/{limits.max_projects ?? "∞"} project
                {" · "}{c.prdQuota} {limits.prd_used}/{limits.prd_limit ?? "∞"}
                {" · "}{c.promptQuota} {limits.prompt_used}/{limits.prompt_limit ?? "∞"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.plan === "free" && <button onClick={() => navigate("/upgrade")} className="btn-ghost px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-zinc-200" data-testid="dashboard-upgrade-btn"><CreditCard size={15} /> {c.upgrade}</button>}
            <button onClick={() => navigate("/projects/new")} className="btn-primary px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2" data-testid="dashboard-create-btn">
              <Plus size={15} /> {c.create}
            </button>
          </div>
        </div>

        <div className="dashboard-metrics mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.06 }}
              className={`dashboard-stat dashboard-stat-${card.id} bg-[#121212] border border-white/10 rounded-2xl p-6`}>
              <card.icon size={18} className="text-indigo-400 mb-4" />
              <p className="font-display text-3xl font-black" data-testid={`stat-value-${i}`}>{stats ? card.value : "—"}</p>
              <p className="text-zinc-500 text-xs mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="dashboard-section-heading flex items-end justify-between mt-12 mb-5">
          <h2 className="font-display text-lg font-bold">{c.recent}</h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">LATEST ACTIVITY</span>
        </div>
        {stats && stats.recent_projects.length === 0 ? (
          <div className="dashboard-empty border border-dashed border-white/15 rounded-2xl p-14 text-center" data-testid="dashboard-empty-state">
            <FolderKanban size={28} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-500 text-sm">{c.empty}</p>
            <button onClick={() => navigate("/projects/new")} className="btn-ghost mt-6 px-6 py-2.5 rounded-full text-sm text-zinc-300" data-testid="empty-create-btn">
              {c.create}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(stats?.recent_projects || []).map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} data-testid={`recent-project-${p.id}`}
                className="dashboard-project-row flex items-center justify-between bg-[#121212] border border-white/10 rounded-xl px-6 py-4 card-hover group">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-zinc-500 text-xs truncate mt-0.5">{p.product_type || p.description?.slice(0, 80)}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {p.prd_status === "completed" && <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">PRD</span>}
                  {p.prompt_status === "completed" && <span className="text-[10px] font-mono text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 rounded-full">PROMPT</span>}
                  <ArrowRight size={15} className="text-zinc-600 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

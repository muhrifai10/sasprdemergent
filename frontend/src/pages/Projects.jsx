import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";
import { Plus, Search, Trash2, FileText, Bot, FolderKanban, Download, Copy } from "lucide-react";

const t = {
  id: { title: "Projects", search: "Cari project...", empty: "Belum ada project.", create: "Buat Project", del: "Project dihapus", confirm: "Hapus project ini beserta PRD & prompt-nya?", copied: "Prompt disalin ke clipboard", downloaded: "PRD.md diunduh", exportPrd: "Export PRD.md", copyPrompt: "Salin Prompt" },
  en: { title: "Projects", search: "Search projects...", empty: "No projects yet.", create: "Create Project", del: "Project deleted", confirm: "Delete this project along with its PRD & prompts?", copied: "Prompt copied to clipboard", downloaded: "PRD.md downloaded", exportPrd: "Export PRD.md", copyPrompt: "Copy Prompt" },
};

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Projects() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const c = t[lang];
  const [projects, setProjects] = useState(null);
  const [query, setQuery] = useState("");

  const loadProjects = useCallback(() => {
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => setProjects([]));
  }, []);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  const remove = async (e, id) => {
    e.preventDefault();
    if (!window.confirm(c.confirm)) return;
    await api.delete(`/projects/${id}`);
    setProjects((p) => p.filter((x) => x.id !== id));
    toast.success(c.del);
  };

  const exportPrd = async (e, p) => {
    e.preventDefault();
    try {
      const res = await api.get(`/projects/${p.id}/prd`);
      downloadFile(`${p.name.replace(/\s+/g, "_")}_PRD.md`, res.data.content);
      toast.success(c.downloaded);
    } catch { toast.error("PRD not found"); }
  };

  const copyPrompt = async (e, p) => {
    e.preventDefault();
    try {
      const res = await api.get(`/projects/${p.id}/prompt`);
      await navigator.clipboard.writeText(res.data.content);
      toast.success(c.copied);
    } catch { toast.error("Prompt not found"); }
  };

  const filtered = (projects || []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppLayout>
       <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-12" data-testid="projects-page">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-black tracking-tight">{c.title}</h1>
          <button onClick={() => navigate("/projects/new")} className="btn-primary px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2" data-testid="projects-create-btn">
            <Plus size={15} /> {c.create}
          </button>
        </div>
        <div className="relative mt-8 max-w-md">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search}
            className="w-full bg-[#121212] border border-white/10 rounded-full pl-11 pr-4 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            data-testid="projects-search-input" />
        </div>

        {projects === null ? (
          <div className="mt-14 flex justify-center"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 border border-dashed border-white/15 rounded-2xl p-14 text-center" data-testid="projects-empty-state">
            <FolderKanban size={28} className="mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-500 text-sm">{c.empty}</p>
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="bg-[#121212] border border-white/10 rounded-2xl p-6 card-hover group relative" data-testid={`project-card-${p.id}`}>
                <div className="flex items-start justify-between">
                   <h3 className="min-w-0 break-words font-display font-bold text-base pr-6 leading-snug">{p.name}</h3>
                  <button onClick={(e) => remove(e, p.id)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0" data-testid={`project-delete-${p.id}`} aria-label="Delete project">
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="text-zinc-500 text-xs mt-2 line-clamp-2 leading-relaxed">{p.description || p.product_type || "—"}</p>
                <div className="flex items-center gap-2 mt-5">
                  <span className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${p.prd_status === "completed" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-zinc-600 border-white/10"}`}>
                    <FileText size={10} /> PRD
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${p.prompt_status === "completed" ? "text-indigo-300 border-indigo-500/30 bg-indigo-500/10" : "text-zinc-600 border-white/10"}`}>
                    <Bot size={10} /> PROMPT
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {p.prd_status === "completed" && (
                      <button onClick={(e) => exportPrd(e, p)} title={c.exportPrd}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-white/5 transition-colors" data-testid={`card-export-prd-${p.id}`} aria-label={c.exportPrd}>
                        <Download size={13} />
                      </button>
                    )}
                    {p.prompt_status === "completed" && (
                      <button onClick={(e) => copyPrompt(e, p)} title={c.copyPrompt}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-indigo-300 hover:bg-white/5 transition-colors" data-testid={`card-copy-prompt-${p.id}`} aria-label={c.copyPrompt}>
                        <Copy size={13} />
                      </button>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

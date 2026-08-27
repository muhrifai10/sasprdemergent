import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import AppLayout from "../components/AppLayout";
import { api, streamGeneration } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";
import { FileText, Bot, Copy, Download, RefreshCw, Loader2, Pencil, Save, X, Sparkles, AlertTriangle, Share2 } from "lucide-react";

const t = {
  id: {
    overview: "Ringkasan", prd: "PRD", prompt: "Agent Prompt",
    genPrd: "Generate PRD", genPrompt: "Generate Agent Prompt",
    regenerate: "Regenerate", generating: "AI sedang menulis...",
    prdFirst: "Generate PRD terlebih dahulu sebelum membuat Agent Prompt.",
    emptyPrd: "Belum ada PRD. Klik tombol di bawah untuk membuat PRD inti implementasi dari requirement project Anda.",
    emptyPrompt: "Belum ada Agent Prompt. Prompt akan dibuat berdasarkan PRD dengan workflow Frontend → Backend → Integration.",
    copied: "Disalin ke clipboard", downloaded: "File diunduh",
    edit: "Edit", save: "Simpan", cancel: "Batal", saved: "PRD tersimpan",
     version: "Versi", error: "Generasi gagal", retry: "Coba Lagi", upgrade: "Upgrade ke Pro",
    langOut: "Bahasa output:",
    reqTitle: "Requirement Project",
    exportPrd: "Export PRD.md",
    copyPrompt: "Salin Prompt AI Agent",
    shareCreate: "Buat Share Link",
    shareCopy: "Copy Share Link",
    shareOff: "Matikan",
    shareCopied: "Share link disalin ke clipboard",
    shareDisabled: "Share link dinonaktifkan",
  },
  en: {
    overview: "Overview", prd: "PRD", prompt: "Agent Prompt",
    genPrd: "Generate PRD", genPrompt: "Generate Agent Prompt",
    regenerate: "Regenerate", generating: "AI is writing...",
    prdFirst: "Generate the PRD first before creating the Agent Prompt.",
    emptyPrd: "No PRD yet. Click the button below to create a focused implementation PRD from your project requirements.",
    emptyPrompt: "No Agent Prompt yet. The prompt will be built from the PRD with a Frontend → Backend → Integration workflow.",
    copied: "Copied to clipboard", downloaded: "File downloaded",
    edit: "Edit", save: "Save", cancel: "Cancel", saved: "PRD saved",
     version: "Version", error: "Generation failed", retry: "Retry", upgrade: "Upgrade to Pro",
    langOut: "Output language:",
    reqTitle: "Project Requirements",
    exportPrd: "Export PRD.md",
    copyPrompt: "Copy AI Agent Prompt",
    shareCreate: "Create Share Link",
    shareCopy: "Copy Share Link",
    shareOff: "Disable",
    shareCopied: "Share link copied to clipboard",
    shareDisabled: "Share link disabled",
  },
};

const fieldLabels = {
  description: ["Deskripsi", "Description"], product_type: ["Tipe Produk", "Product Type"],
  target_users: ["Target User", "Target Users"], business_goal: ["Tujuan Bisnis", "Business Goal"],
  main_problem: ["Masalah Utama", "Main Problem"], desired_features: ["Fitur", "Features"],
  preferred_technology: ["Teknologi", "Technology"], design_preference: ["Desain", "Design"],
  auth_requirement: ["Autentikasi", "Authentication"], payment_requirement: ["Pembayaran", "Payment"],
  integrations: ["Integrasi", "Integrations"], deployment_preference: ["Deployment", "Deployment"],
  additional_requirements: ["Tambahan", "Additional"],
};

function download(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  const c = t[lang];
  const [project, setProject] = useState(null);
  const [projectError, setProjectError] = useState(null);
  const [tab, setTab] = useState("prd");
  const [prd, setPrd] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [streaming, setStreaming] = useState(null);
  const [streamText, setStreamText] = useState("");
  const [genError, setGenError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [outLang, setOutLang] = useState(lang);
  const generationController = useRef(null);

  const load = useCallback(async (signal) => {
    try {
      const p = await api.get(`/projects/${id}`, { signal });
      setProject(p.data);
      setProjectError(null);
      const [prdResult, promptResult] = await Promise.allSettled([
        api.get(`/projects/${id}/prd`, { signal }),
        api.get(`/projects/${id}/prompt`, { signal }),
      ]);
      if (signal?.aborted) return;
      setPrd(prdResult.status === "fulfilled" ? prdResult.value.data : null);
      setPrompt(promptResult.status === "fulfilled" ? promptResult.value.data : null);
    } catch (error) {
      if (!signal?.aborted) setProjectError(error);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setProject(null);
    load(controller.signal);
    return () => {
      controller.abort();
      generationController.current?.abort();
    };
  }, [load]);

  const generate = async (type) => {
    setStreaming(type);
    setStreamText("");
    setGenError(null);
    setTab(type);
    generationController.current?.abort();
    const controller = new AbortController();
    generationController.current = controller;
    try {
      const path = type === "prd" ? `/projects/${id}/generate-prd` : `/projects/${id}/generate-agent-prompt`;
      await streamGeneration(path, outLang, setStreamText, { signal: controller.signal });
      await load();
      toast.success(type === "prd" ? "PRD ✓" : "Agent Prompt ✓");
    } catch (err) {
      if (controller.signal.aborted) return;
      setGenError(err.response?.data?.detail || err.message);
      toast.error(c.error);
    } finally {
      if (generationController.current === controller) {
        generationController.current = null;
        setStreaming(null);
      }
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(c.copied);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const savePrd = async () => {
    await api.put(`/projects/${id}/prd`, { content: editText });
    setPrd((p) => ({ ...p, content: editText, edited: true }));
    setEditing(false);
    toast.success(c.saved);
  };

  const toggleShare = async (enabled) => {
    const res = await api.post(`/projects/${id}/share`, { enabled });
    setProject((p) => ({ ...p, share_id: res.data.share_id }));
    if (enabled) {
      const url = `${window.location.origin}/share/${res.data.share_id}`;
      await navigator.clipboard.writeText(url);
      toast.success(c.shareCopied);
    } else {
      toast.success(c.shareDisabled);
    }
  };

  if (!project) {
    return <AppLayout><div className="p-12 text-center">{projectError ? <p className="text-red-300 text-sm">Project tidak dapat dimuat.</p> : <div className="flex justify-center"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}</div></AppLayout>;
  }

  const tabs = [
    { key: "overview", label: c.overview, icon: FileText },
    { key: "prd", label: c.prd, icon: FileText },
    { key: "prompt", label: c.prompt, icon: Bot },
  ];

  const renderDocTab = (type) => {
    const doc = type === "prd" ? prd : prompt;
    const emptyMsg = type === "prd" ? c.emptyPrd : c.emptyPrompt;
    const genLabel = type === "prd" ? c.genPrd : c.genPrompt;
    const canGenerate = type === "prd" || !!prd;

    if (streaming === type) {
      return (
        <div>
          <div className="flex items-center gap-3 text-indigo-300 text-sm mb-6">
            <Loader2 size={16} className="animate-spin" /> {c.generating}
          </div>
          <div className="prose-dark bg-[#101014] border border-white/10 rounded-2xl p-8 max-h-[65vh] overflow-y-auto" data-testid={`${type}-stream-output`}>
            <ReactMarkdown>{streamText}</ReactMarkdown>
            <span className="caret text-indigo-400">▍</span>
          </div>
        </div>
      );
    }

    if (genError && tab === type) {
      const limitReached = genError.includes("Batas") || genError.toLowerCase().includes("limit");
      return (
        <div className="border border-red-500/30 bg-red-500/5 rounded-2xl p-10 text-center" data-testid={`${type}-error-state`}>
          <AlertTriangle size={26} className="mx-auto text-red-400 mb-4" />
          <p className="text-red-300 text-sm mb-1">{c.error}</p>
          <p className="text-zinc-500 text-xs mb-6">{genError}</p>
           {limitReached ? <button onClick={() => navigate("/upgrade")} className="btn-primary px-6 py-2.5 rounded-full text-sm font-semibold" data-testid={`${type}-upgrade-btn`}>{c.upgrade}</button> : <button onClick={() => generate(type)} className="btn-primary px-6 py-2.5 rounded-full text-sm font-semibold" data-testid={`${type}-retry-btn`}><RefreshCw size={14} className="inline mr-2" />{c.retry}</button>}
        </div>
      );
    }

    if (!doc) {
      return (
        <div className="border border-dashed border-white/15 rounded-2xl p-14 text-center" data-testid={`${type}-empty-state`}>
          <Sparkles size={26} className="mx-auto text-indigo-400 mb-4" />
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">{canGenerate ? emptyMsg : c.prdFirst}</p>
          {canGenerate && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {c.langOut}
                <button onClick={() => setOutLang("id")} className={`px-3 py-1 rounded-full border text-xs ${outLang === "id" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-white/10 text-zinc-500"}`} data-testid="outlang-id">ID</button>
                <button onClick={() => setOutLang("en")} className={`px-3 py-1 rounded-full border text-xs ${outLang === "en" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-white/10 text-zinc-500"}`} data-testid="outlang-en">EN</button>
              </div>
              <button onClick={() => generate(type)} disabled={!!streaming}
                className="btn-primary px-7 py-3 rounded-full text-sm font-semibold flex items-center gap-2 disabled:opacity-50" data-testid={`generate-${type}-btn`}>
                <Sparkles size={15} /> {genLabel}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-mono text-zinc-500 border border-white/10 px-2.5 py-1 rounded-full">{c.version} {doc.version}{doc.edited ? " · edited" : ""}</span>
           <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {type === "prd" && !editing && (
              <button onClick={() => { setEditing(true); setEditText(doc.content); }} className="btn-ghost px-4 py-2 rounded-full text-xs flex items-center gap-1.5 text-zinc-300" data-testid="prd-edit-btn">
                <Pencil size={12} /> {c.edit}
              </button>
            )}
            <button onClick={() => copy(doc.content)} className="btn-ghost px-4 py-2 rounded-full text-xs flex items-center gap-1.5 text-zinc-300" data-testid={`${type}-copy-btn`}>
              <Copy size={12} /> Copy
            </button>
            <button onClick={() => { download(`${project.name.replace(/\s+/g, "_")}_${type}.md`, doc.content); toast.success(c.downloaded); }}
              className="btn-ghost px-4 py-2 rounded-full text-xs flex items-center gap-1.5 text-zinc-300" data-testid={`${type}-download-btn`}>
              <Download size={12} /> .md
            </button>
            <button onClick={() => generate(type)} disabled={!!streaming}
              className="btn-primary px-4 py-2 rounded-full text-xs flex items-center gap-1.5 disabled:opacity-50" data-testid={`${type}-regenerate-btn`}>
              <RefreshCw size={12} /> {c.regenerate}
            </button>
          </div>
        </div>

        {editing && type === "prd" ? (
          <div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={26}
              className="w-full bg-[#101014] border border-white/10 rounded-2xl p-6 font-mono text-xs leading-relaxed focus:outline-none focus:border-indigo-500/50"
              data-testid="prd-edit-textarea" />
            <div className="flex gap-3 mt-4">
              <button onClick={savePrd} className="btn-primary px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2" data-testid="prd-save-btn">
                <Save size={14} /> {c.save}
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost px-6 py-2.5 rounded-full text-sm text-zinc-300 flex items-center gap-2" data-testid="prd-cancel-btn">
                <X size={14} /> {c.cancel}
              </button>
            </div>
          </div>
        ) : (
           <div className="prose-dark min-w-0 bg-[#101014] border border-white/10 rounded-2xl p-4 sm:p-8 lg:p-10" data-testid={`${type}-content`}>
            {type === "prd" && doc.connected_consistency && (
              <div className="not-prose mb-6 rounded-xl border border-white/10 bg-black/30 p-4 text-left" data-testid="prd-consistency-report">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                  <span className="font-semibold uppercase tracking-widest text-zinc-400">Konsistensi</span>
                  <span className={doc.connected_consistency.readiness === "READY FOR IMPLEMENTATION" ? "text-emerald-300" : "text-amber-300"}>
                    {doc.connected_consistency.readiness}
                  </span>
                  <span className="text-zinc-500">CRITICAL <b className={doc.connected_consistency.counts.critical ? "text-red-400" : "text-zinc-400"}>{doc.connected_consistency.counts.critical}</b></span>
                  <span className="text-zinc-500">HIGH <b className={doc.connected_consistency.counts.high ? "text-amber-300" : "text-zinc-400"}>{doc.connected_consistency.counts.high}</b></span>
                  <span className="text-zinc-500">MEDIUM <b className="text-zinc-400">{doc.connected_consistency.counts.medium}</b></span>
                </div>
                {doc.connected_consistency.critical?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-red-300/90">
                    {doc.connected_consistency.critical.map((item, i) => <li key={i}>• {item}</li>)}
                  </ul>
                )}
                {doc.connected_consistency.high?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-300/90">
                    {doc.connected_consistency.high.map((item, i) => <li key={i}>• {item}</li>)}
                  </ul>
                )}
                {doc.connected_consistency.medium?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                    {doc.connected_consistency.medium.map((item, i) => <li key={i}>• {item}</li>)}
                  </ul>
                )}
              </div>
            )}
            <ReactMarkdown>{doc.content}</ReactMarkdown>
           </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
       <div className="min-w-0 max-w-5xl p-4 sm:p-6 lg:p-12" data-testid="project-detail-page">
         <h1 className="break-words font-display text-2xl md:text-3xl font-black tracking-tight" data-testid="project-title">{project.name}</h1>
        {(prd || prompt) && (
          <div className="flex flex-wrap gap-3 mt-5">
            {prd && (
              <button onClick={() => { download(`${project.name.replace(/\s+/g, "_")}_PRD.md`, prd.content); toast.success(c.downloaded); }}
                className="btn-primary px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2" data-testid="export-prd-btn">
                <Download size={13} /> {c.exportPrd}
              </button>
            )}
            {prompt && (
              <button onClick={() => copy(prompt.content)}
                className="btn-ghost px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 text-zinc-200" data-testid="copy-agent-prompt-btn">
                <Copy size={13} /> {c.copyPrompt}
              </button>
            )}
            {project.share_id ? (
              <span className="flex items-center gap-1.5">
                <button onClick={() => toggleShare(true)}
                  className="btn-ghost px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 text-emerald-300 border-emerald-500/30" data-testid="share-copy-link-btn">
                  <Share2 size={13} /> {c.shareCopy}
                </button>
                <button onClick={() => toggleShare(false)} className="text-zinc-500 hover:text-red-400 transition-colors p-1.5" title={c.shareOff} data-testid="share-disable-btn" aria-label={c.shareOff}>
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button onClick={() => toggleShare(true)}
                className="btn-ghost px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 text-zinc-200" data-testid="share-create-btn">
                <Share2 size={13} /> {c.shareCreate}
              </button>
            )}
          </div>
        )}
         <div className="flex gap-1 mt-8 overflow-x-auto border-b border-white/10">
          {tabs.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
               className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 sm:px-5 ${tab === tb.key ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              data-testid={`tab-${tb.key}`}>
              <tb.icon size={14} /> {tb.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "overview" && (
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-8" data-testid="overview-content">
              <h2 className="font-display font-bold mb-6">{c.reqTitle}</h2>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {Object.entries(fieldLabels).map(([key, [idL, enL]]) => project[key] ? (
                  <div key={key} className={key === "description" ? "sm:col-span-2" : ""}>
                    <dt className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1">{lang === "id" ? idL : enL}</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed">{project[key]}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>
          )}
          {tab === "prd" && renderDocTab("prd")}
          {tab === "prompt" && renderDocTab("prompt")}
        </div>
      </div>
    </AppLayout>
  );
}

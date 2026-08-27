import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, FileText, Bot, Copy, AlertTriangle } from "lucide-react";

export default function SharePage() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("prd");

  const loadShare = useCallback(() => {
    api.get(`/public/share/${shareId}`)
      .then((r) => {
        setData(r.data);
        if (!r.data.prd && r.data.prompt) setTab("prompt");
      })
      .catch(() => setError(true));
  }, [shareId]);

  useEffect(() => { loadShare(); }, [loadShare]);

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6" data-testid="share-not-found">
        <AlertTriangle size={30} className="text-red-400 mb-4" />
        <p className="text-zinc-400 text-sm">Share link tidak ditemukan / Share link not found.</p>
        <Link to="/" className="btn-primary mt-6 px-6 py-2.5 rounded-full text-sm font-semibold">PRD CreativeAI</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const doc = tab === "prd" ? data.prd : data.prompt;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" data-testid="share-page">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0A0A]/60 border-b border-white/10">
         <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" data-testid="share-logo">
            <span className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center"><Sparkles size={12} /></span>
            <span className="font-display font-bold text-sm">PRD CreativeAI</span>
          </Link>
          <span className="text-[10px] font-mono text-zinc-500 border border-white/10 rounded-full px-2.5 py-1">READ-ONLY</span>
        </div>
      </header>

       <main className="mx-auto min-w-0 max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
         <h1 className="break-words font-display text-2xl md:text-3xl font-black tracking-tight" data-testid="share-project-name">{data.project_name}</h1>
         <div className="flex gap-1 mt-6 overflow-x-auto border-b border-white/10">
          {data.prd && (
            <button onClick={() => setTab("prd")}
               className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 sm:px-5 ${tab === "prd" ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              data-testid="share-tab-prd">
              <FileText size={14} /> PRD
            </button>
          )}
          {data.prompt && (
            <button onClick={() => setTab("prompt")}
               className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 sm:px-5 ${tab === "prompt" ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              data-testid="share-tab-prompt">
              <Bot size={14} /> Agent Prompt
            </button>
          )}
        </div>

        {doc ? (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono text-zinc-500 border border-white/10 px-2.5 py-1 rounded-full">v{doc.version}</span>
              <button onClick={() => copy(doc.content)} className="btn-ghost ml-auto px-4 py-2 rounded-full text-xs flex items-center gap-1.5 text-zinc-300" data-testid="share-copy-btn">
                <Copy size={12} /> Copy
              </button>
            </div>
             <div className="prose-dark min-w-0 bg-[#101014] border border-white/10 rounded-2xl p-4 sm:p-8 lg:p-10" data-testid="share-content">
              <ReactMarkdown>{doc.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm mt-10" data-testid="share-empty">Dokumen belum tersedia / No document available yet.</p>
        )}

        <div className="mt-14 text-center border-t border-white/10 pt-10 pb-6">
          <p className="text-zinc-500 text-sm">Dibuat dengan PRD CreativeAI — Build Better Products. Start With Better PRDs.</p>
          <Link to="/" className="btn-primary inline-block mt-5 px-7 py-3 rounded-full text-sm font-semibold" data-testid="share-cta-btn">
            Buat PRD Anda Sendiri →
          </Link>
        </div>
      </main>
    </div>
  );
}

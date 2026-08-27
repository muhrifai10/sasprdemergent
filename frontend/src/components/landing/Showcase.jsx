import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight } from "lucide-react";

const t = {
  id: {
    prdLabel: "PRD GENERATOR",
    prdTitle: "PRD selevel senior product manager, dalam hitungan menit.",
    prdPoints: ["Bagian inti yang fokus dan tidak berulang", "Database schema dengan field, tipe, dan relasi", "API specification per endpoint dengan error case", "Spesifikasi halaman frontend lengkap dengan state"],
    promptLabel: "AI AGENT PROMPT",
    promptTitle: "Prompt yang membuat coding agent bekerja dengan disiplin.",
    promptPoints: ["Kompatibel dengan Claude Code, Cursor, Codex, Windsurf", "Aturan development eksplisit — tanpa asumsi liar", "Completion report wajib di setiap phase", "Frontend → Backend → Integration, tanpa pengecualian"],
    cta: "Coba Sekarang",
  },
  en: {
    prdLabel: "PRD GENERATOR",
    prdTitle: "Senior-PM-level PRDs, in minutes.",
    prdPoints: ["Focused core sections without repetition", "Database schema with fields, types, and relations", "Per-endpoint API specification with error cases", "Complete frontend page specs including states"],
    promptLabel: "AI AGENT PROMPT",
    promptTitle: "Prompts that make coding agents work with discipline.",
    promptPoints: ["Compatible with Claude Code, Cursor, Codex, Windsurf", "Explicit development rules — no wild assumptions", "Mandatory completion report at every phase", "Frontend → Backend → Integration, no exceptions"],
    cta: "Try It Now",
  },
};

function Panel({ label, title, points, mock, reversed, cta, onCta, testid }) {
  return (
    <div className={`grid lg:grid-cols-2 gap-14 items-center py-20 ${reversed ? "" : ""}`}>
      <motion.div initial={{ opacity: 0, x: reversed ? 30 : -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7 }}
        className={reversed ? "lg:order-2" : ""}>
        <p className="text-xs font-mono tracking-[0.3em] text-indigo-400 mb-4">{label}</p>
        <h3 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight">{title}</h3>
        <ul className="mt-8 space-y-4">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-zinc-400 text-sm">
              <span className="w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <button onClick={onCta} className="btn-ghost group mt-9 px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 text-zinc-200" data-testid={testid}>
          {cta} <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay: 0.1 }}
        className={reversed ? "lg:order-1" : ""}>
        {mock}
      </motion.div>
    </div>
  );
}

export default function Showcase() {
  const { lang } = useLang();
  const { login } = useAuth();
  const c = t[lang];

  const prdMock = (
    <div className="glass rounded-2xl p-7 font-mono text-[11.5px] leading-loose">
      <p className="text-zinc-500 mb-3">— prd_document.md</p>
      <p className="text-indigo-300"># Product Requirements Document</p>
       <p className="text-white mt-2">## 6. Data Model and Database Schema</p>
      <div className="mt-2 border border-white/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 text-[10px] bg-white/5 text-zinc-300 px-3 py-1.5"><span>field</span><span>type</span><span>null</span><span>relation</span></div>
        <div className="grid grid-cols-4 text-[10px] text-zinc-500 px-3 py-1.5 border-t border-white/5"><span>id</span><span>uuid</span><span>no</span><span>PK</span></div>
        <div className="grid grid-cols-4 text-[10px] text-zinc-500 px-3 py-1.5 border-t border-white/5"><span>user_id</span><span>uuid</span><span>no</span><span>FK users</span></div>
        <div className="grid grid-cols-4 text-[10px] text-zinc-500 px-3 py-1.5 border-t border-white/5"><span>status</span><span>enum</span><span>no</span><span>—</span></div>
      </div>
       <p className="text-white mt-4">## 7. API Specification</p>
      <p className="text-emerald-400">POST /api/projects <span className="text-zinc-600">· auth required</span></p>
      <p className="text-emerald-400">GET /api/projects/:id/prd <span className="text-zinc-600">· 200 | 404</span></p>
    </div>
  );

  const promptMock = (
    <div className="glass rounded-2xl p-7 font-mono text-[11.5px] leading-loose">
      <p className="text-zinc-500 mb-3">— agent_prompt.md</p>
      <p className="text-indigo-300"># IMPLEMENTATION PHASES</p>
      <p className="text-white mt-2">## PHASE 1 — FRONTEND</p>
      <p className="text-zinc-500">Build routing, layouts, pages, components with mock data. Backend work is FORBIDDEN.</p>
      <p className="text-emerald-400 mt-1">→ FRONTEND COMPLETION REPORT</p>
      <p className="text-white mt-3">## PHASE 2 — BACKEND</p>
      <p className="text-zinc-500">Schema, models, auth, services, API, tests.</p>
      <p className="text-emerald-400 mt-1">→ BACKEND COMPLETION REPORT</p>
      <p className="text-white mt-3">## PHASE 3 — INTEGRATION</p>
      <p className="text-zinc-500">Wire APIs, auth, CRUD, E2E testing.</p>
      <p className="text-emerald-400 mt-1">→ INTEGRATION COMPLETION REPORT<span className="caret text-white">▍</span></p>
    </div>
  );

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12" data-testid="showcase-section">
      <Panel label={c.prdLabel} title={c.prdTitle} points={c.prdPoints} mock={prdMock} cta={c.cta} onCta={login} testid="showcase-prd-cta" />
      <Panel label={c.promptLabel} title={c.promptTitle} points={c.promptPoints} mock={promptMock} reversed cta={c.cta} onCta={login} testid="showcase-prompt-cta" />
    </section>
  );
}

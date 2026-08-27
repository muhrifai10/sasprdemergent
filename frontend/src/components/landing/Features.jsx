import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import { FileText, Bot, Layers, GitBranch, Database, ShieldCheck } from "lucide-react";

const t = {
  id: {
    label: "FITUR",
    title: "Semua yang Anda butuhkan sebelum menulis satu baris kode.",
    items: [
      { id: "prd", icon: FileText, h: "PRD Inti Implementasi", p: "Bagian penting yang langsung dipakai coding agent: user flow, requirement, halaman, database schema, API, security, dan acceptance criteria.", big: true },
      { id: "agent-prompt", icon: Bot, h: "AI Agent Prompt Generator", p: "Prompt implementasi detail untuk Claude Code, Cursor, Codex, Windsurf — dengan aturan phase yang tidak bisa dilompati.", big: true },
      { id: "workflow", icon: Layers, h: "Workflow Bertahap", p: "Frontend → Backend → Integration. Selalu. Prompt yang dihasilkan melarang agent bekerja acak." },
      { id: "database-api", icon: Database, h: "Database & API Design", p: "Setiap entity dengan field, tipe data, relasi, dan index. Setiap endpoint dengan request, response, dan error case." },
      { id: "versioning", icon: GitBranch, h: "Versioning", p: "Setiap regenerasi membuat versi baru. History tidak pernah ditimpa." },
      { id: "assumptions", icon: ShieldCheck, h: "Asumsi Transparan", p: "Requirement ambigu ditandai 'Needs Clarification' lengkap dengan asumsi teraman yang dipakai AI." },
    ],
  },
  en: {
    label: "FEATURES",
    title: "Everything you need before writing a single line of code.",
    items: [
      { id: "prd", icon: FileText, h: "Implementation Core PRD", p: "The essential structure coding agents need: user flows, requirements, pages, database schema, APIs, security, and acceptance criteria.", big: true },
      { id: "agent-prompt", icon: Bot, h: "AI Agent Prompt Generator", p: "Detailed implementation prompts for Claude Code, Cursor, Codex, Windsurf — with phase rules that cannot be skipped.", big: true },
      { id: "workflow", icon: Layers, h: "Phased Workflow", p: "Frontend → Backend → Integration. Always. Generated prompts forbid the agent from working out of order." },
      { id: "database-api", icon: Database, h: "Database & API Design", p: "Every entity with fields, datatypes, relations, and indexes. Every endpoint with request, response, and error cases." },
      { id: "versioning", icon: GitBranch, h: "Versioning", p: "Every regeneration creates a new version. History is never overwritten." },
      { id: "assumptions", icon: ShieldCheck, h: "Transparent Assumptions", p: "Ambiguous requirements are flagged 'Needs Clarification' along with the safest assumption the AI used." },
    ],
  },
};

export default function Features() {
  const { lang } = useLang();
  const c = t[lang];
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 lg:px-10 py-28" data-testid="features-section">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <p className="text-xs font-mono tracking-[0.3em] text-indigo-400 mb-4">{c.label}</p>
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight max-w-2xl">{c.title}</h2>
      </motion.div>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-6 gap-6">
        {c.items.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
            className={`card-hover bg-[#121212] border border-white/10 rounded-2xl p-8 ${item.big ? "md:col-span-3" : "md:col-span-2"}`}>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
              <item.icon size={20} className="text-indigo-400" />
            </div>
            <h3 className="font-display text-lg font-bold mb-3">{item.h}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{item.p}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

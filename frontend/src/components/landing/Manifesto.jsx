import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";

const t = {
  id: {
    title: "Dari ide mentah menjadi blueprint yang bisa langsung dieksekusi.",
    steps: [
      { n: "01", h: "Tulis Ide Anda", p: "Cukup deskripsikan produk Anda dalam bahasa bebas — atau isi form terstruktur. AI kami memahami keduanya dan mengubahnya menjadi requirement terstruktur." },
      { n: "02", h: "AI Menganalisis Requirement", p: "AI mengidentifikasi tujuan produk, target user, entitas database, API, integrasi, dan kebutuhan keamanan. Bagian yang ambigu ditandai transparan dengan asumsi yang digunakan." },
      { n: "03", h: "PRD Inti Dihasilkan", p: "Dokumen ringkas yang fokus pada user flow, requirement, halaman, database schema, API, keamanan, dan acceptance criteria agar coding agent tidak menebak." },
      { n: "04", h: "Prompt AI Agent Siap Pakai", p: "Prompt implementasi super-detail untuk Claude Code, Cursor, Codex, dan lainnya — selalu mengikuti workflow ketat: Frontend → Backend → Integration." },
    ],
  },
  en: {
    title: "From raw idea to a blueprint you can execute immediately.",
    steps: [
      { n: "01", h: "Write Your Idea", p: "Describe your product in free-form text — or fill a structured form. Our AI understands both and turns them into structured requirements." },
      { n: "02", h: "AI Analyzes Requirements", p: "The AI identifies product goals, target users, database entities, APIs, integrations, and security needs. Ambiguous parts are transparently flagged with the assumptions used." },
      { n: "03", h: "Core PRD Generated", p: "A focused implementation document covering user flows, requirements, pages, database schema, APIs, security, and acceptance criteria so coding agents do not guess." },
      { n: "04", h: "Ready-to-Use Agent Prompt", p: "An ultra-detailed implementation prompt for Claude Code, Cursor, Codex, and more — always enforcing the strict workflow: Frontend → Backend → Integration." },
    ],
  },
};

export default function Manifesto() {
  const { lang } = useLang();
  const c = t[lang];
  return (
    <section id="manifesto" className="max-w-7xl mx-auto px-6 lg:px-10 py-32" data-testid="manifesto-section">
      <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7 }}
        className="font-display text-3xl md:text-5xl font-bold tracking-tight max-w-3xl leading-tight">
        {c.title}
      </motion.h2>
      <div className="mt-20 space-y-0">
        {c.steps.map((s, i) => (
          <motion.div key={s.n} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay: i * 0.08 }}
            className="grid md:grid-cols-12 gap-6 py-12 border-t border-white/10 group">
            <div className="md:col-span-2">
              <span className="font-display text-5xl font-light text-zinc-700 group-hover:text-indigo-500 transition-colors duration-300">{s.n}</span>
            </div>
            <div className="md:col-span-4">
              <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight">{s.h}</h3>
            </div>
            <div className="md:col-span-6">
              <p className="text-zinc-400 leading-relaxed">{s.p}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

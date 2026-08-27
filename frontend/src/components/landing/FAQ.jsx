import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

const t = {
  id: {
    label: "FAQ",
    title: "Pertanyaan yang sering diajukan.",
    items: [
      { id: "about", q: "Apa itu PRD CreativeAI?", a: "Platform AI yang mengubah ide produk menjadi PRD inti yang berisi keputusan implementasi penting plus prompt siap pakai untuk AI Coding Agent seperti Claude Code, Cursor, dan Codex." },
      { id: "workflow", q: "Mengapa urutan Frontend → Backend → Integration?", a: "Urutan bertahap membuat coding agent bekerja disiplin: UI selesai dan terverifikasi dulu dengan mock data, baru backend dibangun, lalu keduanya diintegrasikan. Ini mengurangi rework dan bug integrasi secara drastis." },
      { id: "editing", q: "Apakah PRD bisa diedit setelah dihasilkan?", a: "Bisa. Anda dapat mengedit konten PRD langsung di editor, dan setiap regenerasi AI membuat versi baru tanpa menimpa history." },
      { id: "exports", q: "Format export apa saja yang didukung?", a: "PRD dapat diexport sebagai Markdown, dan prompt AI Agent sebagai Markdown/TXT. Anda juga bisa langsung copy ke clipboard." },
      { id: "input-language", q: "Apakah bisa menulis ide dalam bahasa bebas?", a: "Ya. Cukup deskripsikan ide Anda seperti bercerita — AI akan menstrukturkannya. Form terstruktur juga tersedia jika Anda ingin lebih presisi." },
      { id: "output-language", q: "Bahasa apa yang didukung untuk output?", a: "Bahasa Indonesia dan English. Anda memilih bahasa output saat generate." },
    ],
  },
  en: {
    label: "FAQ",
    title: "Frequently asked questions.",
    items: [
      { id: "about", q: "What is PRD CreativeAI?", a: "An AI platform that turns product ideas into a focused PRD containing the implementation decisions that matter, plus ready-to-use prompts for AI Coding Agents like Claude Code, Cursor, and Codex." },
      { id: "workflow", q: "Why the Frontend → Backend → Integration order?", a: "The phased order makes coding agents work with discipline: UI is finished and verified first with mock data, then the backend is built, then both are integrated. This drastically reduces rework and integration bugs." },
      { id: "editing", q: "Can I edit the PRD after it's generated?", a: "Yes. You can edit the PRD content directly in the editor, and every AI regeneration creates a new version without overwriting history." },
      { id: "exports", q: "What export formats are supported?", a: "PRDs export as Markdown, and AI Agent prompts as Markdown/TXT. You can also copy directly to clipboard." },
      { id: "input-language", q: "Can I write my idea in free-form text?", a: "Yes. Just describe your idea like telling a story — the AI will structure it. A structured form is also available if you want more precision." },
      { id: "output-language", q: "Which output languages are supported?", a: "Bahasa Indonesia and English. You choose the output language when generating." },
    ],
  },
};

export default function FAQ() {
  const { lang } = useLang();
  const c = t[lang];
  return (
    <section id="faq" className="max-w-4xl mx-auto px-6 lg:px-10 py-28" data-testid="faq-section">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <p className="text-xs font-mono tracking-[0.3em] text-indigo-400 mb-4">{c.label}</p>
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{c.title}</h2>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }} className="mt-12">
        <Accordion type="single" collapsible className="space-y-3">
          {c.items.map((item) => (
            <AccordionItem key={item.id} value={`item-${item.id}`} className="bg-[#121212] border border-white/10 rounded-xl px-6 data-[state=open]:border-indigo-500/40">
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-5" data-testid={`faq-trigger-${item.id}`}>{item.q}</AccordionTrigger>
              <AccordionContent className="text-zinc-400 text-sm leading-relaxed pb-5">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
}

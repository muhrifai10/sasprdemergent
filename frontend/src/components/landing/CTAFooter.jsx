import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { ArrowRight, AtSign, Facebook, Instagram, Sparkles } from "lucide-react";

const t = {
  id: {
    title: "Berhenti menulis PRD dari nol.",
    sub: "Mulai dari ide, akhiri dengan blueprint yang siap dieksekusi AI coding agent.",
    cta: "Mulai Gratis Sekarang",
    rights: "Semua hak dilindungi.",
    tagline: "Build Better Products. Start With Better PRDs.",
  },
  en: {
    title: "Stop writing PRDs from scratch.",
    sub: "Start with an idea, end with a blueprint ready for AI coding agents to execute.",
    cta: "Start Free Now",
    rights: "All rights reserved.",
    tagline: "Build Better Products. Start With Better PRDs.",
  },
};

export default function CTAFooter() {
  const { lang } = useLang();
  const { login, user } = useAuth();
  const c = t[lang];
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    api.get("/site-settings").then((res) => setLogoUrl(res.data.logo_url)).catch(() => {});
  }, []);
  return (
    <>
      <section className="relative border-t border-white/10 py-32 overflow-hidden" data-testid="cta-section">
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="h-[400px] w-[700px] max-w-[90vw] glow-indigo rounded-full" />
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-black tracking-tighter leading-tight">{c.title}</h2>
          <p className="mt-6 text-zinc-400 text-lg">{c.sub}</p>
          <button onClick={user ? () => (window.location.href = "/dashboard") : login}
            className="btn-primary group mt-10 px-9 py-4 rounded-full font-semibold text-sm inline-flex items-center gap-2" data-testid="footer-cta-btn">
            {c.cta} <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </section>
      <footer className="border-t border-white/10 py-12" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
             {logoUrl ? <img src={logoUrl} alt="PRD CreativeAI" className="h-8 max-w-[180px] rounded-lg object-contain" /> : <><span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><Sparkles size={14} /></span><span className="font-display font-bold">PRD CreativeAI</span></>}
          </div>
          <p className="text-zinc-500 text-xs italic">{c.tagline}</p>
          <nav className="flex items-center gap-2" aria-label="Social media">
            <a href="https://www.instagram.com/creativeai.id/" target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram"
              className="w-8 h-8 rounded-full border border-white/10 text-zinc-500 hover:text-white hover:border-indigo-400/50 flex items-center justify-center transition-colors" data-testid="footer-instagram-link">
              <Instagram size={15} />
            </a>
            <a href="https://www.threads.com/@creativeai.id?hl=id" target="_blank" rel="noreferrer" aria-label="Threads" title="Threads"
              className="w-8 h-8 rounded-full border border-white/10 text-zinc-500 hover:text-white hover:border-indigo-400/50 flex items-center justify-center transition-colors" data-testid="footer-threads-link">
              <AtSign size={15} />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61590893720327&locale=id_ID" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook"
              className="w-8 h-8 rounded-full border border-white/10 text-zinc-500 hover:text-white hover:border-indigo-400/50 flex items-center justify-center transition-colors" data-testid="footer-facebook-link">
              <Facebook size={15} />
            </a>
          </nav>
          <p className="text-zinc-600 text-xs">© 2026 PRD CreativeAI. {c.rights}</p>
        </div>
      </footer>
    </>
  );
}

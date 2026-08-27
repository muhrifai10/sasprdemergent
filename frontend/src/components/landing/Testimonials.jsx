import { motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import TestimonialMarquee from "./TestimonialMarquee";

const t = {
  id: {
    label: "TESTIMONI",
    title: "Dipercaya builder dan tim produk.",
    items: [
      { img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=srgb&fm=jpg&q=85&w=200", name: "Rendra Wijaya", role: "Founder, SaaS Studio", quote: "PRD yang dihasilkan lebih rapi dari yang biasa tim kami tulis dalam seminggu. Agent prompt-nya langsung saya paste ke Cursor dan hasilnya disiplin." },
      { img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=srgb&fm=jpg&q=85&w=200", name: "Sarah Chen", role: "Product Manager", quote: "Bagian database schema dan API spec-nya detail banget. Developer kami bisa langsung kerja tanpa meeting klarifikasi berulang-ulang." },
    ],
  },
  en: {
    label: "TESTIMONIALS",
    title: "Trusted by builders and product teams.",
    items: [
      { img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=srgb&fm=jpg&q=85&w=200", name: "Rendra Wijaya", role: "Founder, SaaS Studio", quote: "The generated PRD was cleaner than what our team usually writes in a week. I pasted the agent prompt straight into Cursor and it worked with discipline." },
      { img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=srgb&fm=jpg&q=85&w=200", name: "Sarah Chen", role: "Product Manager", quote: "The database schema and API spec sections are incredibly detailed. Our developers could start immediately without endless clarification meetings." },
    ],
  },
};

export default function Testimonials() {
  const { lang } = useLang();
  const c = t[lang];
  const rows = [c.items.map(({ name, img, quote }) => ({ name, avatar: img, text: quote })), [...c.items].reverse().map(({ name, img, quote }) => ({ name, avatar: img, text: quote }))];

  return (
    <section className="max-w-7xl mx-auto overflow-hidden px-6 py-28 lg:px-10" data-testid="testimonials-section">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <p className="mb-4 text-xs font-mono tracking-[0.3em] text-indigo-400">{c.label}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{c.title}</h2>
      </motion.div>
      <TestimonialMarquee rows={rows} speed={45} pauseOnHover gap="1.5rem" cardWidth="420px" avatarSize="64px" />
    </section>
  );
}

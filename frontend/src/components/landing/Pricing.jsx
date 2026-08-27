import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Check } from "lucide-react";

const t = {
  id: {
    label: "HARGA",
    title: "Mulai gratis. Skala saat butuh.",
    plans: [
       { name: "Free", price: "Rp0", period: "/bulan", features: ["Generate 1 Project", "Export PRD & Agent Prompt", "Share link", "Bahasa ID & EN", "Template PRD"], cta: "Mulai Gratis", popular: false },
        { name: "Pro", price: "-", period: "", features: ["Generate Project 20x", "Export PRD & Agent Prompt", "Share link", "Bahasa ID & EN", "Template PRD"], cta: "Upgrade ke Pro", popular: true },
      { name: "Enterprise", price: "Custom", period: "", features: ["Semua fitur Pro", "Team workspace", "Custom AI model", "SSO & audit log", "SLA & dedicated support"], cta: "Hubungi Kami", popular: false },
    ],
    soon: "Segera",
  },
  en: {
    label: "PRICING",
    title: "Start free. Scale when you need to.",
    plans: [
       { name: "Free", price: "$0", period: "/month", features: ["Generate 1 project", "Export PRD & Agent Prompt", "Share link", "ID & EN languages", "PRD templates"], cta: "Start Free", popular: false },
        { name: "Pro", price: "-", period: "", features: ["Generate 20 projects", "Export PRD & Agent Prompt", "Share link", "ID & EN languages", "PRD templates"], cta: "Upgrade to Pro", popular: true },
      { name: "Enterprise", price: "Custom", period: "", features: ["Everything in Pro", "Team workspace", "Custom AI model", "SSO & audit log", "SLA & dedicated support"], cta: "Contact Us", popular: false },
    ],
    soon: "Soon",
  },
};

export default function Pricing() {
  const { lang } = useLang();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  const c = t[lang];
  const openProUpgrade = () => user ? navigate("/upgrade") : login();

  useEffect(() => {
    api.get("/payments/public-pricing").then((res) => setPricing(res.data)).catch(() => setPricing({ configured: false }));
  }, []);

  const formatPrice = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
  return (
    <section id="pricing" className="border-t border-white/10 bg-[#0D0D0F] py-28" data-testid="pricing-section">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <p className="text-xs font-mono tracking-[0.3em] text-indigo-400 mb-4">{c.label}</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{c.title}</h2>
        </motion.div>
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {c.plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 card-hover ${plan.popular ? "bg-[#14141f] border border-indigo-500/50" : "bg-[#121212] border border-white/10"}`}>
              {plan.popular && (
                <span className="absolute -top-3 left-8 text-[10px] font-mono tracking-widest bg-indigo-600 text-white px-3 py-1 rounded-full">POPULAR</span>
              )}
              <h3 className="font-display font-bold text-lg">{plan.name}</h3>
               <p className="mt-4"><span className="font-display text-4xl font-black">{i === 1 && pricing?.configured ? formatPrice(pricing.pro_price) : plan.price}</span><span className="text-zinc-500 text-sm">{i === 1 && pricing?.configured ? (lang === "id" ? ` / ${pricing.pro_duration_days} hari` : ` / ${pricing.pro_duration_days} days`) : plan.period}</span></p>
              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-400">
                    <Check size={14} className="text-indigo-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
                <button onClick={i === 0 ? (user ? () => navigate("/dashboard") : login) : i === 1 ? openProUpgrade : undefined} disabled={i === 2}
                 className={`mt-8 w-full py-3 rounded-full text-sm font-semibold ${i === 2 ? "btn-ghost text-zinc-400 cursor-not-allowed opacity-60" : "btn-primary"}`}
                data-testid={`pricing-cta-${plan.name.toLowerCase()}`}>
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

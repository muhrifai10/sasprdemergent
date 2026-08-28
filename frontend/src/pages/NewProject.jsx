import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { api, createGuidedProject, normalizeApiError } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";
import { ArrowRight, Loader2, Cloud, Store, Smartphone, ShoppingCart, Sparkles, Wrench, FilePlus } from "lucide-react";

const templateIcons = { cloud: Cloud, store: Store, smartphone: Smartphone, "shopping-cart": ShoppingCart, sparkles: Sparkles, wrench: Wrench };

const t = {
  id: {
    title: "Buat Project Baru",
    sub: "Isi nama dan deskripsikan ide Anda — field lain opsional, AI akan mengisi celahnya dengan asumsi transparan.",
    name: "Nama Project *",
    namePh: "cth. Marketplace Produk Digital",
    desc: "Deskripsi Ide (bahasa bebas)",
    descPh: "Saya ingin membuat marketplace untuk menjual produk digital seperti e-book dan template. Pembeli bisa checkout dengan QRIS...",
    optional: "Detail Opsional",
    fields: {
      product_type: ["Tipe Produk", "SaaS / Marketplace / Mobile App..."],
      target_users: ["Target User", "Freelancer, UMKM, kreator..."],
      business_goal: ["Tujuan Bisnis", "Monetisasi lewat komisi transaksi..."],
      main_problem: ["Masalah Utama", "Sulit menjual produk digital secara aman..."],
      desired_features: ["Fitur yang Diinginkan", "Auth, katalog, checkout, dashboard penjual..."],
      preferred_technology: ["Teknologi Pilihan", "React, Laravel, PostgreSQL..."],
      design_preference: ["Preferensi Desain", "Modern, minimal, dark mode..."],
      auth_requirement: ["Kebutuhan Autentikasi", "Email + Google OAuth..."],
      payment_requirement: ["Kebutuhan Pembayaran", "Midtrans / Stripe / QRIS..."],
      integrations: ["Integrasi Pihak Ketiga", "Email, storage, analytics..."],
      deployment_preference: ["Preferensi Deployment", "VPS, Vercel, Docker..."],
      additional_requirements: ["Kebutuhan Tambahan", "Multi-bahasa, SEO, dll..."],
    },
    submit: "Buat Project",
    creating: "Membuat...",
    nameRequired: "Nama project wajib diisi",
    created: "Project berhasil dibuat",
    tplTitle: "Mulai dari Template",
    tplSub: "Pilih template untuk mengisi requirement otomatis — tetap bisa Anda ubah.",
    tplBlank: "Kosong",
    tplBlankSub: "Mulai dari nol",
    tplApplied: "Template diterapkan",
    guided: "Gunakan Guided Discovery",
    guidedSub: "AI membantu menemukan gap; keputusan tetap milik Anda.",
  },
  en: {
    title: "Create New Project",
    sub: "Fill in the name and describe your idea — other fields are optional, the AI will fill the gaps with transparent assumptions.",
    name: "Project Name *",
    namePh: "e.g. Digital Products Marketplace",
    desc: "Idea Description (free-form)",
    descPh: "I want to build a marketplace for selling digital products like e-books and templates. Buyers can check out with Stripe...",
    optional: "Optional Details",
    fields: {
      product_type: ["Product Type", "SaaS / Marketplace / Mobile App..."],
      target_users: ["Target Users", "Freelancers, SMBs, creators..."],
      business_goal: ["Business Goal", "Monetize via transaction fees..."],
      main_problem: ["Main Problem", "Hard to sell digital products safely..."],
      desired_features: ["Desired Features", "Auth, catalog, checkout, seller dashboard..."],
      preferred_technology: ["Preferred Technology", "React, Laravel, PostgreSQL..."],
      design_preference: ["Design Preference", "Modern, minimal, dark mode..."],
      auth_requirement: ["Authentication Requirement", "Email + Google OAuth..."],
      payment_requirement: ["Payment Requirement", "Stripe / PayPal..."],
      integrations: ["Third-party Integrations", "Email, storage, analytics..."],
      deployment_preference: ["Deployment Preference", "VPS, Vercel, Docker..."],
      additional_requirements: ["Additional Requirements", "Multi-language, SEO, etc..."],
    },
    submit: "Create Project",
    creating: "Creating...",
    nameRequired: "Project name is required",
    created: "Project created successfully",
    tplTitle: "Start from a Template",
    tplSub: "Pick a template to auto-fill requirements — you can still edit everything.",
    tplBlank: "Blank",
    tplBlankSub: "Start from scratch",
    tplApplied: "Template applied",
    guided: "Use Guided Discovery",
    guidedSub: "AI helps find gaps; decisions remain yours.",
  },
};

export default function NewProject() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const c = t[lang];
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [guided, setGuided] = useState(false);

  const loadTemplates = useCallback(() => {
    api.get("/templates").then((r) => setTemplates(r.data)).catch(() => setTemplates([]));
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyTemplate = (tpl) => {
    if (!tpl) {
      setSelectedTpl(null);
      setForm((f) => {
        const next = { name: f.name, description: f.description };
        return next;
      });
      setShowOptional(false);
      return;
    }
    setSelectedTpl(tpl.id);
    setForm((f) => ({ name: f.name, description: f.description, ...tpl.prefill[lang] }));
    setShowOptional(true);
    toast.success(`${c.tplApplied}: ${tpl.name[lang]}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(c.nameRequired); return; }
    setSaving(true);
    try {
      const res = guided ? await createGuidedProject(form) : await api.post("/projects", form);
      toast.success(c.created);
      navigate(guided ? `/projects/${res.data.id}/discovery` : `/projects/${res.data.id}`);
    } catch (err) {
      toast.error(guided ? normalizeApiError(err) : err.response?.data?.detail || "Failed to create project");
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors";

  return (
    <AppLayout>
       <div className="w-full max-w-3xl p-4 sm:p-6 lg:p-12" data-testid="new-project-page">
        <h1 className="font-display text-3xl font-black tracking-tight">{c.title}</h1>
        <p className="text-zinc-500 text-sm mt-2 max-w-lg">{c.sub}</p>

        <div className="mt-10">
          <h2 className="text-xs font-mono tracking-[0.25em] text-indigo-400 uppercase">{c.tplTitle}</h2>
          <p className="text-zinc-500 text-xs mt-1.5">{c.tplSub}</p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button type="button" onClick={() => applyTemplate(null)}
              className={`text-left rounded-xl p-4 border transition-colors duration-150 ${selectedTpl === null ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/10 bg-[#121212] hover:border-white/25"}`}
              data-testid="template-blank">
              <FilePlus size={17} className={selectedTpl === null ? "text-indigo-400" : "text-zinc-500"} />
              <p className="font-semibold text-sm mt-3">{c.tplBlank}</p>
              <p className="text-zinc-500 text-[11px] mt-0.5 leading-snug">{c.tplBlankSub}</p>
            </button>
            {templates.map((tpl) => {
              const Icon = templateIcons[tpl.icon] || Sparkles;
              const active = selectedTpl === tpl.id;
              return (
                <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                  className={`text-left rounded-xl p-4 border transition-colors duration-150 ${active ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/10 bg-[#121212] hover:border-white/25"}`}
                  data-testid={`template-${tpl.id}`}>
                  <Icon size={17} className={active ? "text-indigo-400" : "text-zinc-500"} />
                  <p className="font-semibold text-sm mt-3">{tpl.name[lang]}</p>
                  <p className="text-zinc-500 text-[11px] mt-0.5 leading-snug">{tpl.tagline[lang]}</p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">{c.name}</label>
            <input value={form.name} onChange={set("name")} placeholder={c.namePh} className={inputCls} data-testid="project-name-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">{c.desc}</label>
            <textarea value={form.description} onChange={set("description")} placeholder={c.descPh} rows={6} className={inputCls} data-testid="project-description-input" />
          </div>

          <button type="button" onClick={() => setShowOptional(!showOptional)}
            className="text-indigo-400 text-xs font-semibold hover:text-indigo-300 transition-colors" data-testid="toggle-optional-btn">
            {showOptional ? "− " : "+ "}{c.optional}
          </button>

          {showOptional && (
            <div className="grid sm:grid-cols-2 gap-5">
              {Object.entries(c.fields).map(([key, [label, ph]]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2">{label}</label>
                  <input value={form[key] || ""} onChange={set(key)} placeholder={ph} className={inputCls} data-testid={`project-${key}-input`} />
                </div>
              ))}
            </div>
          )}

          <label className="flex items-start gap-3 border border-white/10 bg-[#121212] px-4 py-3 text-sm" data-testid="guided-mode-control">
            <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" data-testid="guided-mode-toggle" />
            <span>
              <span className="block font-semibold">{c.guided}</span>
              <span className="mt-1 block text-xs text-zinc-500">{c.guidedSub}</span>
            </span>
          </label>

          <button type="submit" disabled={saving}
            className="btn-primary group px-7 py-3.5 rounded-full font-semibold text-sm flex items-center gap-2 disabled:opacity-60" data-testid="project-submit-btn">
            {saving ? <><Loader2 size={15} className="animate-spin" /> {c.creating}</> : <>{c.submit} <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" /></>}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}

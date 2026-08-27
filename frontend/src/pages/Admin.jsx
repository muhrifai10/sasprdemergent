import { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";
import { Users, BarChart3, FileText, Bot, Zap, LayoutTemplate, Trash2, Plus, ShieldAlert, Landmark, Check, X, Image, Upload, Cpu } from "lucide-react";

const t = {
  id: {
    title: "Admin", overview: "Ringkasan", users: "Users", usage: "Usage", templates: "Templates", payments: "Pembayaran", branding: "Logo Brand", aiProvider: "AI Provider", activeProvider: "Provider aktif", providerHint: "Pilih provider yang digunakan untuk generation berikutnya.", providerKey: "API key provider", providerKeyHint: "API key dienkripsi dan hanya disimpan di backend.", providerModel: "Model", providerConfigured: "Terkonfigurasi", providerNotConfigured: "Belum dikonfigurasi", providerEnvironment: "Environment", providerDashboard: "Dashboard", providerLocal: "Gateway lokal", saveProvider: "Simpan provider", providerSaved: "AI provider diperbarui", clearKey: "Hapus API key dashboard", autoProvider: "Auto (berdasarkan key tersedia)", chooseLogo: "Pilih logo", uploadLogo: "Upload logo", removeLogo: "Hapus logo", logoHint: "PNG, JPG, atau WebP maksimal 2 MB.", logoUpdated: "Logo berhasil diperbarui", logoRemoved: "Logo dihapus",
    statUsers: "Total User", statProjects: "Total Project", statPrds: "PRD", statPrompts: "Prompt",
    statOk: "Generasi Sukses", statFail: "Generasi Gagal", statMonth: "Generasi Bulan Ini",
    colUser: "User", colPlan: "Plan", colRole: "Role", colProjects: "Project", colGens: "Generasi", colStatus: "Status", colAction: "Aksi",
    suspend: "Suspend", activate: "Aktifkan", active: "Aktif", suspended: "Suspended",
    updated: "User diperbarui",
    tplName: "Nama template", tplTagline: "Tagline", tplCreate: "Buat Template", tplCreated: "Template dibuat", tplDeleted: "Template dihapus",
    tplHint: "Isi field prefill yang diinginkan (opsional):",
    colWhen: "Waktu", colType: "Tipe", colModel: "Model", colChars: "Karakter", paymentSettings: "Harga Midtrans", price: "Harga Pro (IDR)", duration: "Durasi Pro (hari)", savePaymentSettings: "Simpan harga", paymentSettingsSaved: "Harga Midtrans disimpan", paymentRequests: "Riwayat pembayaran lama", noPayments: "Belum ada riwayat pembayaran lama", payer: "Pengguna", transfer: "Transfer", amount: "Nominal", approve: "Setujui", reject: "Tolak", paymentApproved: "Pembayaran disetujui", paymentRejected: "Pembayaran ditolak", pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak",
  },
  en: {
    title: "Admin", overview: "Overview", users: "Users", usage: "Usage", templates: "Templates", payments: "Payments", branding: "Brand Logo", aiProvider: "AI Provider", activeProvider: "Active provider", providerHint: "Choose the provider for the next generation.", providerKey: "Provider API key", providerKeyHint: "The API key is encrypted and stored only on the backend.", providerModel: "Model", providerConfigured: "Configured", providerNotConfigured: "Not configured", providerEnvironment: "Environment", providerDashboard: "Dashboard", providerLocal: "Local gateway", saveProvider: "Save provider", providerSaved: "AI provider updated", clearKey: "Clear dashboard API key", autoProvider: "Auto (based on available keys)", chooseLogo: "Choose logo", uploadLogo: "Upload logo", removeLogo: "Remove logo", logoHint: "PNG, JPG, or WebP up to 2 MB.", logoUpdated: "Logo updated", logoRemoved: "Logo removed",
    statUsers: "Total Users", statProjects: "Total Projects", statPrds: "PRDs", statPrompts: "Prompts",
    statOk: "Successful Gens", statFail: "Failed Gens", statMonth: "Gens This Month",
    colUser: "User", colPlan: "Plan", colRole: "Role", colProjects: "Projects", colGens: "Gens", colStatus: "Status", colAction: "Action",
    suspend: "Suspend", activate: "Activate", active: "Active", suspended: "Suspended",
    updated: "User updated",
    tplName: "Template name", tplTagline: "Tagline", tplCreate: "Create Template", tplCreated: "Template created", tplDeleted: "Template deleted",
    tplHint: "Fill any prefill fields you want (optional):",
    colWhen: "Time", colType: "Type", colModel: "Model", colChars: "Chars", paymentSettings: "Midtrans pricing", price: "Pro price (IDR)", duration: "Pro duration (days)", savePaymentSettings: "Save pricing", paymentSettingsSaved: "Midtrans pricing saved", paymentRequests: "Legacy payment records", noPayments: "No legacy payment records", payer: "User", transfer: "Transfer", amount: "Amount", approve: "Approve", reject: "Reject", paymentApproved: "Payment approved", paymentRejected: "Payment rejected", pending: "Pending", approved: "Approved", rejected: "Rejected",
  },
};

const PREFILL_FIELDS = ["product_type", "target_users", "business_goal", "main_problem", "desired_features", "preferred_technology", "design_preference", "auth_requirement", "payment_requirement", "integrations", "deployment_preference", "additional_requirements"];

const inputCls = "w-full bg-[#0D0D0F] border border-white/10 rounded-lg px-3 py-2 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50";

const paymentStatusClass = {
  approved: "text-emerald-400 border-emerald-500/30",
  rejected: "text-red-400 border-red-500/30",
  pending: "text-amber-300 border-amber-400/30",
};

function paymentStatusLabel(status, copy) {
  return status === "approved" ? copy.approved : status === "rejected" ? copy.rejected : copy.pending;
}

export default function Admin() {
  const { lang } = useLang();
  const c = t[lang];
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usage, setUsage] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tplForm, setTplForm] = useState({ name: "", tagline: "", prefill: {} });
  const [payments, setPayments] = useState([]);
  const [aiProvider, setAiProvider] = useState({ active_provider: "auto", providers: [] });
  const [providerKey, setProviderKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({ bank_name: "", account_number: "", account_holder: "", pro_price: "", pro_duration_days: 30, instructions: "" });
  const [branding, setBranding] = useState({ logo_url: null });
  const [logoFile, setLogoFile] = useState(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback((activeTab) => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch((error) => {
      if (error.response?.status === 403) setAccessDenied(true);
    });
    if (activeTab === "users") api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
    if (activeTab === "usage") api.get("/admin/usage").then((r) => setUsage(r.data)).catch(() => {});
    if (activeTab === "templates") api.get("/templates").then((r) => setTemplates(r.data)).catch(() => {});
    if (activeTab === "payments") {
      api.get("/admin/payments").then((r) => setPayments(r.data)).catch(() => {});
      api.get("/admin/payment-pricing").then((r) => setPaymentSettings(r.data)).catch(() => {});
    }
    if (activeTab === "branding") api.get("/admin/branding").then((r) => setBranding(r.data)).catch(() => {});
    if (activeTab === "ai-provider") api.get("/admin/ai-provider").then((r) => {
      setAiProvider(r.data);
      const selected = r.data.providers.find((p) => p.id === r.data.active_provider);
      setProviderModel(selected?.model || "");
    }).catch(() => {});
  }, []);

  useEffect(() => { load(tab); }, [load, tab]);

  const updateUser = async (uid, patch) => {
    const res = await api.put(`/admin/users/${uid}`, patch);
    setUsers((us) => us.map((u) => (u.user_id === uid ? { ...u, ...res.data } : u)));
    toast.success(c.updated);
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    if (!tplForm.name.trim()) return;
    await api.post("/admin/templates", tplForm);
    setTplForm({ name: "", tagline: "", prefill: {} });
    api.get("/templates").then((r) => setTemplates(r.data));
    toast.success(c.tplCreated);
  };

  const deleteTemplate = async (id) => {
    await api.delete(`/admin/templates/${id}`);
    setTemplates((ts) => ts.filter((x) => x.id !== id));
    toast.success(c.tplDeleted);
  };

  const savePaymentSettings = async (event) => {
    event.preventDefault();
    const res = await api.put("/admin/payment-pricing", { pro_price: Number(paymentSettings.pro_price), pro_duration_days: Number(paymentSettings.pro_duration_days) });
    setPaymentSettings(res.data);
    toast.success(c.paymentSettingsSaved);
  };

  const reviewPayment = async (paymentId, status) => {
    const res = await api.put(`/admin/payments/${paymentId}`, { status });
    setPayments((items) => items.map((payment) => payment.payment_id === paymentId ? { ...payment, ...res.data } : payment));
    toast.success(status === "approved" ? c.paymentApproved : c.paymentRejected);
  };

  const uploadLogo = async (event) => {
    event.preventDefault();
    if (!logoFile) return;
    setLogoSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      const res = await api.post("/admin/branding/logo", formData);
      setBranding(res.data);
      setLogoFile(null);
      event.target.reset();
      toast.success(c.logoUpdated);
    } finally {
      setLogoSaving(false);
    }
  };

  const removeLogo = async () => {
    setLogoSaving(true);
    try {
      await api.delete("/admin/branding/logo");
      setBranding({ logo_url: null });
      toast.success(c.logoRemoved);
    } finally {
      setLogoSaving(false);
    }
  };

  const selectProvider = (provider) => {
    setAiProvider((settings) => ({ ...settings, active_provider: provider }));
    setProviderKey("");
    setProviderModel(aiProvider.providers.find((item) => item.id === provider)?.model || "");
  };

  const saveAiProvider = async (event) => {
    event.preventDefault();
    setProviderSaving(true);
    try {
      const payload = { active_provider: aiProvider.active_provider, model: providerModel.trim() || undefined };
      if (providerKey.trim()) payload.api_key = providerKey.trim();
      const res = await api.put("/admin/ai-provider", payload);
      setAiProvider(res.data);
      setProviderKey("");
      toast.success(c.providerSaved);
    } finally {
      setProviderSaving(false);
    }
  };

  const clearProviderKey = async () => {
    setProviderSaving(true);
    try {
      const res = await api.put("/admin/ai-provider", { active_provider: "auto", target_provider: aiProvider.active_provider, clear_api_key: true });
      setAiProvider(res.data);
      setProviderKey("");
    } finally {
      setProviderSaving(false);
    }
  };

  const statCards = stats ? [
    { id: "users", icon: Users, label: c.statUsers, value: stats.total_users },
    { id: "projects", icon: BarChart3, label: c.statProjects, value: stats.total_projects },
    { id: "prds", icon: FileText, label: c.statPrds, value: stats.total_prds },
    { id: "prompts", icon: Bot, label: c.statPrompts, value: stats.total_prompts },
    { id: "success", icon: Zap, label: c.statOk, value: stats.generations_success },
    { id: "failed", icon: ShieldAlert, label: c.statFail, value: stats.generations_failed },
    { id: "month", icon: Zap, label: c.statMonth, value: stats.generations_this_month },
  ] : [];

  const tabs = [
    { key: "overview", label: c.overview, icon: BarChart3 },
    { key: "users", label: c.users, icon: Users },
    { key: "usage", label: c.usage, icon: Zap },
    { key: "ai-provider", label: c.aiProvider, icon: Cpu },
    { key: "payments", label: c.payments, icon: Landmark },
    { key: "branding", label: c.branding, icon: Image },
    { key: "templates", label: c.templates, icon: LayoutTemplate },
  ];

  if (accessDenied) {
     return <AppLayout><div className="w-full max-w-2xl p-4 sm:p-6 lg:p-12" data-testid="admin-access-denied"><div className="border border-red-500/30 bg-red-500/5 rounded-xl p-5 sm:p-8"><ShieldAlert size={24} className="text-red-400" /><h1 className="font-display text-2xl font-black mt-5">Akses admin diperlukan</h1><p className="text-zinc-500 text-sm mt-2">Akun ini tidak memiliki izin untuk membuka dashboard admin.</p></div></div></AppLayout>;
  }

  return (
    <AppLayout>
       <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-12" data-testid="admin-page">
        <h1 className="font-display text-3xl font-black tracking-tight">{c.title}</h1>
         <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-white/10 px-4 sm:mx-0 sm:px-0 mt-8">
          {tabs.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
               className={`flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-150 sm:px-5 ${tab === tb.key ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              data-testid={`admin-tab-${tb.key}`}>
              <tb.icon size={14} /> {tb.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "overview" && (
             <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4" data-testid="admin-overview">
              {statCards.map((card) => (
                <div key={card.id} className="bg-[#121212] border border-white/10 rounded-2xl p-5">
                  <card.icon size={16} className="text-indigo-400 mb-3" />
                  <p className="font-display text-2xl font-black">{card.value}</p>
                  <p className="text-zinc-500 text-[11px] mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "users" && (
            <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-x-auto" data-testid="admin-users">
               <table className="min-w-[760px] w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10">
                    <th className="px-5 py-3.5 font-medium">{c.colUser}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colPlan}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colRole}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colProjects}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colGens}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colStatus}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-white/5" data-testid={`admin-user-row-${u.user_id}`}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{u.name}</p>
                        <p className="text-zinc-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.plan} onChange={(e) => updateUser(u.user_id, { plan: e.target.value })}
                          className="bg-[#0D0D0F] border border-white/10 rounded-md px-2 py-1 text-xs" data-testid={`admin-plan-select-${u.user_id}`}>
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.role || "user"} onChange={(e) => updateUser(u.user_id, { role: e.target.value })}
                          className="bg-[#0D0D0F] border border-white/10 rounded-md px-2 py-1 text-xs" data-testid={`admin-role-select-${u.user_id}`}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{u.projects_count}</td>
                      <td className="px-4 py-3 text-zinc-400">{u.generations_count}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${u.suspended ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"}`}>
                          {u.suspended ? c.suspended : c.active}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => updateUser(u.user_id, { suspended: !u.suspended })}
                          className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${u.suspended ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "border-red-500/40 text-red-400 hover:bg-red-500/10"}`}
                          data-testid={`admin-suspend-btn-${u.user_id}`}>
                          {u.suspended ? c.activate : c.suspend}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

           {tab === "usage" && (
             <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-x-auto" data-testid="admin-usage">
               <table className="min-w-[700px] w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10">
                    <th className="px-5 py-3.5 font-medium">{c.colWhen}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colUser}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colType}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colModel}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colChars}</th>
                    <th className="px-4 py-3.5 font-medium">{c.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="px-5 py-3 text-zinc-400 font-mono text-[10px]">{r.created_at?.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-4 py-3 text-zinc-400">{r.user_email}</td>
                      <td className="px-4 py-3 text-zinc-300">{r.generation_type}</td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[10px]">{r.provider}/{r.model}</td>
                      <td className="px-4 py-3 text-zinc-400">{r.chars || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${r.status === "success" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
             </div>
           )}

           {tab === "ai-provider" && (
             <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]" data-testid="admin-ai-provider">
               <form onSubmit={saveAiProvider} className="bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-6 h-fit space-y-4" data-testid="admin-ai-provider-form">
                 <div>
                   <p className="font-display font-bold">{c.aiProvider}</p>
                   <p className="text-zinc-500 text-xs mt-1">{c.providerHint}</p>
                 </div>
                 <label className="block text-xs text-zinc-400">{c.activeProvider}
                   <select value={aiProvider.active_provider} onChange={(e) => selectProvider(e.target.value)} className={`${inputCls} mt-2`} data-testid="admin-ai-provider-select">
                     <option value="auto">{c.autoProvider}</option>
                     {aiProvider.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                   </select>
                 </label>
                 <label className="block text-xs text-zinc-400">{c.providerKey}
                   <input type="password" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} placeholder="••••••••" disabled={aiProvider.active_provider === "auto"} className={`${inputCls} mt-2 disabled:opacity-40`} data-testid="admin-ai-provider-key-input" />
                 </label>
                 <p className="text-zinc-600 text-[11px]">{c.providerKeyHint}</p>
                 <label className="block text-xs text-zinc-400">{c.providerModel}
                   <input value={providerModel} onChange={(e) => setProviderModel(e.target.value)} disabled={aiProvider.active_provider === "auto"} className={`${inputCls} mt-2 disabled:opacity-40`} data-testid="admin-ai-provider-model-input" />
                 </label>
                 <div className="flex flex-wrap gap-3">
                   <button type="submit" disabled={providerSaving} className="btn-primary px-5 py-2.5 rounded-full text-xs font-semibold disabled:opacity-40" data-testid="admin-save-ai-provider-btn">{providerSaving ? "..." : c.saveProvider}</button>
                   {aiProvider.active_provider !== "auto" && aiProvider.providers.find((p) => p.id === aiProvider.active_provider)?.source === "dashboard" && <button type="button" onClick={clearProviderKey} disabled={providerSaving} className="px-4 py-2.5 rounded-full border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-40" data-testid="admin-clear-ai-provider-key-btn">{c.clearKey}</button>}
                 </div>
               </form>
               <section className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden">
                 <div className="px-5 py-5 border-b border-white/10"><p className="font-display font-bold">{c.aiProvider}</p></div>
                 <div className="divide-y divide-white/5">
                   {aiProvider.providers.map((provider) => <div key={provider.id} className="flex items-center justify-between gap-4 px-5 py-4" data-testid={`admin-ai-provider-row-${provider.id}`}>
                     <div><p className="text-sm font-semibold">{provider.label}</p><p className="text-[11px] text-zinc-500 font-mono">{provider.model}</p></div>
                     <div className="text-right"><p className={`text-[10px] uppercase font-mono ${provider.configured ? "text-emerald-400" : "text-zinc-600"}`}>{provider.configured ? c.providerConfigured : c.providerNotConfigured}</p>{provider.source && <p className="text-[10px] text-zinc-600 mt-1">{provider.source === "dashboard" ? c.providerDashboard : provider.source === "local" ? c.providerLocal : c.providerEnvironment}</p>}</div>
                   </div>)}
                 </div>
               </section>
             </div>
           )}

           {tab === "payments" && (
             <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]" data-testid="admin-payments">
               <form onSubmit={savePaymentSettings} className="bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-6 h-fit space-y-4" data-testid="admin-payment-settings-form">
                <div>
                  <p className="font-display font-bold">{c.paymentSettings}</p>
                  <p className="text-zinc-500 text-xs mt-1">{c.payments} Pro akan mengikuti konfigurasi ini.</p>
                </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-xs text-zinc-400">{c.price}<input required min="0" type="number" value={paymentSettings.pro_price} onChange={(e) => setPaymentSettings((s) => ({ ...s, pro_price: e.target.value }))} className={`${inputCls} mt-2`} data-testid="admin-pro-price-input" /></label><label className="block text-xs text-zinc-400">{c.duration}<input required min="1" type="number" value={paymentSettings.pro_duration_days} onChange={(e) => setPaymentSettings((s) => ({ ...s, pro_duration_days: e.target.value }))} className={`${inputCls} mt-2`} data-testid="admin-pro-duration-input" /></label></div>
                <button type="submit" className="btn-primary px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2" data-testid="admin-save-payment-settings-btn"><Landmark size={13} />{c.savePaymentSettings}</button>
              </form>
               <section className="bg-[#121212] border border-white/10 rounded-2xl overflow-x-auto" data-testid="admin-payment-requests">
                <div className="px-5 py-5 border-b border-white/10"><p className="font-display font-bold">{c.paymentRequests}</p></div>
                 {payments.length === 0 ? <p className="p-6 text-zinc-500 text-sm" data-testid="admin-payment-empty">{c.noPayments}</p> : <table className="min-w-[800px] w-full text-xs"><thead><tr className="text-left text-zinc-500 border-b border-white/10"><th className="px-5 py-3.5 font-medium">{c.payer}</th><th className="px-4 py-3.5 font-medium">{c.amount}</th><th className="px-4 py-3.5 font-medium">{c.transfer}</th><th className="px-4 py-3.5 font-medium">{c.colStatus}</th><th className="px-4 py-3.5 font-medium">{c.colAction}</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.payment_id} className="border-b border-white/5" data-testid={`admin-payment-row-${payment.payment_id}`}><td className="px-5 py-4"><p className="font-semibold text-white">{payment.user_name}</p><p className="text-zinc-500 mt-0.5">{payment.user_email}</p><p className="text-zinc-600 mt-1">{payment.sender_name}{payment.sender_bank ? ` · ${payment.sender_bank}` : ""}</p></td><td className="px-4 py-4 text-zinc-300">Rp{Number(payment.amount).toLocaleString("id-ID")}</td><td className="px-4 py-4 text-zinc-400"><p>{payment.transfer_at}</p>{payment.transfer_reference && <p className="text-zinc-600 mt-1">{payment.transfer_reference}</p>}</td><td className="px-4 py-4"><span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${paymentStatusClass[payment.status] || paymentStatusClass.pending}`} data-testid={`admin-payment-status-${payment.payment_id}`}>{paymentStatusLabel(payment.status, c)}</span></td><td className="px-4 py-4">{payment.status === "pending" ? <div className="flex gap-2"><button onClick={() => reviewPayment(payment.payment_id, "approved")} title={c.approve} aria-label={c.approve} className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors duration-150" data-testid={`admin-approve-payment-${payment.payment_id}`}><Check size={15} /></button><button onClick={() => reviewPayment(payment.payment_id, "rejected")} title={c.reject} aria-label={c.reject} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors duration-150" data-testid={`admin-reject-payment-${payment.payment_id}`}><X size={15} /></button></div> : <span className="text-zinc-600">—</span>}</td></tr>)}</tbody></table>}
              </section>
            </div>
          )}

          {tab === "branding" && (
             <section className="w-full max-w-xl bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-6" data-testid="admin-branding">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
                  {branding.logo_url ? <img src={branding.logo_url} alt="Current logo" className="w-full h-full object-contain" /> : <Image size={18} className="text-indigo-300" />}
                </div>
                <div><p className="font-display font-bold">{c.branding}</p><p className="text-zinc-500 text-xs mt-1">Logo header dan footer</p></div>
              </div>
              <form onSubmit={uploadLogo} className="space-y-4">
                <label className="block text-xs text-zinc-400">
                  {c.chooseLogo}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="block w-full mt-2 text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-indigo-500/15 file:px-3 file:py-2 file:text-xs file:text-indigo-300 hover:file:bg-indigo-500/25" data-testid="admin-logo-file-input" />
                </label>
                <p className="text-zinc-600 text-[11px]">{c.logoHint}</p>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={!logoFile || logoSaving} className="btn-primary px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 disabled:opacity-40" data-testid="admin-logo-upload-btn">
                    <Upload size={13} /> {logoSaving ? "..." : c.uploadLogo}
                  </button>
                  {branding.logo_url && <button type="button" onClick={removeLogo} disabled={logoSaving} className="px-5 py-2.5 rounded-full border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-40" data-testid="admin-logo-remove-btn">{c.removeLogo}</button>}
                </div>
              </form>
            </section>
          )}

          {tab === "templates" && (
             <div className="grid gap-6 lg:grid-cols-2" data-testid="admin-templates">
              <div className="space-y-3">
                {templates.map((tpl) => (
                   <div key={tpl.id} className="flex items-center justify-between gap-3 bg-[#121212] border border-white/10 rounded-xl px-4 py-3.5 sm:px-5">
                     <div className="min-w-0">
                       <p className="break-words font-semibold text-sm">{tpl.name[lang]} {tpl.custom && <span className="text-[9px] font-mono text-indigo-300 border border-indigo-500/30 rounded-full px-1.5 py-0.5 ml-1.5">CUSTOM</span>}</p>
                      <p className="text-zinc-500 text-[11px]">{tpl.tagline[lang]}</p>
                    </div>
                    {tpl.custom && (
                      <button onClick={() => deleteTemplate(tpl.id)} className="text-zinc-600 hover:text-red-400 transition-colors" data-testid={`admin-tpl-delete-${tpl.id}`} aria-label="Delete template">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
               <form onSubmit={createTemplate} className="bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-6 h-fit space-y-3">
                <input value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} placeholder={c.tplName} className={inputCls} data-testid="admin-tpl-name-input" />
                <input value={tplForm.tagline} onChange={(e) => setTplForm((f) => ({ ...f, tagline: e.target.value }))} placeholder={c.tplTagline} className={inputCls} data-testid="admin-tpl-tagline-input" />
                <p className="text-zinc-500 text-[11px]">{c.tplHint}</p>
                 <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 sm:grid-cols-2">
                  {PREFILL_FIELDS.map((f) => (
                    <input key={f} value={tplForm.prefill[f] || ""} placeholder={f.replace(/_/g, " ")}
                      onChange={(e) => setTplForm((tf) => ({ ...tf, prefill: { ...tf.prefill, [f]: e.target.value } }))}
                      className={inputCls} data-testid={`admin-tpl-prefill-${f}`} />
                  ))}
                </div>
                <button type="submit" className="btn-primary px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2" data-testid="admin-tpl-create-btn">
                  <Plus size={13} /> {c.tplCreate}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

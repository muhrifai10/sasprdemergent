import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";

const t = {
  id: {
    title: "Upgrade ke Pro", subtitle: "Bayar aman melalui Midtrans dan akses fitur Pro otomatis aktif setelah pembayaran berhasil.",
    active: "Paket Pro Anda aktif", activeSub: "Anda memiliki akses tanpa batas selama paket aktif.",
    price: "Biaya Pro", duration: "Masa aktif", days: "hari", pay: "Bayar dengan Midtrans",
    secure: "Pembayaran diproses oleh Midtrans", unavailable: "Pembayaran belum tersedia", unavailableSub: "Admin belum mengonfigurasi Midtrans.",
    processing: "Membuka pembayaran...", pending: "Pembayaran sedang menunggu konfirmasi.", success: "Pembayaran berhasil. Paket Pro diaktifkan.", failed: "Pembayaran belum berhasil.",
  },
  en: {
    title: "Upgrade to Pro", subtitle: "Pay securely through Midtrans and get Pro access automatically after successful payment.",
    active: "Your Pro plan is active", activeSub: "You have unlimited access while your plan remains active.",
    price: "Pro price", duration: "Duration", days: "days", pay: "Pay with Midtrans",
    secure: "Payment is processed by Midtrans", unavailable: "Payment is unavailable", unavailableSub: "The admin has not configured Midtrans yet.",
    processing: "Opening payment...", pending: "Payment is waiting for confirmation.", success: "Payment successful. Pro plan activated.", failed: "Payment was not completed.",
  },
};

const money = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

function loadSnapScript(isProduction, clientKey) {
  return new Promise((resolve, reject) => {
    if (window.snap) return resolve();
    const script = document.createElement("script");
    script.src = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    script.onload = resolve;
    script.onerror = () => reject(new Error("Midtrans Snap gagal dimuat"));
    document.body.appendChild(script);
  });
}

export default function Upgrade() {
  const { lang } = useLang();
  const { user } = useAuth();
  const c = t[lang];
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get("/payments/midtrans-config");
    setConfig(result.data);
  }, []);

  useEffect(() => { load().catch(() => toast.error("Tidak dapat memuat pembayaran")); }, [load]);

  const waitForSettlement = async (orderId) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result = await api.get(`/payments/midtrans/${orderId}`);
      if (result.data.status === "settlement" || result.data.status === "capture") return true;
    }
    return false;
  };

  const pay = async () => {
    setSaving(true);
    try {
      await loadSnapScript(config.is_production, config.client_key);
      const created = await api.post("/payments/midtrans/create");
      window.snap.pay(created.data.token, {
        onSuccess: async () => {
          try {
            const settled = await waitForSettlement(created.data.order_id);
            if (settled) {
              toast.success(c.success);
              window.location.reload();
            } else toast.success(c.pending);
          } catch (error) {
            toast.error(error.response?.data?.detail || c.pending);
          } finally {
            setSaving(false);
          }
        },
        onPending: () => { setSaving(false); toast.info(c.pending); },
        onError: () => { setSaving(false); toast.error(c.failed); },
        onClose: () => setSaving(false),
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || c.failed);
      setSaving(false);
    }
  };

  return <AppLayout><div className="w-full max-w-5xl p-4 sm:p-6 lg:p-12" data-testid="upgrade-page">
    <div className="max-w-2xl">
      <p className="text-[11px] text-indigo-300 uppercase tracking-[0.2em] font-mono">PRD CreativeAI</p>
      <h1 className="font-display text-3xl font-black mt-3 sm:text-4xl">{c.title}</h1>
      <p className="text-zinc-500 mt-3 text-sm leading-relaxed">{c.subtitle}</p>
    </div>
    {user?.plan === "pro" && <div className="mt-8 flex gap-4 border border-emerald-500/25 bg-emerald-500/5 p-5 rounded-xl" data-testid="pro-active-notice"><CheckCircle2 className="text-emerald-400 shrink-0" size={20} /><div><p className="font-semibold text-sm">{c.active}</p><p className="text-zinc-500 text-xs mt-1">{c.activeSub}</p></div></div>}
    {config?.configured === false && <div className="mt-10 border border-dashed border-white/15 p-10 rounded-xl" data-testid="midtrans-unavailable"><CreditCard size={24} className="text-zinc-600 mb-4" /><p className="font-semibold">{c.unavailable}</p><p className="text-zinc-500 text-sm mt-2">{c.unavailableSub}</p></div>}
    {config?.configured && user?.plan !== "pro" && <section className="mt-10 max-w-xl border border-indigo-500/30 bg-indigo-500/5 rounded-2xl p-7" data-testid="midtrans-payment-card">
      <CreditCard size={20} className="text-indigo-300" />
      <p className="font-display text-3xl font-black mt-5" data-testid="pro-price">{money(config.pro_price)}</p>
      <p className="text-zinc-500 text-xs mt-1">{c.price}</p>
      <div className="mt-7 pt-5 border-t border-indigo-300/15"><p className="text-[10px] uppercase tracking-widest text-zinc-500">{c.duration}</p><p className="font-semibold mt-1" data-testid="pro-duration">{config.pro_duration_days} {c.days}</p></div>
      <button onClick={pay} disabled={saving} className="btn-primary mt-8 w-full justify-center px-5 py-3 rounded-full text-sm font-semibold flex items-center gap-2 disabled:opacity-50" data-testid="midtrans-pay-button">{saving ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} {saving ? c.processing : c.pay}</button>
      <div className="mt-5 flex gap-2 text-xs text-zinc-400"><ShieldCheck size={15} className="text-indigo-300 shrink-0" />{c.secure}</div>
    </section>}
  </div></AppLayout>;
}

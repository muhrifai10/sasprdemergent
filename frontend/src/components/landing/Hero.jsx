import { motion, useReducedMotion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { ArrowDown, ArrowRight, ArrowUpRight, Bot, Check, CircleDot, FileText, Sparkles } from "lucide-react";

const t = {
  id: {
    badge: "01 / PRODUCT CLARITY",
    l1: "Ubah Ide Anda Menjadi PRD",
    l2a: "Siap Eksekusi dalam",
    l2b: "Hitungan Menit.",
    sub: "Ubah ide produk menjadi PRD inti yang langsung bisa dibangun dan prompt implementasi siap pakai untuk AI Coding Agent — dengan workflow ketat Frontend → Backend → Integration.",
    cta: "Buat PRD pertama",
    cta2: "Pelajari alurnya",
    p1: "PRD Inti", p1s: "Flow → Schema → API → Roadmap",
    p2: "Agent Prompt", p2s: "Claude Code · Cursor · Codex",
    p3: "3 Phase Ketat", p3s: "Frontend → Backend → Integration",
    eyebrow: "Dari brief pertama hingga handoff ke AI coding agent.",
    promptLabel: "IDEA INPUT",
    prompt: "Marketplace lokal untuk produk rumah tangga berkelanjutan",
    generated: "GENERATED BLUEPRINT",
    ready: "READY TO BUILD",
    sections: "14 core sections",
  },
  en: {
    badge: "01 / PRODUCT CLARITY",
    l1: "Turn Your Idea Into a PRD",
    l2a: "Ready to Execute",
    l2b: "in Minutes.",
    sub: "Turn product ideas into focused, build-ready PRDs and ready-to-use implementation prompts for AI Coding Agents — with a strict Frontend → Backend → Integration workflow.",
    cta: "Create your first PRD",
    cta2: "Explore the workflow",
    p1: "Core PRD", p1s: "Flow → Schema → API → Roadmap",
    p2: "Agent Prompt", p2s: "Claude Code · Cursor · Codex",
    p3: "3 Strict Phases", p3s: "Frontend → Backend → Integration",
    eyebrow: "From first brief to a handoff your AI coding agent can follow.",
    promptLabel: "IDEA INPUT",
    prompt: "A local marketplace for sustainable home goods",
    generated: "GENERATED BLUEPRINT",
    ready: "READY TO BUILD",
    sections: "14 core sections",
  },
};

export default function Hero() {
  const { lang } = useLang();
  const { user, login } = useAuth();
  const c = t[lang];
  const reduceMotion = useReducedMotion();

  const enter = (delay = 0) => reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } };

  return (
    <section id="top" className="hero-shell relative overflow-hidden">
      <div className="hero-grid absolute inset-0" />
      <div className="hero-orb hero-orb-coral" />
      <div className="hero-orb hero-orb-teal" />

      <div className="hero-inner relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-10">
        <div className="hero-topline lp-line-border flex items-center justify-center gap-5 border-b pb-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] lp-dim">
          <span>PRD CREATIVEAI <span className="lp-coral">/</span> AI SPECIFICATION SYSTEM</span>
          <span className="hidden sm:inline-flex items-center gap-2"><span className="hero-pulse-dot" /> SCROLL TO EXPLORE</span>
        </div>

        <div className="hero-grid-columns grid items-center gap-12 py-14 lg:gap-20 lg:py-16">
          <div className="hero-copy text-center">
          <motion.div {...enter(0)} className="landing-kicker mb-6 inline-flex items-center gap-2">
            <CircleDot size={13} aria-hidden="true" /> {c.badge}
          </motion.div>
          <motion.p {...enter(0.08)} className="lp-teal mx-auto mb-5 max-w-md text-sm font-medium leading-6 tracking-wide">{c.eyebrow}</motion.p>
          <motion.h1 {...enter(0.14)} className="font-display hero-title max-w-2xl font-semibold tracking-tight">
            <span className="hero-title-line">{c.l1}</span>
            <span className="hero-title-line"><span className="lp-muted">{c.l2a} </span><span className="lp-coral">{c.l2b}</span></span>
          </motion.h1>
          <motion.p {...enter(0.25)} className="hero-subcopy lp-muted mx-auto mt-7 max-w-xl text-base leading-7 md:text-lg">{c.sub}</motion.p>
          <motion.div {...enter(0.34)} className="hero-actions mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={user ? () => (window.location.href = "/dashboard") : login} className="btn-primary group inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-sm font-semibold" data-testid="hero-cta-btn">
              {c.cta} <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <a href="#manifesto" className="btn-ghost inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium" data-testid="hero-secondary-btn">
              {c.cta2} <ArrowDown size={14} aria-hidden="true" />
            </a>
          </motion.div>
          <motion.div {...enter(0.42)} className="hero-signals lp-line-border mt-10 grid grid-cols-3 gap-3 border-t pt-5">
            <div><p className="hero-signal-number">14</p><p className="hero-signal-label">{c.p1}</p></div>
            <div><p className="hero-signal-number">03</p><p className="hero-signal-label">{c.p3}</p></div>
            <div><p className="hero-signal-number">ID/EN</p><p className="hero-signal-label">Output</p></div>
          </motion.div>
          </div>

        <motion.div {...enter(0.2)} className="hero-workbench relative">
          <div className="hero-workbench-label lp-dim absolute -top-7 right-0 font-mono text-[10px] uppercase tracking-[0.2em]">{c.ready} <ArrowUpRight size={12} className="inline" aria-hidden="true" /></div>
          <div className="hero-window overflow-hidden rounded-3xl border lp-line-border lp-panel-surface">
            <div className="hero-window-head lp-line-border flex items-center justify-between border-b px-4 py-3">
              <div className="hero-window-title flex items-center gap-2"><Sparkles size={14} className="lp-coral" aria-hidden="true" /><span className="lp-muted font-mono text-[10px] tracking-[0.16em]">PRD CREATIVEAI / WORKSPACE</span></div>
              <span className="lp-live-badge rounded-full px-2 py-1 font-mono text-[9px]">LIVE</span>
            </div>
            <div className="hero-output-grid grid">
              <div className="lp-line-border border-b p-5 lg:border-b-0 lg:border-r">
                <p className="hero-micro-label">{c.promptLabel}</p>
                <p className="lp-ink mt-4 text-sm leading-6">{c.prompt}</p>
                <div className="lp-dim lp-line-border mt-8 flex items-center justify-between border-t pt-4 font-mono text-[10px]"><span>LANGUAGE</span><span className="lp-ink">ID / EN</span></div>
                <div className="lp-dim mt-3 flex items-center justify-between font-mono text-[10px]"><span>OUTPUT</span><span className="lp-teal">PRD + PROMPT</span></div>
                <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="lp-coral-bg progress-fill h-full rounded-full" /></div>
                <p className="lp-dim mt-2 font-mono text-[10px]">ANALYZING REQUIREMENTS 78%</p>
              </div>
              <div className="hero-output p-5">
                <div className="flex items-center justify-between"><p className="hero-micro-label">{c.generated}</p><span className="lp-teal font-mono text-[10px]">{c.sections}</span></div>
                <div className="mt-5 space-y-4 font-mono text-[11px] leading-5">
                  <p className="lp-coral"># Product Requirements Document</p>
                  <div className="lp-line-border rounded-lg border bg-black/20 p-3"><p className="lp-ink">01. Product Overview</p><p className="lp-muted mt-1">A focused marketplace for...</p></div>
                  <div className="grid grid-cols-2 gap-3"><div className="lp-line-border rounded-lg border p-3"><FileText size={14} className="lp-teal" aria-hidden="true" /><p className="lp-dim mt-2">DATABASE</p><p className="lp-ink">12 entities</p></div><div className="lp-line-border rounded-lg border p-3"><Bot size={14} className="lp-coral" aria-hidden="true" /><p className="lp-dim mt-2">API SPEC</p><p className="lp-ink">18 endpoints</p></div></div>
                  <div className="lp-line-border lp-teal flex items-center gap-2 border-t pt-4"><Check size={14} aria-hidden="true" /> Assumptions surfaced clearly</div>
                </div>
              </div>
            </div>
            <div className="hero-window-footer lp-line-border flex items-center justify-between border-t bg-black/15 px-5 py-3"><span className="lp-dim font-mono text-[10px]">FRONTEND <span className="lp-coral mx-1">→</span> BACKEND <span className="lp-coral mx-1">→</span> INTEGRATION</span><span className="lp-teal font-mono text-[10px]">01 / 03</span></div>
          </div>
        </motion.div>
        </div>
      </div>
    </section>
  );
}

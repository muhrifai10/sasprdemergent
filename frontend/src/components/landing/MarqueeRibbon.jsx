const items = ["IDEA", "PRD", "AGENT PROMPT", "FRONTEND", "BACKEND", "INTEGRATION"];

export default function MarqueeRibbon() {
  return (
    <div className="landing-proof-ribbon border-y border-white/10 py-5" data-testid="marquee-ribbon">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 lg:px-10">
        <span className="lp-dim font-mono text-[10px] uppercase tracking-[0.2em]">ONE SYSTEM / SIX OUTPUTS</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {items.map((item, i) => <span key={item} className="lp-muted flex items-center gap-5 font-mono text-[10px] tracking-[0.16em]"><span>{item}</span>{i < items.length - 1 && <span className="lp-coral">/</span>}</span>)}
        </div>
      </div>
    </div>
  );
}

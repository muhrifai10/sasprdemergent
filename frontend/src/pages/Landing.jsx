import { useEffect } from "react";
import Lenis from "lenis";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import MarqueeRibbon from "../components/landing/MarqueeRibbon";
import Manifesto from "../components/landing/Manifesto";
import Features from "../components/landing/Features";
import Workflow from "../components/landing/Workflow";
import Showcase from "../components/landing/Showcase";
import Testimonials from "../components/landing/Testimonials";
import Pricing from "../components/landing/Pricing";
import FAQ from "../components/landing/FAQ";
import CTAFooter from "../components/landing/CTAFooter";

export default function Landing() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf;
    const loop = (time) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  return (
    <div className="landing bg-[#0A0A0A] text-white min-h-screen" data-testid="landing-page">
      <Navbar />
      <Hero />
      <MarqueeRibbon />
      <Manifesto />
      <Features />
      <Workflow />
      <Showcase />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTAFooter />
    </div>
  );
}

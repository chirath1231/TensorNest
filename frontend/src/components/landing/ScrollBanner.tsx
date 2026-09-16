"use client";

import ScrollBaseAnimation from "@/components/ui/scroll-text-marquee";

/** Breather between the feature grid and the walkthrough. Purely typographic —
 *  the two lines run opposite ways and both respond to scroll velocity, so the
 *  band shears as you move through it. */
export function ScrollBanner() {
  return (
    <section aria-hidden className="select-none overflow-hidden py-10 sm:py-16">
      <ScrollBaseAnimation
        baseVelocity={-2.4}
        scrollDependent
        className="font-semibold uppercase tracking-tight text-slate-50/[0.07]"
      >
        submit · close the tab · come back ·
      </ScrollBaseAnimation>
      <ScrollBaseAnimation
        baseVelocity={2.4}
        scrollDependent
        className="font-semibold uppercase tracking-tight text-slate-50/[0.07]"
      >
        logs · checkpoints · status · waiting ·
      </ScrollBaseAnimation>
    </section>
  );
}

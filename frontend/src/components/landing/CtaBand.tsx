"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, GitFork } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { TimelineAnimation, riseVariants } from "@/components/ui/timeline-animation";
import { useAuth } from "@/lib/AuthContext";

export function CtaBand() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  return (
    <section ref={sectionRef} className="px-5 py-16 sm:py-24">
      <TimelineAnimation
        as="div"
        animationNum={0}
        timelineRef={sectionRef}
        customVariants={riseVariants}
        className="mx-auto max-w-4xl"
      >
        <LiquidGlassCard
          borderRadius="28px"
          blurIntensity="xl"
          glowIntensity="lg"
          shadowIntensity="md"
          className="glass glass-raised glass-sheen overflow-hidden"
        >
          <div className="px-7 py-14 text-center sm:px-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Submit one job. Then close the tab.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
              The sample script finishes in about ten seconds on local CPU, with logs
              and five checkpoints waiting when you come back. That is the entire
              pitch, and it takes a minute to check.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={user ? "/dashboard" : "/register"}
                className="btn-accent px-5 py-3"
              >
                {user ? "Open dashboard" : "Create an account"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/chirath1231/TensorNest"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost border border-white/12 px-4 py-3"
              >
                <GitFork className="h-4 w-4" />
                Read the source
              </a>
            </div>
          </div>
        </LiquidGlassCard>
      </TimelineAnimation>
    </section>
  );
}

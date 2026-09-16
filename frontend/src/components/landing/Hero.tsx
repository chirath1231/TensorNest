"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { TimelineAnimation, riseVariants } from "@/components/ui/timeline-animation";
import { useAuth } from "@/lib/AuthContext";
import { TerminalPanel } from "./TerminalPanel";

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  return (
    <section ref={heroRef} className="relative px-5 pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,30rem)] lg:gap-14">
        <div className="min-w-0">
          <TimelineAnimation
            as="div"
            animationNum={0}
            timelineRef={heroRef}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-xs text-slate-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Early research prototype · verified end to end on a Tesla T4
          </TimelineAnimation>

          <TimelineAnimation
            as="h1"
            animationNum={1}
            timelineRef={heroRef}
            className="mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-slate-50 sm:text-6xl"
          >
            Training that
            <br />
            <span className="text-gradient">outlives the tab.</span>
          </TimelineAnimation>

          <TimelineAnimation
            as="p"
            animationNum={2}
            timelineRef={heroRef}
            className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base"
          >
            On Colab and Kaggle a run is tied to a notebook session — close the tab,
            lose the connection, let the laptop sleep, and the job eventually dies.
            TensorNest hands your script to a scheduler that owns the run. Come back
            an hour later, or after a reboot: the status, logs and checkpoints are
            waiting.
          </TimelineAnimation>

          <TimelineAnimation
            as="div"
            animationNum={3}
            timelineRef={heroRef}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href={user ? "/dashboard" : "/register"} className="btn-accent px-5 py-3">
              {user ? "Open dashboard" : "Start training free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="btn-ghost px-4 py-3">
              <BookOpen className="h-4 w-4" />
              See how it works
            </a>
          </TimelineAnimation>

          <TimelineAnimation
            as="p"
            animationNum={4}
            timelineRef={heroRef}
            className="mt-6 text-xs text-slate-500"
          >
            Runs on local CPU for free. Add a Modal token for T4 through H100.
          </TimelineAnimation>
        </div>

        <TimelineAnimation
          as="div"
          animationNum={2}
          timelineRef={heroRef}
          customVariants={riseVariants}
          className="min-w-0"
        >
          <TerminalPanel />
        </TimelineAnimation>
      </div>
    </section>
  );
}

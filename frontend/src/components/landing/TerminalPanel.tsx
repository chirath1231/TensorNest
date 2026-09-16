"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TypeWriter } from "@/components/ui/typing-writer";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

type Line =
  | { kind: "cmd"; text: string }
  /** Instant output; `tone` colours it the way a real status line would read. */
  | { kind: "out"; text: string; tone?: "muted" | "ok" | "accent" };

const SCRIPT: Line[] = [
  { kind: "cmd", text: "tensornest submit train.py --gpu T4" },
  { kind: "out", text: "uploading train.py → s3://tensornest/uploads", tone: "muted" },
  { kind: "out", text: "job 7f3c1a queued on modal:T4", tone: "accent" },
  { kind: "cmd", text: "# close the laptop" },
  { kind: "out", text: "...", tone: "muted" },
  { kind: "cmd", text: "tensornest status 7f3c1a" },
  { kind: "out", text: "succeeded in 41m 12s · 5 checkpoints · 2.1 MB logs", tone: "ok" },
];

const TONE: Record<NonNullable<Extract<Line, { kind: "out" }>["tone"]>, string> = {
  muted: "text-slate-500",
  ok: "text-emerald-300",
  accent: "text-cyan-300",
};

/** The hero's proof-by-demonstration: the whole product is the gap between
 *  "close the laptop" and a finished job, so the terminal plays that gap out
 *  rather than describing it. */
export function TerminalPanel() {
  const [step, setStep] = useState(0);

  // Output lines have nothing to type, so they advance the script themselves
  // on a timer; command lines advance from TypeWriter's onComplete.
  useEffect(() => {
    const line = SCRIPT[step];
    if (!line || line.kind === "cmd") return;
    const timer = setTimeout(() => setStep((s) => s + 1), line.text === "..." ? 1100 : 420);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <LiquidGlassCard
      borderRadius="22px"
      blurIntensity="xl"
      glowIntensity="md"
      shadowIntensity="sm"
      className="glass glass-raised glass-sheen overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-mono text-[11px] tracking-wide text-slate-500">
          tensornest — bash
        </span>
      </div>

      <div className="min-h-[15rem] space-y-1.5 p-4 text-[12.5px] leading-relaxed sm:min-h-[16rem] sm:p-5 sm:text-[13px]">
        {SCRIPT.slice(0, step + 1).map((line, i) => {
          const isCurrent = i === step;

          if (line.kind === "cmd") {
            return (
              <div key={i} className="flex gap-2">
                <span aria-hidden className="select-none text-cyan-400">
                  $
                </span>
                {isCurrent ? (
                  <TypeWriter
                    text={line.text}
                    className="text-slate-200"
                    onComplete={() => setStep((s) => (s === i ? s + 1 : s))}
                  />
                ) : (
                  <span className="font-mono text-slate-200">{line.text}</span>
                )}
              </div>
            );
          }

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("pl-4 font-mono", TONE[line.tone ?? "muted"])}
            >
              {line.text}
            </motion.div>
          );
        })}
      </div>
    </LiquidGlassCard>
  );
}

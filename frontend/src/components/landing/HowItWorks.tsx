"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { SectionHeading } from "./SectionHeading";

interface Step {
  n: string;
  title: string;
  body: string;
  detail: string[];
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Write it anywhere",
    body: "Draft in a TensorNest notebook against a real kernel, or bring a script you already have. Notebooks export to valid nbformat 4.5, so nothing you write here is trapped here.",
    detail: ["notebooks/<user>/<id>.ipynb", "PyTorch 2.4 · NumPy · pandas · sklearn"],
  },
  {
    n: "02",
    title: "Submit to a provider",
    body: "Pick local Docker CPU or a Modal GPU and submit. The script and its dataset go to object storage first, because a remote GPU cannot read your disk.",
    detail: ["uploads/<user>/<random>_<file>", "queued → running"],
  },
  {
    n: "03",
    title: "Close the laptop",
    body: "The provider owns the run from here. The backend holds a container id or a sandbox id, the worker follows along, and neither of those is load-bearing for the result.",
    detail: ["worker restart → reattach, not re-run", "reconciler sweeps every 60s"],
  },
  {
    n: "04",
    title: "Come back to the outcome",
    body: "Status, the full log and every checkpoint are in the bucket under the job's key. Wire up SMTP and the job emails you when it starts, succeeds or fails — at most once each.",
    detail: ["jobs/<id>/logs.txt", "jobs/<id>/checkpoints/<file>"],
  },
];

function StepCard({
  step,
  i,
  total,
  progress,
}: {
  step: Step;
  i: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // The stacking-card effect from ui-layouts: each card sticks, then shrinks as
  // the next one slides over it, so the deck compresses instead of scrolling
  // away. Cards later in the list settle at a larger scale, which is what makes
  // the stack read as depth rather than as a pile.
  const targetScale = 1 - (total - i) * 0.04;
  const scale = useTransform(progress, [i * (1 / total), 1], [1, targetScale]);

  return (
    <div className="sticky top-0 flex min-h-screen items-center justify-center px-1">
      <motion.article
        style={{ scale, top: `calc(-2vh + ${i * 22}px)` }}
        className="glass glass-raised glass-sheen relative w-full max-w-3xl overflow-hidden rounded-3xl p-7 sm:p-10"
      >
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm text-cyan-300/70">{step.n}</span>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            {step.title}
          </h3>
        </div>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{step.body}</p>
        <ul className="mt-7 flex flex-wrap gap-2">
          {step.detail.map((d) => (
            <li
              key={d}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 font-mono text-[11.5px] text-slate-400"
            >
              {d}
            </li>
          ))}
        </ul>
      </motion.article>
    </div>
  );
}

export function HowItWorks() {
  const headingRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: deckRef,
    offset: ["start start", "end end"],
  });

  return (
    <section id="how-it-works" className="scroll-mt-24 px-5 py-20 sm:py-28">
      <div ref={headingRef} className="mx-auto max-w-6xl">
        <SectionHeading
          timelineRef={headingRef}
          eyebrow="How it works"
          title="Four steps, and only one of them needs you"
          description="The whole point of the design is that steps three and four happen whether or not anyone is watching."
        />
      </div>

      <div ref={deckRef} className="mx-auto mt-10 max-w-6xl">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.n}
            step={step}
            i={i}
            total={STEPS.length}
            progress={scrollYProgress}
          />
        ))}
      </div>
    </section>
  );
}

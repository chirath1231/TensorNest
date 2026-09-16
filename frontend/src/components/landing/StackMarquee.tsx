"use client";

import { Marquee } from "@/components/ui/marquee";

const STACK = [
  "PyTorch 2.4",
  "TensorFlow",
  "Modal Sandboxes",
  "Docker",
  "FastAPI",
  "PostgreSQL 16",
  "Redis · arq",
  "Cloudflare R2",
  "Jupyter Kernel Gateway",
  "scikit-learn",
  "NumPy",
  "pandas",
];

/** The stack strip. Deliberately not a wall of customer logos — this is a
 *  research prototype and has none; what it does have is a stack worth naming. */
export function StackMarquee() {
  return (
    <section aria-label="Built on" className="border-y border-white/[0.07] py-6">
      <div className="edge-fade">
        <Marquee pauseOnHover repeat={3} className="[--duration:46s] [--gap:3rem]">
          {STACK.map((item) => (
            <span
              key={item}
              className="whitespace-nowrap font-mono text-sm tracking-tight text-slate-500 transition-colors hover:text-slate-300"
            >
              {item}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

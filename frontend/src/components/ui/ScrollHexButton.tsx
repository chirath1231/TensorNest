"use client";

// A fixed "back to top" control shaped like a hexagon, whose border traces
// itself in as the page scrolls — the scroll-progress indicator seen on a lot
// of futuristic/sci-fi portfolio sites, usually doubling as a jump-to-top
// button. Nothing in ui-layouts' catalogue matches this shape, so it is
// hand-built rather than adapted, reusing the same SVG-gradient technique as
// the wordmark in Logo.tsx to keep the accent stops identical everywhere.

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";

// A hexagon with flat top/bottom edges and pointy left/right vertices, drawn
// in a 0-100 viewBox so the same six coordinates serve both the SVG stroke
// and the CSS clip-path — the two shapes stay pixel-identical by construction
// instead of two hand-tuned numbers drifting apart.
const HEX_POINTS = "96,50 73,89.84 27,89.84 4,50 27,10.16 73,10.16";
const HEX_CLIP =
  "polygon(96% 50%, 73% 89.84%, 27% 89.84%, 4% 50%, 27% 10.16%, 73% 10.16%)";

/** Pixels of page scroll before the button appears. Below this the page is
 *  still effectively at the top, where a "back to top" control has nothing
 *  useful to do — so it stays hidden rather than sitting idle at 0% fill. */
const REVEAL_THRESHOLD = 320;

export function ScrollHexButton() {
  // No `target` passed to useScroll tracks the whole document: scrollYProgress
  // runs 0 at the top of the page to 1 at the bottom, which is exactly the
  // "how far down the page" the border fill is meant to represent.
  const { scrollY, scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > REVEAL_THRESHOLD);
  });

  // Smoothed so the border sweeps with a bit of trailing motion instead of
  // jumping frame-to-frame on a fast trackpad flick.
  const borderFill = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    mass: 0.4,
  });

  return (
    <motion.button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      initial={false}
      animate={
        visible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.7, y: 14 }
      }
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="group fixed bottom-7 right-5 z-40 h-14 w-14 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70 sm:bottom-9 sm:right-9 sm:h-16 sm:w-16"
    >
      {/* Hex-clipped glass fill, inset a few percent inside the stroke so the
          border reads as its own ring rather than blending into the panel. */}
      <span
        aria-hidden
        className="absolute inset-[6%] bg-[rgb(9_12_26_/_0.82)] backdrop-blur-md transition-colors group-hover:bg-[rgb(14_18_36_/_0.88)]"
        style={{ clipPath: HEX_CLIP }}
      />

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="hex-progress-grad" x1="0" y1="0" x2="100" y2="100">
            <stop stopColor="rgb(34,211,238)" />
            <stop offset="0.55" stopColor="rgb(167,139,250)" />
            <stop offset="1" stopColor="rgb(244,114,182)" />
          </linearGradient>
        </defs>

        {/* Dim track: the full outline, always present, so the animated
            stroke reads as filling along a rail rather than growing out of
            nothing. */}
        <polygon
          points={HEX_POINTS}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* The fill itself. `pathLength` is framer-motion's normalised
            stroke-length prop (0-1) for path-like SVG shapes — assigning
            scroll progress to it draws the border in directly, with no
            manual stroke-dasharray math. */}
        <motion.polygon
          points={HEX_POINTS}
          fill="none"
          stroke="url(#hex-progress-grad)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ pathLength: borderFill }}
        />
      </svg>

      <ArrowUp
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-5 w-5 text-slate-200 transition-transform group-hover:-translate-y-0.5"
      />
    </motion.button>
  );
}

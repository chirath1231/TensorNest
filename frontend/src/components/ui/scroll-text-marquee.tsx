"use client";

// From ui-layouts.com/components/scroll-text-marquee, with two adaptations:
// imports come from `framer-motion` rather than `motion/react`, and `wrap` is
// inlined rather than pulled from `@motionone/utils`, which is not a
// dependency of this project (it is four lines, and adding a package for it
// would be the tail wagging the dog).

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Fold `value` back into [min, max), so the track loops instead of running off. */
function wrap(min: number, max: number, value: number) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

interface ScrollBaseAnimationProps {
  children: string;
  /** Percent of the track per second. Negative runs right-to-left. */
  baseVelocity?: number;
  className?: string;
  /** Let scroll direction flip the marquee and scroll speed accelerate it. */
  scrollDependent?: boolean;
  /** Milliseconds to hold still before the track starts moving. */
  delay?: number;
}

export default function ScrollBaseAnimation({
  children,
  baseVelocity = -5,
  className,
  scrollDependent = false,
  delay = 0,
}: ScrollBaseAnimationProps) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 2], {
    clamp: false,
  });

  const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);

  const directionFactor = useRef(1);
  const hasStarted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      hasStarted.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useAnimationFrame((_t, deltaMs) => {
    if (!hasStarted.current) return;

    let moveBy = directionFactor.current * baseVelocity * (deltaMs / 1000);

    if (scrollDependent) {
      if (velocityFactor.get() < 0) directionFactor.current = -1;
      else if (velocityFactor.get() > 0) directionFactor.current = 1;
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div className="flex flex-nowrap overflow-hidden whitespace-nowrap">
      <motion.div
        className="flex flex-nowrap gap-10 whitespace-nowrap"
        style={{ x }}
        aria-hidden
      >
        {/* Four copies: `wrap` cycles over a 25% window, so there is always a
            copy entering as another leaves, at any viewport width. */}
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={cn("block text-[11vw] sm:text-[8vw]", className)}>
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

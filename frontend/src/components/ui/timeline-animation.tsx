"use client";

// From ui-layouts.com/components/timeline-animation, importing from
// `framer-motion` rather than `motion/react` — same API, and the package this
// project already depends on.
//
// Every element in a section shares one `timelineRef`, so the whole group
// starts its stagger when that section scrolls into view rather than each
// element firing independently as it crosses the fold.

import { useInView, motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type React from "react";

/** The default motion minus the blur.
 *
 *  An element whose `filter` is anything other than `none` becomes a backdrop
 *  root, and framer-motion leaves `filter: blur(0px)` on the node once the
 *  animation lands. So a blur-in wrapper permanently flattens any
 *  `backdrop-filter` glass inside it — the panel stops refracting the aurora
 *  and just looks washed out. Use these variants for anything wrapping a
 *  glass surface. */
export const riseVariants: Variants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
  hidden: { y: 18, opacity: 0 },
};

type TimelineContentProps<T extends keyof HTMLElementTagNameMap> = {
  children?: React.ReactNode;
  /** Position in the stagger — the delay is this times the step. */
  animationNum: number;
  className?: string;
  timelineRef: React.RefObject<HTMLElement | null>;
  as?: T;
  customVariants?: Variants;
  once?: boolean;
} & HTMLMotionProps<T>;

export const TimelineAnimation = <T extends keyof HTMLElementTagNameMap = "div">({
  children,
  animationNum,
  timelineRef,
  className,
  as,
  customVariants,
  once = true,
  ...props
}: TimelineContentProps<T>) => {
  const defaultSequenceVariants: Variants = {
    visible: (i: number) => ({
      filter: "blur(0px)",
      y: 0,
      opacity: 1,
      // The published default is a 0.5s step, which is languid on a page with
      // this many sections; 0.12 keeps the stagger legible without stalling.
      transition: { delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    }),
    hidden: { filter: "blur(12px)", y: 18, opacity: 0 },
  };

  const sequenceVariants = customVariants || defaultSequenceVariants;
  const isInView = useInView(timelineRef as React.RefObject<Element>, { once });
  const MotionComponent = motion[as || "div"] as React.ElementType;

  return (
    <MotionComponent
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={animationNum}
      variants={sequenceVariants}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

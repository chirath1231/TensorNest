"use client";

// From ui-layouts.com/components/accordion. Adapted in three ways: imports
// come from `framer-motion` rather than `motion/react`; the Tailwind v4
// `data-active:` variant is spelled `data-[active]:` on v3; and the default
// colours are the glass palette rather than the library's neutral ramp, since
// this app only ever renders dark.

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AccordionContextType {
  isActive?: boolean;
  value?: string;
  onChangeIndex?: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextType>({});
const useAccordion = () => React.useContext(AccordionContext);

export function AccordionContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid grid-cols-1 gap-1", className)}>{children}</div>;
}

export function AccordionWrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

interface AccordionProps {
  children: ReactNode;
  /** Allow more than one panel open at a time. */
  multiple?: boolean;
  defaultValue?: string | string[];
}

export function Accordion({ children, multiple, defaultValue }: AccordionProps) {
  const [activeIndex, setActiveIndex] = React.useState<string | string[] | null>(
    multiple ? (Array.isArray(defaultValue) ? defaultValue : []) : defaultValue || null
  );

  const onChangeIndex = useCallback(
    (value: string) => {
      setActiveIndex((current) => {
        if (!multiple) return value === current ? null : value;
        if (Array.isArray(current)) {
          return current.includes(value)
            ? current.filter((i) => i !== value)
            : [...current, value];
        }
        return [value];
      });
    },
    [multiple]
  );

  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return null;

    const { value } = child.props as { value: string };
    const isActive = multiple
      ? Array.isArray(activeIndex) && activeIndex.includes(value)
      : activeIndex === value;

    return (
      <AccordionContext.Provider value={{ isActive, value, onChangeIndex }}>
        {child}
      </AccordionContext.Provider>
    );
  });
}

export function AccordionItem({
  children,
  className,
}: {
  children: ReactNode;
  /** Read by <Accordion> to decide whether this item is the open one. */
  value: string;
  className?: string;
}) {
  const { isActive } = useAccordion();

  return (
    <div
      data-active={isActive || undefined}
      className={cn(
        "group mb-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-colors",
        "data-[active]:border-white/20 data-[active]:bg-white/[0.06]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AccordionHeader({
  children,
  customIcon,
  className,
}: {
  children: ReactNode;
  customIcon?: boolean;
  className?: string;
}) {
  const { isActive, value, onChangeIndex } = useAccordion();

  const handleClick = useCallback(() => {
    if (value && onChangeIndex) onChangeIndex(value);
  }, [onChangeIndex, value]);

  return (
    <motion.button
      type="button"
      data-active={isActive || undefined}
      aria-expanded={isActive}
      aria-controls={`accordion-panel-${value}`}
      id={`accordion-header-${value}`}
      onClick={handleClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[15px]",
        "font-medium text-slate-300 transition-colors hover:text-slate-50",
        "data-[active]:text-slate-50",
        className
      )}
    >
      {children}
      {!customIcon && (
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform",
            isActive ? "rotate-180" : "rotate-0"
          )}
        />
      )}
    </motion.button>
  );
}

export function AccordionPanel({
  children,
  className,
  articleClassName,
}: {
  children: ReactNode;
  className?: string;
  articleClassName?: string;
}) {
  const { isActive, value } = useAccordion();

  return (
    <AnimatePresence initial={false}>
      {isActive && (
        <motion.div
          role="region"
          id={`accordion-panel-${value}`}
          aria-labelledby={`accordion-header-${value}`}
          initial={{ height: 0, overflow: "hidden" }}
          animate={{ height: "auto", overflow: "hidden" }}
          exit={{ height: 0 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          className={cn("text-sm leading-relaxed text-muted", className)}
        >
          {/* The clip-path wipe runs slightly behind the height spring, so the
              text is revealed by the opening panel rather than sliding with it. */}
          <motion.div
            initial={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
            animate={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)" }}
            exit={{ clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className={cn("space-y-2 px-5 pb-5 pt-0", articleClassName)}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

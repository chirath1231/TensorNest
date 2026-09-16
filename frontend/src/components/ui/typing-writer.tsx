"use client";

// From ui-layouts.com/components/type-writer. Adapted so the caret colour is
// inherited rather than hard-coded purple, `onComplete` is optional, and the
// effect re-runs when `text` changes — the published version keys its effect
// on mount alone, which is fine for its demo but wrong for a line that gets
// reused across a replaying sequence.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TypeWriterProps {
  text: string;
  /** Milliseconds between characters. */
  charDelay?: number;
  onComplete?: () => void;
  className?: string;
  /** Hide the blinking caret once the line has finished typing. */
  hideCaretWhenDone?: boolean;
}

export function TypeWriter({
  text,
  charDelay = 28,
  onComplete,
  className,
  hideCaretWhenDone = true,
}: TypeWriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  // Held in a ref so a caller that passes an inline arrow function does not
  // restart the typing on every render.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let i = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    setDisplayed("");
    setDone(false);

    function typeNext() {
      if (cancelled) return;
      if (i >= text.length) {
        setDone(true);
        onCompleteRef.current?.();
        return;
      }
      setDisplayed(text.slice(0, i + 1));
      i++;
      timer = setTimeout(typeNext, charDelay);
    }

    timer = setTimeout(typeNext, charDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, charDelay]);

  return (
    <span className={cn("font-mono", className)}>
      {displayed}
      {!(done && hideCaretWhenDone) && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[2px] animate-blink bg-current align-text-bottom"
        />
      )}
    </span>
  );
}

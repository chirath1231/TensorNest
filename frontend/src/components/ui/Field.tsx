"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  /** Validation message. When set, the field renders in its invalid state. */
  error?: string | null;
  /** Rendered under the input — used for the password strength meter. */
  children?: ReactNode;
}

/** Labelled, icon-led text input on the glass surface.
 *
 *  `noValidate` on the parent form turns off the browser's native bubbles, so
 *  everything a user sees comes from here: the message is rendered inline and
 *  wired up with aria-invalid/aria-describedby rather than announced by the
 *  browser, which keeps screen readers and sighted users on the same text. */
export function Field({
  id,
  label,
  type = "text",
  icon: Icon,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  required = true,
  maxLength,
  hint,
  error,
  children,
}: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  const describedBy =
    [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            error ? "text-rose-400" : "text-slate-500"
          )}
        />
        <input
          id={id}
          type={inputType}
          required={required}
          maxLength={maxLength}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "glass-input pl-10",
            isPassword && "pr-11",
            error && "border-rose-400/60 focus:border-rose-400 focus:shadow-[0_0_0_4px_rgba(251,113,133,0.12)]"
          )}
        />
        {isPassword && value.length > 0 && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {children}

      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs text-rose-300"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

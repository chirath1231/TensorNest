"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { AuthShell } from "@/components/ui/AuthShell";
import { Field } from "@/components/ui/Field";
import { validateEmail, validateLoginPassword } from "@/lib/validation";

type FieldName = "email" | "password";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  // A field only shows its error once the user has left it or tried to submit,
  // so the form is not scolding them about an email they are still typing.
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function runValidation() {
    const next: Partial<Record<FieldName, string>> = {};
    const e = validateEmail(email);
    const p = validateLoginPassword(password);
    if (e) next.email = e;
    if (p) next.password = p;
    setErrors(next);
    return next;
  }

  function handleBlur(field: FieldName) {
    setTouched((t) => ({ ...t, [field]: true }));
    runValidation();
  }

  // Re-validate on every keystroke so a field the user has already visited
  // clears its message the moment it becomes valid. Errors stay hidden until
  // the field is touched, so this never nags someone mid-typing.
  useEffect(() => {
    runValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = runValidation();
    if (Object.keys(found).length > 0) {
      setTouched({ email: true, password: true });
      // Move focus to the first bad field so keyboard users are not stranded.
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.status === 401
            ? "Invalid email or password."
            : err.message
          : "Could not reach the server. Is the backend running?"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up your notebooks and running jobs.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AnimatePresence initial={false}>
          {formError && (
            <motion.p
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="flex items-center gap-2 overflow-hidden rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </motion.p>
          )}
        </AnimatePresence>

        <Field
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          value={email}
          onChange={setEmail}
          onBlur={() => handleBlur("email")}
          error={touched.email ? errors.email : null}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          icon={Lock}
          value={password}
          onChange={setPassword}
          onBlur={() => handleBlur("password")}
          error={touched.password ? errors.password : null}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <button type="submit" disabled={submitting} className="btn-accent w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link
            href="/register"
            className="font-medium text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

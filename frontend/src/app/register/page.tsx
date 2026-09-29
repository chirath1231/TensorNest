"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { AuthShell } from "@/components/ui/AuthShell";
import { Field } from "@/components/ui/Field";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { NAME_MAX, PASSWORD_MAX, validateEmail, validateName, validatePassword } from "@/lib/validation";

type FieldName = "name" | "email" | "password";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function runValidation() {
    const next: Partial<Record<FieldName, string>> = {};
    const n = validateName(name);
    const e = validateEmail(email);
    const p = validatePassword(password);
    if (n) next.name = n;
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
  }, [name, email, password]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = runValidation();
    if (Object.keys(found).length > 0) {
      setTouched({ name: true, email: true, password: true });
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim());
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Attach a duplicate-email conflict to the field it belongs to.
        setErrors((prev) => ({ ...prev, email: "That email is already registered." }));
        setTouched((t) => ({ ...t, email: true }));
        document.getElementById("email")?.focus();
      } else {
        setFormError(
          err instanceof ApiError
            ? err.message
            : "Could not reach the server. Is the backend running?"
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Takes a moment. No card, no cluster to configure."
    >
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
          id="name"
          label="Name"
          icon={User}
          value={name}
          onChange={setName}
          onBlur={() => handleBlur("name")}
          error={touched.name ? errors.name : null}
          maxLength={NAME_MAX}
          placeholder="Ada Lovelace"
          autoComplete="name"
        />
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
          maxLength={PASSWORD_MAX}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        >
          <PasswordStrength password={password} />
        </Field>

        <button type="submit" disabled={submitting} className="btn-accent w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

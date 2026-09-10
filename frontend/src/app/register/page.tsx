"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, name);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-[#f2bc33] bg-white p-8 shadow-sm dark:bg-neutral-900"
      >
        <div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-cyan-600 text-sm font-semibold text-white">
            TN
          </div>
          <h1 className="text-lg font-semibold dark:text-[#e6c163]">Create your TensorNest account</h1>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="space-y-1">
          <label className="text-sm text-[#e6c163] dark:text-[#e6c163]">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-[#f2bc33] px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-[#e6c163]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-[#e6c163] dark:text-[#e6c163]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-[#f2bc33] px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-[#e6c163]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-[#e6c163] dark:text-[#e6c163]">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-[#f2bc33] px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-[#e6c163]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-[#e6c163]">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-600 underline">
            Sign in
          </Link>
        </p>
      </motion.form>
    </div>
  );
}

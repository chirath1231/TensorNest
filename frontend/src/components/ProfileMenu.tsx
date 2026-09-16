"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Avatar } from "@/components/ui/Avatar";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navigating to the settings page should leave the menu behind it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="rounded-full transition hover:ring-2 hover:ring-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
      >
        <Avatar src={user?.avatar_url} name={user?.name} email={user?.email} size="sm" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Account"
            /* Same reason as the notification panel: on a phone the avatar is
               far from the right edge, so anchoring a fixed-width card to it
               would push the card off-screen. */
            className="glass glass-raised glass-sheen fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl
                       bg-[rgb(9_12_28_/_0.94)]
                       sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64"
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
              <Avatar src={user?.avatar_url} name={user?.name} email={user?.email} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-50">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>

            {user?.bio && (
              <p className="border-b border-white/10 px-4 py-3 text-xs leading-relaxed text-muted">
                {user.bio}
              </p>
            )}

            <div className="p-1.5">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08] hover:text-slate-50"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Profile settings
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-slate-200 transition hover:bg-rose-500/12 hover:text-rose-200"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

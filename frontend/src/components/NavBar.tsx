"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

const links = [
  { href: "/dashboard", label: "Notebooks" },
  { href: "/jobs", label: "Jobs" },
  { href: "/datasets", label: "Datasets" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-[#f2bc33] bg-white/80 px-6 py-3 backdrop-blur dark:bg-neutral-900/80">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-tight dark:text-[#e6c163]">TensorNest</span>
        <div className="flex gap-1">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-cyan-600 font-medium dark:text-cyan-400"
                    : "text-[#e6c163] hover:text-[#e6c163] dark:text-[#e6c163] dark:hover:text-[#e6c163]"
                }`}
              >
                {link.label}
                {active && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-md bg-cyan-50 dark:bg-cyan-950/50"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-xs font-medium text-white">
          {initials}
        </div>
        <span className="hidden text-sm text-[#e6c163] sm:inline dark:text-[#e6c163]">{user?.email}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[#e6c163] transition hover:bg-neutral-100 hover:text-[#e6c163] dark:text-[#e6c163] dark:hover:bg-neutral-800 dark:hover:text-[#e6c163]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </nav>
  );
}

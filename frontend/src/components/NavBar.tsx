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
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200 bg-white/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-tight">TensorNest</span>
        <div className="flex gap-1">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-2.5 py-1.5 text-sm transition-colors ${
                  active ? "text-cyan-600 font-medium" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {link.label}
                {active && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-md bg-cyan-50"
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
        <span className="hidden text-sm text-neutral-500 sm:inline">{user?.email}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </nav>
  );
}

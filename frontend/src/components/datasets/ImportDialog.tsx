"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Heart, Link2, Loader2, Scale, Search, X } from "lucide-react";
import { toast } from "sonner";
import { discoverApi } from "@/lib/resources";
import type { DiscoverResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const sourceLabels: Record<string, string> = {
  huggingface: "Hugging Face",
  url: "Direct link",
};

export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DiscoverResult[] | null>(null);
  const [expanded, setExpanded] = useState<DiscoverResult | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setExpanded(null);
    try {
      const { results } = await discoverApi.search(query.trim());
      setResults(results);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleExpand(result: DiscoverResult) {
    if (expanded?.ref === result.ref) {
      setExpanded(null);
      return;
    }
    // A direct link already names its one file, so there is nothing to look up.
    if (result.files.length > 0) {
      setExpanded(result);
      return;
    }
    setLoadingFiles(true);
    setExpanded(result);
    try {
      setExpanded(await discoverApi.describe(result.source, result.ref));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that dataset");
      setExpanded(null);
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleImport(result: DiscoverResult, path: string) {
    setImporting(path);
    try {
      await discoverApi.import({ source: result.source, ref: result.ref, path });
      toast.success(`Importing ${path.split("/").pop()} — it appears in Datasets when it lands.`);
      onImported();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start that import");
    } finally {
      setImporting(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Import a dataset from the web"
            className="glass glass-raised glass-sheen relative w-full max-w-2xl rounded-2xl bg-[rgb(9_12_28_/_0.96)] p-5 sm:p-6"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-base font-semibold text-slate-50">Import a dataset</h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
              Search Hugging Face, or paste a direct link to any CSV or Parquet file. It lands in
              your datasets and is usable from a notebook with{" "}
              <code className="text-cyan-300">tn.load()</code>.
            </p>

            <form onSubmit={handleSearch} className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="titanic, or https://example.com/data.csv"
                  aria-label="Search datasets"
                  className="glass-input pl-9"
                />
              </div>
              <button type="submit" disabled={searching} className="btn-accent shrink-0">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </button>
            </form>

            <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto">
              {results === null ? (
                <p className="py-10 text-center text-sm text-muted">
                  Search a catalogue, or paste a link.
                </p>
              ) : results.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  Nothing found for “{query}”.
                </p>
              ) : (
                results.map((result) => {
                  const isOpen = expanded?.ref === result.ref;
                  const shown = isOpen ? expanded : result;
                  return (
                    <div
                      key={`${result.source}:${result.ref}`}
                      className={cn(
                        "rounded-xl border transition",
                        isOpen
                          ? "border-cyan-400/40 bg-cyan-400/[0.07]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      )}
                    >
                      <button
                        onClick={() => handleExpand(result)}
                        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">
                              {result.title}
                            </span>
                            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                              {sourceLabels[result.source] ?? result.source}
                            </span>
                          </span>
                          {result.description && (
                            <span className="mt-1 line-clamp-1 block text-xs text-muted">
                              {result.description}
                            </span>
                          )}
                          <span className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            {result.downloads !== null && (
                              <span className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {result.downloads.toLocaleString()}
                              </span>
                            )}
                            {result.likes !== null && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {result.likes}
                              </span>
                            )}
                            {result.license && (
                              <span className="flex items-center gap-1">
                                <Scale className="h-3 w-3" />
                                {result.license}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/10 px-3.5 py-3">
                          {loadingFiles ? (
                            <p className="flex items-center gap-2 text-xs text-muted">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Reading files…
                            </p>
                          ) : !shown || shown.files.length === 0 ? (
                            <p className="text-xs text-muted">
                              No importable files here — this dataset ships only scripts or
                              formats TensorNest cannot open yet.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {shown.files.map((file) => (
                                <li
                                  key={file.path}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-xs text-slate-200">
                                      {file.path}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {formatSize(file.size)}
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => handleImport(shown, file.path)}
                                    disabled={importing !== null}
                                    className="btn-ghost shrink-0 px-2.5 py-1 text-xs disabled:opacity-50"
                                  >
                                    {importing === file.path ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    Import
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {shown?.url && (
                            <a
                              href={shown.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-slate-500 transition hover:text-cyan-300"
                            >
                              <Link2 className="h-3 w-3" />
                              View on {sourceLabels[shown.source] ?? shown.source}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Cpu, Loader2, Rocket, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { jobsApi } from "@/lib/resources";
import type { ProviderType } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROVIDERS: {
  value: ProviderType;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "local_cpu",
    label: "Local CPU",
    hint: "Runs in a container on this machine. Free and slow — good for testing the pipeline.",
    icon: Cpu,
  },
  {
    value: "modal_gpu",
    label: "Modal GPU · Tesla T4",
    hint: "Runs on a remote GPU. Survives closing the tab or shutting the computer down. Uses Modal credit.",
    icon: Zap,
  },
];

const SAMPLE_SCRIPT = `import os
import time

checkpoint_dir = os.environ.get("CHECKPOINT_DIR", "./checkpoints")
os.makedirs(checkpoint_dir, exist_ok=True)

for step in range(5):
    print(f"training step {step}")
    time.sleep(1)
    with open(os.path.join(checkpoint_dir, f"step_{step}.txt"), "w") as f:
        f.write(f"checkpoint at step {step}\\n")

print("done")
`;

export function JobForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [provider, setProvider] = useState<ProviderType>("local_cpu");
  const [allowNetwork, setAllowNetwork] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await jobsApi.create({
        name,
        script_source: script,
        provider_type: provider,
        allow_network: allowNetwork,
      });
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass glass-sheen relative space-y-5 rounded-2xl p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Submit a background job</h2>
        <p className="mt-0.5 text-xs text-muted">
          Write checkpoints to the path in <code className="text-cyan-300">CHECKPOINT_DIR</code> —
          they upload to your bucket when the job finishes.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="job-name" className="block text-xs font-medium uppercase tracking-wide text-muted">
          Job name
        </label>
        <input
          id="job-name"
          required
          placeholder="resnet-finetune-run-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="glass-input"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="job-script" className="block text-xs font-medium uppercase tracking-wide text-muted">
          Script
        </label>
        <textarea
          id="job-script"
          required
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={12}
          spellCheck={false}
          className="glass-input resize-y font-mono text-xs leading-relaxed"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Compute
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const selected = provider === p.value;
            return (
              <label
                key={p.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition",
                  selected
                    ? "border-cyan-400/50 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                )}
              >
                <input
                  type="radio"
                  name="provider_type"
                  value={p.value}
                  checked={selected}
                  onChange={() => setProvider(p.value)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition",
                    selected
                      ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-slate-400"
                  )}
                >
                  <p.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      selected ? "text-slate-50" : "text-slate-200"
                    )}
                  >
                    {p.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{p.hint}</span>
                </span>
              </label>
            );
          })}
        </div>

        {provider === "local_cpu" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20">
            <input
              type="checkbox"
              checked={allowNetwork}
              onChange={(e) => setAllowNetwork(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-200">Allow network access</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">
                Needed to read datasets with <code className="text-cyan-300">tn.load()</code> or to
                pip install while the job runs. Uncheck for a fully isolated run.
              </span>
            </span>
          </label>
        )}
      </fieldset>

      <button type="submit" disabled={submitting} className="btn-accent w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />
            Submit job
          </>
        )}
      </button>
    </form>
  );
}

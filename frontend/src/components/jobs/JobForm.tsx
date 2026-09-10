"use client";

import { FormEvent, useState } from "react";
import { jobsApi } from "@/lib/resources";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await jobsApi.create({ name, script_source: script });
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-[#f2bc33] bg-neutral-50/50 p-4 dark:bg-neutral-900/50">
      <h2 className="text-sm font-medium dark:text-[#e6c163]">Submit a background job</h2>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}
      <input
        required
        placeholder="Job name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-[#f2bc33] bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-[#e6c163]"
      />
      <textarea
        required
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={10}
        spellCheck={false}
        className="w-full rounded-md border border-[#f2bc33] bg-white p-2 font-mono text-xs outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <p className="text-xs text-[#e6c163]">
        Runs on the CPU-only local provider. Write checkpoints to the <code>CHECKPOINT_DIR</code> env var.
      </p>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Job"}
      </button>
    </form>
  );
}

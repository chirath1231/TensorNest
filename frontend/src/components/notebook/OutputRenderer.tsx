import type { OutputMessage } from "@/lib/kernelClient";

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

function RichData({ data }: { data: Record<string, unknown> }) {
  if (typeof data["image/png"] === "string") {
    return <img src={`data:image/png;base64,${data["image/png"]}`} alt="output" className="max-w-full" />;
  }
  if (typeof data["text/html"] === "string") {
    return <div dangerouslySetInnerHTML={{ __html: data["text/html"] as string }} />;
  }
  if (typeof data["text/plain"] === "string") {
    return <pre className="whitespace-pre-wrap text-sm">{data["text/plain"] as string}</pre>;
  }
  return null;
}

export function OutputRenderer({ outputs }: { outputs: OutputMessage[] }) {
  if (outputs.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 rounded-md bg-neutral-50 p-3">
      {outputs.map((output, i) => {
        switch (output.type) {
          case "stream":
            return (
              <pre
                key={i}
                className={`whitespace-pre-wrap text-sm ${output.name === "stderr" ? "text-red-600" : "text-neutral-800"}`}
              >
                {output.text}
              </pre>
            );
          case "execute_result":
          case "display_data":
            return <RichData key={i} data={output.data} />;
          case "error":
            return (
              <pre key={i} className="whitespace-pre-wrap text-sm text-red-600">
                {stripAnsi(output.traceback.join("\n"))}
              </pre>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

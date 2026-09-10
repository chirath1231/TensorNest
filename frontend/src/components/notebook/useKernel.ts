"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { KernelClient, type OutputMessage } from "@/lib/kernelClient";
import { notebooksApi } from "@/lib/resources";

export type KernelStatus = "disconnected" | "connecting" | "idle" | "busy";

export function useKernel(notebookId: string) {
  const [status, setStatus] = useState<KernelStatus>("disconnected");
  const clientRef = useRef<KernelClient | null>(null);
  const connectingRef = useRef<Promise<KernelClient> | null>(null);

  const ensureConnected = useCallback(async (): Promise<KernelClient> => {
    if (clientRef.current) return clientRef.current;
    if (connectingRef.current) return connectingRef.current;

    setStatus("connecting");
    connectingRef.current = (async () => {
      const { ws_path } = await notebooksApi.startKernel(notebookId);
      const token = getAccessToken();
      const wsBase = API_BASE_URL.replace(/^http/, "ws");
      const client = new KernelClient();
      client.onStatusChange = (s) => {
        if (s === "disconnected") {
          clientRef.current = null;
        }
        setStatus(s as KernelStatus);
      };
      await client.connect(`${wsBase}${ws_path}?token=${encodeURIComponent(token || "")}`);
      clientRef.current = client;
      setStatus("idle");
      return client;
    })();

    try {
      return await connectingRef.current;
    } finally {
      connectingRef.current = null;
    }
  }, [notebookId]);

  const runCode = useCallback(
    async (code: string, onOutput: (output: OutputMessage) => void, onExecutionCount: (count: number) => void) => {
      const client = await ensureConnected();
      await client.execute(code, { onOutput, onExecutionCount });
    },
    [ensureConnected]
  );

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return { status, ensureConnected, runCode };
}

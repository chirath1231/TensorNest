/**
 * Minimal hand-rolled client for the Jupyter kernel messaging protocol
 * (v5.3, JSON framing) talking to our own WS proxy at
 * /ws/kernels/{session_id}, which bridges to a kernel-gateway container's
 * standard /api/kernels/{id}/channels endpoint. A full client library like
 * @jupyterlab/services assumes it owns kernel lifecycle via a REST API at a
 * fixed URL shape; since kernel lifecycle here is driven by our own FastAPI
 * endpoints and only the message channel is proxied, talking the wire
 * protocol directly is simpler and avoids fighting library internals.
 */

export type OutputMessage =
  | { type: "stream"; name: "stdout" | "stderr"; text: string }
  | { type: "execute_result" | "display_data"; data: Record<string, unknown> }
  | { type: "error"; ename: string; evalue: string; traceback: string[] };

interface ExecuteHandlers {
  onOutput: (output: OutputMessage) => void;
  onExecutionCount: (count: number) => void;
}

interface PendingExecution extends ExecuteHandlers {
  resolve: () => void;
  reject: (err: Error) => void;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function makeHeader(msgType: string, session: string) {
  return {
    msg_id: uuid(),
    username: "tensornest",
    session,
    date: new Date().toISOString(),
    msg_type: msgType,
    version: "5.3",
  };
}

export class KernelClient {
  private ws: WebSocket | null = null;
  private session = uuid();
  private pending = new Map<string, PendingExecution>();
  public onStatusChange: ((status: "connecting" | "idle" | "busy" | "disconnected") => void) | null = null;

  connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("Kernel WebSocket connection failed"));
      this.ws.onclose = () => {
        this.onStatusChange?.("disconnected");
        for (const { reject: rejectPending } of this.pending.values()) {
          rejectPending(new Error("Kernel connection closed"));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  execute(code: string, handlers: ExecuteHandlers): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Kernel is not connected"));
    }
    const header = makeHeader("execute_request", this.session);

    return new Promise((resolve, reject) => {
      this.pending.set(header.msg_id, { ...handlers, resolve, reject });

      const message = {
        header,
        parent_header: {},
        metadata: {},
        content: {
          code,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true,
        },
        channel: "shell",
        buffers: [],
      };
      this.ws!.send(JSON.stringify(message));
    });
  }

  private handleMessage(msg: any): void {
    const parentId = msg.parent_header?.msg_id;
    const handlers = parentId ? this.pending.get(parentId) : undefined;

    if (msg.channel === "iopub") {
      const content = msg.content;
      switch (msg.msg_type) {
        case "status":
          this.onStatusChange?.(content.execution_state);
          break;
        case "stream":
          handlers?.onOutput({ type: "stream", name: content.name, text: content.text });
          break;
        case "execute_result":
          handlers?.onExecutionCount(content.execution_count);
          handlers?.onOutput({ type: "execute_result", data: content.data });
          break;
        case "display_data":
          handlers?.onOutput({ type: "display_data", data: content.data });
          break;
        case "error":
          handlers?.onOutput({
            type: "error",
            ename: content.ename,
            evalue: content.evalue,
            traceback: content.traceback,
          });
          break;
      }
    } else if (msg.channel === "shell" && msg.msg_type === "execute_reply") {
      if (msg.content.execution_count !== undefined) {
        handlers?.onExecutionCount(msg.content.execution_count);
      }
      if (parentId) {
        this.pending.delete(parentId);
        handlers?.resolve();
      }
    }
  }
}

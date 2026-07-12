/**
 * SSE client for the streaming AI endpoints (/api/*\/stream). POSTs a JSON body,
 * reads the text/event-stream response, and invokes `onEvent(event, data)` per
 * event. Events: `thinking`/`token` ({delta}), `result` (the payload), `error`,
 * `done`.
 */
export interface StreamHandlers {
  onEvent: (event: string, data: unknown) => void;
  signal?: AbortSignal;
}

export async function streamSSE(url: string, body: unknown, handlers: StreamHandlers): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });
  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* keep status */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message';
      let dataStr = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        data = dataStr;
      }
      handlers.onEvent(event, data);
    }
  }
}

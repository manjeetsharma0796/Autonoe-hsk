// Server-Sent Events helper for streaming AI responses. Each event is
//   event: <name>\n data: <json>\n\n
// Clients (web/lib/stream.ts) read these via fetch + ReadableStream.

import type { Response } from 'express';

export interface SseChannel {
  send(event: string, data: unknown): void;
  end(): void;
}

export function sse(res: Response): SseChannel {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  (res as Response & { flushHeaders?: () => void }).flushHeaders?.();
  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      res.end();
    },
  };
}

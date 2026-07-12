'use client';

/**
 * Grey, collapsible "thinking" panel for streamed AI reasoning. Shows the live
 * streaming reasoning (grey/mono, auto-scrolling) while `streaming` is true, and
 * stays collapsible afterwards as a "Show thinking" trace. Separate from the
 * final answer/result the caller renders.
 */
import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';

export interface LiveThinkingProps {
  text: string;
  streaming: boolean;
  /** Open by default (auto-opens while streaming regardless). */
  defaultOpen?: boolean;
}

export function LiveThinking({ text, streaming, defaultOpen }: LiveThinkingProps) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text, open]);

  if (!text && !streaming) return null;

  return (
    <div
      style={{
        borderTop: '1px solid var(--line2)',
        margin: '14px 0 0',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: streaming ? 'var(--gold2)' : 'var(--faint)',
            boxShadow: streaming ? '0 0 8px var(--gold2)' : 'none',
            flexShrink: 0,
          }}
        />
        {streaming ? 'Thinking…' : 'Show thinking'}
        <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="md-think"
          style={{ maxHeight: 240, overflowY: 'auto', padding: '2px 0 12px' }}
        >
          <Markdown text={text} />
          {streaming && <span className="ai-cursor">▋</span>}
        </div>
      )}
    </div>
  );
}

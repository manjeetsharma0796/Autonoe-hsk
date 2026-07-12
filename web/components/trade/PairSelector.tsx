"use client";

import { useEffect, useRef, useState } from "react";
import type { Pair } from "./data";
import { getSymbols, type TokenInfo } from "@/lib/api";
import { formatPrice } from "@/lib/format";

function Caret() {
  return (
    <svg
      className="car"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A row in the dropdown — derived from either a live Pair or a search hit. */
type Opt = {
  sym: string;
  badge: string;
  sub: string;
  px: string;
  dir: "up" | "down";
};

function pairToOpt(p: Pair): Opt {
  return { sym: p.sym, badge: p.badge, sub: p.sub, px: p.px, dir: p.dir };
}

function tokenToOpt(t: TokenInfo): Opt {
  return {
    sym: t.symbol,
    badge: t.symbol[0],
    sub: t.bybitSymbol,
    px: formatPrice(t.price),
    dir: t.change24hPct >= 0 ? "up" : "down",
  };
}

export function PairSelector({
  pair,
  pairs,
  onSelect,
}: {
  pair: Pair;
  /** Live pair list; falls back to the current pair if empty. */
  pairs: Pair[];
  onSelect: (sym: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenInfo[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  // Debounced server search so ANY listed token is reachable, not just the
  // top-80 passed in `pairs`.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => {
      getSymbols(q, 30)
        .then(setResults)
        .catch(() => {
          // keep whatever is shown
        });
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
  };

  const searching = query.trim().length > 0;
  const opts: Opt[] = searching
    ? (results ?? []).map(tokenToOpt)
    : (pairs.length ? pairs : [pair]).map(pairToOpt);

  return (
    <div className={`pairsel ${open ? "open" : ""}`} ref={ref}>
      <button
        type="button"
        className="pairbtn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="b">{pair.badge}</span>
        <span className="pname">
          mUSD/{pair.sym} <small>{pair.sub}</small>
        </span>
        <Caret />
      </button>

      <div className="pairmenu" role="listbox">
        <input
          className="pairsearch"
          type="text"
          placeholder="Search any token…"
          aria-label="Search tokens"
          value={query}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setQuery(e.target.value)}
        />

        {searching && opts.length === 0 && (
          <div className="pairempty">
            {results === null
              ? "Searching…"
              : `No tokens match "${query.trim().toUpperCase()}".`}
          </div>
        )}

        {opts.map((p) => (
          <button
            type="button"
            role="option"
            aria-selected={p.sym === pair.sym}
            className="pairopt"
            key={p.sym}
            onClick={() => {
              onSelect(p.sym);
              close();
            }}
          >
            <span className="b">{p.badge}</span>
            <div className="m">
              <b>mUSD/{p.sym}</b>
              <small>{p.sub}</small>
            </div>
            <span className={`pp ${p.dir}`}>{p.px}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

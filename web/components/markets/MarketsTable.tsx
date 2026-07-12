"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./markets.module.css";
import { getSymbols, type TokenInfo } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { SearchIcon, SortIcon, StarIcon } from "./icons";

const FAVORITES_KEY = "autonoe.favorites";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Filter = "all" | "favorites" | "gainers" | "losers";
type SortKey = "name" | "price" | "change" | "volume";
type SortDir = "asc" | "desc";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
];

/** Format a volume number to compact string, e.g. "$1.23M". */
function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Pick badge class from symbol. Keeps the WMNT/BTC/ETH colours, generic gold for the rest. */
function badgeClass(symbol: string): string {
  if (symbol === "WMNT") return "mnt";
  if (symbol === "BTC") return "btc";
  if (symbol === "ETH") return "eth";
  return "";
}

/** One-or-two-letter glyph for the badge. */
function glyph(symbol: string): string {
  if (symbol === "BTC") return "₿";
  if (symbol === "ETH") return "Ξ";
  if (symbol === "WMNT") return "W";
  return symbol.slice(0, 2);
}

// ── hook ─────────────────────────────────────────────────────────────────────

function useSymbols() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stale-while-revalidate: `loading` is true only until the FIRST fetch
  // resolves. Background polls just swap `tokens` in place — the row key is the
  // stable symbol, so React updates the price/change cells without remounting,
  // and the table never blanks.
  const refresh = useCallback(() => {
    getSymbols(undefined)
      .then((data) => {
        setTokens(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Failed to load markets");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { tokens, loading, error };
}

// ── component ─────────────────────────────────────────────────────────────────

interface MarketsTableProps {
  onTokensLoaded?: (tokens: TokenInfo[]) => void;
}

export function MarketsTable({ onTokensLoaded }: MarketsTableProps) {
  const root = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TokenInfo[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(["WMNT"]),
  );
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { tokens, loading, error } = useSymbols();

  // bubble token list up to MarketStats
  useEffect(() => {
    if (tokens.length > 0) onTokensLoaded?.(tokens);
  }, [tokens, onTokensLoaded]);

  // P2 — favorites persistence. Read once on mount (read-in-effect avoids an
  // SSR hydration mismatch); skip the first write so we never clobber the
  // stored set before it's loaded.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) setFavorites(new Set(arr as string[]));
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  const firstFavWrite = useRef(true);
  useEffect(() => {
    if (firstFavWrite.current) {
      firstFavWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch {
      // ignore unavailable storage
    }
  }, [favorites]);

  // P5 — realtime search backed by the server, which can match ANY token (not
  // just the top-80 loaded for the table). Debounced; prior results stay
  // visible while a new query is in flight so the list never blanks.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const id = setTimeout(() => {
      getSymbols(q, 100)
        .then(setSearchResults)
        .catch(() => {
          // keep whatever is currently shown
        });
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        gsap.set(el, { opacity: 1, y: 0 });
        return;
      }
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    },
    { scope: root },
  );

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    // When searching, prefer the server results (they can include long-tail
    // tokens outside the top-80); fall back to the loaded set until they land.
    const source = q ? (searchResults ?? tokens) : tokens;
    let list = source.filter((t) => {
      if (q && !t.symbol.includes(q)) return false;
      switch (filter) {
        case "favorites":
          return favorites.has(t.symbol);
        case "gainers":
          return t.change24hPct > 0;
        case "losers":
          return t.change24hPct < 0;
        default:
          return true;
      }
    });

    if (sortKey) {
      const factor = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        switch (sortKey) {
          case "name":
            return a.symbol.localeCompare(b.symbol) * factor;
          case "price":
            return (a.price - b.price) * factor;
          case "change":
            return (a.change24hPct - b.change24hPct) * factor;
          case "volume":
            return (a.volume24h - b.volume24h) * factor;
        }
      });
    }
    return list;
  }, [tokens, searchResults, search, filter, favorites, sortKey, sortDir]);

  return (
    <div ref={root} className={`${styles.mk} ${styles.reveal}`}>
      <div className={styles.mhead}>
        <h2>All markets</h2>
        <label className={styles.tsearch} aria-label="Search by symbol">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.chip} ${filter === f.key ? "on" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${styles.mrow} head`}>
        <div />
        <SortHeader
          label="Market"
          active={sortKey === "name"}
          onClick={() => onSort("name")}
        />
        <SortHeader
          className="r"
          label="Price (USDT)"
          active={sortKey === "price"}
          onClick={() => onSort("price")}
        />
        <SortHeader
          className="r pctcell"
          label="24h %"
          active={sortKey === "change"}
          onClick={() => onSort("change")}
        />
        <SortHeader
          className="r vol"
          label="24h Volume"
          active={sortKey === "volume"}
          onClick={() => onSort("volume")}
        />
        <div className="r sparkcell">On-chain</div>
      </div>

      {loading && tokens.length === 0 && (
        <div className={styles.empty}>Loading markets…</div>
      )}

      {error && tokens.length === 0 && (
        <div className={styles.empty}>
          Could not load markets: {error}
        </div>
      )}

      {tokens.length > 0 && rows.length === 0 && (
        <div className={styles.empty}>
          {search ? `No markets match "${search.toUpperCase()}".` : "No markets match this filter."}
        </div>
      )}

      {rows.map((t) => (
        <MarketRow
          key={t.symbol}
          token={t}
          favorite={favorites.has(t.symbol)}
          onToggleFavorite={() => toggleFavorite(t.symbol)}
        />
      ))}

      <div className={styles.mfoot}>
        <span className="ping" /> Live prices from Bybit spot ·
        refreshes every ~15s · on-chain execution for WMNT only
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        className={`sortable ${active ? "active" : ""}`}
        onClick={onClick}
      >
        {label}
        <SortIcon />
      </button>
    </div>
  );
}

function MarketRow({
  token,
  favorite,
  onToggleFavorite,
}: {
  token: TokenInfo;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const up = token.change24hPct >= 0;
  const slug = token.symbol === "WMNT" ? "mUSD-WMNT" : `mUSD-${token.symbol}`;

  return (
    <Link
      className={`${styles.mrow} row`}
      href={`/trade?pair=${slug}`}
    >
      <button
        type="button"
        className={`${styles.fav} ${favorite ? "on" : ""}`}
        aria-label={
          favorite
            ? `Remove ${token.symbol} from favorites`
            : `Add ${token.symbol} to favorites`
        }
        aria-pressed={favorite}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        <StarIcon filled={favorite} />
      </button>

      <div className={styles.sym}>
        <span className={`b ${badgeClass(token.symbol)}`}>{glyph(token.symbol)}</span>
        <div className="nm">
          <b>mUSD/{token.symbol}</b>
          <small>{token.bybitSymbol}</small>
        </div>
      </div>

      <div className={`${styles.px} r`}>{formatPrice(token.price)}</div>
      <div className={`${styles.pct} ${up ? "up" : "down"} r pctcell`}>
        {up ? "+" : ""}
        {token.change24hPct.toFixed(2)}%
      </div>
      <div className={`${styles.px} r vol`}>{fmtVolume(token.volume24h)}</div>
      <div className="r sparkcell">
        {token.onchain ? (
          <span className={styles.onchainBadge} title="On-chain AMM execution available">
            on-chain
          </span>
        ) : (
          <span className={styles.advisoryBadge}>advise-only</span>
        )}
      </div>
    </Link>
  );
}

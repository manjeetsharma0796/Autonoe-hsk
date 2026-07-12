"use client";

import { STATS, type Pair } from "./data";
import { PairSelector } from "./PairSelector";

import { TradingViewChart } from "@/components/charts/TradingViewChart";

/** Fixed tall chart - presets/resize removed per design direction. */
const CHART_HEIGHT = 520;

export function ChartPanel({
  pair,
  pairs,
  onSelectPair,
}: {
  pair: Pair;
  /** Full live pair list for the dropdown. */
  pairs: Pair[];
  onSelectPair: (sym: string) => void;
}) {
  const up = pair.dir === "up";

  return (
    <section className="panel" style={{ gridColumn: "1 / -1" }}>
      <div className="phead">
        <PairSelector pair={pair} pairs={pairs} onSelect={onSelectPair} />

        <div className="lastpx">
          <span className="v num">{pair.px}</span>
          <span className={`ch ${up ? "up" : "down"}`}>
            {up ? "▲ " : "▼ "}
            {pair.ch}
          </span>
        </div>

        <span className="spacer" style={{ flex: 1 }} />
      </div>

      <div className="pbody chart-pbody">
        <div className="chartshell" style={{ height: CHART_HEIGHT }}>
          <TradingViewChart
            asset={pair.sym}
            bybitSymbol={pair.bybitSymbol}
            height="100%"
          />
        </div>

        <div className="stat-strip">
          {STATS.map((s) => (
            <div className="cell" key={s.k}>
              <div className="k">{s.k}</div>
              <div className={`v num ${s.tone ?? ""}`}>{s.n}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

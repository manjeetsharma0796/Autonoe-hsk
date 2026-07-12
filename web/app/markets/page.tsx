import type { Metadata } from "next";
import styles from "@/components/markets/markets.module.css";
import { MarketsShell } from "@/components/markets/MarketsShell";

export const metadata: Metadata = {
  title: "Autonoe - Markets · trade against mUSD",
  description:
    "Track price, momentum and depth for every mUSD pair on HashKey Chain.",
};

export default function MarketsPage() {
  return (
    <main>
      <section className={`${styles.markets} wrap`}>
        <MarketsShell />
      </section>

      <footer className={`${styles.foot} wrap`}>
        <div className="brand">
          <span className="dot" /> AUTONOE
        </div>
        <div>
          Built for the HashKey Horizon Hackathon · not financial advice
        </div>
      </footer>
    </main>
  );
}

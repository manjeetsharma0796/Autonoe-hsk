"use client";

import s from "./landing.module.css";
import { useReveal } from "./useReveal";

export function FinalCta() {
  const root = useReveal<HTMLDivElement>(s.reveal);

  return (
    <div ref={root}>
      <section className={`${s.final} wrap`}>
        <h2 className={s.reveal}>
          Let the machines
          <br />
          <span>make the case.</span>
        </h2>
        <p className={s.reveal}>
          Spin up an agent wallet, fund it with test mUSD, and watch three minds
          argue your next trade.
        </p>
        <div className={`${s.cta} ${s.finalCta} ${s.reveal}`}>
          <button className="btn btn-gold" type="button">
            Launch app →
          </button>
          <button className="btn btn-ghost" type="button">
            Read the thesis
          </button>
        </div>
      </section>

      <footer className={`${s.footer} wrap`}>
        <div className="brand">
          <span className="dot" /> AUTONOE
        </div>
        <div>
          Built for the HashKey Horizon Hackathon · not financial advice
        </div>
      </footer>
    </div>
  );
}

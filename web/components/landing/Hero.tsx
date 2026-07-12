"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import s from "./landing.module.css";

const TICKER_ITEMS = [
  { pair: "mUSD/WMNT", price: "1.2843", change: "▲ 4.21%", dir: "up" },
  { pair: "mUSD/BTC", price: "64,210", change: "▼ 1.08%", dir: "down" },
  { pair: "mUSD/ETH", price: "3,488", change: "▲ 2.74%", dir: "up" },
  { pair: "Decisions logged", price: "1,204", change: "▲ live", dir: "up" },
] as const;

/** Split a string into per-character <span>s for the GSAP reveal. */
function SplitLine({ text, className }: { text: string; className: string }) {
  return (
    <span className={className} data-split>
      {[...text].map((c, i) => (
        <span className={s.ch} key={i}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      gsap.from(`.${s.ch}`, {
        yPercent: 120,
        opacity: 0,
        stagger: 0.025,
        duration: 0.9,
        ease: "power4.out",
        delay: 0.15,
      });
      gsap.from(".eyebrow", {
        y: 14,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
      });
      gsap.from(
        [`.${s.lede}`, `.${s.cta}`, `.${s.meta}`, `.${s.ticker}`],
        {
          y: 26,
          opacity: 0,
          stagger: 0.12,
          duration: 0.8,
          delay: 0.5,
          ease: "power3.out",
        },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} className={`${s.hero} wrap`}>
      <div>
        <span className="eyebrow">
          <span className="ping" /> Live on HashKey Chain · Turing Test 2026
        </span>
      </div>

      <h1 className={s.title}>
        <SplitLine text="The machine" className={s.l1} />
        <SplitLine text="tribunal for trades" className={s.l2} />
      </h1>

      <p className={s.lede}>
        Autonoe writes a trading thesis, then puts it on trial. A{" "}
        <b>Supporter</b>, a <b>Discriminator</b>, and a <b>Judge</b> argue it
        out - and an autonomous wallet executes the verdict on-chain. Every
        decision is recorded as an <b>AI performance benchmark</b>.
      </p>

      <div className={s.cta}>
        <button className="btn btn-gold" type="button">
          Launch app →
        </button>
        <button className="btn btn-ghost" type="button">
          Watch the tribunal
        </button>
      </div>

      <div className={s.meta}>
        <div className={s.metaItem}>
          <div className={s.metaN}>
            3<span className={s.metaU}> agents</span>
          </div>
          <div className={s.metaK}>debate every thesis</div>
        </div>
        <div className={s.metaItem}>
          <div className={s.metaN}>
            5<span className={s.metaU}>s</span>
          </div>
          <div className={s.metaK}>thesis → verdict</div>
        </div>
        <div className={s.metaItem}>
          <div className={s.metaN}>100%</div>
          <div className={s.metaK}>on-chain &amp; auditable</div>
        </div>
      </div>

      <div className={s.ticker}>
        <div className={s.tickrow}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span className={s.pair} key={i}>
              <b>{t.pair}</b> {t.price}{" "}
              <span className={t.dir === "up" ? s.up : s.down}>{t.change}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

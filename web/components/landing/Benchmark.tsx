"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import s from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STATS = [
  { end: 1204, suffix: "", k: "decisions logged" },
  { end: 68, suffix: "%", k: "judge win-rate" },
  { end: 5, suffix: "", k: "providers supported" },
  { end: 100, suffix: "%", k: "verifiable on-chain" },
] as const;

export function Benchmark() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Scroll fade-up for revealable blocks.
      const targets = gsap.utils.toArray<HTMLElement>(`.${s.reveal}`);
      if (reduce) {
        gsap.set(targets, { opacity: 1, y: 0 });
      } else {
        targets.forEach((el) => {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%" },
          });
        });
      }

      // Count-up on each stat number.
      const nums = gsap.utils.toArray<HTMLElement>("[data-count]");
      nums.forEach((el) => {
        const end = Number(el.dataset.count ?? "0");
        const numEl = el.querySelector<HTMLElement>("[data-count-target]");
        if (!numEl) return;

        if (reduce) {
          numEl.textContent = end.toLocaleString();
          return;
        }

        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              v: end,
              duration: 1.6,
              ease: "power2.out",
              onUpdate: () => {
                numEl.textContent = Math.round(obj.v).toLocaleString();
              },
            });
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="bench" className={`${s.section} wrap`}>
      <div className={s.band}>
        <div className={s.reveal}>
          <span className="tag">On-chain proof</span>
          <h2 className={`h2 ${s.bandH2}`}>
            Every decision, benchmarked on Mantle.
          </h2>
          <p className="sub">
            Not a leaderboard of vibes. Each thesis, verdict and outcome is
            written to a DecisionLog contract - a permanent, public record of
            which models actually make money.
          </p>
        </div>

        <div className={s.bgrid}>
          {STATS.map((stat) => (
            <div
              className={`${s.reveal}`}
              data-count={stat.end}
              key={stat.k}
            >
              <div className={s.statN}>
                <span data-count-target>0</span>
                {stat.suffix && <span>{stat.suffix}</span>}
              </div>
              <div className={s.statK}>{stat.k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

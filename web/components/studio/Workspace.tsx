"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Thesis } from "@autonoe/shared";
import styles from "./studio.module.css";
import { IntakeChat } from "./intake/IntakeChat";
import { StepJudge } from "./StepJudge";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Step = 1 | 2;

const STEPS: { n: Step; kicker: string; label: string }[] = [
  { n: 1, kicker: "Step one", label: "Thesis" },
  { n: 2, kicker: "Step two", label: "Judge Panel" },
];

export function Workspace() {
  const [step, setStep] = useState<Step>(1);
  const [judgeVisited, setJudgeVisited] = useState(false);
  // Thesis flows from StepThesis → StepJudge via this shared state.
  const [currentThesis, setCurrentThesis] = useState<Thesis | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const stepperRef = useRef<HTMLDivElement>(null);

  const goStep = (n: Step) => {
    setStep(n);
    if (n === 2) setJudgeVisited(true);
    const top = stepperRef.current;
    if (top) {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      top.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const handleSendToJudge = (thesis: Thesis) => {
    setCurrentThesis(thesis);
    goStep(2);
  };

  // Calm staggered reveals for whichever step is active. Re-runs on step
  // change so freshly shown content animates in. Respects reduced motion.
  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const active = root.current?.querySelector(
        `[data-step="${step}"].${styles.panel}`
      );
      const targets = active
        ? Array.from(active.querySelectorAll<HTMLElement>(".reveal"))
        : [];
      if (reduce || targets.length === 0) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        targets,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
        }
      );
    },
    { scope: root, dependencies: [step] }
  );

  return (
    <main ref={root}>
      <section className={`${styles.pagehead} wrap`}>
        <div className="reveal">
          <span className="eyebrow">
            <span className="ping" /> AI Workspace · HashKey Chain
          </span>
          <h1 className="h2">Studio - write it, then put it on trial.</h1>
          <p className="sub">
            Draft a thesis with AI or write your own, then either execute
            directly or route it through the Judge Panel for refined,
            risk-tiered options. Every AI output keeps a collapsible reasoning
            trace.
          </p>
        </div>

        <div className={`${styles.stepper} reveal`} ref={stepperRef}>
          {STEPS.map((s, i) => (
            <span
              key={s.n}
              style={{ display: "contents" }}
            >
              <button
                className={`${styles.stepbtn} ${step === s.n ? styles.on : ""}`}
                type="button"
                aria-current={step === s.n ? "step" : undefined}
                onClick={() => goStep(s.n)}
              >
                <span className={styles.num}>{s.n}</span>
                <span className={styles.stxt}>
                  <span className={styles.sk}>{s.kicker}</span>
                  <span className={styles.sl}>{s.label}</span>
                </span>
              </button>
              {i === 0 && <span className={styles.stepbar} />}
            </span>
          ))}
        </div>
      </section>

      <div
        className={`${styles.panel} ${step === 1 ? styles.active : ""}`}
        data-step={1}
        style={{ display: step === 1 ? "block" : "none" }}
      >
        <IntakeChat onSendToJudge={handleSendToJudge} />
      </div>

      <div
        className={`${styles.panel} ${step === 2 ? styles.active : ""}`}
        data-step={2}
        style={{ display: step === 2 ? "block" : "none" }}
      >
        <StepJudge active={judgeVisited && step === 2} thesis={currentThesis} />
      </div>

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

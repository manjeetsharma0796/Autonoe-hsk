"use client";

import s from "./landing.module.css";
import { useReveal } from "./useReveal";

const STEPS = [
  {
    h: "Write a thesis",
    p: "Tell Autonoe your intent - or write your own. A LangChain agent researches across on-chain, market, news and indicator subagents you toggle.",
    line: true,
  },
  {
    h: "Put it on trial",
    p: "Send it to the tribunal. Supporter, Discriminator and Judge refine it into ranked options with predicted return and risk.",
    line: true,
  },
  {
    h: "Execute on-chain",
    p: "Your autonomous agent wallet signs a real swap on Mantle - within your limits - and logs the decision forever.",
    line: false,
  },
] as const;

export function HowItWorks() {
  const root = useReveal(s.reveal);

  return (
    <section ref={root} id="how" className={`${s.section} wrap`}>
      <div className={s.reveal}>
        <span className="tag">How it works</span>
        <h2 className="h2">Thesis. Judgment. Execution.</h2>
        <p className="sub">
          Go straight from a thesis to a trade, or route it through the panel
          first - your call, your risk appetite.
        </p>
      </div>

      <div className={s.steps}>
        {STEPS.map((step) => (
          <div className={`${s.step} ${s.reveal}`} key={step.h}>
            {step.line && <div className={s.dotline} />}
            <h3>{step.h}</h3>
            <p>{step.p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

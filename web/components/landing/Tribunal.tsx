"use client";

import s from "./landing.module.css";
import { useReveal } from "./useReveal";

const AGENTS = [
  {
    cls: s.sup,
    role: "Supporter",
    h: "Argues for",
    p: "Builds the strongest bull case for the thesis - catalysts, momentum, asymmetry.",
  },
  {
    cls: s.dis,
    role: "Discriminator",
    h: "Argues against",
    p: "The devil's advocate - liquidity traps, drawdown, every way this loses money.",
  },
  {
    cls: s.jud,
    role: "Judge",
    h: "Delivers the verdict",
    p: "Weighs both, then issues refined options with predicted return, risk, and caveats.",
  },
] as const;

export function Tribunal() {
  const root = useReveal(s.reveal);

  return (
    <section ref={root} id="tribunal" className={`${s.section} wrap`}>
      <div className={s.reveal}>
        <span className="tag">The signature</span>
        <h2 className="h2">Your thesis goes on trial.</h2>
        <p className="sub">
          Three specialist agents - each on a model you choose - argue the case.
          You see every line of their reasoning, collapsed until you want it.
        </p>
      </div>

      <svg
        className={`${s.flow} ${s.reveal}`}
        viewBox="0 0 1000 300"
        role="img"
        aria-label="Thesis flows to Supporter and Discriminator, then to Judge, then to Verdict"
      >
        <defs>
          <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F5A524" />
            <stop offset="1" stopColor="#3FE0A6" />
          </linearGradient>
          <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F5A524" />
            <stop offset="1" stopColor="#FF6B6B" />
          </linearGradient>
          <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3FE0A6" />
            <stop offset="1" stopColor="#F5A524" />
          </linearGradient>
          <linearGradient id="bg4" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FF6B6B" />
            <stop offset="1" stopColor="#F5A524" />
          </linearGradient>
          <linearGradient id="bg5" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F5A524" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        <path
          id="p1"
          className={s.beam}
          stroke="url(#bg1)"
          d="M150,150 C250,150 250,64 320,64"
        />
        <path
          id="p2"
          className={s.beam}
          stroke="url(#bg2)"
          d="M150,150 C250,150 250,236 320,236"
        />
        <path
          id="p3"
          className={s.beam}
          stroke="url(#bg3)"
          d="M404,64 C540,64 560,150 656,150"
        />
        <path
          id="p4"
          className={s.beam}
          stroke="url(#bg4)"
          d="M404,236 C540,236 560,150 656,150"
        />
        <path
          id="p5"
          className={s.beam}
          stroke="url(#bg5)"
          d="M740,150 L854,150"
        />

        <circle r="3.5" fill="#FFCC66">
          <animateMotion dur="2.4s" repeatCount="indefinite">
            <mpath href="#p1" />
          </animateMotion>
        </circle>
        <circle r="3.5" fill="#FFCC66">
          <animateMotion dur="2.4s" begin="0.3s" repeatCount="indefinite">
            <mpath href="#p2" />
          </animateMotion>
        </circle>
        <circle r="3.5" fill="#8CF0CC">
          <animateMotion dur="2.2s" begin="1s" repeatCount="indefinite">
            <mpath href="#p3" />
          </animateMotion>
        </circle>
        <circle r="3.5" fill="#FFB0B0">
          <animateMotion dur="2.2s" begin="1.3s" repeatCount="indefinite">
            <mpath href="#p4" />
          </animateMotion>
        </circle>
        <circle r="4" fill="#B79CFF">
          <animateMotion dur="1.6s" begin="2s" repeatCount="indefinite">
            <mpath href="#p5" />
          </animateMotion>
        </circle>

        <g className={s.node}>
          <circle
            cx="110"
            cy="150"
            r="40"
            fill="#0F1626"
            stroke="rgba(245,165,36,.5)"
            strokeWidth="1.4"
          />
          <text
            x="110"
            y="150"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "var(--mono)",
              fontSize: "12px",
              letterSpacing: ".14em",
            }}
            fill="#FFCC66"
          >
            THESIS
          </text>
          <text className={s.lab} x="110" y="208" textAnchor="middle">
            intent
          </text>
        </g>
        <g className={s.node}>
          <circle
            cx="362"
            cy="64"
            r="42"
            fill="#0F1626"
            stroke="rgba(63,224,166,.55)"
            strokeWidth="1.4"
          />
          <text
            className={s.gly}
            x="362"
            y="64"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#3FE0A6"
          >
            S
          </text>
          <text className={s.lab} x="362" y="18" textAnchor="middle">
            Supporter
          </text>
        </g>
        <g className={s.node}>
          <circle
            cx="362"
            cy="236"
            r="42"
            fill="#0F1626"
            stroke="rgba(255,107,107,.55)"
            strokeWidth="1.4"
          />
          <text
            className={s.gly}
            x="362"
            y="236"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FF6B6B"
          >
            D
          </text>
          <text className={s.lab} x="362" y="296" textAnchor="middle">
            Discriminator
          </text>
        </g>
        <g className={s.node}>
          <circle
            cx="698"
            cy="150"
            r="48"
            fill="#0F1626"
            stroke="rgba(245,165,36,.6)"
            strokeWidth="1.6"
          />
          <text
            className={s.gly}
            x="698"
            y="150"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: "30px" }}
            fill="#F5A524"
          >
            J
          </text>
          <text className={s.lab} x="698" y="214" textAnchor="middle">
            Judge
          </text>
        </g>
        <g className={s.node}>
          <circle
            cx="900"
            cy="150"
            r="44"
            fill="#120E1E"
            stroke="rgba(139,92,246,.6)"
            strokeWidth="1.4"
          />
          <text
            x="900"
            y="150"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              letterSpacing: ".1em",
            }}
            fill="#B79CFF"
          >
            VERDICT
          </text>
        </g>
      </svg>

      <div className={s.tri}>
        {AGENTS.map((a) => (
          <div className={`${s.agent} ${a.cls} ${s.reveal}`} key={a.role}>
            <div className={s.agentIc}>
              <i />
            </div>
            <div className={s.role}>{a.role}</div>
            <h3>{a.h}</h3>
            <p>{a.p}</p>
            <div className={s.bars}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`${s.verdict} ${s.reveal}`}>
        <div>
          <div className={s.vk}>Verdict · option A</div>
          <h4>Long WMNT - scaled entry</h4>
        </div>
        <div className={s.spacer} />
        <span className={`${s.pill} ${s.ret}`}>predicted +6.4% - +11%</span>
        <span className={`${s.pill} ${s.risk}`}>risk: medium</span>
        <button className="btn btn-gold" type="button">
          Execute →
        </button>
      </div>
    </section>
  );
}

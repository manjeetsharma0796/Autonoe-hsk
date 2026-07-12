import styles from "./studio.module.css";

/** Tribunal flow diagram - gradient beams + <animateMotion> pulses.
 *  Ported as JSX from the landing/studio mockup. */
export function TribunalFlow({ className }: { className?: string }) {
  return (
    <svg
      className={`${styles.flow}${className ? ` ${className}` : ""}`}
      viewBox="0 0 1000 300"
      role="img"
      aria-label="Thesis flows to Supporter and Discriminator, then to Judge, then to Verdict"
    >
      <defs>
        <linearGradient id="sg-bg1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F5A524" />
          <stop offset="1" stopColor="#3FE0A6" />
        </linearGradient>
        <linearGradient id="sg-bg2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F5A524" />
          <stop offset="1" stopColor="#FF6B6B" />
        </linearGradient>
        <linearGradient id="sg-bg3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3FE0A6" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
        <linearGradient id="sg-bg4" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF6B6B" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
        <linearGradient id="sg-bg5" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F5A524" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      <path id="sg-p1" className={styles.beam} stroke="url(#sg-bg1)" d="M150,150 C250,150 250,64 320,64" />
      <path id="sg-p2" className={styles.beam} stroke="url(#sg-bg2)" d="M150,150 C250,150 250,236 320,236" />
      <path id="sg-p3" className={styles.beam} stroke="url(#sg-bg3)" d="M404,64 C540,64 560,150 656,150" />
      <path id="sg-p4" className={styles.beam} stroke="url(#sg-bg4)" d="M404,236 C540,236 560,150 656,150" />
      <path id="sg-p5" className={styles.beam} stroke="url(#sg-bg5)" d="M740,150 L854,150" />

      <circle r="3.5" fill="#FFCC66">
        <animateMotion dur="2.4s" repeatCount="indefinite">
          <mpath href="#sg-p1" />
        </animateMotion>
      </circle>
      <circle r="3.5" fill="#FFCC66">
        <animateMotion dur="2.4s" begin="0.3s" repeatCount="indefinite">
          <mpath href="#sg-p2" />
        </animateMotion>
      </circle>
      <circle r="3.5" fill="#8CF0CC">
        <animateMotion dur="2.2s" begin="1s" repeatCount="indefinite">
          <mpath href="#sg-p3" />
        </animateMotion>
      </circle>
      <circle r="3.5" fill="#FFB0B0">
        <animateMotion dur="2.2s" begin="1.3s" repeatCount="indefinite">
          <mpath href="#sg-p4" />
        </animateMotion>
      </circle>
      <circle r="4" fill="#B79CFF">
        <animateMotion dur="1.6s" begin="2s" repeatCount="indefinite">
          <mpath href="#sg-p5" />
        </animateMotion>
      </circle>

      <g className={styles.node}>
        <circle cx="110" cy="150" r="40" fill="#0F1626" stroke="rgba(245,165,36,.5)" strokeWidth="1.4" />
        <text
          x="110"
          y="150"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--mono)", fontSize: "12px", letterSpacing: ".14em" }}
          fill="#FFCC66"
        >
          THESIS
        </text>
        <text className={styles.lab} x="110" y="208" textAnchor="middle">
          intent
        </text>
      </g>
      <g className={styles.node}>
        <circle cx="362" cy="64" r="42" fill="#0F1626" stroke="rgba(63,224,166,.55)" strokeWidth="1.4" />
        <text className={styles.gly} x="362" y="64" textAnchor="middle" dominantBaseline="central" fill="#3FE0A6">
          S
        </text>
        <text className={styles.lab} x="362" y="18" textAnchor="middle">
          Supporter
        </text>
      </g>
      <g className={styles.node}>
        <circle cx="362" cy="236" r="42" fill="#0F1626" stroke="rgba(255,107,107,.55)" strokeWidth="1.4" />
        <text className={styles.gly} x="362" y="236" textAnchor="middle" dominantBaseline="central" fill="#FF6B6B">
          D
        </text>
        <text className={styles.lab} x="362" y="296" textAnchor="middle">
          Discriminator
        </text>
      </g>
      <g className={styles.node}>
        <circle cx="698" cy="150" r="48" fill="#0F1626" stroke="rgba(245,165,36,.6)" strokeWidth="1.6" />
        <text
          className={styles.gly}
          x="698"
          y="150"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "30px" }}
          fill="#F5A524"
        >
          J
        </text>
        <text className={styles.lab} x="698" y="214" textAnchor="middle">
          Judge
        </text>
      </g>
      <g className={styles.node}>
        <circle cx="900" cy="150" r="44" fill="#120E1E" stroke="rgba(139,92,246,.6)" strokeWidth="1.4" />
        <text
          x="900"
          y="150"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--mono)", fontSize: "11px", letterSpacing: ".1em" }}
          fill="#B79CFF"
        >
          VERDICT
        </text>
      </g>
    </svg>
  );
}

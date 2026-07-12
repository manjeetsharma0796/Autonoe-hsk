/* intent.js — Step 1 Thesis / Intent Panel
 * Exposes window.IntentStep = { mount, getIntent, getSources, onGenerate, setGenerateEnabled }
 */
(function (global) {
  "use strict";

  const EXAMPLE =
    "WMNT looks oversold after the testnet incentive cliff — is there a scaled long worth taking against mUSD?";

  const SOURCE_DEFS = [
    { key: "onchain",    label: "On-chain",   icon: "⛓",  defaultOn: true  },
    { key: "market",     label: "Market",     icon: "📈",  defaultOn: true  },
    { key: "indicators", label: "Indicators", icon: "🔬",  defaultOn: true  },
    { key: "news",       label: "News",       icon: "📰",  defaultOn: false },
  ];

  /* ── state ──────────────────────────────────────────────────────────── */
  let _textarea      = null;
  let _generateBtn   = null;
  let _pillStates    = {};   // key → boolean
  let _generateCb    = null;
  let _mounted       = false;

  SOURCE_DEFS.forEach(s => { _pillStates[s.key] = s.defaultOn; });

  /* ── helpers ────────────────────────────────────────────────────────── */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === "class") node.className = v;
        else if (k === "style") node.style.cssText = v;
        else node.setAttribute(k, v);
      });
    }
    children.forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function label(text) {
    return el("p", { class: "intent-panel__label" }, text);
  }

  function buildPill(def) {
    const dot  = el("span", { class: "intent-pill__dot" });
    const icon = el("span", { class: "intent-pill__icon", "aria-hidden": "true" }, def.icon);
    const lbl  = el("span", {}, def.label);

    const pill = el("button",
      {
        class: "intent-pill" + (_pillStates[def.key] ? " is-on" : ""),
        type: "button",
        "data-source": def.key,
        "aria-pressed": String(_pillStates[def.key]),
      },
      icon, lbl, dot
    );

    pill.addEventListener("click", () => {
      _pillStates[def.key] = !_pillStates[def.key];
      const on = _pillStates[def.key];
      pill.classList.toggle("is-on", on);
      pill.setAttribute("aria-pressed", String(on));
    });

    return pill;
  }

  function buildPanel() {
    /* textarea section */
    _textarea = el("textarea", {
      class: "intent-panel__textarea",
      rows:  "5",
      placeholder: EXAMPLE,
    });

    const intentSection = el("div", { class: "intent-panel__section" },
      label("YOUR INTENT"),
      _textarea
    );

    /* sources section */
    const pillRow = el("div", { class: "intent-panel__sources" });
    SOURCE_DEFS.forEach(def => pillRow.appendChild(buildPill(def)));

    const sourcesSection = el("div", { class: "intent-panel__section" },
      label("DATA SOURCES"),
      pillRow
    );

    /* generate button */
    _generateBtn = el("button", {
      class: "intent-panel__generate",
      type: "button",
    }, "Generate thesis");

    _generateBtn.addEventListener("click", () => {
      if (_generateCb) _generateCb();
    });

    /* assemble panel */
    return el("div", { class: "intent-panel" },
      intentSection,
      sourcesSection,
      _generateBtn
    );
  }

  /* ── public API ─────────────────────────────────────────────────────── */
  const IntentStep = {
    /**
     * Mount the panel into containerEl.
     * Clears any previous mount; safe to call multiple times.
     */
    mount(containerEl) {
      if (!containerEl) throw new Error("IntentStep.mount: containerEl is required");
      containerEl.innerHTML = "";
      containerEl.appendChild(buildPanel());
      _mounted = true;
    },

    /** Returns the current textarea value (trimmed). */
    getIntent() {
      return _textarea ? _textarea.value.trim() : "";
    },

    /**
     * Returns an array of enabled source keys.
     * Possible keys: "onchain", "market", "indicators", "news"
     */
    getSources() {
      return Object.entries(_pillStates)
        .filter(([, on]) => on)
        .map(([k]) => k);
    },

    /**
     * Register a callback to fire when the Generate button is clicked.
     * Replaces any previously registered callback.
     */
    onGenerate(cb) {
      _generateCb = typeof cb === "function" ? cb : null;
    },

    /**
     * Enable or disable the Generate button.
     * @param {boolean} enabled
     */
    setGenerateEnabled(enabled) {
      if (_generateBtn) _generateBtn.disabled = !enabled;
    },
  };

  global.IntentStep = IntentStep;
})(window);

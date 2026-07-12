/* shell.js — step-progress bar + gating flow
 *
 * Exports: window.Flow = { init({ onGenerate }) }
 *
 * Expects on window before init():
 *   window.IntentStep.getIntent()            → string (current textarea value)
 *   window.IntentStep.getActiveSources()     → string[] (labels of active data sources, may be [])
 *   window.IntentStep.setGenerateEnabled(bool) → void (enable/disable the Generate button)
 *   window.IntentStep.onGenerate(fn)         → void (register callback for Generate click)
 *
 * DOM it builds (injected into document.body before .wrap, or at top of .wrap):
 *   #flow-stepper          — the two-step progress bar
 *   #flow-step1            — wrapper div; must contain #intent-step and #model-config (filled by other modules)
 *   #flow-summary          — compact summary bar (inside #flow-step1, visible only when collapsed)
 *   #flow-step2            — wrapper div; contains #rounds (moved here from wherever it lives)
 *
 * Integration contract: see bottom of this file.
 */

(function () {
  'use strict';

  /* ── DOM builder helpers ──────────────────────────────────────────────── */

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'className') node.className = v;
        else if (k === 'id') node.id = v;
        else if (k === 'style') node.style.cssText = v;
        else if (k === 'textContent') node.textContent = v;
        else node.setAttribute(k, v);
      });
    }
    children.forEach(c => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  /* ── Build stepper bar ────────────────────────────────────────────────── */

  function buildStepper() {
    const steps = [
      { n: '01', label: 'STEP ONE', title: 'Thesis' },
      { n: '02', label: 'STEP TWO', title: 'Judge Panel' },
    ];

    const bar = el('div', { id: 'flow-stepper' });

    steps.forEach((s, i) => {
      if (i > 0) {
        bar.appendChild(el('div', { className: 'flow-stepper-divider' }));
      }

      const step = el('div', { className: 'flow-step', id: 'flow-step-indicator-' + (i + 1) });
      const numBox = el('div', { className: 'flow-step__num' }, s.n);
      const textBox = el('div', {});
      textBox.appendChild(el('div', { className: 'flow-step__label' }, s.label));
      textBox.appendChild(el('div', { className: 'flow-step__title' }, s.title));
      step.appendChild(numBox);
      step.appendChild(textBox);
      bar.appendChild(step);
    });

    return bar;
  }

  /* ── Build step containers ────────────────────────────────────────────── */

  function buildStep1() {
    const wrap = el('div', { id: 'flow-step1', className: 'expanded' });

    // Compact summary (hidden until collapse)
    const summary = el('div', { id: 'flow-summary' });
    const intentSpan = el('span', { id: 'flow-summary__intent' });
    const sourcesSpan = el('span', { id: 'flow-summary__sources' });
    const editBtn = el('button', { id: 'flow-summary__edit' }, '✎ edit');

    summary.appendChild(intentSpan);
    summary.appendChild(sourcesSpan);
    summary.appendChild(editBtn);
    wrap.appendChild(summary);

    // Placeholders — other modules mount into these ids
    wrap.appendChild(el('div', { id: 'intent-step' }));
    wrap.appendChild(el('div', { id: 'model-config' }));

    return wrap;
  }

  function buildStep2(roundsEl) {
    const wrap = el('div', { id: 'flow-step2' });
    wrap.appendChild(roundsEl);
    return wrap;
  }

  /* ── Stepper state helpers ────────────────────────────────────────────── */

  function setStepperActive(stepNumber) {
    [1, 2].forEach(n => {
      const ind = document.getElementById('flow-step-indicator-' + n);
      if (!ind) return;
      ind.classList.remove('active', 'done');
      if (n === stepNumber) ind.classList.add('active');
      else if (n < stepNumber) ind.classList.add('done');
    });
  }

  /* ── Collapse Step 1 into summary ────────────────────────────────────── */

  function collapseStep1(intent, sources) {
    const step1 = document.getElementById('flow-step1');
    const intentSpan = document.getElementById('flow-summary__intent');
    const sourcesSpan = document.getElementById('flow-summary__sources');

    if (intentSpan) intentSpan.textContent = '“' + intent + '”';

    if (sourcesSpan) {
      sourcesSpan.innerHTML = '';
      const labels = Array.isArray(sources) ? sources : [];
      labels.forEach(label => {
        const tag = el('span', { className: 'flow-source-tag' }, label);
        sourcesSpan.appendChild(tag);
      });
    }

    if (step1) {
      step1.classList.remove('expanded');
      step1.classList.add('collapsed');
    }
  }

  /* ── Re-expand Step 1 (edit button) ──────────────────────────────────── */

  function expandStep1() {
    const step1 = document.getElementById('flow-step1');
    if (step1) {
      step1.classList.remove('collapsed');
      step1.classList.add('expanded');
    }
    // If we're going back to step 1, hide step 2 and reset stepper
    const step2 = document.getElementById('flow-step2');
    if (step2) step2.classList.remove('visible');
    setStepperActive(1);
    // Re-disable generate if intent is now empty
    _pollGating();
  }

  /* ── Gating poll ──────────────────────────────────────────────────────── */

  let _pollInterval = null;

  function _pollGating() {
    try {
      const intent = window.IntentStep && typeof window.IntentStep.getIntent === 'function'
        ? window.IntentStep.getIntent()
        : '';
      const enabled = typeof intent === 'string' && intent.trim().length > 0;
      if (window.IntentStep && typeof window.IntentStep.setGenerateEnabled === 'function') {
        window.IntentStep.setGenerateEnabled(enabled);
      }
    } catch (e) {
      // IntentStep not ready yet — will retry on next tick
    }
  }

  function _startGatingPoll() {
    // Poll at 150ms — fast enough to feel instant on keyup, cheap enough to not matter
    _pollInterval = setInterval(_pollGating, 150);
    _pollGating(); // immediate first check
  }

  /* ── public API ───────────────────────────────────────────────────────── */

  window.Flow = {
    /**
     * init({ onGenerate })
     *
     * Must be called after the DOM is ready and after window.IntentStep is
     * available. Typically: at the end of your DOMContentLoaded handler,
     * after all other modules have initialised.
     *
     * @param {object}   options
     * @param {function} options.onGenerate  — called (with no args) when the
     *                                         user submits a valid intent.
     *                                         Wire this to runEvaluation().
     */
    init({ onGenerate }) {
      /* 1. Locate the .wrap (or body) to inject into */
      const wrap = document.querySelector('.wrap') || document.body;

      /* 2. Pull the existing #rounds out before we restructure */
      const existingRounds = document.getElementById('rounds');
      if (!existingRounds) {
        console.warn('[Flow] #rounds element not found — make sure it exists in the HTML before calling Flow.init()');
      }

      /* 3. Build DOM pieces */
      const stepper = buildStepper();
      const step1   = buildStep1();
      const step2   = buildStep2(existingRounds || el('div', { id: 'rounds' }));

      /* 4. Inject at the top of .wrap, before any existing children */
      wrap.insertBefore(step2,   wrap.firstChild);
      wrap.insertBefore(step1,   wrap.firstChild);
      wrap.insertBefore(stepper, wrap.firstChild);

      /* 5. Initial stepper state — Step 1 active */
      setStepperActive(1);

      /* 6. Wire "edit" button in summary to re-expand */
      const editBtn = document.getElementById('flow-summary__edit');
      if (editBtn) editBtn.addEventListener('click', expandStep1);

      /* 7. Start gating poll */
      _startGatingPoll();

      /* 8. Register generate handler */
      if (window.IntentStep && typeof window.IntentStep.onGenerate === 'function') {
        window.IntentStep.onGenerate(function () {
          const intent = window.IntentStep.getIntent
            ? window.IntentStep.getIntent().trim()
            : '';

          // Hard validation — belt-and-suspenders even if button was disabled
          if (!intent) {
            _pollGating(); // re-check gating state
            return;
          }

          const sources = window.IntentStep.getActiveSources
            ? window.IntentStep.getActiveSources()
            : [];

          // Collapse step 1, switch stepper, reveal step 2
          collapseStep1(intent, sources);
          setStepperActive(2);

          const step2El = document.getElementById('flow-step2');
          if (step2El) step2El.classList.add('visible');

          // Stop polling — no longer needed
          if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }

          // Fire the integrator callback
          if (typeof onGenerate === 'function') onGenerate();
        });
      } else {
        console.warn('[Flow] window.IntentStep.onGenerate not found — Generate callback not wired.');
      }
    },
  };

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * INTEGRATION CONTRACT — edits required to judge-panel.html
   * ═══════════════════════════════════════════════════════════════════════
   *
   * 1. In <head>, add BEFORE the closing </style> (or as separate <link>):
   *
   *      <link rel="stylesheet" href=".build/shell.css" />
   *
   * 2. In <body>, keep the existing .wrap div but REMOVE these blocks from
   *    inside it (Flow.init() re-inserts them in the right order):
   *      — The entire <div class="head">…</div> block (the old static step bar)
   *      — The <div class="configbar" id="configbar">…</div> block
   *        (keep the id="configbar" element only if your buildConfigBar() still
   *        targets it; alternatively, place an empty <div id="model-config"></div>
   *        inside .wrap and have buildConfigBar() target #model-config instead)
   *      — Leave <div id="rounds"></div> exactly where it is — Flow.init()
   *        will move it into #flow-step2 automatically.
   *
   * 3. At the bottom of <script>, REMOVE the two bare calls:
   *
   *      buildConfigBar();
   *      runEvaluation();         ← THIS is the critical one — removing it
   *                                  prevents auto-run on load.
   *
   *    Replace them with:
   *
   *      buildConfigBar();        // still call this to populate #model-config
   *                               // (or target #configbar if you kept it)
   *      Flow.init({
   *        onGenerate: runEvaluation,
   *      });
   *
   * 4. Add <script src=".build/shell.js"></script> AFTER your existing
   *    </script> tag (so shell.js loads after PROVIDERS/cfg/buildConfigBar
   *    are defined), but BEFORE the closing </body>.
   *
   * 5. Implement window.IntentStep on the page (separate module or inline):
   *
   *      window.IntentStep = {
   *        getIntent()            { return textarea.value; },
   *        getActiveSources()     { return [...activeSourceLabels]; },
   *        setGenerateEnabled(b)  { generateBtn.disabled = !b; generateBtn.style.opacity = b ? '1' : '.4'; },
   *        onGenerate(fn)         { generateBtn.addEventListener('click', fn); },
   *      };
   *
   *    The #intent-step and #model-config divs (created by Flow.init() inside
   *    #flow-step1) are the mount points — render your textarea and source
   *    toggles into #intent-step, and the model-config bar into #model-config.
   *
   * ═══════════════════════════════════════════════════════════════════════
   */
})();

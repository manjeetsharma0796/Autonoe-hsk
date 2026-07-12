/**
 * TribunalModels — self-contained provider + model picker
 * Exposes: window.TribunalModels = { mount, getRoles, hasAnyKey, onChange }
 *
 * No external dependencies. Requires picker.css to be loaded first.
 */
(function () {
  'use strict';

  // ── Mock model data ─────────────────────────────────────────────────────────
  const MOCK_MODELS = {
    groq:       ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    mistral:    ['mistral-large-latest', 'mistral-medium-2505', 'mistral-small-latest'],
    nvidia:     ['nemotron-4-340b-instruct', 'llama-3.1-nemotron-70b'],
    openrouter: ['anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b', 'qwen/qwen-2.5-72b'],
    gemini:     ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  const PROVIDERS = ['groq', 'mistral', 'nvidia', 'openrouter', 'gemini'];
  const ROLES     = ['supporter', 'discriminator', 'judge'];

  // ── State ────────────────────────────────────────────────────────────────────
  const state = {
    // Per-provider
    keys:   Object.fromEntries(PROVIDERS.map(p => [p, ''])),   // '' = no key set
    models: Object.fromEntries(PROVIDERS.map(p => [p, []])),   // populated when key set

    // Active provider/model per role
    roles: {
      supporter:     { provider: 'groq', model: '' },
      discriminator: { provider: 'groq', model: '' },
      judge:         { provider: 'groq', model: '' },
    },

    // Which roles were manually overridden (stop auto-following Supporter)
    overridden: { supporter: false, discriminator: false, judge: false },

    // Currently viewed role in the picker
    activeRole: 'supporter',

    // Convenience: model filter text, per role
    filterText: { supporter: '', discriminator: '', judge: '' },
  };

  let changeCallbacks = [];

  function emit() {
    const snapshot = getRoles();
    changeCallbacks.forEach(cb => { try { cb(snapshot); } catch(e) {} });
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function getRoles() {
    return {
      supporter:     { ...state.roles.supporter },
      discriminator: { ...state.roles.discriminator },
      judge:         { ...state.roles.judge },
    };
  }

  function hasAnyKey() {
    return PROVIDERS.some(p => state.keys[p] !== '');
  }

  function onChange(cb) {
    changeCallbacks.push(cb);
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────────
  function el(tag, cls, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  function txt(text) { return document.createTextNode(text); }

  // ── Render ───────────────────────────────────────────────────────────────────
  // We keep references to elements we need to update.
  let refs = {};

  function buildDOM(container) {
    container.innerHTML = '';
    const root = el('div', 'tm-picker');

    // --- Role Tabs ---
    const tabBar = el('div', 'tm-role-tabs');
    refs.tabs = {};
    ROLES.forEach(role => {
      const btn = el('button', 'tm-role-tab' + (role === state.activeRole ? ' active' : ''));
      btn.type = 'button';

      const dot = el('span', 'tm-role-dot ' + role);
      btn.appendChild(dot);
      btn.appendChild(txt(role.charAt(0).toUpperCase() + role.slice(1)));

      const badge = el('span', 'tm-custom-badge');
      badge.textContent = 'custom';
      badge.style.display = 'none';
      btn.appendChild(badge);

      refs.tabs[role] = { btn, badge };
      btn.addEventListener('click', () => selectRole(role));
      tabBar.appendChild(btn);
    });
    root.appendChild(tabBar);

    // --- Provider Grid ---
    const provLabel = el('div', 'tm-section-label');
    provLabel.textContent = 'Provider';
    root.appendChild(provLabel);

    const grid = el('div', 'tm-provider-grid');
    refs.chips = {};
    PROVIDERS.forEach(p => {
      const chip = el('button', 'tm-provider-chip');
      chip.type = 'button';

      const dot = el('span', 'tm-status-dot ' + (state.keys[p] ? 'has-key' : 'no-key'));
      chip.appendChild(dot);
      chip.appendChild(txt(p));

      refs.chips[p] = { chip, dot };
      chip.addEventListener('click', () => selectProvider(p));
      grid.appendChild(chip);
    });
    root.appendChild(grid);

    // --- API Key Input ---
    const keyLabel = el('div', 'tm-section-label');
    keyLabel.textContent = 'API Key';
    root.appendChild(keyLabel);

    const keyInput = el('input', 'tm-input tm-key-input');
    keyInput.type = 'password';
    keyInput.placeholder = 'paste API key';
    refs.keyInput = keyInput;

    keyInput.addEventListener('input', () => {
      const provider = activeRoleProvider();
      const val = keyInput.value.trim();
      state.keys[provider] = val;
      if (val) {
        // Populate models (mock: instant)
        state.models[provider] = [...MOCK_MODELS[provider]];
        // Auto-select first model if none selected for this provider across roles
        ROLES.forEach(r => {
          if (state.roles[r].provider === provider && !state.roles[r].model) {
            state.roles[r].model = state.models[provider][0] || '';
          }
        });
        refs.chips[provider].dot.className = 'tm-status-dot has-key';
      } else {
        state.models[provider] = [];
        refs.chips[provider].dot.className = 'tm-status-dot no-key';
      }
      refreshModelList();
      refreshSummary();
      emit();
    });
    root.appendChild(keyInput);

    // --- Model Filter ---
    const filterLabel = el('div', 'tm-section-label');
    filterLabel.textContent = 'Model';
    root.appendChild(filterLabel);

    const filterInput = el('input', 'tm-input');
    filterInput.type = 'text';
    filterInput.placeholder = 'filter models…';
    refs.filterInput = filterInput;

    filterInput.addEventListener('input', () => {
      state.filterText[state.activeRole] = filterInput.value;
      refreshModelList();
    });
    root.appendChild(filterInput);

    // --- Model List ---
    const modelList = el('div', 'tm-model-list');
    refs.modelList = modelList;
    root.appendChild(modelList);

    // --- Summary ---
    const summary = el('div', 'tm-summary');
    refs.summaryRows = {};
    ROLES.forEach(role => {
      const row = el('div', 'tm-summary-row ' + role);
      const lbl = el('span', 'tm-summary-role');
      lbl.textContent = role.slice(0,3).toUpperCase();
      const val = el('span', 'tm-summary-val');
      refs.summaryRows[role] = val;
      row.appendChild(lbl);
      row.appendChild(val);
      summary.appendChild(row);
    });
    root.appendChild(summary);

    container.appendChild(root);

    // Initial render pass
    syncChipSelection();
    refreshModelList();
    refreshSummary();
    syncKeyInput();
    syncFilterInput();
  }

  // ── Interactions ─────────────────────────────────────────────────────────────

  function activeRoleProvider() {
    return state.roles[state.activeRole].provider;
  }

  function selectRole(role) {
    state.activeRole = role;

    // Update tab styles
    ROLES.forEach(r => {
      const { btn } = refs.tabs[r];
      btn.classList.toggle('active', r === role);
    });

    syncChipSelection();
    syncKeyInput();
    syncFilterInput();
    refreshModelList();
  }

  function selectProvider(provider) {
    const role = state.activeRole;
    state.roles[role].provider = provider;

    if (role === 'supporter' && !state.overridden.discriminator) {
      state.roles.discriminator.provider = provider;
    }
    if (role === 'supporter' && !state.overridden.judge) {
      state.roles.judge.provider = provider;
    }

    // If not overridden, non-supporter auto-follows
    if (role !== 'supporter') {
      state.overridden[role] = true;
      refs.tabs[role].badge.style.display = '';
    }

    // Reset model for this role if the provider changed
    const available = state.models[provider];
    if (!available.includes(state.roles[role].model)) {
      state.roles[role].model = available[0] || '';
    }

    // Cascade to non-overridden roles when supporter changes
    if (role === 'supporter') {
      ['discriminator', 'judge'].forEach(r => {
        if (!state.overridden[r]) {
          const av = state.models[provider];
          if (!av.includes(state.roles[r].model)) {
            state.roles[r].model = av[0] || '';
          }
        }
      });
    }

    syncChipSelection();
    syncKeyInput();
    syncFilterInput();
    refreshModelList();
    refreshSummary();
    emit();
  }

  function selectModel(model) {
    const role = state.activeRole;
    state.roles[role].model = model;

    if (role !== 'supporter') {
      state.overridden[role] = true;
      refs.tabs[role].badge.style.display = '';
    } else {
      // Auto-fill non-overridden roles
      ['discriminator', 'judge'].forEach(r => {
        if (!state.overridden[r]) {
          state.roles[r].provider = state.roles.supporter.provider;
          state.roles[r].model    = model;
        }
      });
    }

    refreshModelList();
    refreshSummary();
    emit();
  }

  function syncChipSelection() {
    const provider = state.roles[state.activeRole].provider;
    PROVIDERS.forEach(p => {
      refs.chips[p].chip.classList.toggle('selected', p === provider);
    });
  }

  function syncKeyInput() {
    const provider = state.roles[state.activeRole].provider;
    refs.keyInput.value = state.keys[provider];
  }

  function syncFilterInput() {
    refs.filterInput.value = state.filterText[state.activeRole] || '';
  }

  function refreshModelList() {
    const role     = state.activeRole;
    const provider = state.roles[role].provider;
    const current  = state.roles[role].model;
    const filter   = (state.filterText[role] || '').toLowerCase();
    const list     = state.models[provider] || [];

    const filtered = filter ? list.filter(m => m.toLowerCase().includes(filter)) : list;

    refs.modelList.innerHTML = '';

    if (filtered.length === 0) {
      const empty = el('div', 'tm-model-empty');
      empty.textContent = list.length === 0
        ? 'paste an API key to load models'
        : 'no models match filter';
      refs.modelList.appendChild(empty);
      return;
    }

    filtered.forEach(model => {
      const row = el('div', 'tm-model-row' + (model === current ? ' selected' : ''));
      const dot = el('span', 'tm-model-dot');
      row.appendChild(dot);
      row.appendChild(txt(model));
      row.addEventListener('click', () => selectModel(model));
      refs.modelList.appendChild(row);
    });
  }

  function refreshSummary() {
    ROLES.forEach(role => {
      const { provider, model } = state.roles[role];
      const val = refs.summaryRows[role];
      val.textContent = model ? provider + ' / ' + model : provider + ' / —';
    });
  }

  // ── mount ────────────────────────────────────────────────────────────────────
  function mount(containerEl) {
    if (typeof containerEl === 'string') {
      containerEl = document.getElementById(containerEl);
    }
    if (!containerEl) throw new Error('TribunalModels.mount: container not found');
    buildDOM(containerEl);
  }

  // ── Expose global ────────────────────────────────────────────────────────────
  window.TribunalModels = { mount, getRoles, hasAnyKey, onChange };

})();

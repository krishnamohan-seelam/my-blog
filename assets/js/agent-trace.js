/**
 * agent-trace.js
 * <agent-trace src="..." start="N"> — renders a recorded agent-trace/1 run.
 * Vanilla custom element, no framework, no build step (light DOM: inherits page CSS vars).
 */

(function () {
  const PLAYBACK_INTERVAL_MS = 1200;
  const claimedHashes = new Set();

  function slugFor(src) {
    return src.split('/').pop().replace(/\.json$/, '');
  }

  function parseStepHash(hash, slug) {
    const match = new RegExp(`^#${slug}-step-(\\d+)$`).exec(hash);
    return match ? parseInt(match[1], 10) : null;
  }

  const FALLBACK_SUMMARY = {
    tool_call: (step) => `Called tool ${(step.detail && step.detail.tool) || 'unknown'}`,
    tool_result: (step) => `${(step.detail && step.detail.tool) || 'Tool'} returned a result`,
    llm: () => 'LLM call',
    state: (step) => {
      const changed = (step.detail && step.detail.changed) || {};
      const keys = Object.keys(changed);
      return keys.length ? `State changed: ${keys.join(', ')}` : 'State changed';
    },
    node_start: (step) => `Entered ${step.node || 'node'}`,
    node_end: (step) => `Left ${step.node || 'node'}`,
    error: (step) => `Error: ${(step.detail && step.detail.message) || step.summary || 'unknown error'}`,
  };

  function summaryFor(step) {
    if (step.summary) return step.summary;
    const fn = FALLBACK_SUMMARY[step.kind];
    return fn ? fn(step) : `${step.kind} step`;
  }

  const DETAIL_FIELDS = {
    llm: (detail) => [
      ['Prompt', detail.prompt],
      ['Response', detail.response],
    ],
    tool_call: (detail) => [
      ['Tool', detail.tool],
      ['Args', detail.args],
    ],
    tool_result: (detail) => [
      ['Tool', detail.tool],
      ['Output', detail.output],
    ],
    state: (detail) => [['Changed', detail.changed]],
  };

  function detailFieldsFor(step) {
    if (!step.detail) return null;
    const fn = DETAIL_FIELDS[step.kind];
    if (!fn) return null;
    return fn(step.detail).filter(([, value]) => value !== undefined);
  }

  function tokenCostLineFor(step, trace) {
    if (!step.tokens || typeof step.cost_inr !== 'number') return null;
    const asOf = trace.pricing && trace.pricing.as_of;
    const asOfText = asOf ? ` (prices as of ${asOf})` : '';
    return `${step.tokens.in} in / ${step.tokens.out} out · ≈ ₹${step.cost_inr}${asOfText}`;
  }

  function truncatedBadgeFor(step) {
    if (!step.truncated) return null;
    return typeof step.original_size === 'number'
      ? `truncated (original ${step.original_size} bytes)`
      : 'truncated';
  }

  const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  let mermaidModulePromise = null;

  function loadMermaid() {
    if (!mermaidModulePromise) {
      mermaidModulePromise = import(MERMAID_CDN_URL).then((mod) => mod.default);
    }
    return mermaidModulePromise;
  }

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark';
  }

  function safeNodeId(name, index) {
    return `node_${index}_${String(name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  function buildMermaidDefinition(graph) {
    const idByName = {};
    graph.nodes.forEach((name, index) => {
      idByName[name] = safeNodeId(name, index);
    });

    const lines = ['graph TD'];
    graph.nodes.forEach((name) => {
      const label = String(name).replace(/"/g, "'");
      lines.push(`  ${idByName[name]}["${label}"]`);
    });
    graph.edges.forEach(([from, to]) => {
      if (idByName[from] && idByName[to]) {
        lines.push(`  ${idByName[from]} --> ${idByName[to]}`);
      }
    });

    return { definition: lines.join('\n'), idByName };
  }

  function makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'agent-trace__btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  class AgentTrace extends HTMLElement {
    constructor() {
      super();
      this._trace = null;
      this._currentIndex = 0;
      this._playing = false;
      this._timer = null;
      this._observer = null;
      this._fetched = false;
    }

    connectedCallback() {
      this._renderStatus('Loading trace…');

      const slug = slugFor(this.getAttribute('src'));
      const hash = window.location.hash;
      const hashStepId = parseStepHash(hash, slug);
      if (hashStepId !== null && !claimedHashes.has(hash)) {
        claimedHashes.add(hash);
        this._hashStepId = hashStepId;
        this._fetched = true;
        this._load().then(() => {
          this.scrollIntoView({ block: 'center' });
        });
        return;
      }

      this._observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this._fetched) {
              this._fetched = true;
              this._load();
            }
          });
        },
        { rootMargin: '200px' }
      );
      this._observer.observe(this);
    }

    disconnectedCallback() {
      if (this._observer) this._observer.disconnect();
      this._stopPlayback();
    }

    async _load() {
      const src = this.getAttribute('src');
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this._trace = await res.json();
      } catch (err) {
        this._renderStatus(`Could not load trace: ${err.message}`, true);
        return;
      }

      const maxIndex = Math.max(0, this._trace.steps.length - 1);

      if (this._hashStepId !== undefined) {
        const hashIndex = this._trace.steps.findIndex((s) => s.id === this._hashStepId);
        this._currentIndex = hashIndex >= 0 ? hashIndex : 0;
      } else {
        const startAttr = parseInt(this.getAttribute('start'), 10);
        this._currentIndex = Number.isFinite(startAttr)
          ? Math.min(maxIndex, Math.max(0, startAttr - 1))
          : 0;
      }

      this._render();
    }

    _renderStatus(message, isError) {
      this.textContent = '';
      const p = document.createElement('p');
      p.className = isError ? 'agent-trace__error' : 'agent-trace__loading';
      p.textContent = message;
      this.appendChild(p);
    }

    _render() {
      this.textContent = '';
      const root = document.createElement('div');
      root.className = 'agent-trace';

      const main = document.createElement('div');
      main.className = 'agent-trace__main';
      root.appendChild(main);

      if (this._trace.graph && this._trace.graph.nodes && this._trace.graph.nodes.length) {
        const graphPanel = document.createElement('div');
        graphPanel.className = 'agent-trace__graph';
        this._graphPanel = graphPanel;
        main.appendChild(graphPanel);
        this._renderGraph();
      } else {
        this._graphPanel = null;
        this._nodeIdMap = null;
      }

      const right = document.createElement('div');
      right.className = 'agent-trace__right';
      main.appendChild(right);

      const controls = document.createElement('div');
      controls.className = 'agent-trace__controls';
      const backBtn = makeButton('Back', () => this._step(-1));
      const playBtn = makeButton('Play', () => this._togglePlay(playBtn));
      const nextBtn = makeButton('Next', () => this._step(1));
      controls.append(backBtn, playBtn, nextBtn);
      this._playBtn = playBtn;
      right.appendChild(controls);

      const list = document.createElement('ol');
      list.className = 'agent-trace__steps';
      this._listEl = list;
      right.appendChild(list);

      const detailWrap = document.createElement('details');
      detailWrap.className = 'agent-trace__detail';
      detailWrap.open = true;
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = 'Detail';
      const detailBody = document.createElement('div');
      detailBody.className = 'agent-trace__detail-body';
      detailWrap.append(summaryEl, detailBody);
      this._detailBody = detailBody;
      right.appendChild(detailWrap);

      this.appendChild(root);
      this._renderStepList();
      this._renderDetail();
    }

    _renderStepList() {
      this._listEl.textContent = '';
      this._trace.steps.forEach((step, index) => {
        const li = document.createElement('li');
        li.className =
          'agent-trace__step' + (index === this._currentIndex ? ' agent-trace__step--active' : '');

        const line = document.createElement('button');
        line.type = 'button';
        line.className = 'agent-trace__step-line';
        line.textContent = `${step.id}. [${step.kind}] ${summaryFor(step)}`;
        line.addEventListener('click', () => this._goTo(index));
        li.appendChild(line);

        const tokenCostLine = tokenCostLineFor(step, this._trace);
        if (tokenCostLine) {
          const costEl = document.createElement('span');
          costEl.className = 'agent-trace__cost';
          costEl.textContent = tokenCostLine;
          li.appendChild(costEl);
        }

        const truncatedBadge = truncatedBadgeFor(step);
        if (truncatedBadge) {
          const badgeEl = document.createElement('span');
          badgeEl.className = 'agent-trace__badge agent-trace__badge--truncated';
          badgeEl.textContent = truncatedBadge;
          li.appendChild(badgeEl);
        }

        const linkBtn = makeButton('Copy link', () => this._copyLinkFor(step, linkBtn));
        linkBtn.className += ' agent-trace__link-btn';
        li.appendChild(linkBtn);

        this._listEl.appendChild(li);
        if (index === this._currentIndex) {
          this._activeStepEl = li;
        }
      });
    }

    _copyLinkFor(step, linkBtn) {
      const slug = slugFor(this.getAttribute('src'));
      const hash = `#${slug}-step-${step.id}`;
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;

      window.history.replaceState(null, '', hash);

      const originalLabel = linkBtn.textContent;
      const showCopied = () => {
        linkBtn.textContent = 'Copied!';
        setTimeout(() => {
          linkBtn.textContent = originalLabel;
        }, 1500);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied, () => {});
      }
    }

    _renderGraph() {
      const { definition, idByName } = buildMermaidDefinition(this._trace.graph);
      this._nodeIdMap = idByName;

      loadMermaid()
        .then((mermaid) => {
          mermaid.initialize({ startOnLoad: false, theme: getActiveTheme(), securityLevel: 'loose' });
          const svgId = `agent-trace-mermaid-${Math.random().toString(36).slice(2)}`;
          return mermaid.render(svgId, definition);
        })
        .then(({ svg }) => {
          if (!this._graphPanel) return;
          this._graphPanel.innerHTML = svg;
          this._highlightActiveNode();
        })
        .catch((err) => {
          if (!this._graphPanel) return;
          this._graphPanel.textContent = '';
          const p = document.createElement('p');
          p.className = 'agent-trace__error';
          p.textContent = `Could not render graph: ${err.message}`;
          this._graphPanel.appendChild(p);
        });
    }

    _highlightActiveNode() {
      if (!this._graphPanel || !this._nodeIdMap) return;
      const step = this._trace.steps[this._currentIndex];
      const activeSafeId = step.node && this._nodeIdMap[step.node];

      this._graphPanel.querySelectorAll('.node').forEach((el) => {
        el.classList.remove('agent-trace__node--active');
      });
      if (!activeSafeId) return;

      this._graphPanel.querySelectorAll('.node').forEach((el) => {
        if (el.id && el.id.includes(`-${activeSafeId}-`)) {
          el.classList.add('agent-trace__node--active');
        }
      });
    }

    _renderDetail() {
      const step = this._trace.steps[this._currentIndex];
      this._detailBody.textContent = '';

      if (!step.detail) {
        const p = document.createElement('p');
        p.className = 'agent-trace__detail-empty';
        p.textContent = '(no detail for this step)';
        this._detailBody.appendChild(p);
        return;
      }

      const fields = detailFieldsFor(step);
      if (!fields) {
        const pre = document.createElement('pre');
        pre.className = 'agent-trace__detail-content';
        pre.textContent = JSON.stringify(step.detail, null, 2);
        this._detailBody.appendChild(pre);
        return;
      }

      const dl = document.createElement('dl');
      dl.className = 'agent-trace__detail-fields';
      fields.forEach(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        dl.append(dt, dd);
      });
      this._detailBody.appendChild(dl);
    }

    _goTo(index) {
      if (!this._trace) return;
      const maxIndex = this._trace.steps.length - 1;
      this._currentIndex = Math.max(0, Math.min(maxIndex, index));
      this._renderStepList();
      this._renderDetail();
      this._highlightActiveNode();
      if (this._activeStepEl && this._activeStepEl.scrollIntoView) {
        this._activeStepEl.scrollIntoView({ block: 'nearest' });
      }
    }

    _step(delta) {
      this._goTo(this._currentIndex + delta);
    }

    _togglePlay(playBtn) {
      if (this._playing) {
        this._stopPlayback();
        playBtn.textContent = 'Play';
        return;
      }

      this._playing = true;
      playBtn.textContent = 'Pause';
      this._timer = setInterval(() => {
        if (this._currentIndex >= this._trace.steps.length - 1) {
          this._stopPlayback();
          return;
        }
        this._step(1);
      }, PLAYBACK_INTERVAL_MS);
    }

    _stopPlayback() {
      this._playing = false;
      if (this._playBtn) this._playBtn.textContent = 'Play';
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  }

  customElements.define('agent-trace', AgentTrace);
})();

/**
 * agent-trace.js
 * <agent-trace src="..." start="N"> — renders a recorded agent-trace/1 run.
 * Vanilla custom element, no framework, no build step (light DOM: inherits page CSS vars).
 */

(function () {
  const PLAYBACK_INTERVAL_MS = 1200;

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

      const startAttr = parseInt(this.getAttribute('start'), 10);
      const maxIndex = Math.max(0, this._trace.steps.length - 1);
      this._currentIndex = Number.isFinite(startAttr)
        ? Math.min(maxIndex, Math.max(0, startAttr - 1))
        : 0;

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

      const controls = document.createElement('div');
      controls.className = 'agent-trace__controls';
      const backBtn = makeButton('Back', () => this._step(-1));
      const playBtn = makeButton('Play', () => this._togglePlay(playBtn));
      const nextBtn = makeButton('Next', () => this._step(1));
      controls.append(backBtn, playBtn, nextBtn);
      this._playBtn = playBtn;
      root.appendChild(controls);

      const list = document.createElement('ol');
      list.className = 'agent-trace__steps';
      this._listEl = list;
      root.appendChild(list);

      const detailWrap = document.createElement('details');
      detailWrap.className = 'agent-trace__detail';
      detailWrap.open = true;
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = 'Detail';
      const detailBody = document.createElement('div');
      detailBody.className = 'agent-trace__detail-body';
      detailWrap.append(summaryEl, detailBody);
      this._detailBody = detailBody;
      root.appendChild(detailWrap);

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

        this._listEl.appendChild(li);
        if (index === this._currentIndex) {
          this._activeStepEl = li;
        }
      });
    }

    _renderDetail() {
      const step = this._trace.steps[this._currentIndex];
      this._detailBody.textContent = '';

      const pre = document.createElement('pre');
      pre.className = 'agent-trace__detail-content';
      pre.textContent = step.detail ? JSON.stringify(step.detail, null, 2) : '(no detail for this step)';
      this._detailBody.appendChild(pre);
    }

    _goTo(index) {
      if (!this._trace) return;
      const maxIndex = this._trace.steps.length - 1;
      this._currentIndex = Math.max(0, Math.min(maxIndex, index));
      this._renderStepList();
      this._renderDetail();
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

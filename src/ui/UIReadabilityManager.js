const STORAGE_KEY = 'world-invasion.ui.v1';

const DEFAULTS = Object.freeze({
  scale: 1.1,
  density: 'STANDARD',
  mapLabels: 'LARGE',
  highContrast: false,
  reduceNoise: false,
  leftCollapsed: false,
  rightCollapsed: false
});

const SCALE_VALUES = [1, 1.1, 1.25, 1.5];
const DENSITIES = new Set(['COMPACT', 'STANDARD', 'COMFORT']);
const LABEL_SIZES = new Set(['NORMAL', 'LARGE']);

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function button(label, attrs = '') {
  return `<button type="button" ${attrs}>${label}</button>`;
}

export class UIReadabilityManager {
  constructor({ root = document.documentElement, shell = document.querySelector('#wi-shell') } = {}) {
    this.root = root;
    this.shell = shell;
    this.settings = this.load();
    this.panel = null;
    this.trigger = null;
    this.apply();
    this.mount();
    this.bindGlobalShortcuts();
  }

  load() {
    let stored = null;
    try { stored = safeParse(localStorage.getItem(STORAGE_KEY)); } catch { stored = null; }
    const merged = { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) };
    if (!SCALE_VALUES.includes(Number(merged.scale))) merged.scale = DEFAULTS.scale;
    if (!DENSITIES.has(merged.density)) merged.density = DEFAULTS.density;
    if (!LABEL_SIZES.has(merged.mapLabels)) merged.mapLabels = DEFAULTS.mapLabels;
    for (const key of ['highContrast', 'reduceNoise', 'leftCollapsed', 'rightCollapsed']) merged[key] = Boolean(merged[key]);
    return merged;
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* file:// or privacy-restricted storage: keep session settings only */ }
  }

  set(patch) {
    this.settings = { ...this.settings, ...patch };
    this.apply();
    this.save();
    this.syncPanel();
    window.dispatchEvent(new CustomEvent('worldinvasion:ui-settings', { detail: { ...this.settings } }));
  }

  apply() {
    const s = Number(this.settings.scale) || 1.1;
    const densityFactor = this.settings.density === 'COMFORT' ? 1.14 : this.settings.density === 'COMPACT' ? .9 : 1;
    const px = (base, min = 0) => `${Math.max(min, Math.round(base * s))}px`;
    const sp = (base) => `${Math.round(base * densityFactor * Math.min(s, 1.25))}px`;

    this.root.style.setProperty('--wi-ui-scale', String(s));
    this.root.style.setProperty('--wi-font-xs', px(11, 11));
    this.root.style.setProperty('--wi-font-sm', px(12, 12));
    this.root.style.setProperty('--wi-font-md', px(14, 14));
    this.root.style.setProperty('--wi-font-lg', px(17, 17));
    this.root.style.setProperty('--wi-font-xl', px(21, 21));
    this.root.style.setProperty('--wi-font-display', px(25, 24));
    this.root.style.setProperty('--wi-control-h', px(38, 38));
    this.root.style.setProperty('--wi-hit', px(40, 40));
    this.root.style.setProperty('--wi-icon-md', px(22, 20));
    this.root.style.setProperty('--wi-gap-xs', sp(5));
    this.root.style.setProperty('--wi-gap-sm', sp(8));
    this.root.style.setProperty('--wi-gap-md', sp(12));
    this.root.style.setProperty('--wi-gap-lg', sp(18));
    this.root.style.setProperty('--wi-panel-pad', sp(18));
    this.root.style.setProperty('--wi-top-h', px(76, 76));
    this.root.style.setProperty('--wi-bottom-h', px(76, 76));
    this.root.style.setProperty('--wi-left-w', `${Math.min(320, Math.max(248, Math.round(260 * s)))}px`);
    this.root.style.setProperty('--wi-right-w', `${Math.min(450, Math.max(336, Math.round(350 * s)))}px`);
    this.root.style.setProperty('--wi-map-label-scale', this.settings.mapLabels === 'LARGE' ? String(1.2 * Math.min(s, 1.25)) : String(Math.min(s, 1.15)));

    this.root.dataset.uiDensity = this.settings.density.toLowerCase();
    this.root.dataset.mapLabels = this.settings.mapLabels.toLowerCase();
    this.root.dataset.highContrast = String(this.settings.highContrast);
    this.root.dataset.reduceNoise = String(this.settings.reduceNoise);
    this.shell?.classList.toggle('is-left-collapsed', this.settings.leftCollapsed);
    this.shell?.classList.toggle('is-right-collapsed', this.settings.rightCollapsed);
  }

  mount() {
    if (document.querySelector('.wi-ui-settings')) return;
    const host = document.createElement('div');
    host.className = 'wi-ui-settings';
    host.innerHTML = `
      <button type="button" class="wi-ui-settings-trigger" aria-expanded="false" aria-controls="wi-ui-settings-panel">Aa <b>110%</b></button>
      <section id="wi-ui-settings-panel" class="wi-ui-settings-panel" hidden aria-label="Réglages d'affichage">
        <header><div><span>DISPLAY</span><b>READABILITY</b></div><button type="button" data-ui-close aria-label="Fermer">×</button></header>
        <div class="wi-ui-setting-group"><span>UI SCALE</span><div class="wi-ui-segmented">
          ${SCALE_VALUES.map(v => button(`${Math.round(v * 100)}%`, `data-ui-scale="${v}"`)).join('')}
        </div></div>
        <div class="wi-ui-setting-group"><span>DENSITY</span><div class="wi-ui-segmented">
          ${['COMPACT','STANDARD','COMFORT'].map(v => button(v, `data-ui-density="${v}"`)).join('')}
        </div></div>
        <div class="wi-ui-setting-group"><span>MAP LABELS</span><div class="wi-ui-segmented">
          ${['NORMAL','LARGE'].map(v => button(v, `data-ui-labels="${v}"`)).join('')}
        </div></div>
        <label class="wi-ui-toggle"><span>HIGH CONTRAST</span><input type="checkbox" data-ui-contrast></label>
        <label class="wi-ui-toggle"><span>REDUCE VISUAL NOISE</span><input type="checkbox" data-ui-noise></label>
        <div class="wi-ui-setting-group"><span>PANELS / MAP FIRST</span><div class="wi-ui-segmented wi-ui-panels">
          ${button('LEFT', 'data-ui-panel="left"')}${button('DETAIL', 'data-ui-panel="right"')}${button('MAP FIRST', 'data-ui-map-first')}
        </div></div>
        <footer><button type="button" data-ui-reset>RESET DISPLAY</button><small>Preferences are stored locally.</small></footer>
      </section>`;
    document.body.append(host);
    this.trigger = host.querySelector('.wi-ui-settings-trigger');
    this.panel = host.querySelector('.wi-ui-settings-panel');

    this.trigger.addEventListener('click', () => this.togglePanel());
    host.querySelector('[data-ui-close]').addEventListener('click', () => this.togglePanel(false));
    host.querySelectorAll('[data-ui-scale]').forEach(el => el.addEventListener('click', () => this.set({ scale: Number(el.dataset.uiScale) })));
    host.querySelectorAll('[data-ui-density]').forEach(el => el.addEventListener('click', () => this.set({ density: el.dataset.uiDensity })));
    host.querySelectorAll('[data-ui-labels]').forEach(el => el.addEventListener('click', () => this.set({ mapLabels: el.dataset.uiLabels })));
    host.querySelector('[data-ui-contrast]').addEventListener('change', e => this.set({ highContrast: e.currentTarget.checked }));
    host.querySelector('[data-ui-noise]').addEventListener('change', e => this.set({ reduceNoise: e.currentTarget.checked }));
    host.querySelector('[data-ui-panel="left"]').addEventListener('click', () => this.set({ leftCollapsed: !this.settings.leftCollapsed }));
    host.querySelector('[data-ui-panel="right"]').addEventListener('click', () => this.set({ rightCollapsed: !this.settings.rightCollapsed }));
    host.querySelector('[data-ui-map-first]').addEventListener('click', () => this.set({ leftCollapsed: true, rightCollapsed: true }));
    host.querySelector('[data-ui-reset]').addEventListener('click', () => this.set({ ...DEFAULTS }));
    document.addEventListener('pointerdown', e => {
      if (!this.panel.hidden && !host.contains(e.target)) this.togglePanel(false);
    });
    this.syncPanel();
  }

  syncPanel() {
    if (!this.panel || !this.trigger) return;
    const s = this.settings;
    this.trigger.querySelector('b').textContent = `${Math.round(s.scale * 100)}%`;
    this.panel.querySelectorAll('[data-ui-scale]').forEach(el => el.classList.toggle('is-active', Number(el.dataset.uiScale) === s.scale));
    this.panel.querySelectorAll('[data-ui-density]').forEach(el => el.classList.toggle('is-active', el.dataset.uiDensity === s.density));
    this.panel.querySelectorAll('[data-ui-labels]').forEach(el => el.classList.toggle('is-active', el.dataset.uiLabels === s.mapLabels));
    this.panel.querySelector('[data-ui-contrast]').checked = s.highContrast;
    this.panel.querySelector('[data-ui-noise]').checked = s.reduceNoise;
    this.panel.querySelector('[data-ui-panel="left"]').classList.toggle('is-active', !s.leftCollapsed);
    this.panel.querySelector('[data-ui-panel="right"]').classList.toggle('is-active', !s.rightCollapsed);
  }

  togglePanel(force) {
    if (!this.panel) return;
    const open = typeof force === 'boolean' ? force : this.panel.hidden;
    this.panel.hidden = !open;
    this.trigger?.setAttribute('aria-expanded', String(open));
  }

  bindGlobalShortcuts() {
    window.addEventListener('keydown', e => {
      if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        this.togglePanel();
      }
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        const current = SCALE_VALUES.indexOf(this.settings.scale);
        if (current >= 0 && current < SCALE_VALUES.length - 1) { e.preventDefault(); this.set({ scale: SCALE_VALUES[current + 1] }); }
      }
      if (e.ctrlKey && e.key === '-') {
        const current = SCALE_VALUES.indexOf(this.settings.scale);
        if (current > 0) { e.preventDefault(); this.set({ scale: SCALE_VALUES[current - 1] }); }
      }
    });
  }
}

/**
 * echarts.js — Apache ECharts wrapper
 *
 * Key behaviours:
 *   • buildLoomTheme() reads CSS custom properties via getComputedStyle.
 *     CSS variables do not resolve inside <canvas>; concrete colour values
 *     must be passed to ECharts directly.
 *   • initECharts() patches window.echarts.init once after the CDN script
 *     loads, so every chart — including inline <script> charts in model
 *     files that call echarts.init() directly — gets the 'loom' theme with
 *     correctly resolved colours.
 *   • Charts created via renderEChart() are tracked so they re-render when
 *     the user toggles light / dark mode.
 */

// ── Theme builder ──────────────────────────────────────────────────────────────
// CSS custom properties do not resolve in <canvas> context; we must read them
// via getComputedStyle and pass concrete colour values to ECharts.

function buildLoomTheme() {
  const cs  = getComputedStyle(document.documentElement);
  const tok = (v, fb) => cs.getPropertyValue(v).trim() || fb;
  return {
    color: [
      '#F0177A', '#10B981', '#F59E0B', '#1B6FEE',
      '#8B5CF6', '#06B6D4', '#EF4444', '#84CC16',
    ],
    backgroundColor: 'transparent',
    textStyle: {},
    title: {
      textStyle:    { color: tok('--text',   '#111110'), fontSize: 14, fontWeight: 'normal' },
      subtextStyle: { color: tok('--text-2', '#6B6860') },
    },
    legend: {
      textStyle: { color: tok('--text-2', '#6B6860') },
    },
    categoryAxis: {
      axisLine:  { lineStyle: { color: tok('--border', '#E4E2DF') } },
      axisLabel: { color: tok('--text-2', '#6B6860') },
      splitLine: { lineStyle: { color: tok('--border', '#E4E2DF'), type: 'dashed' } },
    },
    valueAxis: {
      axisLine:  { show: false },
      axisLabel: { color: tok('--text-2', '#6B6860') },
      splitLine: { lineStyle: { color: tok('--border', '#E4E2DF'), type: 'dashed' } },
    },
    tooltip: {
      backgroundColor: tok('--card-bg', '#fff'),
      borderColor:     tok('--border',  '#E4E2DF'),
      textStyle:       { color: tok('--text', '#111110') },
    },
  };
}

// ── Chart registry ─────────────────────────────────────────────────────────────
// Tracks charts created via renderEChart() for theme-change re-renders.
// Uses a mutable chartRef object so the ResizeObserver closure always targets
// the current chart instance even after a dispose + reinit cycle.
//
// el → { chartRef: { current }, options }

const chartRegistry = new Map();

// ── ECharts init patcher ──────────────────────────────────────────────────────
// Called once by viz-registry.js after echarts.min.js loads.
// Wraps window.echarts.init so that:
//   • Every init call re-registers 'loom' with freshly-resolved CSS colours.
//   • Charts get 'loom' by default when no theme is specified (covers inline
//     model scripts that call window.echarts.init() directly).
//   • All renderEChart-tracked charts re-render when data-theme changes.

export function initECharts() {
  const ec = window.echarts;
  if (!ec || ec.__loomPatched) return;
  ec.__loomPatched = true;

  const _init = ec.init.bind(ec);

  ec.init = function (el, theme, opts) {
    ec.registerTheme('loom', buildLoomTheme());
    return _init(el, theme || 'loom', opts);
  };

  // Re-render all registered charts when the site switches light ↔ dark.
  new MutationObserver(() => {
    chartRegistry.forEach(({ chartRef, options }, el) => {
      if (!document.contains(el))       { chartRegistry.delete(el); return; }
      if (chartRef.current?.isDisposed()) { chartRegistry.delete(el); return; }

      const merged = {
        ...CHART_DEFAULTS,
        ...options,
        grid: { ...CHART_DEFAULTS.grid, ...(options.grid || {}) },
      };

      chartRef.current.dispose();
      const newChart = ec.init(el, 'loom', { renderer: 'canvas' });
      newChart.setOption(merged);
      chartRef.current = newChart; // ResizeObserver closure now targets the new instance
    });
  }).observe(document.documentElement, {
    attributes:      true,
    attributeFilter: ['data-theme'],
  });
}

// ── Defaults ──────────────────────────────────────────────────────────────────
// Applied to every chart before per-chart options so individual charts can
// override them. containLabel ensures axis labels are never clipped.

const CHART_DEFAULTS = {
  grid: {
    top:          56,
    right:        24,
    bottom:       56,
    left:         24,
    containLabel: true,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise an ECharts instance on `el` with the given options.
 * Returns the initial chart instance; core.js stores this for scrolly updates,
 * but updateEChart always re-resolves via getInstanceByDom so it stays current.
 *
 * @param {HTMLElement} el
 * @param {object}      options  ECharts setOption-compatible config object
 * @returns {object|null}        ECharts instance or null
 */
export function renderEChart(el, options) {
  const ec = window.echarts;
  if (!ec) return null;

  // Dispose any previous instance on this element (idempotent re-render).
  const existing = ec.getInstanceByDom(el);
  if (existing) existing.dispose();

  const merged = {
    ...CHART_DEFAULTS,
    ...options,
    grid: { ...CHART_DEFAULTS.grid, ...(options.grid || {}) },
  };

  // ec.init is already patched by initECharts — theme is registered and 'loom' applied.
  const chart = ec.init(el, 'loom', { renderer: 'canvas' });
  chart.setOption(merged);

  // Mutable ref so the ResizeObserver closure stays correct after theme re-renders.
  const chartRef = { current: chart };
  chartRegistry.set(el, { chartRef, options });

  // Keep chart correctly sized when the container resizes.
  const resizeObs = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      if (chartRef.current && !chartRef.current.isDisposed()) chartRef.current.resize();
    });
  });
  resizeObs.observe(el);

  // Clean up when element is removed from DOM.
  const mo = new MutationObserver((_, obs) => {
    if (!document.contains(el)) {
      chartRef.current?.dispose();
      resizeObs.disconnect();
      obs.disconnect();
      chartRegistry.delete(el);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return chart;
}

/**
 * Update an ECharts instance in response to a scroll step.
 * Re-resolves the live chart via getInstanceByDom so scrolly updates work
 * correctly even after a theme-change dispose + reinit on this element.
 *
 * @param {HTMLElement} el
 * @param {object}      data      Partial ECharts setOption-compatible object.
 * @param {object|null} instance  Fallback instance (from renderEChart return value).
 */
export function updateEChart(el, data, instance) {
  const chart = window.echarts?.getInstanceByDom(el) ?? instance;
  if (chart && typeof chart.setOption === 'function') {
    chart.setOption(data, false); // false = merge, not replace
  }
}

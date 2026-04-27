/**
 * ricker.js — Interactive Ricker population model
 *
 * The Ricker map: x_{n+1} = x_n · exp( r · (1 − x_n) )
 * Produces periodic orbits and chaos depending on growth rate r.
 *
 * Requires ECharts (loaded by default.hbs when post tag "viz" is present).
 *
 * Declarative usage in posts:
 *   <div data-viz="ricker"></div>
 *
 * @module models/ricker
 */

import { renderEChart } from '../viz/echarts.js';

// ── Model ─────────────────────────────────────────────────────────────────────

/**
 * Iterate the Ricker map for `n` steps starting from `x0`.
 * @returns {number[]}
 */
function rickerSeries(r, x0, n) {
  const xs = new Array(n);
  xs[0] = x0;
  for (let i = 1; i < n; i++) {
    xs[i] = xs[i - 1] * Math.exp(r * (1 - xs[i - 1]));
  }
  return xs;
}

// ── Chart builders ────────────────────────────────────────────────────────────

function timeSeriesOptions(xs) {
  return {
    animation: false,
    title: { text: 'Time series', left: 0, top: 0, textStyle: { fontSize: 13, fontWeight: '500' } },
    grid: { top: 36, right: 16, bottom: 40, left: 56 },
    xAxis: { type: 'category', data: xs.map((_, i) => i), name: 'n', nameLocation: 'middle', nameGap: 28 },
    yAxis: { type: 'value', name: 'xₙ', nameLocation: 'middle', nameGap: 40, min: 0 },
    series: [{
      type: 'line',
      data: xs,
      showSymbol: xs.length <= 60,
      symbolSize: 4,
      lineStyle: { width: 1.5, color: '#F0177A' },
      itemStyle: { color: '#F0177A' },
    }],
    tooltip: { trigger: 'axis' },
  };
}

function phaseOptions(xs) {
  // Pairs (x_n, x_{n+1})
  const pairs = xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);

  // Ricker curve for reference: y = x·exp(r·(1−x)) over x ∈ [0, 2]
  // We don't have r here directly — skip the curve overlay for simplicity;
  // the 45° diagonal already conveys fixed-point information.
  const maxVal = Math.max(...xs, 1.5);
  const diagLine = [[0, 0], [maxVal, maxVal]];

  return {
    animation: false,
    title: { text: 'Phase plot', left: 0, top: 0, textStyle: { fontSize: 13, fontWeight: '500' } },
    grid: { top: 36, right: 16, bottom: 40, left: 56 },
    xAxis: { type: 'value', name: 'xₙ',   nameLocation: 'middle', nameGap: 28, min: 0 },
    yAxis: { type: 'value', name: 'xₙ₊₁', nameLocation: 'middle', nameGap: 40, min: 0 },
    series: [
      {
        type: 'line',
        data: diagLine,
        showSymbol: false,
        lineStyle: { type: 'dashed', color: '#888', width: 1 },
        z: 1,
        silent: true,
      },
      {
        type: 'scatter',
        data: pairs,
        symbolSize: pairs.length > 80 ? 3 : 5,
        itemStyle: { color: '#F0177A', opacity: 0.65 },
        z: 2,
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: ([, [x, y]]) => `xₙ = ${x.toFixed(4)}<br>xₙ₊₁ = ${y.toFixed(4)}`,
    },
  };
}

// ── Widget ────────────────────────────────────────────────────────────────────

/**
 * Mount an interactive Ricker model widget inside `el`.
 * @param {HTMLElement} el
 */
export function renderRicker(el) {
  el.innerHTML = `
    <div class="ricker-widget">
      <div class="ricker-controls">
        <label class="ricker-label">
          <span>Growth rate <em>r</em></span>
          <div class="ricker-slider-row">
            <input class="ricker-r" type="range" min="0" max="4" step="0.05" value="2.5">
            <strong class="ricker-r-val">2.50</strong>
          </div>
        </label>
        <label class="ricker-label">
          <span>Initial value <em>x</em>₀</span>
          <div class="ricker-slider-row">
            <input class="ricker-x0" type="range" min="0.01" max="0.99" step="0.01" value="0.1">
            <strong class="ricker-x0-val">0.10</strong>
          </div>
        </label>
        <label class="ricker-label">
          <span>Iterations <em>n</em></span>
          <div class="ricker-slider-row">
            <input class="ricker-n" type="range" min="10" max="300" step="5" value="80">
            <strong class="ricker-n-val">80</strong>
          </div>
        </label>
      </div>
      <div class="ricker-charts">
        <div class="ricker-timeseries"></div>
        <div class="ricker-phase"></div>
      </div>
    </div>`;

  const tsEl    = el.querySelector('.ricker-timeseries');
  const phEl    = el.querySelector('.ricker-phase');
  const rInput  = el.querySelector('.ricker-r');
  const x0Input = el.querySelector('.ricker-x0');
  const nInput  = el.querySelector('.ricker-n');
  const rVal    = el.querySelector('.ricker-r-val');
  const x0Val   = el.querySelector('.ricker-x0-val');
  const nVal    = el.querySelector('.ricker-n-val');

  let tsChart = null;
  let phChart = null;

  function update() {
    const r  = parseFloat(rInput.value);
    const x0 = parseFloat(x0Input.value);
    const n  = parseInt(nInput.value, 10);

    rVal.textContent  = r.toFixed(2);
    x0Val.textContent = x0.toFixed(2);
    nVal.textContent  = n;

    const xs = rickerSeries(r, x0, n);

    if (tsChart) {
      tsChart.setOption(timeSeriesOptions(xs));
    } else {
      tsChart = renderEChart(tsEl, timeSeriesOptions(xs));
    }

    if (phChart) {
      phChart.setOption(phaseOptions(xs));
    } else {
      phChart = renderEChart(phEl, phaseOptions(xs));
    }
  }

  rInput.addEventListener('input', update);
  x0Input.addEventListener('input', update);
  nInput.addEventListener('input', update);

  update();
}

// ── Scrollytelling variant ─────────────────────────────────────────────────────

/**
 * Step configs keyed by step index (or data-step value).
 * Step 0: stable fixed point  (r = 1.2)
 * Step 1: period-2 orbit      (r = 2.2)
 * Step 2: chaotic regime      (r = 3.0)
 * Falls back to step 0 for unknown step values.
 */
const SCROLLY_STEPS = [
  { r: 1.2, x0: 0.5, n: 80 },
  { r: 2.2, x0: 0.5, n: 80 },
  { r: 3.0, x0: 0.5, n: 80 },
];

/**
 * Render a Ricker widget driven by scroll-story steps.
 * No sliders — parameter changes are triggered by story:step events.
 *
 * Usage in posts:
 *   <div data-viz="ricker-scrolly"></div>
 *   (place inside a .story-graphic)
 *
 * @param {HTMLElement} el
 */
export function renderRickerScrolly(el) {
  el.innerHTML = `
    <div class="ricker-widget ricker-widget--scrolly">
      <div class="ricker-charts">
        <div class="ricker-timeseries"></div>
        <div class="ricker-phase"></div>
      </div>
    </div>`;

  const tsEl = el.querySelector('.ricker-timeseries');
  const phEl = el.querySelector('.ricker-phase');

  let tsChart = null;
  let phChart = null;

  function update(r, x0, n) {
    const xs = rickerSeries(r, x0, n);

    if (tsChart) {
      tsChart.setOption(timeSeriesOptions(xs));
    } else {
      tsChart = renderEChart(tsEl, timeSeriesOptions(xs));
    }

    if (phChart) {
      phChart.setOption(phaseOptions(xs));
    } else {
      phChart = renderEChart(phEl, phaseOptions(xs));
    }
  }

  // Initial state — step 0
  const { r: r0, x0: x00, n: n0 } = SCROLLY_STEPS[0];
  update(r0, x00, n0);

  // Listen for story step events dispatched by narrative.js
  const graphic = el.closest('.story-graphic');
  if (graphic) {
    graphic.addEventListener('story:step', ({ detail }) => {
      const stepKey = Number(detail.step ?? detail.index);
      const cfg = SCROLLY_STEPS[stepKey] ?? SCROLLY_STEPS[0];
      update(cfg.r, cfg.x0, cfg.n);
    });
  }
}

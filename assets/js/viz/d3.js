/**
 * d3.js — D3 chart adapter (selective import)
 *
 * Loads only the D3 submodules actually used, via a single esm.sh bundle:
 * select, scaleBand, scaleLinear, axisLeft, axisBottom, max, extent,
 * line, curveMonotoneX, forceSimulation, forceLink, forceManyBody,
 * forceCenter, drag, transition (~120 KB vs 560 KB for the full bundle).
 *
 * ── Built-in chart types ──────────────────────────────────────────────────────
 *
 *   bar    Horizontal bar chart.  data-options: {"data": [{label, value}]}
 *   line   Line chart.            data-options: {"data": [{x, value}]}
 *   force  Force-directed graph.  data-options: {"data": {"nodes":[{id}], "links":[{source,target}]}}
 *
 * ── Usage in posts ────────────────────────────────────────────────────────────
 *
 *   <div data-d3="bar" style="height:320px"
 *        data-options='{"data":[{"label":"Apples","value":42}]}'></div>
 *
 * ── Scrolly update ────────────────────────────────────────────────────────────
 *
 *   Give the element an id, then on each story step:
 *
 *   <div data-d3="bar" id="pop-chart" style="height:320px"
 *        data-options='{"data":[{"label":"1970","value":3.7}]}'></div>
 *
 *   <div class="story-step" data-step="1"
 *        data-update='{"pop-chart": {"data": [{"label":"1970","value":3.7},
 *                                             {"label":"2024","value":8.1}]}}'>
 *     Population growth…
 *   </div>
 *
 * ── Extending: registerD3Chart ────────────────────────────────────────────────
 *
 *   Add a custom chart type in a post HTML block or a separate JS file:
 *
 *   <script type="module">
 *     import { registerD3Chart } from '/assets/js/viz/d3.js';
 *
 *     registerD3Chart('scatter', (el, data, options) => {
 *       // Mount chart on el using window.d3 (set after first render).
 *       const svg = window.d3.select(el).append('svg') // …
 *       return {
 *         update(newData) { /* re-render with newData * / }
 *       };
 *     });
 *   </script>
 *
 *   <div data-d3="scatter" style="height:320px"
 *        data-options='{"data":[…]}'></div>
 *
 * @module viz/d3
 */

// ── Selective D3 loader ───────────────────────────────────────────────────────
// Single esm.sh bundle — only the D3 functions this adapter uses.
// window.d3 is also set for backwards-compat with custom registerD3Chart factories.

/* eslint-disable-next-line no-unused-vars */
let d3 = null;
let _loadPromise = null;

const D3_ESM_URL =
  'https://esm.sh/d3@7?bundle&exports=' +
  'select,scaleBand,scaleLinear,axisLeft,axisBottom,' +
  'max,extent,line,curveMonotoneX,' +
  'forceSimulation,forceLink,forceManyBody,forceCenter,' +
  'drag,transition';

async function loadD3() {
  if (d3) return d3;
  if (_loadPromise) return _loadPromise;
  _loadPromise = import(D3_ESM_URL).then((mod) => {
    d3 = mod;
    window.d3 = mod; // backwards compat for custom registerD3Chart factories
    return mod;
  });
  return _loadPromise;
}

// ── Chart registry ────────────────────────────────────────────────────────────

const D3_CHARTS = new Map();

/**
 * Register a D3 chart factory under a name.
 *
 * @param {string}   name     Matches data-d3="name" on elements.
 * @param {Function} factory  (el, data, options) → { update(newData) }
 */
export function registerD3Chart(name, factory) {
  D3_CHARTS.set(name, factory);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSize(el) {
  const { width, height } = el.getBoundingClientRect();
  return { width: width || 640, height: height || 320 };
}

function makeSvg(el, margin) {
  const { width, height } = getSize(el);

  el.innerHTML = '';

  const svg = d3
    .select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-hidden', 'true');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return {
    svg,
    g,
    width,
    height,
    innerW: width  - margin.left - margin.right,
    innerH: height - margin.top  - margin.bottom,
  };
}

// ── Built-in: horizontal bar chart ───────────────────────────────────────────

function barChart(el, data, options) {
  if (!Array.isArray(data)) return { update() {} };

  const margin = { top: 16, right: 24, bottom: 40, left: 120 };
  const { g, innerW, innerH } = makeSvg(el, margin);
  const color = options.color ?? '#F0177A';

  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, innerH])
    .padding(0.28);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) ?? 1])
    .nice()
    .range([0, innerW]);

  // Axes
  g.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5))
    .select('.domain')
    .remove();

  // Bars
  const bars = g
    .selectAll('rect')
    .data(data, (d) => d.label)
    .join('rect')
    .attr('x', 0)
    .attr('y', (d) => y(d.label))
    .attr('height', y.bandwidth())
    .attr('width', (d) => x(d.value))
    .attr('fill', color)
    .attr('rx', 3);

  // Value labels
  const labels = g
    .selectAll('.bar-label')
    .data(data, (d) => d.label)
    .join('text')
    .attr('class', 'bar-label')
    .attr('x', (d) => x(d.value) + 6)
    .attr('y', (d) => y(d.label) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('font-size', 12)
    .attr('fill', 'var(--text-2, #6B6860)')
    .text((d) => d.value);

  function update(newData) {
    if (!Array.isArray(newData)) return;
    y.domain(newData.map((d) => d.label));
    x.domain([0, d3.max(newData, (d) => d.value) ?? 1]).nice();

    bars
      .data(newData, (d) => d.label)
      .join('rect')
      .transition()
      .duration(600)
      .attr('y', (d) => y(d.label))
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.value))
      .attr('fill', color)
      .attr('rx', 3);

    labels
      .data(newData, (d) => d.label)
      .join('text')
      .attr('class', 'bar-label')
      .transition()
      .duration(600)
      .attr('x', (d) => x(d.value) + 6)
      .attr('y', (d) => y(d.label) + y.bandwidth() / 2)
      .text((d) => d.value);
  }

  return { update };
}

// ── Built-in: line chart ──────────────────────────────────────────────────────

function lineChart(el, data, options) {
  if (!Array.isArray(data)) return { update() {} };

  const margin = { top: 16, right: 24, bottom: 40, left: 52 };
  const { g, innerW, innerH } = makeSvg(el, margin);
  const color = options.color ?? '#F0177A';

  const xExt = d3.extent(data, (d) => d.x);
  const x = d3.scaleLinear().domain(xExt).range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) ?? 1])
    .nice()
    .range([innerH, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5))
    .select('.domain')
    .remove();

  g.append('g').call(d3.axisLeft(y).ticks(5)).select('.domain').remove();

  const lineGen = d3
    .line()
    .x((d) => x(d.x))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const path = g
    .append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 2.5)
    .attr('d', lineGen);

  function update(newData) {
    if (!Array.isArray(newData)) return;
    x.domain(d3.extent(newData, (d) => d.x));
    y.domain([0, d3.max(newData, (d) => d.value) ?? 1]).nice();
    path.datum(newData).transition().duration(600).attr('d', lineGen);
  }

  return { update };
}

// ── Built-in: force-directed graph ───────────────────────────────────────────

function forceGraph(el, data, options) {
  if (!data?.nodes) return { update() {} };

  const { width, height } = getSize(el);
  el.innerHTML = '';

  const nodes = data.nodes.map((nd) => ({ ...nd }));
  const links = (data.links ?? []).map((lk) => ({ ...lk }));
  const color = options.color ?? '#F0177A';

  const svg = d3
    .select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-hidden', 'true');

  const linkEl = svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'var(--border, #ccc)')
    .attr('stroke-width', 1.5);

  const nodeEl = svg
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 7)
    .attr('fill', color)
    .call(
      d3
        .drag()
        .on('start', (event, nd) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          nd.fx = nd.x;
          nd.fy = nd.y;
        })
        .on('drag', (event, nd) => {
          nd.fx = event.x;
          nd.fy = event.y;
        })
        .on('end', (event, nd) => {
          if (!event.active) sim.alphaTarget(0);
          nd.fx = null;
          nd.fy = null;
        }),
    );

  nodeEl.append('title').text((nd) => nd.id);

  const sim = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((nd) => nd.id).distance(60))
    .force('charge', d3.forceManyBody().strength(-100))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', () => {
      linkEl
        .attr('x1', (lk) => lk.source.x)
        .attr('y1', (lk) => lk.source.y)
        .attr('x2', (lk) => lk.target.x)
        .attr('y2', (lk) => lk.target.y);
      nodeEl.attr('cx', (nd) => nd.x).attr('cy', (nd) => nd.y);
    });

  // Force graphs are re-mounted on update, not incrementally updated
  return { update() {} };
}

// ── Register built-ins ────────────────────────────────────────────────────────

registerD3Chart('bar',   barChart);
registerD3Chart('line',  lineChart);
registerD3Chart('force', forceGraph);

// ── Public render / update ────────────────────────────────────────────────────

/**
 * Mount a D3 chart on `el`. Loads the D3 subset on first call.
 *
 * @param {HTMLElement} el
 * @param {object}      [options]  Merged into data-options JSON.
 * @returns {Promise<{ chart: object } | null>}
 */
export async function renderD3(el, options = {}) {
  await loadD3(); // ensures d3 module-level var is set before chart functions run

  const type = el.dataset.d3;
  const factory = D3_CHARTS.get(type);

  if (!factory) {
    console.warn(
      `[loom/d3] Unknown chart type: "${type}". ` +
        `Register it with registerD3Chart() or use: bar, line, force.`,
    );
    return null;
  }

  let parsed = {};
  try {
    if (el.dataset.options) parsed = JSON.parse(el.dataset.options);
  } catch (err) {
    console.warn('[loom/d3] Invalid data-options JSON', err);
  }

  const merged = { ...options, ...parsed };
  const { data, ...opts } = merged;

  const chart = factory(el, data ?? [], opts);

  // Re-render when the container is resized (e.g. window resize, layout shift)
  if (typeof ResizeObserver !== 'undefined') {
    let resizeTimer;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const newInstance = factory(el, data ?? [], opts);
        Object.assign(chart, newInstance); // update in-place so scrolly refs stay valid
      }, 150);
    });
    ro.observe(el);
  }

  return { chart };
}

/**
 * Update a D3 chart in response to a scroll step.
 *
 * @param {HTMLElement}       el
 * @param {object}            data      Keys: data (array), or other chart-specific keys.
 * @param {{ chart: object }} instance  Returned by renderD3().
 */
export function updateD3(el, data, instance) {
  instance?.chart?.update(data.data ?? data);
}

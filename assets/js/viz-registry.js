/**
 * viz-registry.js — Central visualization library registry
 *
 * Each entry describes one library: how to detect if it's needed, what CDN
 * assets to load, how to initialise, and how to render individual elements
 * or update them in response to Scrollama story steps.
 *
 * ── Adapter interface (element-level renderers) ────────────────────────────
 *   render(el, options) → instance
 *     Mount viz on `el`; return an opaque instance for later updates.
 *   update(el, data, instance)
 *     Apply incremental data change triggered by a scroll step.
 *
 * ── Adding a new library ───────────────────────────────────────────────────
 *   1. Create  assets/js/viz/your-lib.js  — export init(), render(), update()
 *   2. Import it here and add an entry to REGISTRY below.
 *   3. If you need a body-class flag, add it in _layouts/default.html.
 *   4. Add the tag in post front matter:  your-lib: true
 *
 * ── Scrolly data-update API ───────────────────────────────────────────────
 *   Give each viz element an id, then put data-update JSON on each story step:
 *
 *   <div data-leaflet id="city-map" …></div>
 *
 *   <div class="story-step" data-step="1"
 *        data-update='{"city-map": {"lat": 48.858, "lng": 2.295, "zoom": 14}}'>
 *     Paris…
 *   </div>
 *
 *   core.js routes each key → the matching entry's update() function.
 */

import { initMath }                          from './viz/math.js';
import { initDiagrams }                      from './viz/diagrams.js';
import { initECharts, renderEChart, updateEChart } from './viz/echarts.js';
import { renderMap, updateMap }              from './viz/mapbox.js';
import { renderLeaflet, updateLeaflet }      from './viz/leaflet.js';
import { renderD3, updateD3 }                from './viz/d3.js';
import { renderRicker, renderRickerScrolly } from './models/ricker.js';
import { renderOilShock }                   from './models/oil-shock.js';
import { initPyodide, renderPyodideCell }    from './viz/pyodide.js';

// ── ECharts element router ────────────────────────────────────────────────────
// [data-viz] elements: route to a named renderer or fall back to generic ECharts.

const ECHARTS_RENDERERS = {
  ricker:           renderRicker,
  'ricker-scrolly': renderRickerScrolly,
  'oil-shock':      renderOilShock,
};

function renderEChartsEl(el, options) {
  const named = ECHARTS_RENDERERS[el.dataset.viz];
  if (named) return named(el, options);
  return renderEChart(el, options ?? {});
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const REGISTRY = [

  // ── KaTeX (inline and display mathematics) ─────────────────────────────────
  //   Front matter: math: true  →  body class tag-hash-math
  //   Also auto-detected from .math-* elements or display-math $$ delimiters.
  //   NOTE: Single $ is intentionally NOT auto-detected — it triggers falsely
  //   on currency values (e.g. "$50 billion"). Use math: true in front matter
  //   for any post with LaTeX, or $$...$$ display math will trigger it.
  {
    id: 'math',
    detect: (content) =>
      document.body.classList.contains('tag-hash-math') ||
      !!document.querySelector('.math, .math-inline, .math-display') ||
      !!(content?.textContent.includes('$$')),
    cdn: {
      styles:  ['https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css'],
      scripts: [
        'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js',
        'https://cdn.jsdelivr.net/npm/katex@0.16/dist/contrib/auto-render.min.js',
      ],
    },
    init:     initMath,
    selector: null,   // init handles all rendering — no per-element API
    render:   null,
    update:   null,
  },

  // ── Mermaid (flowcharts, sequence diagrams, class diagrams, Gantt …) ────────
  //   Front matter: diagram: true  →  body class tag-hash-diagram
  //   Also auto-detected from .mermaid elements and code.language-mermaid blocks.
  {
    id: 'diagrams',
    detect: () =>
      document.body.classList.contains('tag-hash-diagram') ||
      !!document.querySelector('.mermaid, code.language-mermaid'),
    cdn: {
      styles:  [],
      scripts: ['https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'],
    },
    init:     initDiagrams,
    selector: null,
    render:   null,
    update:   null,
  },

  // ── ECharts (charts + Ricker model) ──────────────────────────────────────────
  //   Front matter: viz: true  →  body class tag-hash-viz
  //   Also auto-detected from [data-viz] elements.
  //
  //   Markup:
  //     Generic chart:    <div data-viz="echarts" data-options='{ ECharts option JSON }'></div>
  //     Ricker widget:    <div data-viz="ricker"></div>
  //     Ricker scrolly:   <div data-viz="ricker-scrolly"></div>
  //
  //   Scrolly update (for generic echarts elements only):
  //     data-update='{"chart-id": { ECharts setOption-compatible partial }}'
  {
    id: 'echarts',
    detect: () =>
      document.body.classList.contains('tag-hash-viz') ||
      !!document.querySelector('[data-viz]'),
    cdn: {
      styles:  [],
      scripts: ['https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js'],
    },
    init:     initECharts,
    selector: '[data-viz]',
    render:   renderEChartsEl,
    update:   updateEChart,
  },

  // ── ECharts GL (3D charts — scatter3D, bar3D, surface, globe) ─────────────
  //   Front matter: gl: true  →  body class tag-hash-gl
  //   MUST come after the echarts entry so echarts.min.js loads first.
  //   No selector/render — GL extends the global echarts object; inline scripts
  //   using scatter3D, grid3D, etc. work automatically once this loads.
  //
  //   Usage: add gl: true to front matter alongside viz: true.
  {
    id: 'echarts-gl',
    detect: () => document.body.classList.contains('tag-hash-gl'),
    cdn: {
      styles:  [],
      scripts: ['https://cdn.jsdelivr.net/npm/echarts-gl@2/dist/echarts-gl.min.js'],
    },
    init:     () => { window.__echartsGL = true; },
    selector: null,
    render:   null,
    update:   null,
  },

  // ── Leaflet (interactive maps, no API key required) ───────────────────────────
  //   Front matter: leaflet: true  →  body class tag-hash-leaflet
  //   Also auto-detected from [data-leaflet] elements.
  //
  //   Markup:
  //     <div data-leaflet id="my-map" style="height:400px"
  //          data-lat="51.505" data-lng="-0.09" data-zoom="13"
  //          data-tiles="carto"></div>
  //
  //   Scrolly update:
  //     data-update='{"my-map": {"lat": 48.858, "lng": 2.295, "zoom": 15}}'
  //
  //   Tile presets: osm (default), carto, carto-dark, stadia
  //   Markers: data-markers='[{"lat":51.5,"lng":-0.09,"label":"Hello"}]'
  {
    id: 'leaflet',
    detect: () =>
      document.body.classList.contains('tag-hash-leaflet') ||
      !!document.querySelector('[data-leaflet]'),
    cdn: {
      styles:  ['https://unpkg.com/leaflet@1.9/dist/leaflet.css'],
      scripts: ['https://unpkg.com/leaflet@1.9/dist/leaflet.js'],
    },
    init:     null,
    selector: '[data-leaflet]',
    render:   renderLeaflet,
    update:   updateLeaflet,
  },

  // ── D3 (custom charts via built-in types or registerD3Chart) ──────────────────
  //   Front matter: d3: true  →  body class tag-hash-d3
  //   Also auto-detected from [data-d3] elements.
  //
  //   Built-in types: bar, line, force
  //
  //   Markup:
  //     <div data-d3="bar" style="height:320px"
  //          data-options='{"data":[{"label":"A","value":10}]}'></div>
  //
  //   Scrolly update:
  //     data-update='{"chart-id": {"data": [{"label":"A","value":30}]}}'
  //
  //   Custom type (in a post HTML block or loaded JS file):
  //     import { registerD3Chart } from '/assets/js/viz/d3.js';
  //     registerD3Chart('scatter', (el, data, opts) => {
  //       // mount chart on el, return { update(newData) {} }
  //     });
  //     <div data-d3="scatter" data-options='{"data": [...]}'></div>
  {
    id: 'd3',
    detect: () =>
      document.body.classList.contains('tag-hash-d3') ||
      !!document.querySelector('[data-d3]'),
    cdn: {
      styles:  [],
      scripts: [], // D3 is loaded selectively by viz/d3.js via esm.sh (~120 KB vs 560 KB)
    },
    init:     null,
    selector: '[data-d3]',
    render:   renderD3,   // async — core.js awaits it
    update:   updateD3,
  },

  // ── Mapbox GL (full-featured maps — requires API token) ───────────────────────
  //   Front matter: geo: true  →  body class tag-hash-geo
  //   Also auto-detected from [data-map] elements.
  //   Token: set window.MAPBOX_TOKEN or data-token="pk.…" on the element.
  //   Note: for token-free maps use Leaflet above.
  {
    id: 'mapbox',
    detect: () =>
      document.body.classList.contains('tag-hash-geo') ||
      !!document.querySelector('[data-map]'),
    cdn: {
      styles:  ['https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css'],
      scripts: ['https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js'],
    },
    init:     null,
    selector: '[data-map]',
    render:   (el) => renderMap(el, {}),
    update:   (el, data, instance) => updateMap(el, data, instance),
  },

  // ── Pyodide (Python-in-WebAssembly, interactive cells) ───────────────────────
  //   Front matter: pyodide: true  →  body class tag-hash-pyodide
  //   Also auto-detected from .pyodide-cell elements.
  //
  //   MUST be last in registry — Pyodide is ~8 MB from CDN; placing it last
  //   ensures all other viz adapters render before this heavyweight load begins.
  //
  //   Authoring (in .qmd or raw Markdown):
  //     ::: {.pyodide-cell}
  //     ```python
  //     import numpy as np
  //     print(np.exp(-1.5))
  //     ```
  //     :::
  //
  //   Constraints: numpy pre-loaded; no file I/O; cells are stateless per run.
  {
    id: 'pyodide',
    detect: () =>
      document.body.classList.contains('tag-hash-pyodide') ||
      !!document.querySelector('.pyodide-cell'),
    cdn: { styles: [], scripts: [] },  // CDN loaded by initPyodide() via dynamic import
    init:     initPyodide,
    selector: '.pyodide-cell',
    render:   renderPyodideCell,
    update:   null,
  },

];

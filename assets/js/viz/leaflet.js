/**
 * leaflet.js — Leaflet interactive map adapter
 *
 * Requires Leaflet CSS + JS to be loaded via CDN (handled by core.js
 * when [data-leaflet] elements or body class tag-hash-leaflet are detected).
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   <div data-leaflet style="height:400px"
 *        data-lat="51.505" data-lng="-0.09" data-zoom="13"></div>
 *
 * ── With a named tile preset ──────────────────────────────────────────────────
 *
 *   <div data-leaflet style="height:400px"
 *        data-lat="48.858" data-lng="2.295" data-zoom="12"
 *        data-tiles="carto"></div>
 *
 * ── With markers ──────────────────────────────────────────────────────────────
 *
 *   <div data-leaflet style="height:400px"
 *        data-lat="51.505" data-lng="-0.09" data-zoom="13"
 *        data-markers='[{"lat":51.505,"lng":-0.09,"label":"Here"}]'></div>
 *
 * ── Scrolly flyTo ─────────────────────────────────────────────────────────────
 *
 *   Give the element an id, then use data-update on story steps:
 *
 *   <div data-leaflet id="city-map" style="height:100%" …></div>
 *
 *   <div class="story-step" data-step="1"
 *        data-update='{"city-map": {"lat": 48.858, "lng": 2.295, "zoom": 15}}'>
 *     Paris…
 *   </div>
 *
 * @module viz/leaflet
 */

// ── Tile layer presets ────────────────────────────────────────────────────────
// Add entries here to give post authors short named tile styles.

const TILE_PRESETS = {
  // OpenStreetMap — no key required, global coverage
  osm: {
    url:     'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  // CartoDB Positron — minimal light style, free
  carto: {
    url:     'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attr:    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  // CartoDB Dark Matter
  'carto-dark': {
    url:     'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr:    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  // Stadia Alidade Smooth
  stadia: {
    url:     'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    attr:    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20,
  },
};

// ── Overlay tile presets ──────────────────────────────────────────────────────
// Added as a second layer on top of the base tile layer.
// Activated by data-overlay="preset-name" on the [data-leaflet] element.

const OVERLAY_PRESETS = {
  // ESA WorldCover 2021 — 10 m global land cover classification, free via Terrascope
  worldcover: {
    url:     'https://services.terrascope.be/wmts/v2?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=WORLDCOVER_2021_MAP&STYLE=&FORMAT=image/png&TileMatrixSet=EPSG:3857&TileMatrix=EPSG:3857:{z}&TileRow={y}&TileCol={x}',
    attr:    '&copy; <a href="https://esa-worldcover.org/">ESA WorldCover 2021</a> / Terrascope',
    maxZoom: 13,
    opacity: 0.85,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Mount a Leaflet map on `el`.
 *
 * Reads config from data-* attributes; `options` can override any attribute.
 *
 * @param {HTMLElement} el
 * @param {object}      [options]  Merged with defaults; overrides data-* attrs.
 * @returns {{ map: L.Map } | null}
 */
export function renderLeaflet(el, options = {}) {
  const L = window.L;
  if (!L) return null;

  const lat     = Number(el.dataset.lat    ?? options.lat    ?? 51.505);
  const lng     = Number(el.dataset.lng    ?? options.lng    ?? -0.09);
  const zoom    = Number(el.dataset.zoom   ?? options.zoom   ?? 13);
  const tileKey = el.dataset.tiles ?? options.tiles ?? 'osm';
  const preset  = TILE_PRESETS[tileKey] ?? TILE_PRESETS.osm;

  const map = L.map(el, { zoomControl: true }).setView([lat, lng], zoom);

  L.tileLayer(preset.url, {
    attribution: preset.attr,
    maxZoom:     preset.maxZoom,
  }).addTo(map);

  // Leaflet tiles won't render if the container has 0 dimensions at init
  // time, or if the container size changes after init (e.g. sticky layout).
  // invalidateSize() forces a recalculation once the DOM has settled.
  setTimeout(() => map.invalidateSize(), 0);

  // Optional markers from data-markers JSON: [{lat, lng, label?}]
  if (el.dataset.markers) {
    try {
      const markers = JSON.parse(el.dataset.markers);
      markers.forEach(({ lat: mlat, lng: mlng, label }) => {
        const m = L.marker([mlat, mlng]).addTo(map);
        if (label) m.bindPopup(label);
      });
    } catch (err) {
      console.warn('[loom/leaflet] Invalid data-markers JSON', err);
    }
  }

  // Swap tile layer when dark mode is toggled
  const darkPresetKey = el.dataset.tilesDark ?? (tileKey === 'carto' ? 'carto-dark' : tileKey);
  const darkPreset = TILE_PRESETS[darkPresetKey] ?? preset;

  let currentLayer = null;

  function applyTheme(isDark) {
    if (currentLayer) map.removeLayer(currentLayer);
    const p = isDark ? darkPreset : preset;
    currentLayer = L.tileLayer(p.url, { attribution: p.attr, maxZoom: p.maxZoom }).addTo(map);
  }

  // Replace the initial tile layer with a theme-aware one
  map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
  applyTheme(document.documentElement.dataset.theme === 'dark');

  // Optional overlay layer (e.g. land cover classification) via data-overlay
  const overlayKey = el.dataset.overlay ?? options.overlay;
  if (overlayKey && OVERLAY_PRESETS[overlayKey]) {
    const op = OVERLAY_PRESETS[overlayKey];
    L.tileLayer(op.url, {
      attribution: op.attr,
      maxZoom:     op.maxZoom,
      opacity:     op.opacity ?? 1,
    }).addTo(map);
  }

  // Watch for theme changes
  const themeObserver = new MutationObserver(() => {
    applyTheme(document.documentElement.dataset.theme === 'dark');
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Expose map instance on element so inline essay scripts can access it,
  // and fire a ready event (bubbles so it can be caught from any ancestor).
  el._leafletMap = map;
  el.dispatchEvent(new CustomEvent('leaflet:ready', { bubbles: true, detail: { map } }));

  return { map };
}

/**
 * Update a Leaflet map instance in response to a scroll step.
 *
 * Called by core.js when a story step with data-update targets this element.
 *
 * @param {HTMLElement}       el
 * @param {object}            data      Keys: lat, lng, zoom, animate (default true)
 * @param {{ map: L.Map }}    instance  Returned by renderLeaflet()
 */
export function updateLeaflet(el, data, instance) {
  if (!instance?.map) return;
  const { lat, lng, zoom, animate = true } = data;

  if (lat != null && lng != null) {
    instance.map.flyTo([lat, lng], zoom ?? instance.map.getZoom(), {
      duration: animate ? 1.5 : 0,
    });
  } else if (zoom != null) {
    instance.map.setZoom(zoom, { animate });
  }
}

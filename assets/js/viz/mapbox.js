/**
 * mapbox.js — Geo map adapter (Leaflet-backed, token-free)
 *
 * Replaces the former Mapbox GL JS adapter. Accepts the same declarative
 * data-* attributes as the old Mapbox version so no essay HTML needs to
 * change — only the rendering engine has swapped to Leaflet + CartoDB tiles.
 *
 * ── Declarative usage (unchanged from prior Mapbox version) ─────────────────
 *
 *   Standalone map:
 *     <div data-map="custom" id="my-map" style="height:500px"
 *          data-center="-114.07, 51.04"
 *          data-zoom="10"></div>
 *
 *   With GeoJSON overlay layers:
 *     <div data-map="custom" id="my-map" style="height:500px"
 *          data-center="-114.07, 51.04"
 *          data-zoom="8"
 *          data-geojson='{ GeoJSON FeatureCollection }'></div>
 *
 *   With dot markers:
 *     <div data-map="custom" id="my-map" style="height:500px"
 *          data-center="-114.07, 51.04"
 *          data-zoom="8"
 *          data-markers='[{"lng":-114.07,"lat":51.04,"label":"Calgary","color":"#ef4444"}]'>
 *     </div>
 *
 * ── Coordinate convention (Mapbox legacy, preserved) ────────────────────────
 *
 *   data-center is "lng, lat" (Mapbox order).
 *   data-update center arrays are [lng, lat] (Mapbox order).
 *   This module converts to Leaflet's [lat, lng] order internally.
 *   Essays don't need to change.
 *
 * ── data-style is silently ignored ──────────────────────────────────────────
 *
 *   Mapbox style URLs are not applicable to Leaflet. CartoDB Positron (a
 *   clean light raster basemap) is used for all maps. Use data-tiles on a
 *   [data-leaflet] element if you need a different tile preset.
 *
 * ── Scrolly usage (data-update, unchanged) ──────────────────────────────────
 *
 *   <div class="story-step" data-step="1"
 *        data-update='{"my-map": {"center": [-114.07, 51.04], "zoom": 12}}'>
 *     …
 *   </div>
 *
 *   Layer visibility toggling via the layers key:
 *     data-update='{"my-map": {"center": [-114.07, 51.04], "zoom": 10,
 *                              "layers": {"flood-zone": true, "watershed": false}}}'
 *
 * @module viz/mapbox
 */

// ── Named location presets (center is [lng, lat] to match Mapbox convention) ─

const PRESETS = {
  calgary:   { center: [-114.0719,  51.0447], zoom: 11 },
  edmonton:  { center: [-113.4938,  53.5461], zoom: 11 },
  vancouver: { center: [-123.1207,  49.2827], zoom: 11 },
  toronto:   { center: [ -79.3832,  43.6532], zoom: 11 },
  world:     { center: [   0,       20     ], zoom:  2  },
  zermatt:   { center: [   7.7491,  46.0207], zoom: 13 },
  findelen:  { center: [   7.840,   46.012 ], zoom: 13 },
  gorner:    { center: [   7.820,   45.970 ], zoom: 12 },
  chamonix:  { center: [   6.869,   45.924 ], zoom: 12 },
  peyto:     { center: [-116.530,   51.715 ], zoom: 13 },
  athabasca: { center: [-117.245,   52.190 ], zoom: 12 },
};

// ── Tile layer ────────────────────────────────────────────────────────────────
// CartoDB Positron: clean light style, globally available, no token required.

const TILE_URL  = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
                  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a "lng, lat" string (Mapbox convention) and return [lng, lat].
 * Returns null if the string is missing or invalid.
 */
function parseLngLat(str) {
  if (!str) return null;
  const parts = str.split(',').map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts; // [lng, lat]
  return null;
}

/**
 * Build Leaflet path options from GeoJSON feature properties.
 * Mirrors the styling conventions used by the former Mapbox adapter.
 */
function buildPathOptions(p, geomType) {
  const type = geomType ?? '';

  if (type === 'Polygon' || type === 'MultiPolygon') {
    return {
      fillColor:   p.color ?? '#3b82f6',
      fillOpacity: p.opacity ?? 0.3,
      color:       p['outline-color'] ?? p.color ?? '#3b82f6',
      weight:      p.width ?? 2,
      opacity:     Math.min((p.opacity ?? 0.3) * 2.5, 1),
    };
  }

  if (type === 'LineString' || type === 'MultiLineString') {
    const opts = {
      color:   p.color ?? '#3b82f6',
      weight:  p.width ?? 2,
      opacity: p.opacity ?? 0.85,
    };
    if (p.dash) {
      opts.dashArray = Array.isArray(p.dash) ? p.dash.join(' ') : String(p.dash);
    }
    return opts;
  }

  // Point / MultiPoint — used by pointToLayer below
  return {};
}

/**
 * Create a Leaflet layer for a single GeoJSON feature. Returns the layer but
 * does NOT add it to the map — visibility is controlled by the caller.
 */
function makeFeatureLayer(L, feature) {
  const p        = feature.properties ?? {};
  const geomType = feature.geometry?.type ?? '';
  const style    = buildPathOptions(p, geomType);

  const opts = {};

  if (geomType === 'Point' || geomType === 'MultiPoint') {
    opts.pointToLayer = (f, latlng) => L.circleMarker(latlng, {
      radius:      p.radius ?? 6,
      fillColor:   p.color  ?? '#3b82f6',
      color:       '#ffffff',
      weight:      1.5,
      fillOpacity: p.opacity ?? 0.8,
      opacity:     1,
    });
  } else {
    opts.style = () => style;
  }

  return L.geoJSON(feature, opts);
}

/**
 * Add dot markers from a JSON array [{lng, lat, label?, color?}].
 * Mirrors the former Mapbox addMapboxMarkers() helper.
 */
function addMarkers(L, map, markersStr) {
  let markers;
  try { markers = JSON.parse(markersStr); } catch (err) {
    console.warn('[wh/geo] Invalid data-markers JSON:', err);
    return;
  }

  markers.forEach(({ lng, lat, label, color = '#ef4444' }) => {
    const marker = L.circleMarker([lat, lng], {
      radius:      6,
      fillColor:   color,
      color:       '#ffffff',
      weight:      2,
      fillOpacity: 1,
      opacity:     1,
    }).addTo(map);

    if (label) {
      marker.bindTooltip(label, {
        permanent:  false,
        direction:  'top',
        offset:     [0, -8],
        className:  'wh-map-tooltip',
      });
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise a Leaflet map inside `el`, accepting the same data-* attributes
 * as the former Mapbox GL JS adapter.
 *
 * @param {HTMLElement} el
 * @param {object}      [config]  Optional overrides: { center, zoom }
 * @returns {{ map: L.Map, namedLayers: Object } | null}
 */
export function renderMap(el, config = {}) {
  const L = window.L;
  if (!L) return null;

  // Ensure the container has a height
  if (!el.style.height && el.offsetHeight === 0) {
    el.style.height = '400px';
  }

  // Resolve center — data-center is "lng, lat" (Mapbox order)
  const locationKey = el.dataset.map;
  const preset      = PRESETS[locationKey] ?? {};

  const lngLat =
    parseLngLat(el.dataset.center) ??
    (config.center ? config.center : null) ??
    preset.center ??
    [0, 20];

  const [lng, lat] = lngLat;  // Mapbox order → Leaflet needs [lat, lng]

  const zoom =
    (el.dataset.zoom ? parseFloat(el.dataset.zoom) : null) ??
    config.zoom ??
    preset.zoom ??
    2;

  // ── Create map ─────────────────────────────────────────────────────────────
  const map = L.map(el, {
    zoomControl:       true,
    attributionControl: true,
    scrollWheelZoom:   false,  // avoid hijacking page scroll in essays
  }).setView([lat, lng], zoom);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 20 }).addTo(map);

  // Leaflet tiles won't render if the container has zero size at init time.
  setTimeout(() => map.invalidateSize(), 0);

  // ── Named GeoJSON layers ───────────────────────────────────────────────────
  // Each Feature with a properties.id becomes an individually togglable layer.
  const namedLayers = {};

  if (el.dataset.geojson) {
    let fc;
    try { fc = JSON.parse(el.dataset.geojson); } catch (err) {
      console.warn('[wh/geo] Invalid data-geojson:', err);
    }

    if (fc && Array.isArray(fc.features)) {
      fc.features.forEach((feature) => {
        const id = feature.properties?.id;
        if (!id) return;

        const layer = makeFeatureLayer(L, feature);
        namedLayers[id] = layer;

        // Start visible unless properties.visible === false
        if (feature.properties?.visible !== false) {
          layer.addTo(map);
        }
      });
    }
  }

  // ── Dot markers ────────────────────────────────────────────────────────────
  if (el.dataset.markers) addMarkers(L, map, el.dataset.markers);

  // ── Keep map sized on container resize ─────────────────────────────────────
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => map.invalidateSize()).observe(el);
  }

  // ── Expose and signal ready ────────────────────────────────────────────────
  el._map         = map;
  el._namedLayers = namedLayers;

  el.dispatchEvent(new CustomEvent('map:ready', {
    bubbles: true,
    detail:  { map, namedLayers },
  }));

  return { map, namedLayers };
}

/**
 * Update the map in response to a Scrollama story step.
 *
 * @param {HTMLElement}                      el
 * @param {object}                           data
 *   center   — [lng, lat] array (Mapbox order) — converted to Leaflet [lat, lng]
 *   zoom     — target zoom level
 *   animate  — boolean, default true
 *   layers   — { "layer-id": true/false } visibility map
 * @param {{ map: L.Map, namedLayers: object }} instance
 */
export function updateMap(el, data, instance) {
  if (!instance?.map) return;

  const { center, zoom, animate = true, layers } = data;

  // Camera transition — center is [lng, lat] (Mapbox convention), swap for Leaflet
  if (center != null) {
    const [cLng, cLat] = center;
    instance.map.flyTo(
      [cLat, cLng],
      zoom ?? instance.map.getZoom(),
      { duration: animate ? 1.5 : 0, animate }
    );
  } else if (zoom != null) {
    instance.map.setZoom(zoom, { animate });
  }

  // Layer visibility toggling
  if (layers && instance.namedLayers) {
    Object.entries(layers).forEach(([id, visible]) => {
      const layer = instance.namedLayers[id];
      if (!layer) return;

      if (visible === true || visible === 'visible') {
        if (!instance.map.hasLayer(layer)) layer.addTo(instance.map);
      } else {
        if (instance.map.hasLayer(layer)) instance.map.removeLayer(layer);
      }
    });
  }
}

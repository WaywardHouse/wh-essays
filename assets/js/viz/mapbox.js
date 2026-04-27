/**
 * mapbox.js — Mapbox GL JS wrapper
 *
 * Requires mapbox-gl.js and mapbox-gl.css (loaded from Mapbox CDN by the viz
 * registry when a page has geo: true front matter or a [data-map] element).
 *
 * Declarative usage in posts:
 *   <div data-map="calgary" style="height:500px;"></div>
 *   <div data-map="custom" data-center="-113.5,51.0" data-zoom="10" style="height:400px;"></div>
 *   <div data-map="custom" data-center="7.82,45.97" data-zoom="13"
 *        data-pitch="55" data-bearing="170"
 *        data-terrain="1.5"
 *        data-style="mapbox://styles/mapbox/satellite-streets-v12"
 *        style="height:500px;"></div>
 *
 * Access token (in order of precedence):
 *   1. data-token attribute on the element
 *   2. window.MAPBOX_TOKEN (injected by head.html from site.mapbox_token in _config.yml)
 *
 * 3D terrain:
 *   data-terrain        — enable terrain with default exaggeration (1.5)
 *   data-terrain="2.0"  — enable terrain with custom exaggeration
 *   Adds Mapbox DEM source, setTerrain(), and an atmosphere sky layer.
 *   Best combined with data-pitch > 0 and satellite-streets-v12 or outdoors-v12.
 *
 * Default style: light-v11 (clean greyscale basemap — overlays and typography read clearly).
 */

// ── Preset locations ──────────────────────────────────────────────────────────

const PRESETS = {
  calgary:    { center: [-114.0719,  51.0447], zoom: 11 },
  edmonton:   { center: [-113.4938,  53.5461], zoom: 11 },
  vancouver:  { center: [-123.1207,  49.2827], zoom: 11 },
  toronto:    { center: [ -79.3832,  43.6532], zoom: 11 },
  world:      { center: [   0,       20     ], zoom:  1.5 },
  zermatt:    { center: [   7.7491,  46.0207], zoom: 13 },
  findelen:   { center: [   7.840,   46.012 ], zoom: 13 },
  gorner:     { center: [   7.820,   45.970 ], zoom: 12 },
  chamonix:   { center: [   6.869,   45.924 ], zoom: 12 },
  peyto:      { center: [-116.530,   51.715 ], zoom: 13 },
  athabasca:  { center: [-117.245,   52.190 ], zoom: 12 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCenter(str) {
  if (!str) return null;
  const parts = str.split(',').map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts;
  return null;
}

function showError(el, message) {
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.background = 'var(--bg3, #EEECEA)';
  el.style.borderRadius = 'var(--radius, 12px)';
  el.innerHTML = `<p style="color:var(--text-3,#9C9890);font-size:0.875rem;padding:16px;text-align:center;">${message}</p>`;
}

// ── Overlay helpers ───────────────────────────────────────────────────────────

/**
 * Add GeoJSON features as named layers on the map.
 *
 * Called after the style has loaded. Parses data-geojson as a GeoJSON
 * FeatureCollection. Each Feature must carry a `properties.id` string that
 * becomes the base layer id for that feature. Optional properties:
 *   color        — fill / line / circle colour  (default "#3b82f6")
 *   opacity      — fill / line opacity           (default 0.3)
 *   outline-color — stroke colour for fills      (default == color)
 *   width        — line width in px              (default 2)
 *   dash         — [gap, dash] array for dashed lines
 *   radius       — circle radius in px           (default 6)
 *   visible      — false to start hidden         (default true)
 *
 * Polygon / MultiPolygon  → two layers: "<id>-fill" and "<id>-outline"
 * LineString / MultiLine  → one layer: "<id>"
 * Point / MultiPoint      → one circle layer: "<id>"
 *
 * @param {mapboxgl.Map} map
 * @param {string}       geojsonStr  Raw JSON string from data-geojson
 */
function addGeoJsonLayers(map, geojsonStr) {
  let fc;
  try { fc = JSON.parse(geojsonStr); } catch (err) {
    console.warn('[loom/mapbox] Invalid data-geojson:', err);
    return;
  }
  if (!Array.isArray(fc?.features)) return;

  fc.features.forEach((feature, i) => {
    const p          = feature.properties ?? {};
    const id         = p.id ?? `loom-layer-${i}`;
    const color      = p.color ?? '#3b82f6';
    const opacity    = p.opacity ?? 0.3;
    const outline    = p['outline-color'] ?? color;
    const visibility = p.visible === false ? 'none' : 'visible';
    const geomType   = feature.geometry?.type ?? '';

    const srcId = `loom-src-${id}`;
    try {
      map.addSource(srcId, { type: 'geojson', data: feature });
    } catch (err) {
      console.warn(`[loom/mapbox] addSource failed for "${srcId}":`, err.message);
      return;
    }

    try {
      if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
        map.addLayer({
          id:     `${id}-fill`,
          type:   'fill',
          source: srcId,
          paint:  { 'fill-color': color, 'fill-opacity': opacity },
          layout: { visibility },
        });
        map.addLayer({
          id:     `${id}-outline`,
          type:   'line',
          source: srcId,
          paint:  { 'line-color': outline, 'line-width': p.width ?? 2,
                    'line-opacity': Math.min(opacity * 2.5, 1) },
          layout: { visibility },
        });
      } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
        const paint = {
          'line-color':   color,
          'line-width':   p.width  ?? 2,
          'line-opacity': opacity,
        };
        if (p.dash) paint['line-dasharray'] = p.dash;
        map.addLayer({ id, type: 'line', source: srcId, paint, layout: { visibility } });
      } else if (geomType === 'Point' || geomType === 'MultiPoint') {
        map.addLayer({
          id,
          type:   'circle',
          source: srcId,
          paint:  { 'circle-radius': p.radius ?? 6, 'circle-color': color,
                    'circle-opacity': opacity, 'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#ffffff' },
          layout: { visibility },
        });
      } else {
        console.warn(`[loom/mapbox] Unknown geometry type "${geomType}" for feature "${id}"`);
      }
    } catch (err) {
      console.warn(`[loom/mapbox] addLayer failed for "${id}":`, err.message);
    }
  });
}

/**
 * Add simple dot markers with hover tooltips from data-markers JSON.
 *
 * @param {mapboxgl.Map} map
 * @param {string}       markersStr  JSON array of {lng, lat, label?, color?}
 */
function addMapboxMarkers(map, markersStr) {
  const mapboxgl = window.mapboxgl;
  let markers;
  try { markers = JSON.parse(markersStr); } catch (err) {
    console.warn('[loom/mapbox] Invalid data-markers:', err);
    return;
  }
  markers.forEach(({ lng, lat, label, color = '#ef4444' }) => {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width:11px; height:11px; border-radius:50%;
      background:${color}; border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.45); cursor:default;`;

    const marker = new mapboxgl.Marker({ element: dot })
      .setLngLat([lng, lat])
      .addTo(map);

    if (label) {
      const popup = new mapboxgl.Popup({
        offset: 12, closeButton: false, closeOnClick: false,
      }).setHTML(`<span style="font-size:.75rem;font-weight:600;white-space:nowrap">${label}</span>`);
      marker.setPopup(popup);
      dot.addEventListener('mouseenter', () => { if (!marker.getPopup().isOpen()) marker.togglePopup(); });
      dot.addEventListener('mouseleave', () => { if (marker.getPopup().isOpen())  marker.togglePopup(); });
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise a Mapbox map inside `el`.
 *
 * Config precedence (highest first):
 *   1. data-* attributes on the element
 *   2. `config` argument
 *   3. Named preset from PRESETS
 *   4. Fallback defaults
 *
 * Overlay extensions (declarative, no JS needed in the post):
 *   data-markers  — JSON array [{lng, lat, label?, color?}]
 *   data-geojson  — GeoJSON FeatureCollection string (see addGeoJsonLayers above)
 *
 * The map instance is also stored on el._map and a 'mapbox:ready' event is
 * dispatched so inline post scripts can access it:
 *   document.getElementById('my-map').addEventListener('mapbox:ready', e => {
 *     const map = e.detail.map;  // full Mapbox GL JS Map instance
 *   });
 *
 * @param {HTMLElement} el
 * @param {object} config  Optional overrides: { center, zoom, pitch, bearing, style }
 * @returns {object|null}  Mapbox Map instance or null on failure
 */
export function renderMap(el, config = {}) {
  const mapboxgl = window.mapboxgl;
  if (!mapboxgl) return null;

  // Ensure the container has a height
  if (!el.style.height && el.offsetHeight === 0) {
    el.style.height = '400px';
  }

  // Resolve access token
  const token =
    el.dataset.token ||
    window.MAPBOX_TOKEN ||
    null;

  if (!token) {
    showError(
      el,
      'Map unavailable: no Mapbox access token found.<br>' +
      'Set <code>mapbox_token:</code> in <code>_config.yml</code>.'
    );
    return null;
  }

  mapboxgl.accessToken = token;

  // Resolve location / camera
  const locationKey = el.dataset.map;
  const preset = PRESETS[locationKey] ?? {};

  const center =
    parseCenter(el.dataset.center) ??
    config.center ??
    preset.center ??
    [0, 0];

  const zoom =
    (el.dataset.zoom    ? parseFloat(el.dataset.zoom)    : null) ??
    config.zoom    ??
    preset.zoom    ??
    2;

  const pitch =
    (el.dataset.pitch   ? parseFloat(el.dataset.pitch)   : null) ??
    config.pitch   ??
    0;

  const bearing =
    (el.dataset.bearing ? parseFloat(el.dataset.bearing) : null) ??
    config.bearing ??
    0;

  const style =
    el.dataset.style ??
    config.style ??
    'mapbox://styles/mapbox/light-v11';

  // Mapbox GL JS v3 defaults to globe projection; use mercator for essay maps
  // unless the author explicitly requests globe via data-projection="globe".
  const projection = el.dataset.projection ?? config.projection ?? 'mercator';

  let map;
  try {
    map = new mapboxgl.Map({ container: el, style, center, zoom, pitch, bearing, projection });
  } catch (err) {
    showError(el, 'Map failed to initialise. Check the browser console for details.');
    return null;
  }

  // All post-load setup (fog, overlays, terrain, markers) runs once after the
  // map's style and initial tiles are fully ready. Using 'load' (not 'style.load')
  // because style.load fires before addSource/addLayer are safe in GL JS v3,
  // and once() prevents duplicate-source errors on any style refresh.
  map.once('load', () => {
    // Disable fog/atmosphere — it washes out features at low zoom levels.
    // Terrain maps opt back in by adding their own sky layer below.
    if (el.dataset.terrain === undefined) {
      try { map.setFog(null); } catch (_) { /* style may not support fog */ }
    }

    // GeoJSON overlay layers — data-geojson is a GeoJSON FeatureCollection.
    if (el.dataset.geojson) addGeoJsonLayers(map, el.dataset.geojson);

    // Dot markers with hover tooltips.
    if (el.dataset.markers) addMapboxMarkers(map, el.dataset.markers);

    // 3D terrain — enabled by data-terrain (presence) or data-terrain="1.5".
    if (el.dataset.terrain !== undefined) {
      const exaggeration = parseFloat(el.dataset.terrain) || 1.5;
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration });
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      });
    }
  });

  // Keep map sized correctly when the container resizes
  const observer = new ResizeObserver(() => map.resize());
  observer.observe(el);

  // Store instance on the element and fire a ready event so inline post
  // scripts can access the full Mapbox GL JS API without importing this module.
  el._map = map;
  map.once('load', () => {
    el.dispatchEvent(new CustomEvent('mapbox:ready', { bubbles: true, detail: { map } }));
  });

  return map;
}

/**
 * Update a Mapbox map instance in response to a scroll step.
 *
 * Called by core.js when a story step with data-update targets this element.
 *
 * @param {HTMLElement}  el
 * @param {object}       data      Keys: center ([lng,lat]), zoom, pitch, bearing, animate (default true)
 * @param {object}       instance  Mapbox Map instance returned by renderMap()
 */
export function updateMap(el, data, instance) {
  if (!instance) return;
  const { center, zoom, pitch, bearing, animate = true, layers } = data;
  const duration = animate ? 1500 : 0;

  // Camera transition
  const flyOptions = { duration };
  if (center  != null) flyOptions.center  = center;
  if (zoom    != null) flyOptions.zoom    = zoom;
  if (pitch   != null) flyOptions.pitch   = pitch;
  if (bearing != null) flyOptions.bearing = bearing;
  if (Object.keys(flyOptions).length > 1) instance.flyTo(flyOptions);

  // Layer visibility — { "layer-id": true/false } or { "layer-id": "visible"/"none" }
  // Polygon features produce two layers ("<id>-fill" and "<id>-outline");
  // the shorthand "<id>" targets both if individual layers are not specified.
  if (layers && typeof layers === 'object') {
    Object.entries(layers).forEach(([id, val]) => {
      const vis = (val === true || val === 'visible') ? 'visible' : 'none';
      // Try exact id first, then the auto-generated fill/outline pair
      for (const layerId of [id, `${id}-fill`, `${id}-outline`]) {
        try {
          if (instance.getLayer(layerId)) instance.setLayoutProperty(layerId, 'visibility', vis);
        } catch (_) { /* layer not yet added */ }
      }
    });
  }
}

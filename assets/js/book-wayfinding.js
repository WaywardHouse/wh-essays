const ACRONYMS = new Map([
  ['gps', 'GPS'],
  ['sar', 'SAR'],
  ['insar', 'InSAR'],
  ['rusle', 'RUSLE'],
  ['pca', 'PCA'],
  ['tsne', 't-SNE'],
  ['umap', 'UMAP'],
  ['grace', 'GRACE'],
  ['lidar', 'LiDAR'],
  ['ngl', 'NGL'],
  ['idf', 'IDF'],
  ['crs', 'CRS'],
  ['utm', 'UTM'],
  ['dem', 'DEM'],
  ['glofs', 'GLOFs'],
]);

export const BOOK_SECTIONS = [
  {
    key: 'getting-started',
    title: 'Getting Started',
    href: '/getting-started/',
    chapters: [
      '/getting-started/how-to-read-equations.html',
      '/getting-started/units-scale-and-estimation.html',
      '/getting-started/maps-coordinates-and-layers.html',
      '/getting-started/uncertainty-error-and-approximation.html',
      '/getting-started/what-makes-a-model-computational.html',
      '/getting-started/setting-up-your-environment.html',
    ],
  },
  {
    key: 'foundations',
    title: 'Maths for Modelling Space',
    href: '/foundations/',
    chapters: [
      '/foundations/what-is-a-spatial-model.html',
      '/foundations/linear-change-and-rate.html',
      '/foundations/exponential-growth-and-logarithms.html',
      '/foundations/logistic-growth-and-equilibrium.html',
      '/foundations/map-projections-and-coordinate-reference-systems.html',
      '/foundations/digital-elevation-models-as-functions.html',
      '/foundations/gradient-aspect-steepest-descent.html',
      '/foundations/gravity-models-trade-migration.html',
      '/foundations/spatial-diffusion-of-innovation.html',
      '/foundations/what-is-remote-sensing.html',
      '/foundations/spatial-spectral-temporal-and-radiometric-resolution.html',
      '/foundations/atmospheric-effects-and-surface-reflectance.html',
      '/foundations/light-attenuation-in-canopy.html',
      '/foundations/spectral-mixing-and-sensor-response.html',
      '/foundations/solar-geometry-and-projection.html',
      '/foundations/hydrological-flow-as-optimization.html',
      '/foundations/earth-as-rotating-sphere.html',
    ],
  },
  {
    key: 'environmental-systems',
    title: 'Earth Systems and Observation',
    href: '/environmental-systems/',
    chapters: [
      '/environmental-systems/net-radiation-and-albedo.html',
      '/environmental-systems/sensible-and-latent-heat-fluxes.html',
      '/environmental-systems/soil-heat-diffusion.html',
      '/environmental-systems/photosynthesis-light-response.html',
      '/environmental-systems/soil-moisture-dynamics.html',
      '/environmental-systems/wind-profiles-and-turbulence.html',
      '/environmental-systems/temperature-moisture-gradients.html',
      '/environmental-systems/multispectral-imagery-and-band-interpretation.html',
      '/environmental-systems/vegetation-indices-and-remote-sensing.html',
      '/environmental-systems/circular-orbits-and-keplers-third-law.html',
      '/environmental-systems/ground-tracks-and-orbital-geometry.html',
      '/environmental-systems/satellite-overpasses-and-visibility.html',
      '/environmental-systems/how-gps-works.html',
      '/environmental-systems/carbon-allocation-and-npp.html',
      '/environmental-systems/decomposition-and-soil-carbon.html',
      '/environmental-systems/nitrogen-cycling.html',
      '/environmental-systems/phenology-and-growing-season.html',
    ],
  },
  {
    key: 'spatial-analysis',
    title: 'GIS and Spatial Analysis',
    href: '/spatial-analysis/',
    chapters: [
      '/spatial-analysis/point-in-polygon-testing.html',
      '/spatial-analysis/buffer-operations.html',
      '/spatial-analysis/polygon-overlay-operations.html',
      '/spatial-analysis/spatial-joins.html',
      '/spatial-analysis/raster-resampling-interpolation.html',
      '/spatial-analysis/map-algebra-focal-operations.html',
      '/spatial-analysis/raster-classification.html',
      '/spatial-analysis/viewshed-line-of-sight.html',
      '/spatial-analysis/watershed-delineation.html',
      '/spatial-analysis/cost-distance-least-cost-paths.html',
      '/spatial-analysis/supervised-image-classification.html',
      '/spatial-analysis/change-detection.html',
      '/spatial-analysis/time-series-analysis.html',
    ],
  },
  {
    key: 'atmospheric-hazards',
    title: 'Hazards, Change, and Prediction',
    href: '/atmospheric-hazards/',
    chapters: [
      '/atmospheric-hazards/fire-weather-ignition.html',
      '/atmospheric-hazards/fire-spread-modeling.html',
      '/atmospheric-hazards/rainfall-intensity-duration.html',
      '/atmospheric-hazards/flood-frequency-analysis.html',
      '/atmospheric-hazards/urban-flood-modeling.html',
      '/atmospheric-hazards/fire-emissions-smoke.html',
      '/atmospheric-hazards/thunderstorm-dynamics.html',
      '/atmospheric-hazards/tornado-formation-intensity.html',
      '/atmospheric-hazards/hail-formation-forecasting.html',
      '/atmospheric-hazards/boundary-layer-turbulence.html',
      '/atmospheric-hazards/extreme-wind-events.html',
    ],
  },
  {
    key: 'economic-systems',
    title: 'Cities, Networks, and Economic Geography',
    href: '/economic-systems/',
    chapters: [
      '/economic-systems/canada-trade-gravity-model.html',
      '/economic-systems/urban-bid-rent-model.html',
      '/economic-systems/urban-agglomeration-economies.html',
      '/economic-systems/markets-spatial-arbitrage.html',
      '/economic-systems/alberta-pipeline-crude-oil.html',
      '/economic-systems/alberta-pipeline-ngl-condensate.html',
      '/economic-systems/alberta-pipeline-natural-gas.html',
      '/economic-systems/alberta-pipeline-refined-products.html',
      '/economic-systems/alberta-pipeline-integrated-network.html',
      '/economic-systems/canada-trade-corridors.html',
      '/economic-systems/canada-port-economics.html',
      '/economic-systems/canada-freight-modal-split.html',
      '/economic-systems/canada-integrated-trade-network.html',
      '/economic-systems/urban-city-size-zipf.html',
      '/economic-systems/urban-economic-base.html',
      '/economic-systems/urban-integrated-system.html',
      '/economic-systems/markets-commodity-price-formation.html',
      '/economic-systems/markets-futures-geographic-instruments.html',
      '/economic-systems/markets-price-volatility.html',
      '/economic-systems/markets-integrated-price-system.html',
      '/economic-systems/resource-hotelling-rule.html',
      '/economic-systems/resource-supply-cost-curves.html',
      '/economic-systems/resource-royalty-regimes.html',
      '/economic-systems/resource-curse.html',
      '/economic-systems/resource-integrated-system.html',
      '/economic-systems/crude-oil-pipelines.html',
      '/economic-systems/ngl-condensate-systems.html',
      '/economic-systems/natural-gas-transmission.html',
      '/economic-systems/refined-products-distribution.html',
      '/economic-systems/integrated-network.html',
      '/economic-systems/alberta-renewable-resource-geography.html',
      '/economic-systems/alberta-renewable-economics.html',
      '/economic-systems/alberta-renewable-policy-demand.html',
    ],
  },
  {
    key: 'cryosphere-and-mountain-systems',
    title: 'Cryosphere and Mountain Systems',
    href: '/cryosphere-and-mountain-systems/',
    chapters: [
      '/cryosphere-and-mountain-systems/snowpack-energy-balance.html',
      '/cryosphere-and-mountain-systems/snow-accumulation-melt-modeling.html',
      '/cryosphere-and-mountain-systems/swe-estimation-methods.html',
      '/cryosphere-and-mountain-systems/avalanche-terrain-analysis.html',
      '/cryosphere-and-mountain-systems/glacier-mass-balance.html',
      '/cryosphere-and-mountain-systems/glacial-meltwater-chemistry.html',
      '/cryosphere-and-mountain-systems/glacial-lake-outburst-floods.html',
      '/cryosphere-and-mountain-systems/slope-stability-analysis.html',
      '/cryosphere-and-mountain-systems/debris-flow-modeling.html',
      '/cryosphere-and-mountain-systems/permafrost-thaw-geohazards.html',
    ],
  },
  {
    key: 'advanced-remote-sensing',
    title: 'Advanced Remote Sensing',
    href: '/advanced-remote-sensing/',
    chapters: [
      '/advanced-remote-sensing/prospect-leaf-optical-properties.html',
      '/advanced-remote-sensing/sail-canopy-reflectance.html',
      '/advanced-remote-sensing/hyperspectral-imaging.html',
      '/advanced-remote-sensing/thermal-infrared-remote-sensing.html',
      '/advanced-remote-sensing/lidar-point-clouds.html',
      '/advanced-remote-sensing/bathymetric-lidar-sonar.html',
      '/advanced-remote-sensing/sar-fundamentals.html',
      '/advanced-remote-sensing/gravity-remote-sensing.html',
    ],
  },
  {
    key: 'laboratory',
    title: 'Computational Geography Laboratory',
    href: '/laboratory/',
    chapters: [
      '/laboratory/sar-fundamentals-and-applications.html',
      '/laboratory/insar-deformation-monitoring.html',
      '/laboratory/gravity-remote-sensing-grace.html',
      '/laboratory/passive-microwave-radiometry.html',
      '/laboratory/rock-weathering-and-soil-formation.html',
      '/laboratory/soil-erosion-and-the-rusle.html',
      '/laboratory/shallow-landslides-and-slope-stability.html',
      '/laboratory/sediment-transport-in-rivers.html',
      '/laboratory/channel-morphology-and-hydraulic-geometry.html',
      '/laboratory/wave-dynamics-and-nearshore-transformation.html',
      '/laboratory/longshore-sediment-transport-and-coastal-budgets.html',
      '/laboratory/sea-level-storm-surge-and-coastal-morphodynamics.html',
      '/laboratory/urban-heat-island-dynamics.html',
      '/laboratory/urban-ventilation-and-pollutant-dispersion.html',
      '/laboratory/transportation-network-analysis.html',
      '/laboratory/accessibility-and-travel-demand-modeling.html',
      '/laboratory/land-use-change-modeling.html',
      '/laboratory/urban-scaling-laws-and-city-structure.html',
      '/laboratory/demographic-spatial-dynamics.html',
      '/laboratory/reservoir-operations-and-mass-balance.html',
      '/laboratory/stochastic-streamflow-and-drought-risk.html',
      '/laboratory/dissolved-oxygen-dynamics-and-the-streeter-phelps-model.html',
      '/laboratory/nutrient-dynamics-and-lake-eutrophication.html',
      '/laboratory/sediment-and-contaminant-transport-in-rivers.html',
      '/laboratory/groundwater-contaminant-plumes.html',
      '/laboratory/pump-and-treat-and-in-situ-remediation.html',
      '/laboratory/bayesian-inference-for-environmental-models.html',
      '/laboratory/regression-for-continuous-spatial-variables.html',
      '/laboratory/dimensionality-reduction-for-high-dimensional-geographic-data.html',
      '/laboratory/ensemble-forecasting-and-uncertainty-quantification.html',
      '/laboratory/the-kalman-filter-and-sequential-data-assimilation.html',
      '/laboratory/satellite-data-assimilation-in-environmental-models.html',
      '/laboratory/Fossil-Fuel-Combustion-Chemistry.html',
      '/laboratory/Biomass-Burning-and-Pyrogenic-Carbon.html',
      '/laboratory/Land-Use-Change-and-Deforestation.html',
      '/laboratory/Photosynthesis-and-Gross-Primary-Production.html',
      '/laboratory/Ocean-Carbon-Uptake-and-Air-Sea-Exchange.html',
      '/laboratory/Soil-Carbon-Storage-and-Decomposition.html',
      '/laboratory/Methanogenesis-in-Anaerobic-Environments.html',
    ],
  },
  {
    key: 'machine-learning',
    title: 'Machine Learning for Geographic Data',
    href: '/machine-learning/',
    chapters: [
      '/machine-learning/regression-continuous-variables.html',
      '/machine-learning/dimensionality-reduction-pca-tsne-umap.html',
    ],
  },
];

const SECTION_BY_KEY = new Map(BOOK_SECTIONS.map((section) => [section.key, section]));
const SECTION_BY_PATH = new Map(BOOK_SECTIONS.map((section) => [section.href, section]));

export function getBookBasePath(pathname = '/') {
  if (!pathname) return '';

  const withoutQuery = pathname.split('#')[0].split('?')[0];
  const normalized = withoutQuery
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '/');
  const parts = normalized.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  const firstBookPartIndex = parts.findIndex((part) => SECTION_BY_KEY.has(part));

  if (firstBookPartIndex <= 0) return '';
  return `/${parts.slice(0, firstBookPartIndex).join('/')}`;
}

export function normalizeBookPath(pathname = '/') {
  if (!pathname) return '/';

  const withoutQuery = pathname.split('#')[0].split('?')[0];
  const cleaned = withoutQuery
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '/');

  const normalized = cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
  const parts = normalized.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  const firstBookPartIndex = parts.findIndex((part) => SECTION_BY_KEY.has(part));

  if (firstBookPartIndex > 0) {
    return `/${parts.slice(firstBookPartIndex).join('/')}/`;
  }

  return normalized;
}

export function resolveBookHref(pathname = '/', href = '/') {
  const withoutQuery = href.split('#')[0].split('?')[0];
  const isHtmlChapter = /\.html$/.test(withoutQuery) && !/index\.html$/.test(withoutQuery);
  const normalizedHref = normalizeBookPath(href);
  const basePath = getBookBasePath(pathname);

  if (!basePath) return isHtmlChapter ? withoutQuery : normalizedHref;
  if (normalizedHref === '/') return `${basePath}/`;
  if (isHtmlChapter) return `${basePath}${withoutQuery}`;

  return `${basePath}${normalizedHref}`;
}

export function getSectionForPath(pathname = '/') {
  const normalized = normalizeBookPath(pathname);

  if (SECTION_BY_PATH.has(normalized)) {
    return SECTION_BY_PATH.get(normalized);
  }

  const parts = normalized.replace(/^\/|\/$/g, '').split('/');
  if (parts.length === 0 || !parts[0]) return null;
  return SECTION_BY_KEY.get(parts[0]) || null;
}

export function deriveTitleFromHref(href = '/') {
  const normalized = normalizeBookPath(href);
  const slug = normalized
    .replace(/^\/|\/$/g, '')
    .split('/')
    .pop();

  if (!slug) return 'Computational Geography';

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (ACRONYMS.has(lower)) return ACRONYMS.get(lower);
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function getWayfindingForPath(pathname = '/') {
  const normalized = normalizeBookPath(pathname);
  const section = getSectionForPath(normalized);
  if (!section) return null;

  const chapterIndex = section.chapters.findIndex((href) => normalizeBookPath(href) === normalized);
  if (chapterIndex === -1) {
    return {
      section,
      chapterIndex: -1,
      chapterCount: section.chapters.length,
      previous: null,
      next: null,
      isSectionHome: normalized === section.href,
    };
  }

  const previousHref = chapterIndex > 0 ? section.chapters[chapterIndex - 1] : null;
  const nextHref = chapterIndex < section.chapters.length - 1 ? section.chapters[chapterIndex + 1] : null;

  return {
    section,
    chapterIndex,
    chapterCount: section.chapters.length,
    previous: previousHref ? { href: previousHref, title: deriveTitleFromHref(previousHref) } : null,
    next: nextHref ? { href: nextHref, title: deriveTitleFromHref(nextHref) } : null,
    isSectionHome: false,
  };
}

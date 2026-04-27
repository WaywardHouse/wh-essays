/**
 * oil-shock.js — Managed Oil Shock Propagation Simulator
 *
 * Refresh of the original Hormuz widget. The week-one model treated the crisis
 * mostly as a pure supply-removal shock. This version models the regime that
 * emerged afterward: partial corridor reopening, emergency stock releases,
 * shipping friction, refining/LNG disruption, and importer-side intervention.
 *
 * Usage:
 *   <div data-viz="oil-shock" style="min-height: 980px;"></div>
 *
 * Front matter: viz: true
 *
 * @module models/oil-shock
 */

import { renderEChart } from '../viz/echarts.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS         = 24;
const GLOBAL_SUPPLY  = 103;  // mb/d
const INV_ELASTICITY = 0.08; // inverse of combined short-run elasticity
const PRICE_CEILING  = 220;

// ── Region parameters ────────────────────────────────────────────────────────

const REGIONS = [
  {
    id: 'us', name: 'United States', shortName: 'US', color: '#4e8ac4',
    hormuzDependence: 0.02, oilImportShareGDP: 0.012, foodImportVulnerability: 0.08,
    baseInflation: 2.8, currencyStability: 0.95, fuelSubsidyCapacity: 0.12,
    retailPassThrough: 0.60, foodChannelStrength: 0.30, lngExposure: 0.05,
    reserveDepth: 0.95, refiningExposure: 0.10, group: 'advanced',
  },
  {
    id: 'eu', name: 'European Union', shortName: 'EU', color: '#4e6ac4',
    hormuzDependence: 0.18, oilImportShareGDP: 0.025, foodImportVulnerability: 0.10,
    baseInflation: 2.4, currencyStability: 0.80, fuelSubsidyCapacity: 0.35,
    retailPassThrough: 0.50, foodChannelStrength: 0.30, lngExposure: 0.35,
    reserveDepth: 0.70, refiningExposure: 0.24, group: 'advanced',
  },
  {
    id: 'japan', name: 'Japan', shortName: 'JP', color: '#e8cc6a',
    hormuzDependence: 0.72, oilImportShareGDP: 0.025, foodImportVulnerability: 0.15,
    baseInflation: 2.2, currencyStability: 0.70, fuelSubsidyCapacity: 0.45,
    retailPassThrough: 0.50, foodChannelStrength: 0.35, lngExposure: 0.30,
    reserveDepth: 0.78, refiningExposure: 0.28, group: 'advanced',
  },
  {
    id: 'korea', name: 'South Korea', shortName: 'KR', color: '#c5a44e',
    hormuzDependence: 0.65, oilImportShareGDP: 0.027, foodImportVulnerability: 0.18,
    baseInflation: 2.5, currencyStability: 0.65, fuelSubsidyCapacity: 0.42,
    retailPassThrough: 0.62, foodChannelStrength: 0.35, lngExposure: 0.25,
    reserveDepth: 0.68, refiningExposure: 0.30, group: 'advanced',
  },
  {
    id: 'china', name: 'China', shortName: 'CN', color: '#c44e4e',
    hormuzDependence: 0.40, oilImportShareGDP: 0.018, foodImportVulnerability: 0.12,
    baseInflation: 0.5, currencyStability: 0.75, fuelSubsidyCapacity: 0.55,
    retailPassThrough: 0.40, foodChannelStrength: 0.25, lngExposure: 0.20,
    reserveDepth: 0.82, refiningExposure: 0.18, group: 'emerging_large',
  },
  {
    id: 'india', name: 'India', shortName: 'IN', color: '#c48a4e',
    hormuzDependence: 0.50, oilImportShareGDP: 0.035, foodImportVulnerability: 0.08,
    baseInflation: 5.0, currencyStability: 0.55, fuelSubsidyCapacity: 0.32,
    retailPassThrough: 0.55, foodChannelStrength: 0.50, lngExposure: 0.25,
    reserveDepth: 0.34, refiningExposure: 0.22, group: 'emerging_large',
  },
  {
    id: 'sea', name: 'Southeast Asia', shortName: 'SEA', color: '#c4a04e',
    hormuzDependence: 0.45, oilImportShareGDP: 0.030, foodImportVulnerability: 0.15,
    baseInflation: 3.5, currencyStability: 0.50, fuelSubsidyCapacity: 0.25,
    retailPassThrough: 0.60, foodChannelStrength: 0.45, lngExposure: 0.15,
    reserveDepth: 0.20, refiningExposure: 0.20, group: 'emerging',
  },
  {
    id: 'mena_importers', name: 'MENA Importers', shortName: 'MENA-I', color: '#c46a4e',
    hormuzDependence: 0.60, oilImportShareGDP: 0.045, foodImportVulnerability: 0.35,
    baseInflation: 12.0, currencyStability: 0.35, fuelSubsidyCapacity: 0.42,
    retailPassThrough: 0.35, foodChannelStrength: 0.65, lngExposure: 0.10,
    reserveDepth: 0.18, refiningExposure: 0.15, group: 'developing',
  },
  {
    id: 'ssa', name: 'Sub-Saharan Africa', shortName: 'SSA', color: '#8a3535',
    hormuzDependence: 0.30, oilImportShareGDP: 0.040, foodImportVulnerability: 0.30,
    baseInflation: 15.0, currencyStability: 0.25, fuelSubsidyCapacity: 0.10,
    retailPassThrough: 0.75, foodChannelStrength: 0.70, lngExposure: 0.05,
    reserveDepth: 0.05, refiningExposure: 0.18, group: 'developing',
  },
  {
    id: 'latam', name: 'Latin America', shortName: 'LATAM', color: '#4ec46a',
    hormuzDependence: 0.10, oilImportShareGDP: 0.015, foodImportVulnerability: 0.12,
    baseInflation: 6.0, currencyStability: 0.40, fuelSubsidyCapacity: 0.20,
    retailPassThrough: 0.55, foodChannelStrength: 0.45, lngExposure: 0.08,
    reserveDepth: 0.20, refiningExposure: 0.12, group: 'emerging',
  },
  {
    id: 'gulf_exporters', name: 'Gulf Exporters', shortName: 'GCC', color: '#e8a06a',
    hormuzDependence: 0.90, oilImportShareGDP: -0.35, foodImportVulnerability: 0.40,
    baseInflation: 2.5, currencyStability: 0.80, fuelSubsidyCapacity: 0.85,
    retailPassThrough: 0.10, foodChannelStrength: 0.55, lngExposure: -0.20,
    reserveDepth: 0.72, refiningExposure: 0.10, group: 'special_exporter',
  },
  {
    id: 'canada', name: 'Canada / Alberta', shortName: 'CAN', color: '#c44e8a',
    hormuzDependence: 0.0, oilImportShareGDP: -0.04, foodImportVulnerability: 0.08,
    baseInflation: 2.5, currencyStability: 0.75, fuelSubsidyCapacity: 0.20,
    retailPassThrough: 0.65, foodChannelStrength: 0.20, lngExposure: 0.0,
    reserveDepth: 0.50, refiningExposure: 0.05, group: 'special_exporter',
  },
];

const HISTORICAL_SHOCKS = {
  '1973': { name: '1973 Arab Embargo',       priceStart: 3.0,  pricePeak: 12.0,  peakMonth: 4, duration: 6  },
  '1979': { name: '1979 Iranian Revolution', priceStart: 14.0, pricePeak: 39.5,  peakMonth: 8, duration: 12 },
  '1990': { name: '1990 Gulf War',           priceStart: 17.0, pricePeak: 41.0,  peakMonth: 2, duration: 3  },
  '2008': { name: '2008 Price Spike',        priceStart: 90.0, pricePeak: 147.0, peakMonth: 5, duration: 6  },
  '2022': { name: '2022 Russia-Ukraine',     priceStart: 78.0, pricePeak: 128.0, peakMonth: 3, duration: 8  },
};

const DURATION_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

// ── Lag functions ─────────────────────────────────────────────────────────────

const energyLag = (t) => Math.min(1, 0.65 + 0.35 * (1 - Math.exp(-t / 0.6)));
const foodLag = (t) => Math.min(1, 1 - Math.exp(-t / 2.6));
const lngLagFn = (t) => Math.min(1, 1 - Math.exp(-t / 1.4));
const fiscalLag = (t) => Math.min(1, 1 - Math.exp(-t / 2.2));
const gdpLagFn = (t) => Math.min(1, 1 - Math.exp(-t / 3.5));
const instabilityLag = (t) => Math.min(1, 1 - Math.exp(-t / 4.5));

// ── Scenario derivation ──────────────────────────────────────────────────────

function deriveScenario(params) {
  const corridorShare = params.corridorRecovery / 100;
  const shippingShare = params.shippingFriction / 100;
  const lngShare = params.lngSeverity / 100;
  const coordinationShare = params.policyCoordination / 100;

  const blockedFlow = params.disruptedFlow * (1 - corridorShare);
  const reserveOffset = Math.min(blockedFlow, params.stockRelease);
  const netShortfall = Math.max(0, blockedFlow - reserveOffset);
  const physicalSpike = (netShortfall / GLOBAL_SUPPLY) / INV_ELASTICITY;
  const frictionPremium = shippingShare * 0.22;
  const refiningPremium = (params.refiningLoss / 6) * 0.08;
  const lngPremium = lngShare * 0.05;
  const coordinationDiscount = coordinationShare * 0.06;
  const peakMultiplier = Math.max(
    0,
    physicalSpike + frictionPremium + refiningPremium + lngPremium - coordinationDiscount,
  );

  return {
    ...params,
    corridorShare,
    shippingShare,
    lngShare,
    coordinationShare,
    blockedFlow,
    reserveOffset,
    netShortfall,
    peakMultiplier,
    regimeLabel:
      corridorShare < 0.08 ? 'Near-closure regime'
      : corridorShare < 0.25 ? 'Selective corridor regime'
      : corridorShare < 0.50 ? 'Managed reopening'
      : 'Stress but functioning',
  };
}

// ── Price projection ──────────────────────────────────────────────────────────

function projectPrice(basePrice, scenario, t) {
  const { durationMonths, peakMultiplier, coordinationShare } = scenario;
  const build = 1 - Math.exp(-(t + 0.5) / 0.55);
  const plateau = peakMultiplier * build;

  let multiplier = plateau;
  if (t > durationMonths) {
    const decayRate = 2.4 + coordinationShare * 2.0;
    multiplier = plateau * Math.exp(-(t - durationMonths) / decayRate);
  } else if (durationMonths >= 6) {
    multiplier = plateau * (0.94 + coordinationShare * 0.03);
  }

  return Math.min(PRICE_CEILING, basePrice * (1 + multiplier));
}

// ── Per-region monthly impact ─────────────────────────────────────────────────

function regionAtTime(region, scenario, price, t) {
  const basePrice = scenario.basePrice;
  const oilPriceChange = (price - basePrice) / basePrice;
  const oilCPIWeight = region.group === 'developing' ? 0.10 : 0.07;

  const bufferStrength = region.fuelSubsidyCapacity * scenario.coordinationShare;
  const reserveRelief = region.reserveDepth * (scenario.reserveOffset / Math.max(1, scenario.disruptedFlow)) * 0.40;
  const shippingStress = scenario.shippingShare * region.hormuzDependence;
  const refiningStress = (scenario.refiningLoss / 6) * region.refiningExposure;
  const currencyDep = oilPriceChange * Math.abs(region.oilImportShareGDP)
    * (1 - region.currencyStability) * 0.55;

  const effectivePriceChange = oilPriceChange * (1 + currencyDep) * (1 - reserveRelief * 0.30);

  const energyInflation = (
    effectivePriceChange * region.retailPassThrough * oilCPIWeight * energyLag(t)
    * (1 - bufferStrength * 0.55)
    + shippingStress * 0.08 * energyLag(t)
  ) * 100;

  let foodInflation = (
    effectivePriceChange * region.foodChannelStrength * foodLag(t) * (1 - bufferStrength * 0.18)
    + refiningStress * 0.12 * foodLag(t)
  ) * 100;

  let lngInflation = 0;
  if (scenario.lngSeverity > 0 && region.lngExposure > 0) {
    lngInflation = region.lngExposure * scenario.lngShare * 3.8 * lngLagFn(t);
    foodInflation += region.lngExposure * scenario.lngShare * 1.1 * foodLag(t);
  }

  const policySuppression = energyInflation * bufferStrength * 0.55;
  const totalInflationRaw = Math.max(0, energyInflation - policySuppression) + foodInflation + lngInflation;
  const inflationAmplifier = region.baseInflation > 4
    ? 1 + (region.baseInflation - 4) * 0.12
    : 1;
  const totalInflation = totalInflationRaw * inflationAmplifier;

  let fiscalStrain = 0;
  if (region.oilImportShareGDP > 0) {
    fiscalStrain = (
      bufferStrength * effectivePriceChange * region.oilImportShareGDP * 120
      + reserveRelief * 0.6 * fiscalLag(t)
    ) * fiscalLag(t);
  } else if (region.id === 'gulf_exporters') {
    fiscalStrain = scenario.netShortfall * 0.10 * (1 - scenario.corridorShare) * fiscalLag(t);
  }

  let gdpImpact;
  if (region.oilImportShareGDP < 0) {
    if (region.id === 'gulf_exporters') {
      gdpImpact = -(
        scenario.netShortfall / GLOBAL_SUPPLY * 10
        + scenario.shippingShare * 0.8
      ) * gdpLagFn(t);
    } else {
      gdpImpact = (
        effectivePriceChange * Math.abs(region.oilImportShareGDP) * 24
        - scenario.shippingShare * 0.25
      ) * gdpLagFn(t);
    }
  } else {
    const importShock = effectivePriceChange * (0.9 + region.hormuzDependence * 0.8);
    gdpImpact = -(
      importShock * 1.1
      + fiscalStrain * 0.22
      + foodInflation * 0.08 * instabilityLag(t)
    ) * gdpLagFn(t);
  }

  let currentAccount;
  if (region.oilImportShareGDP < 0) {
    currentAccount = region.id === 'gulf_exporters'
      ? -(scenario.netShortfall / GLOBAL_SUPPLY) * 24
      : effectivePriceChange * Math.abs(region.oilImportShareGDP) * 16;
  } else {
    currentAccount = -(
      effectivePriceChange * region.oilImportShareGDP * 12 * (1 + shippingStress * 0.8)
      + lngInflation * 0.10
    );
  }

  const instability = Math.min(10, Math.max(0,
    (totalInflation / 4.8) * 1.9 +
    (foodInflation / 6.5) * 2.0 +
    Math.max(0, -currentAccount) * 0.50 +
    Math.max(0, -gdpImpact) * 0.85 +
    fiscalStrain * 0.45 +
    (region.baseInflation > 10 ? 1.2 : 0),
  ));

  return {
    energyInflation,
    foodInflation,
    lngInflation,
    policySuppression,
    fiscalStrain,
    totalInflation,
    gdpImpact,
    currentAccount,
    currency: currencyDep * 100,
    instability,
  };
}

// ── Full 24-month simulation ──────────────────────────────────────────────────

function simulate(params) {
  const scenario = deriveScenario(params);
  const prices = Array.from({ length: MONTHS }, (_, t) => projectPrice(params.basePrice, scenario, t));
  const regional = Object.fromEntries(
    REGIONS.map((r) => [
      r.id,
      prices.map((p, t) => regionAtTime(r, scenario, p, t)),
    ]),
  );
  return { scenario, prices, regional };
}

// ── Historical overlay ───────────────────────────────────────────────────────

function historicalPricePoints(shock, basePrice) {
  const normPeak = (shock.pricePeak - shock.priceStart) / shock.priceStart;
  return Array.from({ length: MONTHS }, (_, t) => {
    const pct = t <= shock.peakMonth
      ? normPeak * (t / Math.max(1, shock.peakMonth))
      : normPeak * Math.exp(-(t - shock.peakMonth) / (shock.duration / 2));
    return +(basePrice * (1 + pct)).toFixed(1);
  });
}

// ── Heatmap value ─────────────────────────────────────────────────────────────

function cellValue(region, d) {
  if (region.id === 'canada') return -(d.gdpImpact * 0.6);
  return d.instability;
}

function sortByPeakSeverity(simData) {
  return [...REGIONS].sort((a, b) => {
    const peakA = Math.max(...simData.regional[a.id].map((d) => cellValue(a, d)));
    const peakB = Math.max(...simData.regional[b.id].map((d) => cellValue(b, d)));
    return peakA - peakB;
  });
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG_CARD = '#111820';
const BORDER = '#1c2838';
const TEXT = '#c8cdd3';
const TEXT_DIM = '#6b7a8d';
const GOLD = '#c5a44e';
const RED = '#c44e4e';
const GREEN = '#4ec46a';
const BLUE = '#4e8ac4';

const tooltipBase = {
  backgroundColor: BG_CARD,
  borderColor: BORDER,
  textStyle: { color: TEXT, fontSize: 12 },
};

const axisBase = {
  axisLabel: { color: TEXT_DIM, fontSize: 11 },
  axisLine: { lineStyle: { color: BORDER } },
  splitLine: { lineStyle: { color: BORDER, type: 'dashed' } },
};

// ── Chart option builders ─────────────────────────────────────────────────────

function priceChartOpts(simData, historicalKey) {
  const xLabels = Array.from({ length: MONTHS }, (_, i) => `M${i}`);
  const series = [
    {
      name: 'Managed-disruption path',
      type: 'line',
      data: simData.prices.map((p) => +p.toFixed(1)),
      showSymbol: false,
      lineStyle: { width: 2, color: GOLD },
      itemStyle: { color: GOLD },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(197,164,78,0.22)' },
            { offset: 1, color: 'rgba(197,164,78,0)' },
          ],
        },
      },
    },
  ];

  if (historicalKey) {
    const shock = HISTORICAL_SHOCKS[historicalKey];
    series.push({
      name: shock.name,
      type: 'line',
      data: historicalPricePoints(shock, simData.scenario.basePrice),
      showSymbol: false,
      lineStyle: { width: 1.5, type: 'dashed', color: TEXT_DIM },
      itemStyle: { color: TEXT_DIM },
    });
  }

  return {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: 'Brent under a managed-corridor regime',
      textStyle: { color: TEXT, fontSize: 12, fontWeight: '500' },
      top: 2,
    },
    legend: historicalKey ? {
      data: series.map((s) => s.name),
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      top: 0, right: 4, itemWidth: 14, itemHeight: 2,
    } : { show: false },
    grid: { top: 36, right: 16, bottom: 44, left: 56 },
    xAxis: {
      type: 'category',
      data: xLabels,
      name: 'Month',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: TEXT_DIM },
      ...axisBase,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '$/bbl',
      nameLocation: 'middle',
      nameGap: 48,
      nameTextStyle: { color: TEXT_DIM },
      ...axisBase,
    },
    tooltip: {
      trigger: 'axis',
      ...tooltipBase,
      formatter: (params) => params.map((p) => `${p.seriesName}: <b>$${p.value}</b>`).join('<br>'),
    },
    series,
  };
}

function heatmapOpts(simData, sorted) {
  const data = [];
  for (let ri = 0; ri < sorted.length; ri += 1) {
    const r = sorted[ri];
    for (let t = 0; t < MONTHS; t += 1) {
      data.push([t, ri, +cellValue(r, simData.regional[r.id][t]).toFixed(2)]);
    }
  }

  return {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: 'Observed-style propagation timeline · click a row for channels',
      textStyle: { color: TEXT, fontSize: 12, fontWeight: '500' },
      top: 2,
    },
    grid: { top: 36, right: 96, bottom: 40, left: 72 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: MONTHS }, (_, i) => `M${i}`),
      name: 'Month',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: TEXT_DIM },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
      axisLine: { lineStyle: { color: BORDER } },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((r) => r.shortName),
      axisLabel: { color: TEXT, fontSize: 11 },
      axisLine: { lineStyle: { color: BORDER } },
      splitArea: { show: false },
    },
    visualMap: {
      min: -4,
      max: 10,
      calculable: true,
      orient: 'vertical',
      right: 6,
      top: 36,
      bottom: 40,
      inRange: { color: [GREEN, BG_CARD, '#7a2222', RED] },
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      text: ['Severe', 'Benefit'],
    },
    tooltip: {
      position: 'top',
      ...tooltipBase,
      formatter: (p) => {
        if (!p.data) return '';
        const [month, ri] = p.data;
        const r = sorted[ri];
        const d = simData.regional[r.id][month];
        return [
          `<b>${r.name}</b> · Month ${month}`,
          `Instability: ${d.instability.toFixed(1)}/10`,
          `Inflation: +${d.totalInflation.toFixed(1)} ppt`,
          `Fiscal strain: +${d.fiscalStrain.toFixed(2)} ppt`,
          `Current account: ${d.currentAccount >= 0 ? '+' : ''}${d.currentAccount.toFixed(2)} ppt`,
        ].join('<br>');
      },
    },
    series: [{ type: 'heatmap', data, emphasis: { itemStyle: { borderColor: TEXT, borderWidth: 1 } } }],
  };
}

function channelOpts(region, regionData) {
  const xLabels = Array.from({ length: MONTHS }, (_, i) => `M${i}`);
  const makeArea = (name, values, color) => ({
    name,
    type: 'line',
    stack: 'channels',
    data: values.map((v) => +Math.max(0, v).toFixed(2)),
    showSymbol: false,
    lineStyle: { width: 0 },
    areaStyle: { color },
    emphasis: { focus: 'series' },
  });

  return {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: `Observed channels - ${region.name}`,
      textStyle: { color: TEXT, fontSize: 12, fontWeight: '500' },
      top: 2,
    },
    legend: {
      data: ['Energy', 'Food', 'LNG / gas', 'Fiscal strain', 'External deficit'],
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      top: 0, right: 0, itemWidth: 12, itemHeight: 8,
    },
    grid: { top: 36, right: 16, bottom: 44, left: 56 },
    xAxis: {
      type: 'category',
      data: xLabels,
      name: 'Month',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: TEXT_DIM },
      ...axisBase,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Pressure index',
      nameLocation: 'middle',
      nameGap: 48,
      nameTextStyle: { color: TEXT_DIM },
      ...axisBase,
    },
    tooltip: { trigger: 'axis', ...tooltipBase },
    series: [
      makeArea('Energy', regionData.map((d) => d.energyInflation), 'rgba(197,164,78,0.76)'),
      makeArea('Food', regionData.map((d) => d.foodInflation), 'rgba(196,110,78,0.66)'),
      makeArea('LNG / gas', regionData.map((d) => d.lngInflation), 'rgba(196,78,78,0.56)'),
      makeArea('Fiscal strain', regionData.map((d) => d.fiscalStrain), 'rgba(78,138,196,0.42)'),
      makeArea('External deficit', regionData.map((d) => Math.max(0, -d.currentAccount)), 'rgba(138,53,53,0.38)'),
    ],
  };
}

function comparisonOpts(simData, monthIdx) {
  const names = REGIONS.map((r) => r.shortName);
  const get = (key) => REGIONS.map((r) => +simData.regional[r.id][monthIdx][key].toFixed(2));

  return {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: `Regional comparison - Month ${monthIdx}`,
      textStyle: { color: TEXT, fontSize: 12, fontWeight: '500' },
      top: 2,
    },
    legend: {
      data: ['Inflation (ppt)', 'Fiscal strain (ppt)', 'Instability (/10)'],
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      top: 0, right: 0, itemWidth: 12, itemHeight: 8,
    },
    grid: { top: 36, right: 16, bottom: 60, left: 46 },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: TEXT_DIM, fontSize: 10, rotate: 35 },
      axisLine: { lineStyle: { color: BORDER } },
    },
    yAxis: {
      type: 'value',
      name: 'Index / ppt',
      nameTextStyle: { color: TEXT_DIM },
      nameLocation: 'middle',
      nameGap: 42,
      ...axisBase,
    },
    tooltip: { trigger: 'axis', ...tooltipBase },
    series: [
      { name: 'Inflation (ppt)', type: 'bar', data: get('totalInflation'), itemStyle: { color: GOLD }, barMaxWidth: 18 },
      { name: 'Fiscal strain (ppt)', type: 'bar', data: get('fiscalStrain'), itemStyle: { color: BLUE }, barMaxWidth: 18 },
      { name: 'Instability (/10)', type: 'bar', data: get('instability'), itemStyle: { color: RED }, barMaxWidth: 18 },
    ],
  };
}

// ── Widget markup ─────────────────────────────────────────────────────────────

const WIDGET_HTML = `
<div class="osh-widget">
  <div class="osh-header">
    <div>
      <div class="osh-header-eyebrow">Interactive model</div>
      <h3 class="osh-header-title">Managed Shock Propagation Simulator</h3>
    </div>
    <p class="osh-header-desc">Partial reopening · stock releases · LNG/refining losses · state response</p>
  </div>

  <div class="osh-controls">
    <label class="osh-control">
      <span class="osh-control-label">Gross disrupted flow <em class="osh-unit">mb/d</em></span>
      <div class="osh-slider-row">
        <input class="js-disrupted-flow" type="range" min="5" max="20" step="0.5" value="16">
        <strong class="js-disrupted-flow-val">16.0</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Corridor operating level <em class="osh-unit">% normal</em></span>
      <div class="osh-slider-row">
        <input class="js-corridor-recovery" type="range" min="0" max="60" step="1" value="12">
        <strong class="js-corridor-recovery-val">12%</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Reserve release <em class="osh-unit">mb/d</em></span>
      <div class="osh-slider-row">
        <input class="js-stock-release" type="range" min="0" max="5" step="0.1" value="2.2">
        <strong class="js-stock-release-val">2.2</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Shipping friction <em class="osh-unit">% premium</em></span>
      <div class="osh-slider-row">
        <input class="js-shipping-friction" type="range" min="0" max="35" step="1" value="18">
        <strong class="js-shipping-friction-val">18%</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Refining capacity offline <em class="osh-unit">mb/d</em></span>
      <div class="osh-slider-row">
        <input class="js-refining-loss" type="range" min="0" max="6" step="0.1" value="3">
        <strong class="js-refining-loss-val">3.0</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">LNG disruption <em class="osh-unit">% severity</em></span>
      <div class="osh-slider-row">
        <input class="js-lng-severity" type="range" min="0" max="100" step="5" value="60">
        <strong class="js-lng-severity-val">60%</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Policy coordination <em class="osh-unit">% strength</em></span>
      <div class="osh-slider-row">
        <input class="js-policy-coordination" type="range" min="0" max="100" step="5" value="55">
        <strong class="js-policy-coordination-val">55%</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Starting Brent <em class="osh-unit">$/bbl</em></span>
      <div class="osh-slider-row">
        <input class="js-base-price" type="range" min="70" max="120" step="1" value="84">
        <strong class="js-base-price-val">$84</strong>
      </div>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Duration</span>
      <select class="osh-select js-duration">
        <option value="1m">1 month</option>
        <option value="3m" selected>3 months</option>
        <option value="6m">6 months</option>
        <option value="12m">12+ months</option>
      </select>
    </label>

    <label class="osh-control">
      <span class="osh-control-label">Historical overlay</span>
      <select class="osh-select js-historical">
        <option value="">None</option>
        <option value="1973">1973 Arab Embargo</option>
        <option value="1979">1979 Iranian Revolution</option>
        <option value="1990">1990 Gulf War</option>
        <option value="2008">2008 Price Spike</option>
        <option value="2022">2022 Russia-Ukraine</option>
      </select>
    </label>
  </div>

  <div class="osh-panels-top" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:12px;">
    <div class="osh-panel"><div class="osh-control-label">Net shortfall</div><div class="js-kpi-shortfall" style="font-size:1.15rem;color:${TEXT};margin-top:6px;">0.0 mb/d</div></div>
    <div class="osh-panel"><div class="osh-control-label">Corridor regime</div><div class="js-kpi-regime" style="font-size:1.15rem;color:${TEXT};margin-top:6px;">Selective corridor regime</div></div>
    <div class="osh-panel"><div class="osh-control-label">Peak Brent</div><div class="js-kpi-peak" style="font-size:1.15rem;color:${TEXT};margin-top:6px;">$0</div></div>
    <div class="osh-panel"><div class="osh-control-label">Immediate relief</div><div class="js-kpi-relief" style="font-size:1.15rem;color:${TEXT};margin-top:6px;">0%</div></div>
  </div>

  <div class="osh-panels-top">
    <div class="osh-panel">
      <div class="osh-chart js-price-chart" style="height:252px;"></div>
    </div>
    <div class="osh-panel">
      <div class="osh-chart js-compare-chart" style="height:252px;"></div>
      <div class="osh-month-row">
        <span class="osh-month-label">Month</span>
        <input class="osh-month-slider js-month" type="range" min="0" max="23" step="1" value="3">
        <span class="js-month-val">3</span>
      </div>
    </div>
  </div>

  <div class="osh-panel osh-panel--heatmap">
    <div class="osh-chart osh-chart--heatmap js-heatmap-chart" style="height:320px;"></div>
  </div>

  <div class="osh-panel osh-panel--channels">
    <div class="osh-chart js-channels-chart" style="height:252px;"></div>
  </div>

  <details class="osh-notes">
    <summary class="osh-notes-summary">Methodology &amp; sources</summary>
    <div class="osh-notes-body">
      <p><strong>What changed from the original model</strong><br>
      The first version treated the crisis primarily as an immediate physical supply removal. This refresh adds the mechanisms observed in March 2026: partial corridor use, emergency stock release, shipping and insurance friction, refining outages, LNG disruption, and domestic policy buffering.</p>
      <p><strong>Price formation</strong><br>
      The Brent path combines a physical shortfall term with friction, refining, and LNG premiums, then discounts part of that with coordinated state response. The result is a stylised regime path, not a trading forecast.</p>
      <p><strong>Regional transmission</strong><br>
      Regional outcomes combine oil-import dependence, Hormuz exposure, reserve depth, fuel-subsidy capacity, food-channel strength, LNG exposure, refining exposure, and currency fragility. Stronger policy capacity suppresses headline inflation but raises fiscal strain.</p>
      <p><strong>Interpretation</strong><br>
      Heatmap cells show composite pressure or benefit, not one single variable. Click a region to inspect the channel mix over time.</p>
      <p><strong>Limitations</strong><br>
      Reduced-form simulation. It does not model firm-level substitution, monetary policy, recession feedbacks, military escalation branches, or exact trade-routing decisions. It is intended to reflect the logic of the March 2026 regime more faithfully than the opening-week shock model.</p>
    </div>
  </details>
</div>
`;

// ── Main renderer ─────────────────────────────────────────────────────────────

export function renderOilShock(el) {
  el.innerHTML = WIDGET_HTML;

  const disruptedFlowInput = el.querySelector('.js-disrupted-flow');
  const disruptedFlowVal = el.querySelector('.js-disrupted-flow-val');
  const corridorRecoveryInput = el.querySelector('.js-corridor-recovery');
  const corridorRecoveryVal = el.querySelector('.js-corridor-recovery-val');
  const stockReleaseInput = el.querySelector('.js-stock-release');
  const stockReleaseVal = el.querySelector('.js-stock-release-val');
  const shippingFrictionInput = el.querySelector('.js-shipping-friction');
  const shippingFrictionVal = el.querySelector('.js-shipping-friction-val');
  const refiningLossInput = el.querySelector('.js-refining-loss');
  const refiningLossVal = el.querySelector('.js-refining-loss-val');
  const lngSeverityInput = el.querySelector('.js-lng-severity');
  const lngSeverityVal = el.querySelector('.js-lng-severity-val');
  const policyCoordinationInput = el.querySelector('.js-policy-coordination');
  const policyCoordinationVal = el.querySelector('.js-policy-coordination-val');
  const basePriceInput = el.querySelector('.js-base-price');
  const basePriceVal = el.querySelector('.js-base-price-val');
  const durationSelect = el.querySelector('.js-duration');
  const historicalSelect = el.querySelector('.js-historical');
  const monthSlider = el.querySelector('.js-month');
  const monthVal = el.querySelector('.js-month-val');

  const kpiShortfall = el.querySelector('.js-kpi-shortfall');
  const kpiRegime = el.querySelector('.js-kpi-regime');
  const kpiPeak = el.querySelector('.js-kpi-peak');
  const kpiRelief = el.querySelector('.js-kpi-relief');

  const priceEl = el.querySelector('.js-price-chart');
  const compareEl = el.querySelector('.js-compare-chart');
  const heatmapEl = el.querySelector('.js-heatmap-chart');
  const channelsEl = el.querySelector('.js-channels-chart');

  let priceChart = null;
  let compareChart = null;
  let heatmapChart = null;
  let channelsChart = null;
  let comparisonMonth = 3;
  let selectedRegionId = 'india';
  let currentSorted = [];

  function getParams() {
    return {
      disruptedFlow: parseFloat(disruptedFlowInput.value),
      corridorRecovery: parseInt(corridorRecoveryInput.value, 10),
      stockRelease: parseFloat(stockReleaseInput.value),
      shippingFriction: parseInt(shippingFrictionInput.value, 10),
      refiningLoss: parseFloat(refiningLossInput.value),
      lngSeverity: parseInt(lngSeverityInput.value, 10),
      policyCoordination: parseInt(policyCoordinationInput.value, 10),
      basePrice: parseInt(basePriceInput.value, 10),
      durationMonths: DURATION_MONTHS[durationSelect.value],
    };
  }

  function renderKpis(simData) {
    const relief = simData.scenario.blockedFlow > 0
      ? (simData.scenario.reserveOffset / simData.scenario.blockedFlow) * 100
      : 0;
    kpiShortfall.textContent = `${simData.scenario.netShortfall.toFixed(1)} mb/d`;
    kpiRegime.textContent = simData.scenario.regimeLabel;
    kpiPeak.textContent = `$${Math.max(...simData.prices).toFixed(0)}`;
    kpiRelief.textContent = `${relief.toFixed(0)}%`;
  }

  function update() {
    const params = getParams();

    disruptedFlowVal.textContent = params.disruptedFlow.toFixed(1);
    corridorRecoveryVal.textContent = `${params.corridorRecovery}%`;
    stockReleaseVal.textContent = params.stockRelease.toFixed(1);
    shippingFrictionVal.textContent = `${params.shippingFriction}%`;
    refiningLossVal.textContent = params.refiningLoss.toFixed(1);
    lngSeverityVal.textContent = `${params.lngSeverity}%`;
    policyCoordinationVal.textContent = `${params.policyCoordination}%`;
    basePriceVal.textContent = `$${params.basePrice}`;

    const sim = simulate(params);
    currentSorted = sortByPeakSeverity(sim);
    renderKpis(sim);

    const selReg = REGIONS.find((r) => r.id === selectedRegionId) ?? REGIONS[5];
    const histKey = historicalSelect.value || null;

    const pOpts = priceChartOpts(sim, histKey);
    if (priceChart) priceChart.setOption(pOpts, true);
    else priceChart = renderEChart(priceEl, pOpts);

    const cOpts = comparisonOpts(sim, comparisonMonth);
    if (compareChart) compareChart.setOption(cOpts, true);
    else compareChart = renderEChart(compareEl, cOpts);

    const hmOpts = heatmapOpts(sim, currentSorted);
    if (heatmapChart) {
      heatmapChart.setOption(hmOpts, true);
    } else {
      heatmapChart = renderEChart(heatmapEl, hmOpts);
      if (heatmapChart) {
        heatmapChart.on('click', ({ data }) => {
          if (!data) return;
          const [, regionIdx] = data;
          selectedRegionId = currentSorted[regionIdx]?.id ?? selectedRegionId;
          const reg = REGIONS.find((r) => r.id === selectedRegionId) ?? REGIONS[5];
          const sim2 = simulate(getParams());
          const chOpts = channelOpts(reg, sim2.regional[reg.id]);
          if (channelsChart) channelsChart.setOption(chOpts, true);
          else channelsChart = renderEChart(channelsEl, chOpts);
        });
      }
    }

    const chOpts = channelOpts(selReg, sim.regional[selReg.id]);
    if (channelsChart) channelsChart.setOption(chOpts, true);
    else channelsChart = renderEChart(channelsEl, chOpts);
  }

  monthSlider.addEventListener('input', () => {
    comparisonMonth = parseInt(monthSlider.value, 10);
    monthVal.textContent = comparisonMonth;
    const sim = simulate(getParams());
    const opts = comparisonOpts(sim, comparisonMonth);
    if (compareChart) compareChart.setOption(opts, true);
    else compareChart = renderEChart(compareEl, opts);
  });

  [
    disruptedFlowInput,
    corridorRecoveryInput,
    stockReleaseInput,
    shippingFrictionInput,
    refiningLossInput,
    lngSeverityInput,
    policyCoordinationInput,
    basePriceInput,
  ].forEach((input) => input.addEventListener('input', update));

  durationSelect.addEventListener('change', update);
  historicalSelect.addEventListener('change', update);

  update();
}

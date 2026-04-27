/**
 * core.js — Loom theme visualization runtime
 *
 * Registry-driven: reads REGISTRY from viz-registry.js, detects which
 * libraries are needed, loads CDN assets, initialises adapters, renders
 * per-element visualisations, and wires scrolly step updates.
 *
 * ── How it works ──────────────────────────────────────────────────────────────
 *   1. Detection  — each registry entry's detect() is called.
 *   2. CDN load   — styles + scripts for detected libraries are loaded.
 *   3. Init       — optional one-time init() is called (KaTeX, Mermaid).
 *   4. Render     — for entries with a selector, each matching element
 *                   gets render(el, options) called.
 *   5. Scrolly    — story:step events from narrative.js are routed to
 *                   the matching element's update() based on data-update JSON.
 *
 * ── Adding a new library ──────────────────────────────────────────────────────
 *   1. Create assets/js/viz/your-lib.js  (init, render, update exports)
 *   2. Add an entry to REGISTRY in viz-registry.js
 *   3. Add a body-class flag in _layouts/default.html if needed
 *   4. Add the flag to post front matter
 *
 * Body-class flags (set by Jekyll layouts via front matter):
 *   math: true     → tag-hash-math
 *   diagram: true  → tag-hash-diagram
 *   viz: true      → tag-hash-viz
 *   geo: true      → tag-hash-geo
 *   leaflet: true  → tag-hash-leaflet
 *   d3: true       → tag-hash-d3
 *   story: true    → tag-hash-story  (used by essay/core.js for Scrollama)
 */

import { REGISTRY } from './viz-registry.js';
import { deriveTitleFromHref, getWayfindingForPath, resolveBookHref } from './book-wayfinding.js';

// ── CDN loaders ───────────────────────────────────────────────────────────────

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  l.crossOrigin = 'anonymous';
  document.head.appendChild(l);
}

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = resolve;
    s.onerror = resolve; // resolve on error so await doesn't hang
    document.head.appendChild(s);
  });
}

async function loadCDN({ styles = [], scripts = [] } = {}) {
  styles.forEach(loadStyle);
  for (const src of scripts) await loadScript(src);
}

// ── Element ID helper ─────────────────────────────────────────────────────────

let autoId = 0;
function ensureId(el) {
  if (!el.id) el.id = `loom-viz-${++autoId}`;
  return el.id;
}

// ── Instance store ────────────────────────────────────────────────────────────
// Maps element id → { entry, el, instance } so scrolly updates can look up
// the right adapter + instance by the id in data-update JSON.

const instances = new Map();

// ── Scrolly wiring ────────────────────────────────────────────────────────────
// narrative.js dispatches story:step (bubbles: true) with detail.element
// pointing to the active story step element.
//
// If that element has data-update JSON, core.js routes each key → the
// matching registry entry's update() function.
//
// Example step element:
//   <div class="story-step" data-step="1"
//        data-update='{"city-map": {"lat": 48.858, "lng": 2.295, "zoom": 14}}'>

function wireScrolly() {
  document.addEventListener('story:step', (e) => {
    const stepEl = e.detail?.element;
    if (!stepEl?.dataset.update) return;

    let updates;
    try {
      updates = JSON.parse(stepEl.dataset.update);
    } catch {
      return;
    }

    Object.entries(updates).forEach(([id, data]) => {
      const rec = instances.get(id);
      if (!rec?.entry.update) return;
      rec.entry.update(rec.el, data, rec.instance);
    });
  });
}

function initKeyboardNav() {
  const steps = Array.from(document.querySelectorAll('.story-step'));
  if (steps.length === 0) return;

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;

    const active = document.querySelector('.story-step[data-active]');
    const idx = active ? steps.indexOf(active) : -1;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      steps[Math.min(idx + 1, steps.length - 1)]
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      steps[Math.max(idx - 1, 0)]
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      e.preventDefault();
    }
  });
}

let storyInited = false;

async function initStorytelling() {
  if (storyInited) return;
  const sections = Array.from(document.querySelectorAll('.story-section'));
  if (sections.length === 0) return;

  sections.forEach((section, sectionIdx) => {
    const graphic = section.querySelector('.story-graphic');
    const stepEls = Array.from(section.querySelectorAll('.story-step'));
    if (!graphic || stepEls.length === 0) return;

    if (!section.id) section.id = `story-${sectionIdx + 1}`;
    graphic.setAttribute('aria-live', 'polite');

    function activateStep(stepEl, index = 0, direction = 'down') {
      stepEls.forEach((step) => {
        step.removeAttribute('data-active');
        step.setAttribute('aria-hidden', 'true');
      });

      stepEl.setAttribute('data-active', '');
      stepEl.removeAttribute('aria-hidden');

      graphic.dispatchEvent(new CustomEvent('story:step', {
        bubbles: true,
        detail: {
          index,
          step: stepEl.dataset.step ?? String(index),
          direction,
          element: stepEl,
        },
      }));
    }

    activateStep(stepEls[0], 0, 'down');

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      const stepEl = visible.target;
      const index = stepEls.indexOf(stepEl);
      activateStep(stepEl, index, 'down');
    }, {
      root: null,
      rootMargin: '-35% 0px -35% 0px',
      threshold: [0.15, 0.4, 0.7],
    });

    stepEls.forEach((stepEl, index) => {
      if (!stepEl.id) stepEl.id = `${section.id}-step-${index + 1}`;
      observer.observe(stepEl);
    });
  });

  initKeyboardNav();
  storyInited = true;
}

// ── Reading progress bar ──────────────────────────────────────────────────────
// Adds a fixed 2px progress bar at the top of the viewport on post pages.
// Essay pages already get this from essay/progress.js; skipped here to avoid
// double-mounting.

function normalizePath(pathname) {
  if (!pathname) return '/';
  const cleaned = pathname
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '/');
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}

function currentPath() {
  return normalizePath(window.location.pathname);
}

function isHomeLikePath(pathname) {
  return pathname === '/' || pathname === '/learn/';
}

function isReadingPage() {
  const path = currentPath();
  if (isHomeLikePath(path)) return false;
  if (document.getElementById('essay-content')) return false;
  if (document.body.classList.contains('reading-body')) return true;
  if (document.querySelector('#TOC') && document.querySelector('h2, h3')) return true;
  return false;
}

function escapeHtml(text = '') {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(text = '') {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveNavTitle(href = '', explicit = '') {
  return explicit || deriveTitleFromHref(href);
}

function renderTopWayfinding(pathname, chapterTitle) {
  const state = getWayfindingForPath(pathname);
  if (!state || state.isSectionHome) return '';

  const sectionTitle = state.section.title;
  const bookHomeHref = resolveBookHref(pathname, '/');
  const allModelsHref = resolveBookHref(pathname, '/all-models/');
  const sectionHref = resolveBookHref(pathname, state.section.href);
  const progress = state.chapterIndex >= 0
    ? `Chapter ${state.chapterIndex + 1} of ${state.chapterCount}`
    : `${state.chapterCount} chapters`;

  return `
    <div class="wayward-wayfinding">
      <nav class="wayward-breadcrumbs" aria-label="Breadcrumb">
        <a href="${escapeHtml(bookHomeHref)}">Computational Geography</a>
        <span aria-hidden="true">/</span>
        <a href="${escapeHtml(sectionHref)}">${escapeHtml(sectionTitle)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${escapeHtml(chapterTitle)}</span>
      </nav>
      <div class="wayward-wayfinding__row">
        <div class="wayward-wayfinding__identity">
          <span class="wayward-wayfinding__eyebrow">Reading Path</span>
          <div class="wayward-wayfinding__section">${escapeHtml(sectionTitle)}</div>
          <div class="wayward-wayfinding__progress">${escapeHtml(progress)}</div>
        </div>
        <div class="wayward-wayfinding__actions">
          <a class="wayward-wayfinding__action" href="${escapeHtml(sectionHref)}">Back to start of chapter</a>
          <a class="wayward-wayfinding__action" href="${escapeHtml(allModelsHref)}">All models</a>
          ${document.querySelector('#TOC') ? '<a class="wayward-wayfinding__action" href="#TOC">Jump to contents</a>' : ''}
        </div>
      </div>
    </div>
  `;
}

function renderPagerCard(kind, item, fallbackHref, fallbackLabel, itemDescription, fallbackDescription) {
  if (!item) {
    return `
      <a class="wayward-pager-card wayward-pager-card--muted" href="${escapeHtml(fallbackHref)}">
        <span class="wayward-pager-card__eyebrow">${escapeHtml(kind)}</span>
        <strong>${escapeHtml(fallbackLabel)}</strong>
        <p>${escapeHtml(fallbackDescription)}</p>
      </a>
    `;
  }

  return `
    <a class="wayward-pager-card" href="${escapeHtml(item.href || fallbackHref)}">
      <span class="wayward-pager-card__eyebrow">${escapeHtml(kind)}</span>
      <strong>${escapeHtml(resolveNavTitle(item.href, item.title))}</strong>
      <p>${escapeHtml(itemDescription)}</p>
    </a>
  `;
}

function renderBottomWayfinding(pathname) {
  const state = getWayfindingForPath(pathname);
  if (!state || state.isSectionHome) return null;
  const sectionHref = resolveBookHref(pathname, state.section.href);
  const previousItem = state.previous
    ? { ...state.previous, href: resolveBookHref(pathname, state.previous.href) }
    : null;
  const nextItem = state.next
    ? { ...state.next, href: resolveBookHref(pathname, state.next.href) }
    : null;
  const currentChapterTitle = document.querySelector('#title-block-header .title, main h1')?.textContent?.trim()
    || resolveNavTitle(pathname);
  const progress = state.chapterIndex >= 0
    ? `In ${state.section.title}, chapter ${state.chapterIndex + 1} of ${state.chapterCount}.`
    : `${state.chapterCount} chapters in this reading path.`;

  const nav = document.createElement('nav');
  nav.className = 'wayward-reading-pager';
  nav.setAttribute('aria-label', 'Chapter navigation');
  nav.innerHTML = `
    ${renderPagerCard(
      'Previous',
      previousItem,
      sectionHref,
      'Back to start of chapter',
      'Read the previous chapter in this path.',
      'Return to the section opener for this chapter path.',
    )}
    <div class="wayward-pager-card wayward-pager-card--current" aria-current="page">
      <span class="wayward-pager-card__eyebrow">Where you are</span>
      <strong>${escapeHtml(currentChapterTitle)}</strong>
      <p>${escapeHtml(progress)}</p>
    </div>
    ${renderPagerCard(
      'Next',
      nextItem,
      sectionHref,
      'Chapter path complete',
      'Continue to the next chapter in this path.',
      'You’ve reached the end of this chapter path.',
    )}
  `;

  return nav;
}

function formatDisplayDate(value) {
  if (!value) return '';

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function computeReadingTime(text = '') {
  const words = (text.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
  const minutes = Math.max(1, Math.round(words / 225));
  return `${minutes} min read`;
}

function getArticleUrl() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  return canonical || window.location.href;
}

function shareIcon(kind) {
  const icons = {
    email: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Zm1.6.1 6.4 5.1 6.4-5.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 7.75h7.25A1.75 1.75 0 0 1 19 9.5v8.75A1.75 1.75 0 0 1 17.25 20H8.5a1.75 1.75 0 0 1-1.75-1.75V11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.75 15H6A1.75 1.75 0 0 1 4.25 13.25V4.5A1.75 1.75 0 0 1 6 2.75h8.75A1.75 1.75 0 0 1 16.5 4.5v.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.75a8.25 8.25 0 0 0-2.61 16.07c.41.07.56-.18.56-.4 0-.2-.01-.86-.01-1.56-2.06.38-2.59-.5-2.75-.96-.09-.24-.47-.96-.81-1.15-.28-.15-.68-.53-.01-.54.63-.01 1.08.58 1.23.82.72 1.22 1.87.88 2.33.67.07-.52.28-.88.5-1.08-1.83-.21-3.74-.92-3.74-4.08 0-.9.32-1.64.84-2.22-.08-.21-.37-1.05.08-2.19 0 0 .69-.22 2.27.85a7.7 7.7 0 0 1 4.14 0c1.58-1.08 2.27-.85 2.27-.85.45 1.14.16 1.98.08 2.19.52.58.84 1.31.84 2.22 0 3.17-1.92 3.87-3.75 4.08.29.25.55.74.55 1.5 0 1.08-.01 1.95-.01 2.22 0 .22.15.48.56.4A8.25 8.25 0 0 0 12 3.75Z" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.2 13.5c0-.8-.7-1.5-1.5-1.5-.4 0-.8.2-1.1.5-1.1-.7-2.5-1.1-4.1-1.2l.9-3 2.6.6a1.3 1.3 0 1 0 .2-1 1.3 1.3 0 0 0-.1.2l-2.9-.7a.6.6 0 0 0-.7.4l-1 3.4c-1.6.1-3 .5-4.1 1.2a1.5 1.5 0 1 0-1 2.5v.1c0 2.2 2.6 4 5.9 4s5.9-1.8 5.9-4v-.1c.6-.2 1-.8 1-1.4Zm-8.3 1.8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4.2 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-5.1 2.5c.6.4 1.4.6 2.4.6s1.8-.2 2.4-.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.3 8.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM4.9 10.2h2.8V19H4.9zM10.1 10.2h2.7v1.2h.1c.4-.7 1.3-1.5 2.8-1.5 3 0 3.5 1.9 3.5 4.5V19h-2.8v-4c0-.9 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V19h-2.8z" fill="currentColor"/></svg>',
  };

  return icons[kind] || '';
}

function headerIcon(kind) {
  const icons = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m15.2 15.2 4.1 4.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  return icons[kind] || '';
}

const searchState = {
  dialog: null,
  documents: [],
  input: null,
  results: null,
  status: null,
  promise: null,
};

function stripHtml(text = '') {
  const temp = document.createElement('div');
  temp.innerHTML = text;
  return temp.textContent?.trim() || '';
}

function getSearchIndexUrl() {
  return new URL('../../search.json', import.meta.url);
}

function buildSearchDocuments(records = []) {
  const grouped = new Map();
  const baseUrl = getSearchIndexUrl();

  records.forEach((record) => {
    const rawHref = record.href || record.objectID || '';
    const pageHref = rawHref.split('#')[0];
    if (!pageHref) return;

    const key = pageHref;
    const section = stripHtml(record.section || '');
    const crumbs = (record.crumbs || []).map((crumb) => stripHtml(crumb)).filter(Boolean);
    const bodyText = stripHtml(record.text || '');

    if (!grouped.has(key)) {
      grouped.set(key, {
        href: new URL(pageHref, baseUrl).toString(),
        title: stripHtml(record.title || ''),
        section,
        crumbs,
        body: bodyText,
      });
      return;
    }

    const existing = grouped.get(key);
    existing.body = `${existing.body} ${bodyText}`.trim();
    if (!existing.section && section) existing.section = section;
    if (existing.crumbs.length === 0 && crumbs.length > 0) existing.crumbs = crumbs;
  });

  return Array.from(grouped.values());
}

async function loadSearchIndex() {
  if (!searchState.promise) {
    searchState.promise = fetch(getSearchIndexUrl())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Search index unavailable (${response.status})`);
        }
        return response.json();
      })
      .then((records) => buildSearchDocuments(records));
  }

  return searchState.promise;
}

function rankSearchResults(query, documents) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const terms = trimmed.split(/\s+/).filter(Boolean);

  return documents
    .map((doc) => {
      const title = doc.title.toLowerCase();
      const section = doc.section.toLowerCase();
      const crumbs = doc.crumbs.join(' ').toLowerCase();
      const body = doc.body.toLowerCase();
      let score = 0;

      for (const term of terms) {
        const inTitle = title.includes(term);
        const inSection = section.includes(term);
        const inCrumbs = crumbs.includes(term);
        const inBody = body.includes(term);

        if (!inTitle && !inSection && !inCrumbs && !inBody) {
          return null;
        }

        if (inTitle) score += 14;
        if (inSection) score += 9;
        if (inCrumbs) score += 5;
        if (inBody) score += 1;
      }

      return { doc, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function renderSearchResults(query, documents = []) {
  if (!searchState.results || !searchState.status) return;

  const trimmed = query.trim();
  if (!trimmed) {
    searchState.results.innerHTML = '';
    searchState.status.textContent = 'Type to search the library.';
    return;
  }

  const matches = rankSearchResults(trimmed, documents);
  if (matches.length === 0) {
    searchState.results.innerHTML = '';
    searchState.status.textContent = 'No matching pages found.';
    return;
  }

  searchState.status.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  searchState.results.innerHTML = matches.map(({ doc }) => `
    <a class="wayward-search-result" href="${escapeHtml(doc.href)}">
      <span class="wayward-search-result__title">${escapeHtml(doc.title || 'Untitled')}</span>
      ${doc.section ? `<span class="wayward-search-result__section">${escapeHtml(doc.section)}</span>` : ''}
      ${doc.crumbs.length > 0 ? `<span class="wayward-search-result__crumbs">${escapeHtml(doc.crumbs.join(' / '))}</span>` : ''}
    </a>
  `).join('');
}

function closeSearchDialog() {
  searchState.dialog?.setAttribute('hidden', '');
  document.body.classList.remove('wayward-search-open');
}

function ensureSearchDialog() {
  if (searchState.dialog) return searchState.dialog;

  const dialog = document.createElement('div');
  dialog.className = 'wayward-search-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="wayward-search-dialog__backdrop" data-search-close></div>
    <div class="wayward-search-dialog__panel" role="dialog" aria-modal="true" aria-label="Search computational geography">
      <div class="wayward-search-dialog__head">
        <div>
          <div class="wayward-search-dialog__eyebrow">Search</div>
          <h2 class="wayward-search-dialog__title">Find a chapter or topic</h2>
        </div>
        <button class="wayward-search-dialog__close" type="button" aria-label="Close search" data-search-close>Close</button>
      </div>
      <label class="wayward-search-dialog__field">
        <span class="wayward-search-dialog__icon">${headerIcon('search')}</span>
        <input class="wayward-search-dialog__input" type="search" placeholder="Search the library" autocomplete="off" spellcheck="false">
      </label>
      <div class="wayward-search-dialog__status">Loading search index…</div>
      <div class="wayward-search-dialog__results"></div>
    </div>
  `;

  document.body.appendChild(dialog);

  searchState.dialog = dialog;
  searchState.input = dialog.querySelector('.wayward-search-dialog__input');
  searchState.results = dialog.querySelector('.wayward-search-dialog__results');
  searchState.status = dialog.querySelector('.wayward-search-dialog__status');

  searchState.input?.addEventListener('input', () => {
    renderSearchResults(searchState.input?.value || '', searchState.documents);
  });

  dialog.querySelectorAll('[data-search-close]').forEach((node) => {
    node.addEventListener('click', closeSearchDialog);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeSearchDialog();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSearchDialog();
  });

  return dialog;
}

async function openSearchDialog() {
  const dialog = ensureSearchDialog();
  dialog.hidden = false;
  document.body.classList.add('wayward-search-open');
  searchState.input?.focus();

  searchState.status.textContent = 'Loading search index…';
  searchState.results.innerHTML = '';

  try {
    const documents = await loadSearchIndex();
    searchState.documents = documents;
    searchState.status.textContent = 'Type to search the library.';
    renderSearchResults(searchState.input?.value || '', documents);
  } catch (error) {
    searchState.status.textContent = 'Search is not available on this build yet.';
    void error;
  }
}

function enhanceReadingTitleBlock(main, title, toc) {
  if (!title || title.dataset.enhanced === 'true') return;

  const contentText = Array.from(main.children)
    .filter((child) => child !== title && child !== toc)
    .map((child) => child.textContent || '')
    .join(' ');

  const heading = title.querySelector('.title, .chapter-title');
  if (!heading) return;

  const subtitleEl = title.querySelector('.subtitle, .description');
  const dateEl = title.querySelector('.date');
  const authorEl = title.querySelector('.author');
  const titleText = heading.textContent?.trim() || document.title;
  const subtitle = subtitleEl?.textContent?.trim() || '';
  const displayDate = formatDisplayDate(
    dateEl?.textContent?.trim() ||
    document.querySelector('meta[name="dcterms.date"]')?.getAttribute('content') ||
    ''
  );
  const author = authorEl?.textContent?.trim() || '';
  const readingTime = computeReadingTime(contentText);
  const url = getArticleUrl();
  const issueBody = `Article: ${titleText}\nURL: ${url}\n\nFeedback:\n`;
  const githubIssueUrl = `https://github.com/WaywardHouse/waywardhouse-site/issues/new?title=${encodeURIComponent(`Feedback: ${titleText}`)}&body=${encodeURIComponent(issueBody)}`;
  const metaBits = [];

  if (author) {
    metaBits.push(`<span class="post-meta-author">${escapeHtml(author)}</span>`);
  }
  if (displayDate) {
    metaBits.push(`<span class="post-meta-date">${escapeHtml(displayDate)}</span>`);
  }
  metaBits.push(`<span class="post-meta-reading-time">${escapeHtml(readingTime)}</span>`);

  title.classList.add('wayward-reading-head');
  title.innerHTML = `
    ${renderTopWayfinding(currentPath(), titleText)}
    <div class="wayward-reading-head__meta-row">
      <div class="post-meta" aria-label="Article details">
        ${metaBits.map((bit, index) => `${index > 0 ? '<span class="post-meta-divider" aria-hidden="true">|</span>' : ''}${bit}`).join('')}
      </div>
      <div class="post-share" aria-label="Share article">
        <a class="post-share-button" href="mailto:?subject=${encodeURIComponent(titleText)}&body=${encodeURIComponent(url)}" target="_blank" rel="noopener noreferrer" aria-label="Share by email">
          <span class="post-share-icon">${shareIcon('email')}</span>
        </a>
        <a class="post-share-button" href="https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titleText)}" target="_blank" rel="noopener noreferrer" aria-label="Share on X">
          <span class="post-share-icon">${shareIcon('x')}</span>
        </a>
        <a class="post-share-button" href="https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(titleText)}" target="_blank" rel="noopener noreferrer" aria-label="Share on Reddit">
          <span class="post-share-icon">${shareIcon('reddit')}</span>
        </a>
        <a class="post-share-button" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
          <span class="post-share-icon">${shareIcon('linkedin')}</span>
        </a>
        <a class="post-share-button" href="${githubIssueUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open a GitHub issue for this article">
          <span class="post-share-icon">${shareIcon('github')}</span>
        </a>
      </div>
    </div>
    <h1 class="title"><span class="chapter-title">${escapeHtml(titleText)}</span></h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  `;
  title.dataset.enhanced = 'true';
}

function injectWaywardChrome() {
  if (document.querySelector('.wayward-header')) return;

  const path = currentPath();
  const body = document.body;

  body.classList.add('wayward-shell');
  if (isHomeLikePath(path)) body.classList.add('page-home');
  if (isReadingPage()) body.classList.add('page-reading');
  if (path.startsWith('/learn/')) body.classList.add('page-learn');

  const header = document.createElement('header');
  header.className = 'wayward-header';
  header.innerHTML = `
    <div class="wayward-header__inner">
      <a class="wayward-brand" href="/" aria-label="Wayward House home">
        <span class="wayward-brand__mark">WaywardHouse</span>
        <span class="wayward-brand__dot" aria-hidden="true">.</span>
      </a>
      <nav class="wayward-nav" aria-label="Primary">
        <a href="/articles/" data-nav="/articles/">Articles</a>
        <a href="/learn/" data-nav="/learn/">Learn</a>
        <a href="/pages/about.html" data-nav="/pages/about/">About</a>
      </nav>
      <div class="wayward-header__actions">
        <button class="wayward-search-launch" type="button" aria-label="Search this book">
          <span class="wayward-search-launch__icon">${headerIcon('search')}</span>
          <span class="wayward-search-launch__label">Search the book</span>
          <span class="wayward-search-launch__hint" aria-hidden="true">/</span>
        </button>
      </div>
    </div>
  `;

  header.querySelectorAll('[data-nav]').forEach((link) => {
    const target = link.getAttribute('data-nav');
    if (!target) return;
    if (path === target || path.startsWith(target)) {
      link.classList.add('is-active');
    }
  });

  const searchLaunch = header.querySelector('.wayward-search-launch');

  searchLaunch?.addEventListener('click', () => {
    openSearchDialog();
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.key !== '/') return;
    if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    openSearchDialog();
  });

  const footer = document.querySelector('footer.wayward-footer');

  const contentNodes = Array.from(body.children).filter((node) => {
    if (node === header || node === footer) return false;
    if (node.tagName === 'SCRIPT') return false;
    if (node.classList.contains('wayward-header')) return false;
    if (node.classList.contains('wayward-footer')) return false;
    return true;
  });

  const main = document.createElement('main');
  main.className = 'wayward-main';
  contentNodes.forEach((node) => main.appendChild(node));

  if (body.classList.contains('page-reading')) {
    const toc = main.querySelector('#TOC');
    const title = main.querySelector('#title-block-header');

    enhanceReadingTitleBlock(main, title, toc);

    if (toc && title) {
      const layout = document.createElement('div');
      layout.className = 'wayward-reading-layout';

      const aside = document.createElement('aside');
      aside.className = 'wayward-reading-toc';
      aside.appendChild(toc);

      const content = document.createElement('article');
      content.className = 'wayward-reading-content';
      Array.from(main.children).forEach((child) => {
        if (child !== toc) content.appendChild(child);
      });

      const pager = renderBottomWayfinding(path);
      if (pager) content.appendChild(pager);

      layout.appendChild(aside);
      layout.appendChild(content);
      main.appendChild(layout);
    }
  }

  body.prepend(main);
  body.prepend(header);

  if (!footer) {
    const runtimeFooter = document.createElement('footer');
    runtimeFooter.className = 'wayward-footer';
    runtimeFooter.innerHTML = `
      <div class="wayward-footer__inner">
        <div class="wayward-footer__brand">
          <div class="wayward-footer__logo">WaywardHouse <span>.</span></div>
          <p>Understanding how place, economy, and environment interact through analysis, modelling, and open tools.</p>
        </div>
        <div class="wayward-footer__group">
          <h2>Reading</h2>
          <a href="/articles/">Articles</a>
          <a href="/learn/">Learn</a>
          <a href="/topics/">Topics</a>
        </div>
        <div class="wayward-footer__group">
          <h2>Site</h2>
          <a href="/">Home</a>
          <a href="/pages/about.html">About</a>
          <a href="/pages/contact.html">Contact</a>
        </div>
      </div>
    `;

    const firstScript = body.querySelector('script');
    if (firstScript) {
      body.insertBefore(runtimeFooter, firstScript);
    } else {
      body.appendChild(runtimeFooter);
    }
  }
}

function initPostProgress() {
  if (document.getElementById('essay-content')) return; // essay handles it
  if (!isReadingPage()) return;
  if (document.querySelector('.essay-progress-bar')) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bar = document.createElement('div');
  bar.className = 'essay-progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Reading progress');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '0');
  document.body.prepend(bar);

  if (prefersReduced) return;

  let ticking = false;

  function update() {
    const scrolled  = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const pct = maxScroll > 0 ? Math.min(100, (scrolled / maxScroll) * 100) : 0;
    bar.style.setProperty('--progress', `${pct}%`);
    bar.setAttribute('aria-valuenow', Math.round(pct));
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

// ── Copy buttons ──────────────────────────────────────────────────────────────
// Adds a "Copy" button to every <pre><code> block in .gh-content.
// essay/core.js does the same for #essay-content; this covers regular posts.
// Skipped on essay pages to avoid double-adding buttons.

function addCopyButtons() {
  if (document.getElementById('essay-content')) return; // essay/core.js handles it
  document.querySelectorAll('.gh-content pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (pre.querySelector('.copy-btn')) return;

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? '');
        btn.textContent = 'Copied!';
        btn.classList.add('copy-btn--done');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copy-btn--done');
        }, 2000);
      } catch {
        btn.textContent = 'Error';
      }
    });

    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function init() {
  injectWaywardChrome();

  // Pass the main content element to detect() so it can check text content
  // (used by math detection to find bare $ signs).
  const content = document.querySelector('.gh-content, .essay-content, .post-content, article');

  for (const entry of REGISTRY) {
    if (!entry.detect(content)) continue;

    try {
      await loadCDN(entry.cdn);

      if (entry.init) await entry.init();

      if (entry.selector) {
        const els = Array.from(document.querySelectorAll(entry.selector));
        for (const el of els) {
          const id = ensureId(el);
          let opts = {};
          try {
            if (el.dataset.options) opts = JSON.parse(el.dataset.options);
          } catch {
            console.warn('[loom] Invalid data-options JSON on', el);
          }
          const instance = entry.render ? await entry.render(el, opts) : null;
          instances.set(id, { entry, el, instance });
        }
      }
    } catch (error) {
      console.error(`[loom] Failed to initialize visual adapter "${entry.id}".`, error);
    }
  }

  initPostProgress();
  addCopyButtons();
  wireScrolly();
  await initStorytelling();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

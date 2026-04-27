/**
 * essay/core.js — Computational essay runtime orchestrator
 *
 * Loaded as an ES module when a post/page carries tag "essay" or "story".
 * The main viz scanner (assets/js/core.js) still runs for [data-viz] elements.
 * This module handles essay-specific features only.
 *
 * Features:
 *   • TOC — builds and injects <li> elements from h2/h3 headings
 *   • Copy buttons — appended to all <pre><code> blocks
 *   • Endnotes — collects [data-cite] elements, builds reference list
 *   • Sidenotes — Tufte-style margin notes (desktop) / inline (mobile)
 *   • Progress bar — reading % indicator fixed at top of viewport
 *   • TOC tracking — highlights active section while scrolling
 *   • Narrative — Scrollama scrollytelling (when window.scrollama present)
 *   • Keyboard nav — ↑↓ arrows navigate story steps
 *
 * @module essay/core
 */

import { initSidenotes }                 from './sidenotes.js';
import { initProgress, initTocTracking } from './progress.js';
import { initNarrative }                 from './narrative.js';

// ── TOC builder ───────────────────────────────────────────────────────────────

function buildToc() {
  const toc     = document.getElementById('essay-toc');
  const tocList = document.getElementById('essay-toc-list');
  const content = document.getElementById('essay-content');
  if (!toc || !tocList || !content) return;

  const headings = Array.from(content.querySelectorAll('h2, h3'))
    .filter(h => !h.hasAttribute('data-notoc'));
  if (headings.length < 2) {
    toc.setAttribute('hidden', '');
    return;
  }

  let counter = 0;
  headings.forEach((h) => {
    if (!h.id) h.id = `section-${++counter}`;

    const li = document.createElement('li');
    li.className = h.tagName === 'H3' ? 'toc-item toc-item--sub' : 'toc-item';

    const a = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = 'toc-link';
    a.textContent = h.textContent;

    li.appendChild(a);
    tocList.appendChild(li);
  });
}

// ── Copy buttons ──────────────────────────────────────────────────────────────

function addCopyButtons() {
  document.querySelectorAll('#essay-content pre > code').forEach((code) => {
    const pre = code.parentElement;
    if (pre.querySelector('.copy-btn')) return; // idempotent

    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'copy-btn';
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

    pre.appendChild(btn);
  });
}

// ── Endnotes ──────────────────────────────────────────────────────────────────
//
// Authors mark citations with:
//   <cite data-cite="Author, Title. URL">visible label</cite>
//
// This replaces each <cite> with a superscript back-reference and builds
// a numbered reference list in #essay-endnotes.

function buildEndnotes() {
  const section = document.getElementById('essay-endnotes');
  const list    = document.getElementById('essay-endnotes-list');
  if (!section || !list) return;

  const cites = Array.from(
    document.querySelectorAll('#essay-content [data-cite]')
  );
  if (cites.length === 0) return;

  cites.forEach((cite, i) => {
    const num  = i + 1;
    const text = cite.dataset.cite ?? '';

    // Inline superscript reference
    const sup  = document.createElement('sup');
    sup.className = 'endnote-ref';
    const link = document.createElement('a');
    link.href = `#endnote-${num}`;
    link.textContent = num;
    link.setAttribute('aria-label', `Reference ${num}`);
    sup.appendChild(link);
    cite.replaceWith(sup);

    // Endnotes list item
    const li = document.createElement('li');
    li.id = `endnote-${num}`;
    if (/^https?:\/\//.test(text.trim())) {
      const anchor = document.createElement('a');
      anchor.href = text.trim();
      anchor.rel  = 'noopener noreferrer';
      anchor.target = '_blank';
      anchor.textContent = text.trim();
      li.appendChild(anchor);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
  });

  section.removeAttribute('hidden');
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

function initKeyboardNav() {
  const steps = Array.from(document.querySelectorAll('.story-step'));
  if (steps.length === 0) return;

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select,[contenteditable]')) return;

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

// ── Scrollama dynamic loader ───────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

let narrativeInited = false;

async function tryNarrative() {
  if (narrativeInited) return;
  if (!document.querySelector('.story-section, .story-step')) return;

  // Load Scrollama dynamically if not already present
  if (typeof window.scrollama !== 'function') {
    await loadScript('https://cdn.jsdelivr.net/npm/scrollama@3/build/scrollama.min.js');
  }

  if (typeof window.scrollama !== 'function') return;
  narrativeInited = true;
  initNarrative();
  initKeyboardNav();
}

function init() {
  buildToc();
  addCopyButtons();
  buildEndnotes();
  initSidenotes();
  initProgress();
  initTocTracking();
  tryNarrative();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

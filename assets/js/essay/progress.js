/**
 * progress.js — Reading progress bar + TOC active-section tracker
 *
 * Progress bar:
 *   Creates a fixed 2 px bar at the very top of the viewport whose width
 *   tracks the user's reading position.  The bar element is prepended to
 *   <body> with class .essay-progress-bar.
 *
 * TOC tracking:
 *   Uses IntersectionObserver on h2/h3 elements inside #essay-content.
 *   The corresponding TOC link receives class .toc-link--active (and its
 *   parent <li> receives .toc-item--active) while the heading is in view.
 *
 * @module essay/progress
 */

// ── Reading progress bar ──────────────────────────────────────────────────────

export function initProgress() {
  // Respect reduced-motion preference — skip animation, keep the bar static
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bar = document.createElement('div');
  bar.className = 'essay-progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Reading progress');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '0');
  document.body.prepend(bar);

  if (prefersReduced) return; // bar exists but won't animate

  let ticking = false;

  function update() {
    const scrolled  = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const pct = maxScroll > 0 ? Math.min(100, (scrolled / maxScroll) * 100) : 0;
    bar.style.setProperty('--progress', `${pct}%`);
    bar.setAttribute('aria-valuenow', Math.round(pct));
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );

  update();
}

// ── TOC active-section tracker ────────────────────────────────────────────────

export function initTocTracking() {
  const tocList = document.getElementById('essay-toc-list');
  const content  = document.getElementById('essay-content');
  if (!tocList || !content) return;

  const headings = Array.from(content.querySelectorAll('h2[id], h3[id]'));
  if (headings.length === 0) return;

  function setActive(id) {
    tocList.querySelectorAll('.toc-link').forEach((link) => {
      const isActive = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('toc-link--active', isActive);
      link.closest('li')?.classList.toggle('toc-item--active', isActive);
    });
  }

  // Observe each heading; activate the one nearest the top of the viewport
  const io = new IntersectionObserver(
    (entries) => {
      // Find the topmost intersecting heading
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActive(visible[0].target.id);
      }
    },
    {
      rootMargin: '-8% 0px -70% 0px',
      threshold: 0,
    }
  );

  headings.forEach((h) => io.observe(h));
}

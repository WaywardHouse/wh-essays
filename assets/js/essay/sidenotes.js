/**
 * sidenotes.js — Tufte-style margin notes
 *
 * Post markup convention:
 *
 *   <p>
 *     Some text<span class="sidenote-anchor" data-sn="1"></span> continues.
 *   </p>
 *   <aside class="sidenote" data-sn="1">The margin note content.</aside>
 *
 * If no data-sn is given the module assigns sequential numbers.
 * If no .sidenote-anchor is found the module inserts one immediately before
 * the <aside> element.
 *
 * Behaviour:
 *   Desktop (≥1024 px): notes are moved into #essay-sidenotes and
 *     positioned absolutely so each note sits next to its anchor.
 *   Mobile (<1024 px): notes remain inline below their anchors (CSS manages
 *     visibility — see essay.css).
 *
 * @module essay/sidenotes
 */

export function initSidenotes() {
  const content = document.getElementById('essay-content');
  const sidebar = document.getElementById('essay-sidenotes');
  if (!content || !sidebar) return;

  const notes = Array.from(content.querySelectorAll('.sidenote'));
  if (notes.length === 0) return;

  // ── Number & link every note to its anchor ──────────────────────────────

  notes.forEach((note, i) => {
    const num = i + 1;
    if (!note.dataset.sn) note.dataset.sn = String(num);
    note.id = `sn-${note.dataset.sn}`;

    // Create or locate anchor
    const id = note.dataset.sn;
    let anchor = content.querySelector(`.sidenote-anchor[data-sn="${id}"]`);
    if (!anchor) {
      anchor = document.createElement('span');
      anchor.className = 'sidenote-anchor';
      anchor.dataset.sn = id;
      note.parentNode?.insertBefore(anchor, note);
    }
    anchor.setAttribute('role', 'doc-noteref');
    anchor.setAttribute('aria-label', `Note ${num}`);
    anchor.setAttribute('aria-describedby', `sn-${id}`);

    // Visible superscript inside the anchor
    if (!anchor.querySelector('.sidenote-marker')) {
      const sup = document.createElement('sup');
      sup.className = 'sidenote-marker';
      sup.setAttribute('aria-hidden', 'true');
      sup.textContent = num;
      anchor.appendChild(sup);
    }

    // Prepend number label to the note itself
    if (!note.querySelector('.sidenote-number')) {
      const label = document.createElement('span');
      label.className = 'sidenote-number';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = `${num}`;
      note.prepend(label);
    }
  });

  // ── Layout function ──────────────────────────────────────────────────────

  function layout() {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    if (!isDesktop) {
      // Return notes to inline position if they were moved to sidebar
      notes.forEach((note) => {
        if (note.parentElement === sidebar) {
          const id  = note.dataset.sn;
          const anc = content.querySelector(`.sidenote-anchor[data-sn="${id}"]`);
          anc?.parentNode?.insertBefore(note, anc.nextSibling);
        }
        note.style.cssText = '';
      });
      sidebar.style.minHeight = '';
      return;
    }

    // Move all notes into the sidebar
    notes.forEach((note) => {
      if (note.parentElement !== sidebar) sidebar.appendChild(note);
      note.style.position = 'absolute';
    });

    // Position after paint so heights are known
    requestAnimationFrame(() => {
      sidebar.style.position = 'relative';
      let prevBottom = 0;

      notes.forEach((note) => {
        const id  = note.dataset.sn;
        const anc = content.querySelector(`.sidenote-anchor[data-sn="${id}"]`);
        if (!anc) return;

        // Document-absolute tops (viewport top + scroll offset)
        const ancTop  = anc.getBoundingClientRect().top  + window.scrollY;
        const sideTop = sidebar.getBoundingClientRect().top + window.scrollY;
        const ideal   = ancTop - sideTop;
        const top     = Math.max(prevBottom + 8, ideal);

        note.style.top = `${top}px`;
        prevBottom = top + note.offsetHeight;
      });

      sidebar.style.minHeight = `${prevBottom + 16}px`;
    });
  }

  layout();

  // Re-layout on resize and after images load
  const ro = new ResizeObserver(layout);
  ro.observe(document.documentElement);

  document.querySelectorAll('#essay-content img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', layout, { once: true });
  });
}

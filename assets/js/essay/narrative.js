/**
 * narrative.js — Scrollama-driven scrollytelling controller
 *
 * Activates .story-section elements. Expected post HTML:
 *
 *   <section class="story-section">
 *     <div class="story-sticky">
 *       <div class="story-graphic" aria-live="polite">
 *         <!-- pinned visualisation, e.g. <div data-viz="ricker-scrolly"></div> -->
 *       </div>
 *     </div>
 *     <div class="story-steps">
 *       <div class="story-step" data-step="0">Prose for step 0…</div>
 *       <div class="story-step" data-step="1">Prose for step 1…</div>
 *       <div class="story-step" data-step="2">Prose for step 2…</div>
 *     </div>
 *   </section>
 *
 * When a step crosses the mid-viewport threshold the .story-graphic element
 * receives a CustomEvent:
 *
 *   CustomEvent('story:step', {
 *     detail: { index: Number, step: String, direction: 'up'|'down' }
 *   })
 *
 * Keyboard navigation (↑↓ arrow keys) is handled in essay/core.js.
 *
 * Requires: window.scrollama (loaded via CDN when post has tag "story").
 *
 * @module essay/narrative
 */

export function initNarrative() {
  if (typeof window.scrollama !== 'function') return;

  const sections = Array.from(document.querySelectorAll('.story-section'));
  if (sections.length === 0) return;

  const scrollers = [];

  sections.forEach((section, sectionIdx) => {
    const graphic  = section.querySelector('.story-graphic');
    const stepEls  = Array.from(section.querySelectorAll('.story-step'));
    if (!graphic || stepEls.length === 0) return;

    // Ensure IDs for ARIA
    if (!section.id) section.id = `story-${sectionIdx}`;
    graphic.setAttribute('aria-live', 'polite');
    stepEls.forEach((step, i) => {
      if (!step.id) step.id = `${section.id}-step-${i}`;
      step.setAttribute('aria-label', `Step ${i + 1} of ${stepEls.length}`);
    });

    const scroller = window.scrollama();
    scrollers.push(scroller);

    scroller
      .setup({ step: stepEls, offset: 0.55, debug: false })
      .onStepEnter(({ element, index, direction }) => {
        stepEls.forEach((s) => {
          s.removeAttribute('data-active');
          s.setAttribute('aria-hidden', 'true');
        });
        element.setAttribute('data-active', '');
        element.removeAttribute('aria-hidden');

        graphic.dispatchEvent(
          new CustomEvent('story:step', {
            bubbles: true,
            detail: {
              index,
              step:      element.dataset.step ?? String(index),
              direction,
              element,  // reference to step DOM element — used by core.js for data-update routing
            },
          })
        );
      })
      .onStepExit(({ element }) => {
        element.removeAttribute('data-active');
        element.setAttribute('aria-hidden', 'true');
      });
  });

  // Resize all scrollers together
  window.addEventListener(
    'resize',
    () => scrollers.forEach((s) => s.resize()),
    { passive: true }
  );
}

/**
 * math.js — KaTeX auto-render
 *
 * Requires katex.min.js and contrib/auto-render.min.js to be loaded from
 * CDN (added by default.hbs when the post carries tag "math").
 *
 * Supports:
 *   Inline  $...$   and  \(...\)
 *   Display $$...$$ and  \[...\]
 */

export function initMath() {
  const render = window.renderMathInElement;
  if (typeof render !== 'function') return;

  const root = document.querySelector('.gh-content') ?? document.body;

  render(root, {
    delimiters: [
      { left: '$$', right: '$$', display: true  },
      { left: '$',  right: '$',  display: false },
      { left: '\\[', right: '\\]', display: true  },
      { left: '\\(', right: '\\)', display: false },
    ],
    // Render unknown macros as plain text rather than throwing
    throwOnError: false,
    // Ignore content inside <code> and <pre> blocks
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    // Ignore elements with class="no-katex" — use for prose containing $ currency symbols
    ignoredClasses: ['no-katex'],
  });
}

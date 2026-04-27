/**
 * diagrams.js — Mermaid diagram renderer
 *
 * Requires mermaid.min.js to be loaded (handled by core.js dynamic loader).
 *
 * Supported markup in posts:
 *
 *   1. Ghost code block — preferred, no HTML card needed:
 *      Add a Code block in Ghost editor, set language to "mermaid"
 *      Ghost renders: <pre><code class="language-mermaid">graph TD; A-->B;</code></pre>
 *
 *   2. Raw div — use a Ghost HTML card:
 *      <div class="mermaid">graph TD; A-->B;</div>
 *
 * Both forms are normalised to <div class="mermaid"> before Mermaid runs.
 */

export async function initDiagrams() {
  const mermaid = window.mermaid;
  if (!mermaid) return;

  const isDark = document.documentElement.dataset.theme === 'dark';

  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  });

  // Convert mermaid code blocks to div.mermaid in-place.
  // Quarto often emits <pre class="mermaid"><code>…</code></pre>, while some
  // other sources emit <pre><code class="language-mermaid">…</code></pre>.
  document.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.closest('pre').replaceWith(div);
  });

  document.querySelectorAll('pre.mermaid > code').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.closest('pre')?.replaceWith(div);
  });

  const nodes = Array.from(document.querySelectorAll('.mermaid'));
  if (nodes.length === 0) return;

  // mermaid.run is available in v10+; fall back to mermaid.init for v9
  if (typeof mermaid.run === 'function') {
    await mermaid.run({ nodes });
  } else if (typeof mermaid.init === 'function') {
    mermaid.init(undefined, nodes);
  }
}

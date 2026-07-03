// Build docs/SRE-app-User-Guide.pdf from docs/user-guide.md.
//
// Renders Markdown → styled HTML → PDF via the Playwright install that
// already lives in web/ (used for the app's e2e tests). No new deps beyond
// `marked` (dev-only in web/).
//
// Run:  node scripts/build-user-guide.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const srcPath = resolve(repoRoot, 'docs', 'user-guide.md');
const outPath = resolve(repoRoot, 'docs', 'SRE-app-User-Guide.pdf');

// Both `marked` and `playwright` are installed under web/, so we build a
// require() that looks in web/node_modules first.
const require = createRequire(resolve(repoRoot, 'web', 'package.json'));
const { marked } = require('marked');
const { chromium } = require('playwright');

const raw = await readFile(srcPath, 'utf8');

// Peel off the YAML front-matter (title/subtitle/version) for the cover.
const meta = { title: 'User Guide', subtitle: '', version: '' };
let body = raw;
const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
if (fm) {
  for (const line of fm[1].split('\n')) {
    const m = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
    if (m) meta[m[1]] = m[2];
  }
  body = raw.slice(fm[0].length);
}

marked.setOptions({ gfm: true, breaks: false, headerIds: true });
const contentHtml = marked.parse(body);

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title>
<style>
  :root {
    --ink: #16181d;
    --ink-soft: #4d5566;
    --muted: #7c8496;
    --line: #e3e6ee;
    --line-soft: #eef0f6;
    --accent: #b74a2b;
    --accent-soft: #f4e4dd;
    --code-bg: #f6f7fb;
    --page: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--page); color: var(--ink); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  main { max-width: 720px; margin: 0 auto; padding: 0 32pt; }

  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 48pt;
    background:
      radial-gradient(circle at 15% 10%, rgba(183, 74, 43, 0.10), transparent 45%),
      radial-gradient(circle at 90% 85%, rgba(63, 96, 168, 0.08), transparent 40%),
      #ffffff;
    page-break-after: always;
  }
  .cover .brand {
    display: inline-flex; align-items: center; gap: 10pt;
    font-weight: 600; letter-spacing: 0.02em;
  }
  .cover .brand .badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26pt; height: 26pt;
    background: var(--accent); color: white; border-radius: 6pt;
    font-weight: 700; font-size: 9pt;
  }
  .cover h1 {
    font-size: 40pt; line-height: 1.05; margin: 24pt 0 10pt; font-weight: 700;
    letter-spacing: -0.01em;
  }
  .cover h1 .accent { color: var(--accent); }
  .cover .subtitle {
    font-size: 15pt; color: var(--ink-soft); max-width: 460pt; line-height: 1.35;
  }
  .cover .meta {
    margin-top: 40pt; padding-top: 18pt; border-top: 1pt solid var(--line);
    color: var(--muted); font-size: 10pt; letter-spacing: 0.01em;
  }

  h1, h2, h3, h4 { color: var(--ink); }
  h1 {
    font-size: 22pt; margin: 24pt 0 12pt; font-weight: 700;
    padding-bottom: 6pt; border-bottom: 2pt solid var(--accent);
    letter-spacing: -0.005em;
    page-break-before: always;
  }
  main > h1:first-of-type { page-break-before: auto; }
  h2 {
    font-size: 15pt; margin: 22pt 0 8pt; font-weight: 650;
    color: var(--ink);
  }
  h3 {
    font-size: 12pt; margin: 16pt 0 6pt; font-weight: 600;
    color: var(--ink);
  }
  h4 {
    font-size: 11pt; margin: 12pt 0 4pt; font-weight: 600;
    color: var(--ink-soft);
  }

  p { margin: 6pt 0; }
  ul, ol { margin: 6pt 0 6pt 16pt; padding: 0; }
  li { margin: 3pt 0; }
  li > p { margin: 3pt 0; }

  strong { font-weight: 650; color: var(--ink); }
  em { color: var(--ink-soft); }

  a { color: var(--accent); text-decoration: none; }

  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    background: var(--code-bg);
    padding: 1pt 4pt;
    border-radius: 3pt;
    font-size: 9pt;
    color: #4a3a2f;
  }
  pre {
    background: var(--code-bg);
    padding: 10pt 12pt;
    border-radius: 5pt;
    border: 1pt solid var(--line-soft);
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
  }
  pre code { background: transparent; padding: 0; font-size: inherit; color: var(--ink); }

  table {
    width: 100%; border-collapse: collapse; margin: 10pt 0;
    font-size: 9.5pt;
  }
  th, td {
    padding: 6pt 8pt; border-bottom: 1pt solid var(--line-soft);
    text-align: left; vertical-align: top;
  }
  th { background: var(--line-soft); font-weight: 600; color: var(--ink); }
  tr:nth-child(even) td { background: #fbfcff; }

  hr { border: none; border-top: 1pt solid var(--line); margin: 20pt 0; }

  blockquote {
    margin: 8pt 0; padding: 6pt 12pt;
    border-left: 3pt solid var(--accent);
    background: var(--accent-soft);
    color: var(--ink-soft);
  }

  /* Give the first h1 (the "Welcome") page a bit of breathing room but
     don't force a page break — it follows the cover cleanly. */
  main > h1:first-of-type { padding-top: 0; }
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">
      <span class="badge">SRE</span>
      <span>Sulfur Recovery Engineering</span>
    </div>
    <h1><span class="accent">${escapeHtml(meta.title.split('—')[0].trim() || 'SRE-app')}</span><br/>User Guide</h1>
    <div class="subtitle">${escapeHtml(meta.subtitle)}</div>
    <div class="meta">${escapeHtml(meta.version)}</div>
  </section>
  <main>
    ${contentHtml}
  </main>
</body>
</html>`;

// Write an inspectable HTML file next to the PDF for debugging.
const htmlPath = outPath.replace(/\.pdf$/, '.html');
await writeFile(htmlPath, html, 'utf8');
process.stdout.write(`wrote ${htmlPath}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: outPath,
  format: 'A4',
  margin: { top: '18mm', right: '18mm', bottom: '20mm', left: '18mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size:8pt; color:#8b93a7; width:100%; padding: 0 18mm;
                display:flex; justify-content:space-between;">
      <span>${escapeHtml(meta.title)}</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
});
await browser.close();

process.stdout.write(`wrote ${outPath}\n`);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Small markdown → PDF pipeline used for one-off deliverables. Renders MD
// with `marked`, wraps in a print-friendly HTML template, then uses
// Playwright's Chromium to save PDF. Usage:
//   node scripts/md-to-pdf.mjs <input.md> <output.pdf>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from 'playwright';

const [, , inArg, outArg] = process.argv;
if (!inArg || !outArg) {
  console.error('Usage: node md-to-pdf.mjs <input.md> <output.pdf>');
  process.exit(1);
}
const inPath  = resolve(process.cwd(), inArg);
const outPath = resolve(process.cwd(), outArg);
const md = readFileSync(inPath, 'utf8');
const bodyHtml = marked.parse(md, { gfm: true, breaks: false });

const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Memo</title>
<style>
  @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
  html, body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1c1c1c; line-height: 1.5; font-size: 11pt; }
  h1 { font-size: 20pt; margin: 0 0 6mm 0; color: #131314; border-bottom: 2px solid #C8951C; padding-bottom: 3mm; }
  h2 { font-size: 14pt; margin: 8mm 0 3mm 0; color: #131314; padding-bottom: 1.5mm; border-bottom: 1px solid #E8E5DC; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm 0; color: #131314; }
  h4 { font-size: 11pt; margin: 4mm 0 2mm 0; }
  p, ul, ol { margin: 0 0 3mm 0; }
  ul, ol { padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  code { font-family: "Consolas", "Cascadia Mono", monospace; background: #F4F2EC; padding: 0.5mm 1.5mm; border-radius: 2px; font-size: 10pt; }
  pre { background: #F4F2EC; padding: 3mm; border-radius: 3px; overflow-x: auto; font-size: 9.5pt; line-height: 1.45; }
  pre code { background: transparent; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 10pt; }
  th, td { border: 1px solid #D4D0C4; padding: 2mm 3mm; text-align: left; vertical-align: top; }
  th { background: #F4F2EC; font-weight: 600; }
  blockquote { border-left: 3px solid #C8951C; padding: 1mm 0 1mm 4mm; margin: 3mm 0; color: #3D3B37; background: #FBF4E2; }
  hr { border: none; border-top: 1px solid #D4D0C4; margin: 6mm 0; }
  strong { color: #131314; }
  a { color: #2A5D8A; }
</style>
</head><body>${bodyHtml}</body></html>`;

// Keep the intermediate HTML alongside the PDF for debugging / re-export.
const htmlPath = outPath.replace(/\.pdf$/i, '.html');
writeFileSync(htmlPath, html, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'domcontentloaded' });
await page.pdf({
  path: outPath,
  format: 'A4',
  margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
  printBackground: true,
});
await browser.close();
console.log(`wrote ${outPath}`);

// Screenshot the first page of an HTML file for visual QA.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const html = readFileSync(resolve(process.cwd(), process.argv[2]), 'utf8');
const outPng = resolve(process.cwd(), process.argv[3]);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });  // A4 @ 96dpi
await page.setContent(html, { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: outPng, fullPage: false });
await browser.close();
console.log(`wrote ${outPng}`);

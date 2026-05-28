const puppeteer = require('puppeteer');
const { marked } = require('marked');

const PDF_TIMEOUT_MS = parseInt(process.env.PDF_TIMEOUT_MS || '30000', 10);

const DEFAULT_CSS = `
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1f2328;
    padding: 1.5rem 2rem;
    max-width: 880px;
    margin: 0 auto;
  }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.4em; margin-bottom: 0.6em; line-height: 1.25; }
  h1 { font-size: 2em; border-bottom: 1px solid #d1d9e0; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d1d9e0; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.6em 0; }
  a { color: #0969da; text-decoration: none; }
  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  pre {
    background: #f6f8fa;
    padding: 1em;
    border-radius: 6px;
    overflow: auto;
    line-height: 1.45;
  }
  pre code { background: transparent; padding: 0; border-radius: 0; }
  blockquote {
    border-left: 4px solid #d1d9e0;
    padding: 0 1em;
    color: #59636e;
    margin: 0.8em 0;
  }
  table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
  th, td { border: 1px solid #d1d9e0; padding: 0.4em 0.8em; text-align: left; }
  th { background: #f6f8fa; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #d1d9e0; margin: 1.5em 0; }
  ul, ol { padding-left: 1.6em; }
`;

function buildHtml(markdown) {
  const html = marked.parse(markdown, { gfm: true, breaks: false });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${DEFAULT_CSS}</style>
</head>
<body>
${html}
</body>
</html>`;
}

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

async function convertMarkdownToPdf(markdown) {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    throw Object.assign(new Error('markdown must be a non-empty string'), { status: 400 });
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const html = buildHtml(markdown);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: PDF_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      timeout: PDF_TIMEOUT_MS,
    });
    return pdf;
  } finally {
    await page.close().catch(() => {});
  }
}

async function shutdown() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}

module.exports = { convertMarkdownToPdf, shutdown };

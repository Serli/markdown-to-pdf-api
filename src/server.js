require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { convertMarkdownToPdf, shutdown: shutdownPdf } = require('./pdf');
const { storePdf } = require('./storage');

const PORT = parseInt(process.env.PORT || '8080', 10);
const BODY_LIMIT = process.env.BODY_LIMIT || '1mb';

const app = express();
app.use(express.json({ limit: BODY_LIMIT }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/convert', async (req, res, next) => {
  try {
    const { markdown } = req.body || {};
    const pdf = await convertMarkdownToPdf(markdown);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.end(pdf);
  } catch (err) {
    next(err);
  }
});

app.post('/convert-and-store', async (req, res, next) => {
  try {
    const { markdown, filename } = req.body || {};
    const pdf = await convertMarkdownToPdf(markdown);
    const key = buildKey(filename);
    const result = await storePdf(pdf, key);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

function buildKey(filename) {
  const safe = sanitizeFilename(filename);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(4).toString('hex');
  return `pdf/${stamp}-${rand}-${safe}`;
}

function sanitizeFilename(filename) {
  const base = (typeof filename === 'string' && filename.trim()) ? filename.trim() : 'document.pdf';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

const server = app.listen(PORT, () => {
  console.log(`markdown-to-pdf-api listening on port ${PORT}`);
});

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await shutdownPdf();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

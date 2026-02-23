# 📄 Content Analyzer

**Upload a PDF or image → get concrete suggestions to make your content more engaging.**

## What It Does

1. **Accepts** PDFs (digital) and images (PNG, JPG) up to 10 MB
2. **Extracts** text using pdf-parse for PDFs and Tesseract.js OCR for images
3. **Analyzes** content across five dimensions: readability, structure, engagement hooks, clarity, and actionability
4. **Returns** 3–6 prioritized, explainable suggestions with severity levels

## What It Does NOT Do

- Spell-check or grammar-check (use Grammarly for that)
- Handle handwritten text (OCR works on printed/typed text only)
- Use external AI APIs — runs fully offline, no API keys needed
- Open encrypted or password-protected PDFs
- Guarantee perfect OCR on low-resolution scans

## Tech Stack

| Layer | Tool | Rationale |
|---|---|---|
| Frontend | Vite + vanilla JS | Zero framework overhead, instant HMR |
| Backend | Express.js | Lightweight, mature, great file-handling ecosystem |
| PDF extraction | pdf-parse | Pure JS, no native binaries |
| Image OCR | Tesseract.js | Runs in Node, no external services |
| Analysis | Custom heuristics | Explainable, fast, deterministic |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (frontend + backend concurrently)
npm run dev

# 3. Open in browser
# → http://localhost:5173
```

## How the Analysis Works

The engine scores your content on five dimensions using transparent heuristics:

- **Readability** — Flesch-Kincaid grade level (targeting grades 8–10 for general audiences)
- **Structure** — Headings, paragraph sizes, use of lists and whitespace
- **Engagement Hooks** — Questions, calls-to-action, power words
- **Clarity** — Passive voice ratio, jargon density, sentence complexity
- **Actionability** — Imperative verbs, numbered steps, clear next-actions

Each suggestion tells you *what* to fix, *why* it matters, and *how* severe it is.

## License

MIT

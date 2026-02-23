# 📄 Content Analyzer

**Upload a PDF or image → get concrete suggestions to make your content more engaging.**

## What It Does

1. **Accepts** PDFs (digital) and images (PNG, JPG) up to 10 MB
2. **Extracts** text using pdf-parse for PDFs and Tesseract.js OCR for images
3. **Analyzes** content across five dimensions: readability, structure, engagement hooks, clarity, and actionability
4. **Returns** 3–6 prioritized, explainable suggestions with severity levels


## Tech Stack

| Layer | Tool | Rationale |
|---|---|---|
| Frontend | Vite + vanilla JS | Zero framework overhead, instant HMR |
| Backend | Express.js | Lightweight, mature, great file-handling ecosystem |
| PDF extraction | pdf-parse | Pure JS, no native binaries |
| Image OCR | Tesseract.js | Runs in Node, no external services |
| **Analysis** | **Local ML (Transformers)** | Real intelligence for sentiment & hooks, 100% local |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (frontend + backend concurrently)
# Note: First startup downloads ~90MB of models (cached thereafter)
npm run dev
```

## How the Analysis Works

The engine combines standard math with **local machine learning** (@xenova/transformers):

- **Sentiment (ML)** — Uses **DistilBERT** to understand tone beyond just keyword counting.
- **Hook Detection (ML)** — Uses **MiniLM Embeddings** to semantically classify the opening into archetypes (Story, Bold Claim, etc.).
- **Readability** — Coleman-Liau academic formula for precise grade level calculation.
- **Structure** — Heuristics for paragraph weight, scannability, and whitespace.
- **Actionability** — Imperative verb detection and clear prompt analysis.

Each suggestion tells you *what* to fix, *why* it matters, and *how* severe it is.

## License

MIT

# 📄 Content Analyzer

**Upload a PDF or image → get concrete suggestions to make your content more engaging.**

## What It Does

1. **Accepts** PDFs (digital) and images (PNG, JPG) up to 10 MB
2. **Extracts** text using pdf-parse for PDFs and Tesseract.js OCR for images
3. **Analyzes** content across multiple dimensions: readability, structure, engagement hooks (via semantic embeddings), clarity, cognitive load, actionability, and persuasion flow
4. **Returns** a human-readable explanation and 3–6 prioritized, explainable suggestions with severity levels

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
| Semantic Embeddings | `@xenova/transformers` | Local ONNX models (`Xenova/all-MiniLM-L6-v2`) for offline sentence similarity |
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

- **Readability** — Flesch-Kincaid grade level
- **Structure** — Headings, paragraph sizes, use of lists and whitespace
- **Analysis Dimensions** — Evaluates Hook Archetypes, Cognitive Load, and Persuasion Frameworks (AIDA/PAS)
- **Semantic Understanding** — Uses a local sentence embedding model to calculate prototype similarity for hooks and persuasion flows without relying on LLMs.
- **Clarity & Actionability** — Passive voice ratio, jargon density, sentence complexity, and imperative verbs.

Each suggestion tells you *what* to fix, *why* it matters, and *how* severe it is.

## License

MIT

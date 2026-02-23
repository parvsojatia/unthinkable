# 🏗️ Content Analyzer — Architecture

## High-Level Data Flow

```
Upload File → Ingest → Extract Text → Analyze Content → Structured Response → Render Results
```

```mermaid
flowchart LR
    subgraph Client["🖥️ Frontend (Vite + Vanilla JS)"]
        A["Drag & Drop Upload"] --> B["POST /api/analyze"]
        G["Render Results"] --> H["Score Gauges + Suggestions"]
    end

    subgraph Server["⚙️ Backend (Express.js)"]
        B --> C{"File Router"}
        C -->|PDF| D["pdf-parse"]
        C -->|Image| E["Tesseract.js OCR"]
        D --> F["Analysis Engine"]
        E --> F
        F --> G
    end

    style Client fill:#1a1a2e,stroke:#e94560,color:#eee
    style Server fill:#16213e,stroke:#0f3460,color:#eee
```

## Module Boundaries

The codebase is split into **5 layers** with clear responsibilities:

```mermaid
graph TD
    subgraph Layer1["1 · File Ingestion"]
        M["upload.js — Multer middleware"]
        M -->|"validates type & size"| M2["10 MB limit"]
        M -->|"accepts"| M3["PDF, PNG, JPG"]
    end

    subgraph Layer2["2 · Text Extraction"]
        P["pdfExtractor.js — pdf-parse"]
        I["imageExtractor.js — Tesseract.js"]
    end

    subgraph Layer3["3 · Content Analysis"]
        AN["analyzer.js — 5-dimension heuristic engine"]
        AN --> R["Readability (Flesch-Kincaid)"]
        AN --> S["Structure (headings, lists, paragraphs)"]
        AN --> E["Engagement (power words, CTAs, questions)"]
        AN --> CL["Clarity (passive voice, jargon, complexity)"]
        AN --> AC["Actionability (imperatives, steps, directed language)"]
    end

    subgraph Layer4["4 · API Interface"]
        SV["index.js — Express routes"]
        SV -->|"POST /api/analyze"| SV2["File upload + analysis pipeline"]
        SV -->|"GET /api/health"| SV3["Health check"]
    end

    subgraph Layer5["5 · UI Rendering"]
        UI["index.html + main.js + style.css"]
        UI --> UI2["Upload zone"]
        UI --> UI3["Score dashboard"]
        UI --> UI4["Suggestion cards"]
    end

    Layer1 --> Layer2 --> Layer3 --> Layer4 --> Layer5

    style Layer1 fill:#0f3460,stroke:#533483,color:#eee
    style Layer2 fill:#16213e,stroke:#533483,color:#eee
    style Layer3 fill:#1a1a2e,stroke:#533483,color:#eee
    style Layer4 fill:#0f3460,stroke:#533483,color:#eee
    style Layer5 fill:#16213e,stroke:#533483,color:#eee
```

## Tech Stack Rationale

| Layer | Tool | Why |
|---|---|---|
| Frontend | Vite + vanilla JS | Zero framework overhead, instant HMR, no build complexity |
| Backend | Express.js | Lightweight, mature, excellent file-handling ecosystem |
| PDF extraction | pdf-parse | Pure JS, no native binaries, handles digital PDFs well |
| Image OCR | Tesseract.js | Runs in Node.js, no external services or API keys |
| Analysis | Custom heuristics | Explainable, fast, deterministic — no black-box AI |

## Directory Structure

```
unthinkable/
├── docs/
│   └── architecture.md        ← you are here
├── server/
│   ├── index.js               ← Express entry point + routes
│   ├── middleware/
│   │   └── upload.js           ← Multer config (type/size validation)
│   ├── extractors/
│   │   ├── pdfExtractor.js     ← pdf-parse wrapper
│   │   └── imageExtractor.js   ← Tesseract.js OCR wrapper
│   └── analysis/
│       └── analyzer.js         ← 5-dimension heuristic engine
├── index.html                  ← Frontend entry
├── style.css                   ← Design system
├── main.js                     ← Client-side logic
├── sample_files/               ← Test files
├── package.json
├── vite.config.js
└── README.md
```

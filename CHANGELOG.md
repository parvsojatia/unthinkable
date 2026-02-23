# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-02-24

### Added
- **ML-Powered Analysis Engine**: Integrated `@xenova/transformers` for local sentiment and hook archetype detection.
- **Dashboard UI**: Completely redesigned the results view into a high-performance dashboard layout.
- **Social Media URL Extraction**: Added support for analyzing content directly from URLs (LinkedIn, Twitter, etc.).
- **Semantic Hook Detection**: Classifies opening lines into archetypes (Story, Bold Claim, etc.) using MiniLM embeddings.
- **Embedded Iframe Parsing**: Automatically extracts URLs from pasted `<iframe>` snippets.

### Changed
- **Async Pipeline**: Unified analysis into an asynchronous `Promise.all` pipeline for better performance.
- **Header Transition**: Added a layout shift where the header transforms into a compact navbar during results view.
- **Heuristics Refinement**: Improved Coleman-Liau readability math and structural heuristics.

### Fixed
- **LinkedIn Extraction**: Stripped hidden JSON and multi-page footer data to ensure accurate metrics from SPAs.
- **Responsiveness**: Improved mobile layout for score gauges and suggestion cards.
- **Bug Fix**: Corrected word count logic for posts containing special characters or emoji-heavy strings.

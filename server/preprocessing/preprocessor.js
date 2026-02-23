/**
 * Text Preprocessor — Phase 5
 * Cleans, normalizes, and segments raw extracted text into
 * a structured format ready for single-pass analysis.
 */

// ─── OCR Garbage Patterns ─────────────────────────────────
// Common artifacts from Tesseract OCR and PDF extraction

const OCR_GARBAGE_PATTERNS = [
    /\f/g,                              // form feed characters
    /\r/g,                              // carriage returns (normalize to \n)
    /[^\S\n]{3,}/g,                     // 3+ consecutive spaces/tabs → single space
    /[\u200B-\u200D\uFEFF]/g,          // zero-width chars
    /[|]{3,}/g,                         // OCR pipe artifacts (|||...)
    /[_]{5,}/g,                         // long underscore lines
    /[=]{5,}/g,                         // long equals lines
    /[-]{5,}/g,                         // long dash lines
    /\.{5,}/g,                          // dot leaders (..........)
    /[^\x20-\x7E\n\u00C0-\u024F]/g,   // non-printable chars (keep basic Latin + accents)
];

// ─── Heading Heuristics ───────────────────────────────────

/**
 * Detect whether a line is likely a heading.
 * Uses length, capitalization, and pattern matching.
 */
function isHeading(line) {
    if (line.length === 0 || line.length > 100) return false;

    // Markdown headings: # Title
    if (/^#{1,6}\s+\S/.test(line)) return { type: 'markdown', level: line.match(/^#+/)[0].length };

    // ALL CAPS short lines: INTRODUCTION
    if (line.length < 60 && /^[A-Z][A-Z\s:.\-–—]{2,}$/.test(line)) return { type: 'allcaps', level: 2 };

    // Numbered headings: 1. Introduction, 2.1 Background
    if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(line) && line.length < 80) return { type: 'numbered', level: 2 };

    // Title case short lines (5+ chars, <60 chars, most words capitalized)
    if (line.length >= 5 && line.length < 60) {
        const words = line.split(/\s+/);
        const capitalizedWords = words.filter((w) => /^[A-Z]/.test(w));
        if (words.length >= 2 && capitalizedWords.length / words.length >= 0.6 && !/[.!?]$/.test(line)) {
            return { type: 'titlecase', level: 3 };
        }
    }

    return false;
}

// ─── Main Preprocessor ───────────────────────────────────

/**
 * Preprocess raw extracted text into a clean, segmented structure.
 *
 * @param {string} rawText - The raw extracted text
 * @returns {{
 *   normalizedText: string,
 *   paragraphs: Array<{text: string, index: number, wordCount: number, isHeading: boolean, headingInfo: object|null}>,
 *   sentences: Array<{text: string, paragraphIndex: number, wordCount: number}>,
 *   headings: Array<{text: string, type: string, level: number, index: number}>,
 *   stats: { totalChars: number, totalWords: number, totalSentences: number, totalParagraphs: number, totalHeadings: number }
 * }}
 */
export function preprocessText(rawText) {
    if (!rawText || rawText.trim().length === 0) {
        return {
            normalizedText: '',
            paragraphs: [],
            sentences: [],
            headings: [],
            stats: { totalChars: 0, totalWords: 0, totalSentences: 0, totalParagraphs: 0, totalHeadings: 0 },
        };
    }

    // ── Step 1: Normalize ─────────────────────────────────
    let text = rawText;

    // Apply OCR garbage cleanup
    for (const pattern of OCR_GARBAGE_PATTERNS) {
        text = text.replace(pattern, (match) => {
            // For the multi-space pattern, collapse to single space
            if (/[^\S\n]/.test(match)) return ' ';
            // For line-like patterns, replace with newline
            if (/[|_=\-.]/.test(match[0])) return '\n';
            // Everything else: remove
            return '';
        });
    }

    // Normalize line breaks: collapse 3+ newlines into 2 (paragraph separator)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    text = text
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

    // Trim leading/trailing whitespace
    text = text.trim();

    const normalizedText = text;

    // ── Step 2: Split into paragraphs ─────────────────────
    const rawParagraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    const paragraphs = rawParagraphs.map((p, i) => {
        const trimmed = p.trim();
        const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
        const headingInfo = isHeading(trimmed);

        return {
            text: trimmed,
            index: i,
            wordCount: words.length,
            isHeading: !!headingInfo,
            headingInfo: headingInfo || null,
        };
    });

    // ── Step 3: Split paragraphs into sentences ───────────
    const sentences = [];
    for (const para of paragraphs) {
        if (para.isHeading) continue; // Don't split headings into sentences

        // Sentence splitting regex:
        // Split on . ! ? followed by space+uppercase or end-of-string
        // Handles abbreviations (Mr. Dr. etc.) and decimals (3.14) reasonably
        const sentenceChunks = para.text
            .split(/(?<=[.!?])\s+(?=[A-Z"'(])|(?<=[.!?])$/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        for (const s of sentenceChunks) {
            const words = s.split(/\s+/).filter((w) => w.length > 0);
            sentences.push({
                text: s,
                paragraphIndex: para.index,
                wordCount: words.length,
            });
        }
    }

    // ── Step 4: Extract headings ──────────────────────────
    const headings = paragraphs
        .filter((p) => p.isHeading)
        .map((p) => ({
            text: p.text.replace(/^#+\s*/, ''), // Strip markdown #
            type: p.headingInfo.type,
            level: p.headingInfo.level,
            index: p.index,
        }));

    // ── Step 5: Compute stats ─────────────────────────────
    const allWords = normalizedText.split(/\s+/).filter((w) => w.length > 0);

    const stats = {
        totalChars: normalizedText.length,
        totalWords: allWords.length,
        totalSentences: sentences.length,
        totalParagraphs: paragraphs.length,
        totalHeadings: headings.length,
    };

    return { normalizedText, paragraphs, sentences, headings, stats };
}

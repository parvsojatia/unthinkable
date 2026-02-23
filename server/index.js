import express from 'express';
import cors from 'cors';
import upload from './middleware/upload.js';
import { extractFromPDF } from './extractors/pdfExtractor.js';
import { extractFromImage } from './extractors/imageExtractor.js';
import { analyzeContent } from './analysis/analyzer.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Main Analysis Endpoint ──────────────────────────────

app.post('/api/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded. Please select a PDF or image.' });
        }

        const { mimetype, buffer, originalname, size } = req.file;
        let extraction;

        // Route to the correct extractor based on MIME type
        if (mimetype === 'application/pdf') {
            extraction = await extractFromPDF(buffer);
        } else if (mimetype.startsWith('image/')) {
            extraction = await extractFromImage(buffer);
        } else {
            return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
        }

        // Check if extraction returned any text
        if (!extraction.text || extraction.text.trim().length === 0) {
            return res.status(422).json({
                error: 'Could not extract any text from this file.',
                hint: mimetype.startsWith('image/')
                    ? 'Make sure the image contains clear, printed text. Handwritten text is not supported.'
                    : 'The PDF may be image-based or encrypted. Try a different file.',
            });
        }

        // Run analysis engine
        const analysis = analyzeContent(extraction.text);

        // Build suggestions from dimension scores
        const suggestions = generateSuggestions(analysis.dimensions);

        res.json({
            filename: originalname,
            fileSize: size,
            fileType: mimetype,
            extraction: {
                textLength: extraction.text.length,
                pageCount: extraction.pageCount || null,
                confidence: extraction.confidence || null,
            },
            analysis: {
                overallScore: analysis.overallScore,
                wordCount: analysis.wordCount,
                sentenceCount: analysis.sentenceCount,
                dimensions: analysis.dimensions,
            },
            suggestions,
        });
    } catch (err) {
        console.error('Analysis error:', err);
        res.status(500).json({ error: 'Analysis failed. Please try again with a different file.' });
    }
});

// ─── Suggestion Generator ─────────────────────────────────

function generateSuggestions(dimensions) {
    const suggestions = [];

    // Readability suggestions
    if (dimensions.readability) {
        const { score, details } = dimensions.readability;
        if (score < 60 && details.gradeLevel) {
            suggestions.push({
                dimension: 'Readability',
                severity: score < 30 ? 'high' : 'medium',
                what: `Your content reads at grade level ${details.gradeLevel} — most audiences prefer grade 8-10.`,
                why: 'Dense text causes readers to bounce. Simpler language increases time-on-page by up to 50%.',
                how: 'Break long sentences. Replace multi-syllable words with shorter alternatives. Aim for ~15 words per sentence.',
            });
        }
        if (details.avgWordsPerSentence > 25) {
            suggestions.push({
                dimension: 'Readability',
                severity: 'medium',
                what: `Average sentence length is ${details.avgWordsPerSentence} words (ideal: 15–20).`,
                why: 'Long sentences are harder to parse and increase reader fatigue.',
                how: 'Split sentences at natural breakpoints. Use periods instead of semicolons and commas.',
            });
        }
    }

    // Structure suggestions
    if (dimensions.structure) {
        const { score, details } = dimensions.structure;
        if (details.headingCount === 0) {
            suggestions.push({
                dimension: 'Structure',
                severity: 'high',
                what: 'No headings detected in your content.',
                why: 'Headings help readers scan and find relevant sections. 80% of readers scan before reading.',
                how: 'Add descriptive headings every 2-3 paragraphs. Use a clear hierarchy (H1 → H2 → H3).',
            });
        }
        if (details.longParagraphs > 0) {
            suggestions.push({
                dimension: 'Structure',
                severity: 'medium',
                what: `${details.longParagraphs} paragraph(s) exceed 100 words — wall-of-text effect.`,
                why: 'Long paragraphs are intimidating. Readers skip blocks that look too dense.',
                how: 'Break paragraphs at topic shifts. Aim for 3-5 sentences per paragraph.',
            });
        }
        if (details.listItemCount === 0 && dimensions.structure.score < 70) {
            suggestions.push({
                dimension: 'Structure',
                severity: 'low',
                what: 'No bullet points or numbered lists found.',
                why: 'Lists make information digestible and improve scannability.',
                how: 'Convert sequences of related items into bulleted or numbered lists.',
            });
        }
    }

    // Engagement suggestions
    if (dimensions.engagement) {
        const { score, details } = dimensions.engagement;
        if (details.questionCount === 0) {
            suggestions.push({
                dimension: 'Engagement',
                severity: 'medium',
                what: 'No questions found in your content.',
                why: 'Questions activate curiosity and create mental engagement — readers feel addressed directly.',
                how: 'Open sections with a question. Use "Have you ever…?" or "What if…?" patterns.',
            });
        }
        if (details.ctaCount === 0) {
            suggestions.push({
                dimension: 'Engagement',
                severity: 'medium',
                what: 'No calls-to-action detected.',
                why: 'Without CTAs, readers finish and leave. Every piece of content should guide the next step.',
                how: 'Add at least one clear CTA: "Try this today", "Learn more at…", or "Share your thoughts".',
            });
        }
    }

    // Clarity suggestions
    if (dimensions.clarity) {
        const { score, details } = dimensions.clarity;
        if (details.passiveRatio > 20) {
            suggestions.push({
                dimension: 'Clarity',
                severity: details.passiveRatio > 40 ? 'high' : 'medium',
                what: `${details.passiveRatio}% of sentences use passive voice (aim for under 20%).`,
                why: 'Passive voice hides the actor, making text feel vague and bureaucratic.',
                how: 'Rewrite "The report was written by the team" → "The team wrote the report".',
            });
        }
        if (details.jargonFound.length >= 2) {
            suggestions.push({
                dimension: 'Clarity',
                severity: 'low',
                what: `Found ${details.jargonFound.length} jargon terms: "${details.jargonFound.slice(0, 3).join('", "')}"`,
                why: 'Jargon alienates non-expert readers and makes your content feel exclusionary.',
                how: 'Replace jargon with plain language. "Leverage" → "use", "synergy" → "working together".',
            });
        }
    }

    // Actionability suggestions
    if (dimensions.actionability) {
        const { score, details } = dimensions.actionability;
        if (details.numberedSteps === 0 && details.imperativeSentences < 2) {
            suggestions.push({
                dimension: 'Actionability',
                severity: score < 40 ? 'high' : 'medium',
                what: 'Content lacks clear action steps or directives.',
                why: 'Readers want to know what to DO next. Actionable content gets shared 2x more.',
                how: 'Add numbered steps ("Step 1: …"), imperative sentences ("Start by…"), or a "Next Steps" section.',
            });
        }
    }

    // Sort: high → medium → low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return suggestions.slice(0, 6); // Cap at 6 suggestions
}

// ─── Error Handling ───────────────────────────────────────

// Multer error handler
app.use((err, _req, res, _next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
    }
    if (err.message?.includes('Unsupported file type')) {
        return res.status(400).json({ error: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ─── Start Server ─────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n  🚀 Content Analyzer API running on http://localhost:${PORT}`);
    console.log(`  📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`  📤 Upload endpoint: POST http://localhost:${PORT}/api/analyze\n`);
});

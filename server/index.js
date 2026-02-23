import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import upload, { cleanupTempFile } from './middleware/upload.js';
import { extractFromPDF } from './extractors/pdfExtractor.js';
import { extractFromImage } from './extractors/imageExtractor.js';
import { validateUrl, fetchUrlContent } from './extractors/urlFetcher.js';
import { preprocessText } from './preprocessing/preprocessor.js';
import { analyzeContent } from './analysis/analyzer.js';
import { initModels } from './analysis/mlModels.js';
import { initCentroids } from './analysis/hookDetector.js';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});



// ─── Full Pipeline Endpoint ───────────────────────────────
// Upload → Extract → Preprocess → Analyze → Respond

app.post('/api/analyze', upload.single('file'), async (req, res) => {
    let tempPath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded. Please select a PDF, PNG, or JPG.' });
        }

        const { mimetype, originalname, size, path: filepath, requestId } = req.file;
        tempPath = filepath;

        const buffer = fs.readFileSync(filepath);

        // ── Step 1: Extract ───────────────────────────────
        let extraction;

        if (mimetype === 'application/pdf') {
            extraction = await extractFromPDF(buffer);

            if (extraction.needs_ocr_fallback) {
                // NOTE: Tesseract.js cannot read raw PDF buffers — it only supports
                // image formats (PNG, JPG, etc). Converting PDF pages to images would
                // require additional dependencies (e.g. pdf-to-img, canvas).
                // For now, we keep whatever sparse text pdf-parse found and flag it.
                console.log(`  ⚠️ PDF "${originalname}" appears to be scanned (only ${extraction.extracted_text.length} chars found)`);
                console.log(`     OCR on raw PDF buffers is not supported — keeping sparse text`);
                extraction.extraction_method = 'pdf-parse (sparse)';
                extraction.confidence_estimate = Math.min(extraction.confidence_estimate || 30, 30);
            }
        } else if (mimetype.startsWith('image/')) {
            extraction = await extractFromImage(buffer);
        } else {
            return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
        }

        if (!extraction.extracted_text || extraction.extracted_text.trim().length === 0) {
            return res.status(422).json({
                requestId,
                error: 'Could not extract any text from this file.',
                hint: mimetype.startsWith('image/')
                    ? 'Make sure the image contains clear, printed text.'
                    : 'The PDF appears to be image-based and OCR could not read it.',
            });
        }

        // ── Step 2: Preprocess (Phase 5) ──────────────────
        const preprocessed = preprocessText(extraction.extracted_text);

        // ── Step 3: Analyze (Phase 6) ─────────────────────
        const analysis = await analyzeContent(preprocessed.normalizedText, preprocessed);

        // ── Step 4: Respond ───────────────────────────────
        res.json({
            requestId,
            filename: originalname,
            fileSize: size,
            fileType: mimetype,
            extraction: {
                extraction_method: extraction.extraction_method,
                page_count: extraction.page_count,
                confidence_estimate: extraction.confidence_estimate,
                text_length: extraction.extracted_text.length,
            },
            preprocessing: {
                totalChars: preprocessed.stats.totalChars,
                totalWords: preprocessed.stats.totalWords,
                totalSentences: preprocessed.stats.totalSentences,
                totalParagraphs: preprocessed.stats.totalParagraphs,
                totalHeadings: preprocessed.stats.totalHeadings,
                normalizedText: preprocessed.normalizedText,
            },
            analysis: {
                overallScore: analysis.overallScore,
                wordCount: analysis.wordCount,
                sentenceCount: analysis.sentenceCount,
                dimensions: analysis.dimensions,
                metrics: analysis.metrics,
            },
            suggestions: analysis.suggestions,
        });
    } catch (err) {
        console.error('Analysis error:', err);
        res.status(500).json({ error: 'Analysis failed. Please try again with a different file.' });
    } finally {
        cleanupTempFile(tempPath);
    }
});

// ─── URL Analysis Endpoint ────────────────────────────────
// Accepts JSON { url: "https://..." }, fetches content, analyzes it

app.post('/api/analyze-url', async (req, res) => {
    try {
        const { url } = req.body;

        // Validate URL
        const validation = validateUrl(url);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const requestId = randomUUID();
        console.log(`  🌐 Analyzing URL: ${validation.normalized} [${requestId.slice(0, 8)}]`);

        // Fetch content from URL
        const fetched = await fetchUrlContent(validation.normalized);

        let extractedText = fetched.extracted_text;
        let extractionMethod = fetched.extraction_method;
        let confidence = null;

        // If it's an image URL, run OCR
        if (fetched.is_image && fetched.image_buffer) {
            const ocrResult = await extractFromImage(fetched.image_buffer);
            extractedText = ocrResult.extracted_text;
            extractionMethod = 'url-image-ocr';
            confidence = ocrResult.confidence_estimate;
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(422).json({
                requestId,
                error: 'Could not extract any text from this URL.',
                hint: fetched.is_image
                    ? 'The image may not contain readable text. Try a clearer image.'
                    : 'The web page may be JavaScript-rendered or have no readable content.',
            });
        }

        // Preprocess + Analyze
        const preprocessed = preprocessText(extractedText);
        const analysis = await analyzeContent(preprocessed.normalizedText, preprocessed);

        res.json({
            requestId,
            source: 'url',
            sourceUrl: validation.normalized,
            pageTitle: fetched.title,
            extraction: {
                extraction_method: extractionMethod,
                page_count: 1,
                confidence_estimate: confidence,
                text_length: extractedText.length,
            },
            preprocessing: {
                totalChars: preprocessed.stats.totalChars,
                totalWords: preprocessed.stats.totalWords,
                totalSentences: preprocessed.stats.totalSentences,
                totalParagraphs: preprocessed.stats.totalParagraphs,
                totalHeadings: preprocessed.stats.totalHeadings,
                normalizedText: preprocessed.normalizedText,
            },
            analysis: {
                overallScore: analysis.overallScore,
                wordCount: analysis.wordCount,
                sentenceCount: analysis.sentenceCount,
                dimensions: analysis.dimensions,
                metrics: analysis.metrics,
            },
            suggestions: analysis.suggestions,
        });
    } catch (err) {
        console.error('URL analysis error:', err);

        if (err.name === 'AbortError') {
            return res.status(408).json({ error: 'Request timed out. The URL took too long to respond.' });
        }
        res.status(500).json({ error: `Failed to analyze URL: ${err.message}` });
    }
});

// ─── Error Handling ───────────────────────────────────────

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

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`\n  🚀 Content Analyzer API running on http://localhost:${PORT}`);
        console.log(`  📋 Health check:     GET  http://localhost:${PORT}/api/health`);
        console.log(`  🔬 File analysis:    POST http://localhost:${PORT}/api/analyze`);
        console.log(`  🌐 URL analysis:     POST http://localhost:${PORT}/api/analyze-url\n`);

        // Load ML models asynchronously (server is already accepting requests)
        const modelsLoaded = await initModels();
        if (modelsLoaded) {
            await initCentroids();
        }
    });
}

export default app;

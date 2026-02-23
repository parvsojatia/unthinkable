import pdfParse from 'pdf-parse';

// Minimum character threshold — if a PDF yields less than this,
// it's likely scanned/image-based and needs OCR fallback.
export const MIN_TEXT_THRESHOLD = 50;

/**
 * Extract text from a PDF buffer using pdf-parse.
 * Returns standardized extraction result.
 *
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<{
 *   extracted_text: string,
 *   extraction_method: 'pdf-parse' | 'pdf-parse+ocr-fallback',
 *   page_count: number,
 *   confidence_estimate: number|null,
 *   needs_ocr_fallback: boolean,
 *   info: object
 * }>}
 */
export async function extractFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        const text = data.text.trim();

        // Determine if the PDF is a scanned document with little/no selectable text
        const needsOcrFallback = text.length < MIN_TEXT_THRESHOLD;

        return {
            extracted_text: text,
            extraction_method: 'pdf-parse',
            page_count: data.numpages,
            confidence_estimate: needsOcrFallback ? null : 95, // native text is high confidence
            needs_ocr_fallback: needsOcrFallback,
            info: {
                title: data.info?.Title || null,
                author: data.info?.Author || null,
            },
        };
    } catch (err) {
        throw new Error(`PDF extraction failed: ${err.message}`);
    }
}

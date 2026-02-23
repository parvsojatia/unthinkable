import { createWorker } from 'tesseract.js';

/**
 * Extract text from an image buffer (or PDF page rendered as image) using Tesseract OCR.
 * Returns standardized extraction result.
 *
 * @param {Buffer} buffer - The image file buffer
 * @returns {Promise<{
 *   extracted_text: string,
 *   extraction_method: 'tesseract-ocr',
 *   page_count: number,
 *   confidence_estimate: number
 * }>}
 */
export async function extractFromImage(buffer) {
    let worker;
    try {
        const publicPath = (await import('path')).resolve('./public');
        worker = await createWorker('eng', 1, {
            langPath: publicPath,
            cachePath: publicPath,
        });
        const { data } = await worker.recognize(buffer);
        return {
            extracted_text: data.text.trim(),
            extraction_method: 'tesseract-ocr',
            page_count: 1,
            confidence_estimate: Math.round(data.confidence),
        };
    } catch (err) {
        throw new Error(`OCR extraction failed: ${err.message}`);
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}

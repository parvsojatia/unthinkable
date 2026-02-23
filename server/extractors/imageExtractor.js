import { createWorker } from 'tesseract.js';

/**
 * Extract text from an image buffer using Tesseract OCR.
 * @param {Buffer} buffer - The image file buffer
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function extractFromImage(buffer) {
    let worker;
    try {
        worker = await createWorker('eng');
        const { data } = await worker.recognize(buffer);
        return {
            text: data.text.trim(),
            confidence: Math.round(data.confidence),
        };
    } catch (err) {
        throw new Error(`OCR extraction failed: ${err.message}`);
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}

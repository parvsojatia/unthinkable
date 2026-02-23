import pdfParse from 'pdf-parse';

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<{text: string, pageCount: number, info: object}>}
 */
export async function extractFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        return {
            text: data.text.trim(),
            pageCount: data.numpages,
            info: {
                title: data.info?.Title || null,
                author: data.info?.Author || null,
            },
        };
    } catch (err) {
        throw new Error(`PDF extraction failed: ${err.message}`);
    }
}

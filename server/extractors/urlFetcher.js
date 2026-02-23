/**
 * URL Fetcher — extracts text from web pages and image URLs.
 *
 * For web pages: fetches HTML, strips tags, returns clean text.
 * For image URLs: downloads the image buffer for OCR.
 */

import * as cheerio from 'cheerio';

// ─── URL Validation ───────────────────────────────────────

const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10 MB

/**
 * Validate and normalize a URL.
 * @param {string} url - The raw URL string
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, normalized: '', error: 'URL is required.' };
    }

    let normalized = url.trim();

    // Add protocol if missing
    if (!/^https?:\/\//i.test(normalized)) {
        normalized = 'https://' + normalized;
    }

    try {
        const parsed = new URL(normalized);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, normalized: '', error: 'Only HTTP and HTTPS URLs are supported.' };
        }
        return { valid: true, normalized };
    } catch {
        return { valid: false, normalized: '', error: 'Invalid URL format.' };
    }
}

// ─── Content Type Detection ───────────────────────────────

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];

function isImageUrl(url, contentType) {
    // Check by content-type header
    if (contentType && IMAGE_CONTENT_TYPES.some((t) => contentType.includes(t))) {
        return true;
    }
    // Check by file extension
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
        return false;
    }
}

// ─── Web Page Text Extraction ─────────────────────────────

/**
 * Extract readable text content from HTML.
 * Strips scripts, styles, nav, footer, and other non-content elements.
 */
function extractTextFromHTML(html) {
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, nav, footer, header, aside, iframe, noscript, svg, form, button, input, select, textarea').remove();
    $('[role="navigation"], [role="banner"], [role="complementary"], [aria-hidden="true"]').remove();

    // Try to find main content area
    let contentEl = $('article, [role="main"], main, .post-content, .article-content, .entry-content, #content').first();
    if (contentEl.length === 0) {
        contentEl = $('body');
    }

    // Extract text with structure preserved
    const blocks = [];

    contentEl.find('h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, figcaption, .caption').each((_i, el) => {
        const tag = el.tagName?.toLowerCase();
        let text = $(el).text().trim();
        if (!text) return;

        // Preserve heading markers
        if (tag && tag.startsWith('h')) {
            const level = parseInt(tag[1], 10);
            text = '#'.repeat(level) + ' ' + text;
        }

        // Preserve list markers
        if (tag === 'li') {
            text = '• ' + text;
        }

        blocks.push(text);
    });

    // Fallback: if structured extraction got very little, grab all text
    if (blocks.join('\n').length < 100) {
        return contentEl.text().replace(/\s+/g, ' ').trim();
    }

    return blocks.join('\n\n');
}

// ─── Main Fetch Function ──────────────────────────────────

/**
 * Fetch content from a URL and extract text.
 *
 * @param {string} url - The validated URL
 * @returns {Promise<{
 *   extracted_text: string,
 *   extraction_method: 'web-scrape' | 'url-image-ocr',
 *   source_url: string,
 *   content_type: string,
 *   title: string|null,
 *   is_image: boolean,
 *   image_buffer: Buffer|null
 * }>}
 */
export async function fetchUrlContent(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ContentAnalyzer/1.0 (text extraction bot)',
                'Accept': 'text/html, image/*, application/pdf, */*',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

        if (contentLength > MAX_CONTENT_LENGTH) {
            throw new Error(`Content too large (${Math.round(contentLength / 1024 / 1024)}MB). Max is 10MB.`);
        }

        // ── Image URL → return buffer for OCR ─────────────
        if (isImageUrl(url, contentType)) {
            const buffer = Buffer.from(await response.arrayBuffer());
            return {
                extracted_text: '', // Will be filled by OCR in the route handler
                extraction_method: 'url-image-ocr',
                source_url: url,
                content_type: contentType,
                title: null,
                is_image: true,
                image_buffer: buffer,
            };
        }

        // ── Web Page → extract text from HTML ─────────────
        if (contentType.includes('text/html') || contentType.includes('text/plain')) {
            const body = await response.text();

            if (contentType.includes('text/plain')) {
                return {
                    extracted_text: body.trim(),
                    extraction_method: 'web-scrape',
                    source_url: url,
                    content_type: contentType,
                    title: null,
                    is_image: false,
                    image_buffer: null,
                };
            }

            // HTML parsing
            const $ = cheerio.load(body);
            const title = $('title').text().trim() || $('h1').first().text().trim() || null;
            const extractedText = extractTextFromHTML(body);

            return {
                extracted_text: extractedText,
                extraction_method: 'web-scrape',
                source_url: url,
                content_type: contentType,
                title,
                is_image: false,
                image_buffer: null,
            };
        }

        throw new Error(`Unsupported content type: ${contentType}. Expected a web page or image.`);
    } finally {
        clearTimeout(timeout);
    }
}

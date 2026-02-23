/**
 * ML Model Manager — Centralized loader for all ML models.
 *
 * Uses @xenova/transformers to run Hugging Face models 100% locally.
 * Models are loaded asynchronously on server startup and cached.
 *
 * Exports:
 *   initModels()          — kick off async loading (call once at startup)
 *   classifySentiment()   — ML-powered text sentiment
 *   getEmbedding()        — 384-dim sentence embedding vector
 *   isReady()             — whether all models have finished loading
 */

import { pipeline, env } from '@xenova/transformers';

// Disable local models when running on Vercel to avoid large bundle issues
const isVercel = !!process.env.VERCEL;
env.allowLocalModels = !isVercel;
env.allowRemoteModels = true;
// Use local cache directory for dev
env.cacheDir = isVercel ? '/tmp/.model_cache' : './.model_cache';

let sentimentPipeline = null;
let embeddingPipeline = null;
let modelsReady = false;
let loadError = null;

/**
 * Initialize all ML models. Call once at server startup.
 * This is non-blocking — the server can start serving immediately.
 * @returns {Promise<boolean>} true if all models loaded successfully
 */
export async function initModels() {
    try {
        console.log('  🧠 Loading ML models...');

        // Load sentiment classifier (DistilBERT fine-tuned on SST-2)
        sentimentPipeline = await pipeline(
            'sentiment-analysis',
            'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
        );
        console.log('  ✅ Sentiment model loaded');

        // Load sentence embedding model (MiniLM)
        embeddingPipeline = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2'
        );
        console.log('  ✅ Embedding model loaded');

        modelsReady = true;
        console.log('  🧠 All ML models ready');
        return true;
    } catch (err) {
        loadError = err;
        console.error('  ❌ ML model loading failed:', err.message);
        console.log('  ⚠️  Falling back to heuristic analysis');
        return false;
    }
}

/**
 * Check if ML models are ready for inference.
 * @returns {boolean}
 */
export function isReady() {
    return modelsReady;
}

/**
 * Classify the sentiment using DistilBERT.
 * Accepts a single string or an array of strings for batch processing.
 *
 * @param {string|string[]} input - Input text or array of sentences
 * @returns {Promise<any>}
 *   Single string: { label: 'POSITIVE', score: 0.99 }
 *   Array: [{ label: 'POSITIVE', score: 0.99 }, ...]
 */
export async function classifySentiment(input) {
    if (!sentimentPipeline) {
        throw new Error('Sentiment model not loaded');
    }

    // Handle batch of sentences
    if (Array.isArray(input)) {
        if (input.length === 0) return [];
        // Truncate each sentence to avoid OOM
        const truncated = input.map(s => s.length > 500 ? s.slice(0, 500) : s);
        const results = await sentimentPipeline(truncated);
        return results; // array of objects
    }

    // Handle single string
    const truncated = input.length > 2000 ? input.slice(0, 2000) : input;
    const result = await sentimentPipeline(truncated);
    return result[0]; // { label: 'POSITIVE', score: 0.9998 }
}

/**
 * Generate a 384-dimension embedding vector for a sentence.
 * Used for cosine similarity matching against hook archetypes.
 *
 * @param {string} text - Input sentence
 * @returns {Promise<number[]>} 384-dim normalized vector
 */
export async function getEmbedding(text) {
    if (!embeddingPipeline) {
        throw new Error('Embedding model not loaded');
    }

    const output = await embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true,
    });

    // output.data is a Float32Array; convert to plain array
    return Array.from(output.data);
}

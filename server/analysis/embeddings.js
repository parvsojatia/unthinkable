import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let extractor = null;
let isModelAvailable = false;
let centroids = {
    hooks: {},
    persuasion: {}
};

/**
 * Initialize the embedding model and precompute centroids for prototypes.
 * We do this asynchronously so it doesn't block the server startup, but
 * the embeddings feature won't be available until it completes.
 */
export async function initEmbeddings() {
    try {
        console.log('[Embeddings] Initializing Xenova/all-MiniLM-L6-v2...');
        const { pipeline } = await import('@xenova/transformers');
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        isModelAvailable = true;
        console.log('[Embeddings] Model loaded successfully. Computing centroids...');
        await computeAllCentroids();
        console.log('[Embeddings] Initialization complete.');
    } catch (err) {
        console.warn('[Embeddings] Failed to initialize model. Falling back to heuristic/regex mode.', err.message);
        isModelAvailable = false;
    }
}

/**
 * Returns true if the embedding model is loaded and ready to use.
 */
export function isAvailable() {
    return isModelAvailable;
}

/**
 * Generates an embedding vector for a given text.
 * @param {string} text 
 * @returns {Promise<Float32Array|null>}
 */
export async function getEmbedding(text) {
    if (!isAvailable() || !text.trim()) return null;
    try {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        return output.data;
    } catch (e) {
        console.error('[Embeddings] Error generating embedding:', e.message);
        return null;
    }
}

/**
 * Computes cosine similarity between two Float32Array vectors.
 * @param {Float32Array} vecA 
 * @param {Float32Array} vecB 
 * @returns {number} Value between -1 and 1
 */
export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Returns the precomputed centroids.
 */
export function getCentroids() {
    return centroids;
}

// ─── Internal Centroid Logic ─────────────────────────────────

async function computeAllCentroids() {
    const prototypesDir = path.join(__dirname, 'prototypes');

    // Load hooks
    const hooksDir = path.join(prototypesDir, 'hooks');
    if (fs.existsSync(hooksDir)) {
        const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.txt'));
        for (const file of files) {
            const hookType = path.basename(file, '.txt');
            const lines = fs.readFileSync(path.join(hooksDir, file), 'utf-8')
                .split('\\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);

            centroids.hooks[hookType] = await computeArrayCentroid(lines);
        }
    }

    // Load persuasion
    const persuasionDir = path.join(prototypesDir, 'persuasion');
    if (fs.existsSync(persuasionDir)) {
        const files = fs.readdirSync(persuasionDir).filter(f => f.endsWith('.txt'));
        for (const file of files) {
            const phaseType = path.basename(file, '.txt');
            const lines = fs.readFileSync(path.join(persuasionDir, file), 'utf-8')
                .split('\\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);

            centroids.persuasion[phaseType] = await computeArrayCentroid(lines);
        }
    }
}

async function computeArrayCentroid(texts) {
    if (!texts || texts.length === 0) return null;

    const vecs = [];
    for (const text of texts) {
        const vec = await getEmbedding(text);
        if (vec) vecs.push(vec);
    }

    if (vecs.length === 0) return null;

    // Average all vectors
    const dim = vecs[0].length;
    const centroid = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        let sum = 0;
        for (const vec of vecs) {
            sum += vec[i];
        }
        centroid[i] = sum / vecs.length;
    }

    // Normalize the centroid so cosine similarity is easier
    let norm = 0;
    for (let i = 0; i < dim; i++) {
        norm += centroid[i] * centroid[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < dim; i++) {
            centroid[i] /= norm;
        }
    }

    return centroid;
}

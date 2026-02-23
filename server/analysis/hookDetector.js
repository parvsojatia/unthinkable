/**
 * Hook Detector — Semantic Hook Archetype Classifier
 *
 * Uses MiniLM sentence embeddings to classify the opening sentence
 * of a post into a hook archetype by computing cosine similarity
 * against prototype centroids.
 *
 * Archetypes: question, statistic, story, bold-claim, contrarian
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEmbedding, isReady } from './mlModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOTYPES_DIR = path.join(__dirname, 'prototypes', 'hooks');
const SIMILARITY_THRESHOLD = 0.35;

// Cache for precomputed centroids
let centroids = null;

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in range [-1, 1]
 */
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Average multiple vectors into a single centroid vector.
 * @param {number[][]} vectors
 * @returns {number[]}
 */
function computeCentroid(vectors) {
    const dim = vectors[0].length;
    const centroid = new Array(dim).fill(0);
    for (const vec of vectors) {
        for (let i = 0; i < dim; i++) {
            centroid[i] += vec[i];
        }
    }
    for (let i = 0; i < dim; i++) {
        centroid[i] /= vectors.length;
    }
    return centroid;
}

/**
 * Initialize centroids by embedding all prototype sentences and averaging.
 * Should be called after ML models are loaded.
 * @returns {Promise<boolean>}
 */
export async function initCentroids() {
    if (!isReady()) {
        console.log('  ⚠️  ML models not ready — skipping centroid initialization');
        return false;
    }

    try {
        const files = fs.readdirSync(PROTOTYPES_DIR).filter(f => f.endsWith('.txt'));
        centroids = {};

        for (const file of files) {
            const archetype = path.basename(file, '.txt');
            const content = fs.readFileSync(path.join(PROTOTYPES_DIR, file), 'utf-8');
            const sentences = content.split('\n').map(s => s.trim()).filter(s => s.length > 0);

            // Embed all prototype sentences
            const embeddings = [];
            for (const sentence of sentences) {
                const embedding = await getEmbedding(sentence);
                embeddings.push(embedding);
            }

            // Compute centroid
            centroids[archetype] = computeCentroid(embeddings);
        }

        console.log(`  ✅ Hook centroids computed for: ${Object.keys(centroids).join(', ')}`);
        return true;
    } catch (err) {
        console.error('  ❌ Centroid initialization failed:', err.message);
        centroids = null;
        return false;
    }
}

/**
 * Classify a sentence into a hook archetype using cosine similarity.
 *
 * @param {string} sentence - The opening sentence to classify
 * @returns {Promise<{ hookType: string, confidence: number, allScores: object } | null>}
 */
export async function classifyHook(sentence) {
    if (!centroids || !isReady()) {
        return null; // Graceful fallback
    }

    try {
        const embedding = await getEmbedding(sentence);

        let bestType = 'none';
        let bestScore = -1;
        const allScores = {};

        for (const [archetype, centroid] of Object.entries(centroids)) {
            const similarity = cosineSimilarity(embedding, centroid);
            allScores[archetype] = Math.round(similarity * 100) / 100;

            if (similarity > bestScore) {
                bestScore = similarity;
                bestType = archetype;
            }
        }

        // Only classify if above threshold
        if (bestScore < SIMILARITY_THRESHOLD) {
            return { hookType: 'generic', confidence: bestScore, allScores };
        }

        return { hookType: bestType, confidence: bestScore, allScores };
    } catch (err) {
        console.error('Hook classification error:', err.message);
        return null;
    }
}

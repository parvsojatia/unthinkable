import { describe, it, expect } from 'vitest';
import { cosineSimilarity, isAvailable, getEmbedding, getCentroids } from '../embeddings.js';

describe('embeddings utility', () => {
    it('initializes with model unavailable', () => {
        expect(isAvailable()).toBe(false);
    });

    it('returns null for getEmbedding when unavailable', async () => {
        const vec = await getEmbedding('Hello world');
        expect(vec).toBeNull();
    });

    it('computes cosine similarity correctly', () => {
        const vecA = new Float32Array([1, 0, 0]);
        const vecB = new Float32Array([0, 1, 0]);
        const vecC = new Float32Array([1, 0, 0]);

        // Orthogonal = 0
        expect(cosineSimilarity(vecA, vecB)).toBe(0);

        // Identical = 1
        expect(cosineSimilarity(vecA, vecC)).toBe(1);

        // Negative
        const vecD = new Float32Array([-1, 0, 0]);
        expect(cosineSimilarity(vecA, vecD)).toBe(-1);
    });

    it('handles null or mismatched arrays in cosineSimilarity', () => {
        expect(cosineSimilarity(null, null)).toBe(0);
        expect(cosineSimilarity(new Float32Array([1]), new Float32Array([1, 2]))).toBe(0);
    });

    it('has an empty initial centroids object', () => {
        const centroids = getCentroids();
        expect(centroids.hooks).toBeDefined();
        expect(centroids.persuasion).toBeDefined();
    });
});

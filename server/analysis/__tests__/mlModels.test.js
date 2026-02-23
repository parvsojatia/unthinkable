import { describe, it, expect, beforeAll } from 'vitest';
import { initModels, classifySentiment, getEmbedding } from '../mlModels.js';

describe('ML Models Layer', () => {
    // Increase timeout for model loading
    beforeAll(async () => {
        await initModels();
    }, 60000);

    it('should classify obvious positive sentiment', async () => {
        const result = await classifySentiment('I absolutely love this new feature, it is amazing!');
        expect(result.label).toBe('POSITIVE');
        expect(result.score).toBeGreaterThan(0.9);
    });

    it('should classify obvious negative sentiment', async () => {
        const result = await classifySentiment('This is the worst experience I have ever had. It is terrible.');
        expect(result.label).toBe('NEGATIVE');
        expect(result.score).toBeGreaterThan(0.9);
    });

    it('should generate embeddings of correct dimension (384)', async () => {
        const embedding = await getEmbedding('Testing sentence embeddings.');
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(384);

        // Check for normalization (sum of squares should be approx 1)
        const sumSq = embedding.reduce((sum, val) => sum + val * val, 0);
        expect(sumSq).toBeGreaterThan(0.95);
        expect(sumSq).toBeLessThan(1.05);
    });
});

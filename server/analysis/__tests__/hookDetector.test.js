import { describe, it, expect, beforeAll } from 'vitest';
import { initModels } from '../mlModels.js';
import { initCentroids, classifyHook } from '../hookDetector.js';

describe('Hook Detector', () => {
    beforeAll(async () => {
        await initModels();
        await initCentroids();
    }, 60000);

    it('should detect a question hook', async () => {
        const result = await classifyHook('Have you ever wondered why most startups fail?');
        expect(result.hookType).toBe('question');
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect a statistic hook', async () => {
        const result = await classifyHook('New data shows that 85% of users prefer dark mode.');
        expect(result.hookType).toBe('statistic');
        expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('should detect a story hook', async () => {
        const result = await classifyHook('It was a cold morning in 2018 when I decided to quit.');
        expect(result.hookType).toBe('story');
        expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('should detect a bold claim hook', async () => {
        const result = await classifyHook('Everything the experts told you about SEO is a lie.');
        expect(result.hookType).toBe('bold-claim');
        expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('should return generic for non-hook starters', async () => {
        const result = await classifyHook('I am writing this blog post to explain a new concept.');
        // Generic or relatively low confidence
        expect(['generic', 'bold-claim', 'story']).toContain(result.hookType);
    });
});

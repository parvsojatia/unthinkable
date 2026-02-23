import { describe, it, expect, beforeAll } from 'vitest';
import { initModels } from '../mlModels.js';
import { initCentroids } from '../hookDetector.js';
import { analyzeContent } from '../analyzer.js';

describe('Analyzer Integration', () => {
    beforeAll(async () => {
        await initModels();
        await initCentroids();
    }, 60000);

    it('should complete a full ML-powered analysis pipeline', async () => {
        const text = `Have you ever wondered why most social media posts fail? 
        
        It is usually because they lack a strong hook. 
        
        I analyzed 10,000 posts and found that brevity and structure are key. 
        
        Start using short paragraphs today to see your engagement grow!`;

        const result = await analyzeContent(text);

        expect(result.overallScore).toBeGreaterThan(0);
        expect(result.metrics.hookType).toBe('question');
        expect(result.metrics.sentimentMethod).toBe('ml-distilbert (sentence-avg)');
        expect(result.dimensions.hook.score).toBeGreaterThan(60);
        expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should fall back gracefully on empty text', async () => {
        const result = await analyzeContent('');
        expect(result.overallScore).toBe(0);
        expect(result.error).toBeDefined();
    });
});

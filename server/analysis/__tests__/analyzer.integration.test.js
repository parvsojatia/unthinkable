import { describe, it, expect } from 'vitest';
import { analyzeContent } from '../analyzer.js';

describe('analyzeContent integration', () => {
    it('handles empty text gracefully', async () => {
        const result = await analyzeContent('');
        expect(result.overallScore).toBe(0);
        expect(result.suggestions).toEqual([]);
    });

    it('returns all expected fields for a real text', async () => {
        const text = `
            Have you ever wondered why some LinkedIn posts get thousands of likes while yours gets three?
            It is not luck. It is not connections. It is structure.

            Most people write long paragraphs that nobody reads. They bury the lead under disclaimers and qualifiers.

            Instead, try this. Start with a hook. Keep sentences under 15 words. End with a question.

            What is the one change that made the biggest difference in your content? Drop a comment below.
        `;

        const result = await analyzeContent(text);

        // Core fields exist
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('wordCount');
        expect(result).toHaveProperty('sentenceCount');
        expect(result).toHaveProperty('dimensions');
        expect(result).toHaveProperty('metrics');
        expect(result).toHaveProperty('suggestions');
        expect(result).toHaveProperty('explanation');

        // New dimensions exist
        expect(result.dimensions).toHaveProperty('hook');
        expect(result.dimensions).toHaveProperty('cognitiveLoad');
        expect(result.dimensions).toHaveProperty('persuasion');

        // Dimensions have scores
        expect(result.dimensions.hook.score).toBeGreaterThanOrEqual(0);
        expect(result.dimensions.hook.score).toBeLessThanOrEqual(100);
        expect(result.dimensions.cognitiveLoad.score).toBeGreaterThanOrEqual(0);
        expect(result.dimensions.persuasion.score).toBeGreaterThanOrEqual(0);

        // Dimensions have details
        expect(result.dimensions.hook.details).toHaveProperty('hookType');
        expect(result.dimensions.hook.details).toHaveProperty('reasons');
        expect(result.dimensions.cognitiveLoad.details).toHaveProperty('level');
        expect(result.dimensions.persuasion.details).toHaveProperty('framework');

        // New metrics exist
        expect(result.metrics).toHaveProperty('hookType');
        expect(result.metrics).toHaveProperty('cognitiveLoadLevel');
        expect(result.metrics).toHaveProperty('persuasionFramework');

        // Explanation is a non-empty string
        expect(typeof result.explanation).toBe('string');
        expect(result.explanation.length).toBeGreaterThan(20);

        // Score is reasonable (not 0 for real content)
        expect(result.overallScore).toBeGreaterThan(10);
    });

    it('generates at least 3 suggestions for imperfect content', async () => {
        const text = 'things are nice and stuff happens sometimes in the world we live in today it is very interesting';
        const result = await analyzeContent(text, null, 'linkedin');
        expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('generates different suggestions and scores between platforms for the same text', async () => {
        const text = `
            Welcome to my brand new startup story! 
            Today I am going to share everything.
            I learned a lot and it is quite interesting how things work sometimes, especially when you consider macroeconomics.
            What do you think? Drop a comment below!
            We are launching next week so link in bio.
        `;

        // Preprocess just a dummy object
        const mockCtx = {
            stats: { totalChars: 100, totalWords: 30, totalSentences: 5, totalParagraphs: 5, totalHeadings: 0 },
            normalizedText: text
        };

        const linkedinResult = await analyzeContent(text, mockCtx, 'linkedin');
        const tiktokResult = await analyzeContent(text, mockCtx, 'tiktok');

        // The exact scores and suggestions should differ because TikTok weights hooks much higher
        // and has different specific constraints than LinkedIn.
        expect(linkedinResult.platformScore).not.toBe(tiktokResult.platformScore);

        // Ensure platformSuggestions are returned
        expect(linkedinResult.platformSuggestions).toBeInstanceOf(Array);
        expect(tiktokResult.platformSuggestions).toBeInstanceOf(Array);
    });
});

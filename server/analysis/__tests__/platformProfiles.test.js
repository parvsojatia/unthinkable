import { describe, it, expect } from 'vitest';
import { platformProfiles, evaluatePlatform } from '../platformProfiles.js';

describe('platformProfiles', () => {
    it('has all required platforms defined', () => {
        const platforms = ['linkedin', 'x', 'tiktok', 'instagram', 'facebook', 'pinterest'];
        platforms.forEach(p => {
            expect(platformProfiles).toHaveProperty(p);
            expect(platformProfiles[p]).toHaveProperty('weights');
            expect(platformProfiles[p]).toHaveProperty('gates');
        });
    });

    describe('evaluatePlatform', () => {
        const mockDimensions = {
            readability: { score: 80, details: { gradeLevel: 8 } },
            structure: { score: 50, details: { longParagraphs: 0 } },
            engagement: { score: 60 },
            clarity: { score: 90 },
            actionability: { score: 45 },
            sentiment: { score: 70, details: { sentimentScore: 1 } },
            hook: { score: 40 },
            cognitiveLoad: { score: 80 },
            persuasion: { score: 50 }
        };

        const mockCtx = { wordCount: 150 };

        it('returns null for an unknown platform', () => {
            expect(evaluatePlatform('myspace', mockDimensions, mockCtx)).toBeNull();
        });

        it('computes a platform score and returns no suggestions if gates pass', () => {
            const result = evaluatePlatform('linkedin', mockDimensions, mockCtx);
            expect(result).toHaveProperty('platformScore');
            expect(result.platformScore).toBeGreaterThan(0);
            expect(result.platformScore).toBeLessThanOrEqual(100);

            // longParagraphs is 0, hook is 40. The hook gate triggers (<50).
            expect(result.platformSuggestions.length).toBe(1);
            expect(result.platformSuggestions[0].dimension).toBe('LinkedIn');
            expect(result.platformSuggestions[0].severity).toBe('high');
        });

        it('applies negative impact for triggered gates', () => {
            // X profile has a critical gate for wordCount > 50 which removes 20 points
            const resultX = evaluatePlatform('x', mockDimensions, { wordCount: 60 });

            // Recompute base weighted score without gates
            const profileX = platformProfiles['x'];
            const weightedBase = Object.entries(profileX.weights).reduce((sum, [k, w]) => sum + mockDimensions[k].score * w, 0);

            // Result score should be base - 20 (gate limit) clamped to 0
            const expectedScore = Math.max(0, Math.round(weightedBase - 20));
            expect(resultX.platformScore).toBe(expectedScore);
            expect(resultX.platformSuggestions.length).toBeGreaterThan(0);
            expect(resultX.platformSuggestions[0].what).toContain('Optimize for');
            expect(resultX.platformSuggestions[0].how).toContain('280-character limit');
        });

        it('clamps the minimum platformScore to 0', () => {
            const lowDimensions = {};
            Object.keys(mockDimensions).forEach(k => lowDimensions[k] = { score: 0, details: mockDimensions[k].details });
            lowDimensions.hook.score = 0; // Triggers LinkedIn gate (-15)
            lowDimensions.structure.details.longParagraphs = 5; // Triggers LinkedIn gate (-10)

            const result = evaluatePlatform('linkedin', lowDimensions, mockCtx);
            expect(result.platformScore).toBe(0); // -25 clamped to 0
            expect(result.platformSuggestions.length).toBe(2);
        });
    });
});

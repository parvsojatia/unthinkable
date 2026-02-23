import { describe, it, expect } from 'vitest';
import { analyzeHook, analyzeCognitiveLoad, detectPersuasion, generateContentExplanation } from '../contentSignals.js';

// ═══════════════════════════════════════════════════════════════
// Hook Analyzer
// ═══════════════════════════════════════════════════════════════

describe('analyzeHook', () => {
    it('handles empty input gracefully', () => {
        const result = analyzeHook('');
        expect(result.score).toBe(0);
        expect(result.hookType).toBeNull();
        expect(result.reasons).toHaveLength(1);
    });

    it('detects question hooks', () => {
        const result = analyzeHook('Is your content actually helping your career? Most people have no idea they are doing this wrong.');
        expect(result.hookType).toBe('question');
        expect(result.score).toBeGreaterThan(20);
        expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('detects statistic hooks', () => {
        const result = analyzeHook('73% of hiring managers reject resumes within 6 seconds. The rest never even open them.');
        expect(result.hookType).toBe('statistic');
        expect(result.score).toBeGreaterThan(30);
    });

    it('detects story hooks', () => {
        const result = analyzeHook('I once lost $50,000 in a single afternoon. It taught me the most important lesson about risk.');
        expect(result.hookType).toBe('story');
        expect(result.score).toBeGreaterThan(30);
    });

    it('penalizes vague openings', () => {
        const vague = analyzeHook('Things are kind of interesting in the world of various stuff.');
        const specific = analyzeHook('Tesla stock dropped 12% after Elon Musk announced the Cybertruck delay.');
        expect(specific.score).toBeGreaterThan(vague.score);
    });

    it('prefers short first sentences', () => {
        const short = analyzeHook('Stop doing this. Your career depends on it.');
        const long = analyzeHook('There are many different things that people need to consider when they are thinking about the various aspects of their professional career development in the modern world today.');
        expect(short.score).toBeGreaterThan(long.score);
    });
});

// ═══════════════════════════════════════════════════════════════
// Cognitive Load
// ═══════════════════════════════════════════════════════════════

describe('analyzeCognitiveLoad', () => {
    it('handles empty input gracefully', () => {
        const result = analyzeCognitiveLoad('');
        expect(result.score).toBe(50);
        expect(result.level).toBe('unknown');
    });

    it('scores simple content as low cognitive load', () => {
        const simple = 'Use short sentences. Keep your words simple. Write one idea per line. Readers will thank you.';
        const result = analyzeCognitiveLoad(simple);
        expect(['low', 'moderate']).toContain(result.level);
        expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('scores complex content as higher cognitive load', () => {
        const complex = 'The multifaceted, interconnected nature of contemporary socioeconomic paradigms necessitates a comprehensive reevaluation of our methodological frameworks; meanwhile, the epistemological foundations upon which we predicate our understanding of institutional dynamics are themselves undergoing unprecedented transformation, thereby complicating any attempt at systematic analysis of the phenomena in question.';
        const result = analyzeCognitiveLoad(complex);
        expect(result.score).toBeLessThan(60);
    });

    it('includes reasons explaining the score', () => {
        const result = analyzeCognitiveLoad('Keep it simple. Use small words. Write short lines. Be clear. Stay focused.');
        expect(result.reasons.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// Persuasion Detection
// ═══════════════════════════════════════════════════════════════

describe('detectPersuasion', () => {
    it('handles empty input gracefully', () => {
        const result = detectPersuasion('');
        expect(result.framework).toBe('none');
        expect(result.confidence).toBe(0);
    });

    it('handles very short input gracefully', () => {
        const result = detectPersuasion('Buy now!');
        expect(result.framework).toBe('none');
    });

    it('detects PAS-like structure', () => {
        const pas = `
            Are you struggling with low engagement on your posts? Most people spend hours crafting content that nobody reads.
            Without fixing this, you will keep losing followers. Your competitors are winning because they understand one thing you do not.
            The solution is simple: use a content analyzer. Try our tool today and watch your engagement grow. Click here to get started.
        `;
        const result = detectPersuasion(pas);
        expect(result.reasons.length).toBeGreaterThan(0);
        // Structure should be detected or at least partially scored
        expect(result.score).toBeGreaterThan(0);
    });

    it('returns reasons for unstructured content', () => {
        const random = 'The weather is nice today. I had pasta for lunch. My cat is sleeping. The sky is blue.';
        const result = detectPersuasion(random);
        expect(result.reasons.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// Content Explanation
// ═══════════════════════════════════════════════════════════════

describe('generateContentExplanation', () => {
    it('produces meaningful output for high scores', () => {
        const explanation = generateContentExplanation({
            overallScore: 85,
            hook: { score: 90, hookType: 'question' },
            cognitiveLoad: { score: 80, level: 'low' },
            persuasion: { framework: 'AIDA', confidence: 75 },
            dimensions: {},
        });
        expect(explanation).toContain('85/100');
        expect(explanation).toContain('strong');
    });

    it('produces meaningful output for low scores', () => {
        const explanation = generateContentExplanation({
            overallScore: 25,
            hook: { score: 15, hookType: null },
            cognitiveLoad: { score: 20, level: 'overload' },
            persuasion: { framework: 'none', confidence: 0 },
            dimensions: {},
        });
        expect(explanation).toContain('25/100');
        expect(explanation).toContain('weak');
    });
});

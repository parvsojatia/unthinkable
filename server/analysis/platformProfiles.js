/**
 * Platform Profiles
 * Defines the scoring weights and strict gates for various social platforms.
 * 
 * Weights refer to the 9 existing dimensions: 
 * readability, structure, engagement, clarity, actionability, sentiment, hook, cognitiveLoad, persuasion
 */

export const platformProfiles = {
    linkedin: {
        name: 'LinkedIn',
        weights: {
            readability: 0.10, structure: 0.15, engagement: 0.10, clarity: 0.10,
            actionability: 0.10, sentiment: 0.05, hook: 0.15, cognitiveLoad: 0.10, persuasion: 0.15,
        },
        gates: [
            {
                dimension: 'structure',
                condition: (dim) => dim.details.longParagraphs > 0,
                impact: -10,
                template: 'LinkedIn heavily penalizes walls of text. Break up long paragraphs to optimize for mobile scrolling.',
                severity: 'high'
            },
            {
                dimension: 'hook',
                condition: (dim) => dim.score < 50,
                impact: -15,
                template: 'The "See more" click is critical on LinkedIn. Make your hook more compelling (try a question or bold claim).',
                severity: 'high'
            }
        ]
    },
    x: {
        name: 'X (Twitter)',
        weights: {
            readability: 0.15, structure: 0.05, engagement: 0.15, clarity: 0.15,
            actionability: 0.10, sentiment: 0.05, hook: 0.15, cognitiveLoad: 0.15, persuasion: 0.05,
        },
        gates: [
            {
                dimension: 'wordCount',
                condition: (val) => val > 50, // Assuming 280 chars ~ 50 words usually, just a proxy
                impact: -20,
                template: 'This content might exceed the standard 280-character limit on X, or is too dense for a single post. Consider turning it into a thread.',
                severity: 'critical'
            },
            {
                dimension: 'readability',
                condition: (dim) => dim.details.gradeLevel > 10,
                impact: -10,
                template: 'X favors simple, punchy language. Try lowering the reading grade level.',
                severity: 'medium'
            }
        ]
    },
    tiktok: {
        name: 'TikTok',
        weights: {
            readability: 0.05, structure: 0.05, engagement: 0.20, clarity: 0.10,
            actionability: 0.15, sentiment: 0.05, hook: 0.25, cognitiveLoad: 0.10, persuasion: 0.05,
        },
        gates: [
            {
                dimension: 'hook',
                condition: (dim) => dim.score < 60,
                impact: -20,
                template: 'TikTok viewers scroll within natively fast 3 seconds. Your opening hook must be extraordinarily catchy or visually arresting.',
                severity: 'critical'
            }
        ]
    },
    instagram: {
        name: 'Instagram',
        weights: {
            readability: 0.10, structure: 0.10, engagement: 0.15, clarity: 0.10,
            actionability: 0.15, sentiment: 0.10, hook: 0.15, cognitiveLoad: 0.10, persuasion: 0.05,
        },
        gates: [
            {
                dimension: 'actionability',
                condition: (dim) => dim.score < 40,
                impact: -10,
                template: 'Instagram captions need strong Calls to Action (e.g., "Link in bio", "Save this post") to drive engagement.',
                severity: 'high'
            }
        ]
    },
    facebook: {
        name: 'Facebook',
        weights: {
            readability: 0.15, structure: 0.10, engagement: 0.15, clarity: 0.10,
            actionability: 0.10, sentiment: 0.15, hook: 0.10, cognitiveLoad: 0.10, persuasion: 0.05,
        },
        gates: [
            {
                dimension: 'sentiment',
                condition: (dim) => dim.details.sentimentScore < -2,
                impact: -10,
                template: 'Facebook\'s algorithm can suppress overly negative posts. Consider a more positive or community-oriented tone.',
                severity: 'medium'
            }
        ]
    },
    pinterest: {
        name: 'Pinterest',
        weights: {
            readability: 0.10, structure: 0.05, engagement: 0.10, clarity: 0.15,
            actionability: 0.20, sentiment: 0.10, hook: 0.10, cognitiveLoad: 0.10, persuasion: 0.10,
        },
        gates: [
            {
                dimension: 'actionability',
                condition: (dim) => dim.score < 50,
                impact: -15,
                template: 'Pinterest is a search engine for ideas. Ensure your description has a clear, actionable outcome or step-by-step.',
                severity: 'critical'
            }
        ]
    }
};

/**
 * Calculates a platform-specific score and generates specific suggestions.
 * @param {string} platform - The platform identifier (e.g. 'linkedin')
 * @param {object} dimensions - The raw analyzed dimensions
 * @param {object} ctx - Context like word count
 * @returns {object} { platformScore, platformSuggestions }
 */
export function evaluatePlatform(platform, dimensions, ctx) {
    const profile = platformProfiles[platform];
    if (!profile) return null;

    // 1. Compute weighted score
    let score = Object.entries(profile.weights).reduce((sum, [key, weight]) => {
        return sum + (dimensions[key] ? dimensions[key].score * weight : 0);
    }, 0);

    // 2. Evaluate gates and collect suggestions
    const suggestions = [];
    for (const gate of profile.gates) {
        let conditionMet = false;
        if (gate.dimension === 'wordCount') {
            conditionMet = gate.condition(ctx.wordCount);
        } else {
            conditionMet = gate.condition(dimensions[gate.dimension]);
        }

        if (conditionMet) {
            score += gate.impact;
            suggestions.push({
                dimension: profile.name,
                severity: gate.severity,
                what: `Optimize for ${profile.name}`,
                why: `Platform constraint triggered.`,
                how: gate.template
            });
        }
    }

    // Clamp score
    const platformScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
        platformScore,
        platformSuggestions: suggestions
    };
}

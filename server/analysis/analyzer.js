/**
 * Content Analysis Engine — Phase 7
 *
 * Single-pass pipeline that computes metrics and generates
 * prioritized suggestions with a minimum of 3.
 *
 * Dimensions: readability, structure, engagement, clarity, actionability, sentiment,
 *             hook, cognitiveLoad, persuasion
 */

import { analyzeHook, analyzeCognitiveLoad, detectPersuasion, generateContentExplanation } from './contentSignals.js';

// ─── Helpers ──────────────────────────────────────────────

function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
}

function splitSentences(text) {
    return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitWords(text) {
    return text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9'-]/g, '')).filter((w) => w.length > 0);
}

function splitParagraphs(text) {
    return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
}

// ─── Sentiment (lightweight lexicon-based) ────────────────

const POSITIVE_WORDS = [
    'good', 'great', 'best', 'better', 'love', 'like', 'enjoy', 'happy', 'excellent',
    'amazing', 'wonderful', 'fantastic', 'perfect', 'awesome', 'beautiful', 'brilliant',
    'superb', 'outstanding', 'impressive', 'magnificent', 'remarkable', 'incredible',
    'easy', 'simple', 'fast', 'free', 'helpful', 'useful', 'effective', 'powerful',
    'success', 'win', 'achieve', 'improve', 'grow', 'inspire', 'motivate', 'empower',
    'innovative', 'creative', 'exciting', 'delightful', 'charming', 'elegant',
    'clear', 'clean', 'smooth', 'strong', 'bright', 'fresh', 'smart', 'safe',
];

const NEGATIVE_WORDS = [
    'bad', 'worst', 'worse', 'hate', 'dislike', 'terrible', 'horrible', 'awful',
    'poor', 'ugly', 'boring', 'dull', 'annoying', 'frustrating', 'confusing',
    'difficult', 'hard', 'complex', 'slow', 'expensive', 'dangerous', 'risky',
    'fail', 'failure', 'problem', 'issue', 'error', 'bug', 'broken', 'crash',
    'wrong', 'mistake', 'loss', 'pain', 'suffer', 'struggle', 'stress', 'worry',
    'never', 'cannot', 'impossible', 'unfortunately', 'sadly', 'regret',
    'complicated', 'overwhelming', 'messy', 'weak', 'useless', 'pointless',
];

function analyzeSentiment(words) {
    let positiveCount = 0;
    let negativeCount = 0;

    for (const w of words) {
        const lower = w.toLowerCase();
        if (POSITIVE_WORDS.includes(lower)) positiveCount++;
        if (NEGATIVE_WORDS.includes(lower)) negativeCount++;
    }

    const total = positiveCount + negativeCount;
    // Score: -1 (fully negative) to +1 (fully positive), 0 = neutral
    let sentimentScore = 0;
    if (total > 0) {
        sentimentScore = (positiveCount - negativeCount) / total;
    }

    // Map to tone label
    let toneLabel;
    if (sentimentScore > 0.3) toneLabel = 'positive';
    else if (sentimentScore > 0.1) toneLabel = 'mostly positive';
    else if (sentimentScore > -0.1) toneLabel = 'neutral';
    else if (sentimentScore > -0.3) toneLabel = 'mostly negative';
    else toneLabel = 'negative';

    // Score 0-100 (centered at 50 for neutral)
    const score = Math.round(50 + sentimentScore * 50);

    return {
        score: Math.max(0, Math.min(100, score)),
        details: {
            sentimentScore: Math.round(sentimentScore * 100) / 100,
            toneLabel,
            positiveWords: positiveCount,
            negativeWords: negativeCount,
        },
    };
}

// ─── Readability with Category Buckets ────────────────────

function analyzeReadability(text) {
    const sentences = splitSentences(text);
    const words = splitWords(text);

    if (words.length < 10 || sentences.length < 1) {
        return {
            score: 50,
            details: { gradeLevel: null, category: 'insufficient text', avgWordsPerSentence: 0, avgSyllablesPerWord: 0 },
            note: 'Too little text to measure accurately',
        };
    }

    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;

    // Flesch-Kincaid Grade Level
    const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
    const clampedGrade = Math.max(0, Math.min(20, gradeLevel));

    // Category buckets
    let category;
    if (clampedGrade <= 6) category = 'very easy';
    else if (clampedGrade <= 8) category = 'easy';
    else if (clampedGrade <= 10) category = 'moderate';
    else if (clampedGrade <= 13) category = 'difficult';
    else category = 'very difficult';

    // Score: grade 8 = 100, grade 16+ = 10
    let score;
    if (clampedGrade <= 8) score = 100;
    else if (clampedGrade >= 16) score = 10;
    else score = Math.round(100 - ((clampedGrade - 8) / 8) * 90);

    return {
        score,
        details: {
            gradeLevel: Math.round(clampedGrade * 10) / 10,
            category,
            avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
            avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
        },
    };
}

// ─── Structure ────────────────────────────────────────────

function analyzeStructure(text) {
    const paragraphs = splitParagraphs(text);
    const lines = text.split('\n').map((l) => l.trim());

    const headingPatterns = lines.filter(
        (l) => l.length > 0 && l.length < 80 && (/^#{1,6}\s/.test(l) || /^[A-Z][A-Z\s:]{3,}$/.test(l) || /^\d+\.\s+[A-Z]/.test(l))
    );

    const listItems = lines.filter((l) => /^[\s]*[-•*]\s/.test(l) || /^[\s]*\d+[.)]\s/.test(l));

    const paraLengths = paragraphs.map((p) => splitWords(p).length);
    const avgParaLength = paraLengths.length > 0 ? paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length : 0;
    const longParagraphs = paraLengths.filter((l) => l > 100).length;

    let score = 50;
    if (headingPatterns.length >= 3) score += 20;
    else if (headingPatterns.length >= 1) score += 10;
    if (listItems.length >= 3) score += 15;
    else if (listItems.length >= 1) score += 5;
    if (longParagraphs > 0) score -= longParagraphs * 10;
    if (avgParaLength > 20 && avgParaLength < 80) score += 15;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: { headingCount: headingPatterns.length, listItemCount: listItems.length, paragraphCount: paragraphs.length, avgParagraphWords: Math.round(avgParaLength), longParagraphs },
    };
}

// ─── Engagement (single-pass scan) ────────────────────────

const POWER_WORDS = [
    'discover', 'proven', 'secret', 'exclusive', 'guaranteed', 'transform',
    'unlock', 'boost', 'essential', 'powerful', 'remarkable', 'breakthrough',
    'instant', 'ultimate', 'free', 'new', 'easy', 'simple', 'fast', 'now',
    'imagine', 'surprising', 'incredible', 'revolutionary', 'stunning',
];

const CTA_PATTERNS = [
    /\b(click|tap|try|start|join|sign up|subscribe|download|get|grab|learn more|contact|call|visit|explore|read more)\b/gi,
];

// Emoji regex (covers most common emoji ranges)
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]/gu;

const HASHTAG_REGEX = /#[a-zA-Z]\w{1,30}/g;

function analyzeEngagement(text) {
    const words = splitWords(text);
    const lowerText = text.toLowerCase();

    // Single-pass scan
    const questions = (text.match(/\?/g) || []).length;
    const exclamations = (text.match(/!/g) || []).length;
    const emojis = text.match(EMOJI_REGEX) || [];
    const hashtags = text.match(HASHTAG_REGEX) || [];
    const powerWordHits = POWER_WORDS.filter((pw) => lowerText.includes(pw));

    let ctaCount = 0;
    for (const pat of CTA_PATTERNS) {
        const m = text.match(pat);
        if (m) ctaCount += m.length;
    }

    let score = 30;
    if (questions >= 3) score += 25;
    else if (questions >= 1) score += 15;
    if (powerWordHits.length >= 5) score += 20;
    else if (powerWordHits.length >= 2) score += 10;
    if (ctaCount >= 3) score += 15;
    else if (ctaCount >= 1) score += 8;
    if (exclamations >= 1 && exclamations <= 5) score += 10;
    else if (exclamations > 10) score -= 10;
    // Bonus for emojis (social/marketing content)
    if (emojis.length >= 1 && emojis.length <= 10) score += 5;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: {
            questionCount: questions,
            powerWordsFound: powerWordHits.length,
            powerWordExamples: powerWordHits.slice(0, 5),
            ctaCount,
            exclamationCount: exclamations,
            emojiCount: emojis.length,
            hashtagCount: hashtags.length,
            hashtagExamples: hashtags.slice(0, 5),
        },
    };
}

// ─── Clarity ──────────────────────────────────────────────

const PASSIVE_PATTERNS = [
    /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+ed\b/gi,
    /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+en\b/gi,
];

const JARGON_WORDS = [
    'synergy', 'leverage', 'paradigm', 'holistic', 'ecosystem', 'disruption',
    'scalable', 'actionable', 'bandwidth', 'circle back', 'deep dive',
    'move the needle', 'low-hanging fruit', 'thought leader', 'value-add',
    'core competency', 'best-in-class', 'bleeding edge', 'game-changer',
];

function analyzeClarity(text) {
    const sentences = splitSentences(text);
    const lowerText = text.toLowerCase();

    let passiveCount = 0;
    for (const pat of PASSIVE_PATTERNS) {
        const m = text.match(pat);
        if (m) passiveCount += m.length;
    }
    const passiveRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;

    const jargonHits = JARGON_WORDS.filter((j) => lowerText.includes(j));
    const complexSentences = sentences.filter((s) => splitWords(s).length > 25).length;
    const complexRatio = sentences.length > 0 ? complexSentences / sentences.length : 0;

    let score = 70;
    if (passiveRatio > 0.4) score -= 30;
    else if (passiveRatio > 0.2) score -= 15;
    if (jargonHits.length >= 5) score -= 25;
    else if (jargonHits.length >= 2) score -= 10;
    if (complexRatio > 0.5) score -= 25;
    else if (complexRatio > 0.25) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: { passiveVoiceCount: passiveCount, passiveRatio: Math.round(passiveRatio * 100), jargonFound: jargonHits, complexSentences, totalSentences: sentences.length },
    };
}

// ─── Actionability ────────────────────────────────────────

const IMPERATIVE_VERBS = [
    'use', 'try', 'make', 'create', 'build', 'start', 'stop', 'check',
    'add', 'remove', 'write', 'read', 'follow', 'choose', 'select',
    'click', 'open', 'close', 'run', 'set', 'apply', 'include', 'avoid',
    'ensure', 'consider', 'remember', 'note', 'keep', 'take', 'put',
];

function analyzeActionability(text) {
    const sentences = splitSentences(text);
    const lines = text.split('\n').map((l) => l.trim());

    const numberedSteps = lines.filter((l) => /^\d+[.)]\s/.test(l)).length;
    const imperativeSentences = sentences.filter((s) => {
        const firstWord = splitWords(s)[0]?.toLowerCase();
        return firstWord && IMPERATIVE_VERBS.includes(firstWord);
    }).length;
    const directedPatterns = (text.match(/\b(you\s+(should|can|will|need to|must|might|could))\b/gi) || []).length;

    let score = 30;
    if (numberedSteps >= 3) score += 25;
    else if (numberedSteps >= 1) score += 10;
    if (imperativeSentences >= 3) score += 25;
    else if (imperativeSentences >= 1) score += 10;
    if (directedPatterns >= 3) score += 20;
    else if (directedPatterns >= 1) score += 10;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: { numberedSteps, imperativeSentences, directedLanguageCount: directedPatterns },
    };
}

// ─── Suggestion Templates ─────────────────────────────────

// Templates now receive (dims, ctx) where ctx contains { words, sentences, wordCount, isShortForm }
const SUGGESTION_TEMPLATES = [
    // Readability
    {
        dimension: 'Readability',
        condition: (dims) => dims.readability.score < 60 && dims.readability.details.gradeLevel,
        severity: (dims) => dims.readability.score < 30 ? 'high' : 'medium',
        what: (dims) => `Your content reads at grade level ${dims.readability.details.gradeLevel} (${dims.readability.details.category}) — most audiences prefer grade 8-10.`,
        why: 'Dense text causes readers to bounce. Simpler language increases time-on-page by up to 50%.',
        how: 'Break long sentences. Replace multi-syllable words with shorter alternatives. Aim for ~15 words per sentence.',
        example: '"The implementation of the aforementioned strategy" → "How we put the plan into action"',
    },
    {
        dimension: 'Readability',
        condition: (dims) => dims.readability.details.avgWordsPerSentence > 25,
        severity: () => 'medium',
        what: (dims) => `Average sentence length is ${dims.readability.details.avgWordsPerSentence} words (ideal: 15–20).`,
        why: 'Long sentences are harder to parse and increase reader fatigue.',
        how: 'Split sentences at natural breakpoints. Use periods instead of semicolons.',
        example: 'Before: "Our team, after careful consideration of alternatives, decided to proceed with option B, which despite its higher initial cost, offers long-term savings." → After: "Our team chose option B. Despite the higher upfront cost, it saves money long term."',
    },
    // Structure
    {
        dimension: 'Structure',
        condition: (dims, ctx) => !ctx.isShortForm && dims.structure.details.headingCount === 0,
        severity: () => 'high',
        what: () => 'No headings detected in your content.',
        why: 'Headings help readers scan and find relevant sections in longer content. 80% of readers scan before reading.',
        how: 'Add descriptive headings every 2-3 paragraphs. Use a clear hierarchy (H1 → H2 → H3).',
        example: 'Add: "## Why This Matters" before your supporting argument section.',
    },
    {
        dimension: 'Structure',
        condition: (dims) => dims.structure.details.longParagraphs > 0,
        severity: () => 'medium',
        what: (dims) => `${dims.structure.details.longParagraphs} paragraph(s) exceed 100 words — wall-of-text effect.`,
        why: 'Long paragraphs are intimidating. Readers skip blocks that look too dense.',
        how: 'Break paragraphs at topic shifts. Aim for 3-5 sentences per paragraph.',
        example: 'Split at the "however" or "on the other hand" — those are natural paragraph breaks.',
    },
    {
        dimension: 'Structure',
        condition: (dims, ctx) => !ctx.isShortForm && dims.structure.details.listItemCount === 0 && dims.structure.score < 70,
        severity: () => 'low',
        what: () => 'No bullet points or numbered lists found.',
        why: 'Lists make information digestible and improve scannability.',
        how: 'Convert sequences of related items into bulleted or numbered lists.',
        example: '"We offer speed, reliability, and affordability" → "We offer: • Speed • Reliability • Affordability"',
    },
    // Engagement
    {
        dimension: 'Engagement',
        condition: (dims) => dims.engagement.details.questionCount === 0,
        severity: () => 'medium',
        what: () => 'No questions found in your content.',
        why: 'Questions activate curiosity and create mental engagement — readers feel addressed directly.',
        how: 'Open or close your content with a question. Use "Have you ever…?" or "What do you think?"',
        example: 'Add: "Have you experienced this too?" at the end of your post.',
    },
    {
        dimension: 'Engagement',
        condition: (dims) => dims.engagement.details.ctaCount === 0,
        severity: () => 'medium',
        what: () => 'No calls-to-action detected.',
        why: 'Without CTAs, readers finish and leave. Every piece of content should guide the next step.',
        how: 'Add at least one clear CTA: "Try this today", "Learn more at…", or "Share your thoughts".',
        example: 'End with: "Ready to get started? Download our free template →"',
    },
    {
        dimension: 'Engagement',
        condition: (dims) => dims.engagement.details.emojiCount === 0 && dims.engagement.details.hashtagCount === 0 && dims.engagement.score < 50,
        severity: () => 'low',
        what: () => 'No emojis or hashtags — content may feel dry for social/marketing channels.',
        why: 'Emojis increase engagement rates by 25% on social media. Hashtags improve discoverability.',
        how: 'Add 1-3 relevant emojis to headers or key points. Use 2-5 targeted hashtags if publishing socially.',
        example: '📌 Pro tip: A single well-placed emoji draws the eye without cluttering.',
    },
    // Clarity
    {
        dimension: 'Clarity',
        condition: (dims) => dims.clarity.details.passiveRatio > 20,
        severity: (dims) => dims.clarity.details.passiveRatio > 40 ? 'high' : 'medium',
        what: (dims) => `${dims.clarity.details.passiveRatio}% of sentences use passive voice (aim for under 20%).`,
        why: 'Passive voice hides the actor, making text feel vague and bureaucratic.',
        how: 'Rewrite by putting the doer first: "The report was written" → "The team wrote the report".',
        example: '"Mistakes were made" → "We made mistakes" — clearer, more honest.',
    },
    {
        dimension: 'Clarity',
        condition: (dims) => dims.clarity.details.jargonFound.length >= 2,
        severity: () => 'low',
        what: (dims) => `Found ${dims.clarity.details.jargonFound.length} jargon terms: "${dims.clarity.details.jargonFound.slice(0, 3).join('", "')}"`,
        why: 'Jargon alienates non-expert readers and makes your content feel exclusionary.',
        how: 'Replace jargon with plain language.',
        example: '"Leverage our ecosystem" → "Use our tools together"',
    },
    // Actionability
    {
        dimension: 'Actionability',
        condition: (dims) => dims.actionability.details.numberedSteps === 0 && dims.actionability.details.imperativeSentences < 2,
        severity: (dims) => dims.actionability.score < 40 ? 'high' : 'medium',
        what: () => 'Content lacks clear action steps or directives.',
        why: 'Readers want to know what to DO next. Actionable content gets shared 2x more.',
        how: 'Add numbered steps ("Step 1: …"), imperative sentences ("Start by…"), or a "Next Steps" section.',
        example: 'Add: "Here\'s how to get started: 1. Sign up 2. Choose a template 3. Customize and publish"',
    },
    // Sentiment
    {
        dimension: 'Sentiment',
        condition: (dims) => dims.sentiment.details.toneLabel === 'negative' || dims.sentiment.details.toneLabel === 'mostly negative',
        severity: () => 'medium',
        what: (dims) => `Content tone is "${dims.sentiment.details.toneLabel}" — this may discourage readers unless intentional.`,
        why: 'Consistently negative framing can make readers feel hopeless. Balanced content retains attention better.',
        how: 'Reframe problems as opportunities. After stating a challenge, immediately follow with a solution.',
        example: '"This process is incredibly frustrating" → "This process is frustrating, but here’s the workaround."',
    },
    {
        dimension: 'Sentiment',
        condition: (dims) => dims.sentiment.details.toneLabel === 'neutral' && dims.engagement.score < 50,
        severity: () => 'low',
        what: () => 'Content tone is flat/neutral — it doesn\'t evoke emotion.',
        why: 'Neutral content is forgettable. A touch of enthusiasm or urgency makes writing memorable.',
        how: 'Add conviction words: "I believe", "This matters because", or "The exciting part is".',
        example: '"The results were good" → "The results exceeded every expectation"',
    },
];

// ─── Suggestion Generator ─────────────────────────────────

/**
 * Generate suggestions from dimension scores.
 * Enforces a minimum of 3 suggestions by priority.
 */
function generateSuggestions(dimensions, ctx) {
    const triggered = [];

    for (const template of SUGGESTION_TEMPLATES) {
        try {
            if (template.condition(dimensions, ctx)) {
                triggered.push({
                    dimension: template.dimension,
                    severity: typeof template.severity === 'function' ? template.severity(dimensions, ctx) : template.severity,
                    what: typeof template.what === 'function' ? template.what(dimensions, ctx) : template.what,
                    why: template.why,
                    how: typeof template.how === 'function' ? template.how(dimensions, ctx) : template.how,
                    example: typeof template.example === 'function' ? template.example(dimensions, ctx) : template.example,
                });
            }
        } catch {
            // Skip malformed templates
        }
    }

    // Sort: high → medium → low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    triggered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Enforce minimum of 3 suggestions
    if (triggered.length < 3) {
        const firstSentence = ctx.sentences.length > 0 ? ctx.sentences[0] : '';
        const lastSentence = ctx.sentences.length > 1 ? ctx.sentences[ctx.sentences.length - 1] : '';

        const fallbacks = [
            {
                dimension: 'Actionability',
                severity: 'medium',
                what: 'Content ends without a clear call-to-action or hook for comments.',
                why: 'Without a clear directive, readers finish reading and scroll past. Asking a question or giving a command doubles interaction rates.',
                how: lastSentence
                    ? `Your current ending is: "${lastSentence}". Try replacing or following this with a question to the audience.`
                    : 'End with a clear question to your audience.',
                example: 'Add: "What’s your take on this?" or "Drop a comment below if you agree."',
            },
            {
                dimension: 'Engagement',
                severity: 'low',
                what: 'The opening could be stronger or punchier to immediately hook the reader.',
                why: 'You have about 3 seconds to capture attention on a feed. The first line is the most important part of your post.',
                how: firstSentence
                    ? `Your current opening is: "${firstSentence}". Is there a more surprising or relatable way to say this?`
                    : 'Start with a surprising statistic, a bold claim, or a highly relatable problem.',
                example: '"Did you know 73% of readers never scroll past the first line?"',
            },
            {
                dimension: ctx.isShortForm ? 'Formatting' : 'Structure',
                severity: 'low',
                what: ctx.isShortForm
                    ? 'Break up your text to make it highly scannable on mobile.'
                    : 'Add a brief summary or TL;DR at the top of your content.',
                why: ctx.isShortForm
                    ? 'Huge blocks of text get scrolled past on social feeds. Whitespace is your friend.'
                    : 'Busy readers want the conclusion first. A summary lets them decide if the details are worth reading.',
                how: ctx.isShortForm
                    ? 'Ensure you have a blank line after every 1-3 sentences.'
                    : 'Write 2-3 sentences that capture the key takeaway and place them before the main content.',
                example: ctx.isShortForm
                    ? 'Hit return twice. Let your sentences breathe.'
                    : 'Add: "TL;DR: We reduced page load time by 40% using three simple optimizations."',
            }
        ];

        for (const fb of fallbacks) {
            if (triggered.length >= 3) break;
            // Don't duplicate dimensions already represented
            if (!triggered.some((s) => s.what === fb.what)) {
                triggered.push(fb);
            }
        }
    }

    return triggered.slice(0, 6); // Cap at 6
}

// ─── Main Analysis ────────────────────────────────────────

/**
 * Analyze content across all dimensions in a single pipeline.
 * Accepts either raw text or preprocessed data.
 *
 * @param {string} text - The text content to analyze
 * @param {object} [preprocessed] - Optional preprocessed data from preprocessor
 * @returns {{ overallScore, dimensions, metrics, suggestions, wordCount, sentenceCount }}
 */
export function analyzeContent(text, preprocessed = null) {
    if (!text || text.trim().length === 0) {
        return {
            overallScore: 0,
            wordCount: 0,
            sentenceCount: 0,
            dimensions: {},
            metrics: {},
            suggestions: [],
            error: 'No text content found to analyze.',
        };
    }

    const words = splitWords(text);

    // Compute all dimensions
    const readability = analyzeReadability(text);
    const structure = analyzeStructure(text);
    const engagement = analyzeEngagement(text);
    const clarity = analyzeClarity(text);
    const actionability = analyzeActionability(text);
    const sentiment = analyzeSentiment(words);

    const sentences = splitSentences(text);
    const ctx = {
        text,
        words,
        sentences,
        wordCount: words.length,
        isShortForm: words.length < 250,
    };

    // Content signal modules (Phase 7)
    const hook = analyzeHook(text);
    const cognitiveLoad = analyzeCognitiveLoad(text);
    const persuasion = detectPersuasion(text);

    const dimensions = {
        readability, structure, engagement, clarity, actionability, sentiment,
        hook: { score: hook.score, details: { hookType: hook.hookType, firstSentence: hook.firstSentence, signals: hook.signals, reasons: hook.reasons } },
        cognitiveLoad: { score: cognitiveLoad.score, details: { level: cognitiveLoad.level, metrics: cognitiveLoad.metrics, reasons: cognitiveLoad.reasons } },
        persuasion: { score: persuasion.score, details: { framework: persuasion.framework, confidence: persuasion.confidence, phases: persuasion.phases, reasons: persuasion.reasons } },
    };

    // Weighted average — hook gets highest weight (determines if anyone reads the rest)
    const weights = {
        readability: 0.12, structure: 0.10, engagement: 0.12, clarity: 0.10,
        actionability: 0.10, sentiment: 0.06, hook: 0.18, cognitiveLoad: 0.12, persuasion: 0.10,
    };
    const overallScore = Math.round(
        Object.entries(weights).reduce((sum, [key, weight]) => sum + dimensions[key].score * weight, 0)
    );

    // Aggregate metrics object
    const metrics = {
        readabilityCategory: readability.details.category || 'unknown',
        gradeLevel: readability.details.gradeLevel,
        toneLabel: sentiment.details.toneLabel,
        sentimentScore: sentiment.details.sentimentScore,
        questionCount: engagement.details.questionCount,
        ctaCount: engagement.details.ctaCount,
        emojiCount: engagement.details.emojiCount,
        hashtagCount: engagement.details.hashtagCount,
        passiveVoicePercent: clarity.details.passiveRatio,
        longParagraphs: structure.details.longParagraphs,
        headingCount: structure.details.headingCount,
        hookType: hook.hookType,
        cognitiveLoadLevel: cognitiveLoad.level,
        persuasionFramework: persuasion.framework,
    };

    // Generate suggestions with min 3 enforcement
    const suggestions = generateSuggestions(dimensions, ctx);

    // Generate human-readable explanation
    const explanation = generateContentExplanation({ overallScore, hook, cognitiveLoad, persuasion, dimensions });

    return {
        overallScore,
        wordCount: words.length,
        sentenceCount: sentences.length,
        dimensions,
        metrics,
        suggestions,
        explanation,
    };
}

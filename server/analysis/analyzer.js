/**
 * Content Analysis Engine
 * Runs heuristic checks across 5 dimensions: readability, structure,
 * engagement, clarity, and actionability.
 */

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
    return text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function splitWords(text) {
    return text
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z0-9'-]/g, ''))
        .filter((w) => w.length > 0);
}

function splitParagraphs(text) {
    return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

// ─── Readability ──────────────────────────────────────────

function analyzeReadability(text) {
    const sentences = splitSentences(text);
    const words = splitWords(text);

    if (words.length < 10 || sentences.length < 1) {
        return { score: 50, details: { gradeLevel: null, avgWordsPerSentence: 0, avgSyllablesPerWord: 0 }, note: 'Too little text to measure accurately' };
    }

    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;

    // Flesch-Kincaid Grade Level
    const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
    const clampedGrade = Math.max(0, Math.min(20, gradeLevel));

    // Score: grade 8 = 100, grade 16+ = 0
    let score;
    if (clampedGrade <= 8) score = 100;
    else if (clampedGrade >= 16) score = 10;
    else score = Math.round(100 - ((clampedGrade - 8) / 8) * 90);

    return {
        score,
        details: {
            gradeLevel: Math.round(clampedGrade * 10) / 10,
            avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
            avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
        },
    };
}

// ─── Structure ────────────────────────────────────────────

function analyzeStructure(text) {
    const paragraphs = splitParagraphs(text);
    const lines = text.split('\n').map((l) => l.trim());

    // Detect headings (lines that are short, possibly uppercase or title-like)
    const headingPatterns = lines.filter(
        (l) => l.length > 0 && l.length < 80 && (/^#{1,6}\s/.test(l) || /^[A-Z][A-Z\s:]{3,}$/.test(l) || /^\d+\.\s+[A-Z]/.test(l))
    );

    // Detect lists
    const listItems = lines.filter((l) => /^[\s]*[-•*]\s/.test(l) || /^[\s]*\d+[.)]\s/.test(l));

    // Paragraph length analysis
    const paraLengths = paragraphs.map((p) => splitWords(p).length);
    const avgParaLength = paraLengths.length > 0 ? paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length : 0;
    const longParagraphs = paraLengths.filter((l) => l > 100).length;

    let score = 50;

    // Reward headings
    if (headingPatterns.length >= 3) score += 20;
    else if (headingPatterns.length >= 1) score += 10;

    // Reward lists
    if (listItems.length >= 3) score += 15;
    else if (listItems.length >= 1) score += 5;

    // Penalize wall-of-text
    if (longParagraphs > 0) score -= longParagraphs * 10;

    // Reward reasonable paragraph lengths
    if (avgParaLength > 20 && avgParaLength < 80) score += 15;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: {
            headingCount: headingPatterns.length,
            listItemCount: listItems.length,
            paragraphCount: paragraphs.length,
            avgParagraphWords: Math.round(avgParaLength),
            longParagraphs,
        },
    };
}

// ─── Engagement Hooks ─────────────────────────────────────

const POWER_WORDS = [
    'discover', 'proven', 'secret', 'exclusive', 'guaranteed', 'transform',
    'unlock', 'boost', 'essential', 'powerful', 'remarkable', 'breakthrough',
    'instant', 'ultimate', 'free', 'new', 'easy', 'simple', 'fast', 'now',
    'imagine', 'surprising', 'incredible', 'revolutionary', 'stunning',
];

const CTA_PATTERNS = [
    /\b(click|tap|try|start|join|sign up|subscribe|download|get|grab|learn more|contact|call|visit|explore|read more)\b/gi,
];

function analyzeEngagement(text) {
    const words = splitWords(text);
    const sentences = splitSentences(text);
    const lowerText = text.toLowerCase();

    // Questions
    const questions = text.split('?').length - 1;

    // Power words
    const powerWordHits = POWER_WORDS.filter((pw) => lowerText.includes(pw));

    // CTAs
    let ctaCount = 0;
    CTA_PATTERNS.forEach((pat) => {
        const matches = text.match(pat);
        if (matches) ctaCount += matches.length;
    });

    // Exclamations (moderate use is engaging)
    const exclamations = (text.match(/!/g) || []).length;

    let score = 30; // baseline

    // Questions engage the reader
    if (questions >= 3) score += 25;
    else if (questions >= 1) score += 15;

    // Power words
    const powerRatio = words.length > 0 ? powerWordHits.length / words.length : 0;
    if (powerWordHits.length >= 5) score += 20;
    else if (powerWordHits.length >= 2) score += 10;

    // CTAs
    if (ctaCount >= 3) score += 15;
    else if (ctaCount >= 1) score += 8;

    // Exclamations (a few is good, too many is spammy)
    if (exclamations >= 1 && exclamations <= 5) score += 10;
    else if (exclamations > 10) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: {
            questionCount: questions,
            powerWordsFound: powerWordHits.length,
            powerWordExamples: powerWordHits.slice(0, 5),
            ctaCount,
            exclamationCount: exclamations,
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
    const words = splitWords(text);
    const lowerText = text.toLowerCase();

    // Passive voice
    let passiveCount = 0;
    PASSIVE_PATTERNS.forEach((pat) => {
        const matches = text.match(pat);
        if (matches) passiveCount += matches.length;
    });
    const passiveRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;

    // Jargon
    const jargonHits = JARGON_WORDS.filter((j) => lowerText.includes(j));

    // Complex sentences (>25 words)
    const complexSentences = sentences.filter((s) => splitWords(s).length > 25).length;
    const complexRatio = sentences.length > 0 ? complexSentences / sentences.length : 0;

    let score = 70;

    // Passive voice penalty
    if (passiveRatio > 0.4) score -= 30;
    else if (passiveRatio > 0.2) score -= 15;

    // Jargon penalty
    if (jargonHits.length >= 5) score -= 25;
    else if (jargonHits.length >= 2) score -= 10;

    // Complex sentence penalty
    if (complexRatio > 0.5) score -= 25;
    else if (complexRatio > 0.25) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        details: {
            passiveVoiceCount: passiveCount,
            passiveRatio: Math.round(passiveRatio * 100),
            jargonFound: jargonHits,
            complexSentences,
            totalSentences: sentences.length,
        },
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

    // Numbered steps
    const numberedSteps = lines.filter((l) => /^\d+[.)]\s/.test(l)).length;

    // Imperative sentences (start with a verb)
    const imperativeSentences = sentences.filter((s) => {
        const firstWord = splitWords(s)[0]?.toLowerCase();
        return firstWord && IMPERATIVE_VERBS.includes(firstWord);
    }).length;

    // "You should/can/will" patterns (directed language)
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
        details: {
            numberedSteps,
            imperativeSentences,
            directedLanguageCount: directedPatterns,
        },
    };
}

// ─── Main Analysis ────────────────────────────────────────

/**
 * Analyze extracted text across all dimensions.
 * @param {string} text - The extracted text content
 * @returns {{overallScore: number, dimensions: object, wordCount: number, sentenceCount: number}}
 */
export function analyzeContent(text) {
    if (!text || text.trim().length === 0) {
        return {
            overallScore: 0,
            wordCount: 0,
            sentenceCount: 0,
            dimensions: {},
            error: 'No text content found to analyze.',
        };
    }

    const readability = analyzeReadability(text);
    const structure = analyzeStructure(text);
    const engagement = analyzeEngagement(text);
    const clarity = analyzeClarity(text);
    const actionability = analyzeActionability(text);

    const dimensions = { readability, structure, engagement, clarity, actionability };

    // Weighted average
    const weights = { readability: 0.25, structure: 0.2, engagement: 0.2, clarity: 0.2, actionability: 0.15 };
    const overallScore = Math.round(
        Object.entries(weights).reduce((sum, [key, weight]) => sum + dimensions[key].score * weight, 0)
    );

    return {
        overallScore,
        wordCount: splitWords(text).length,
        sentenceCount: splitSentences(text).length,
        dimensions,
    };
}

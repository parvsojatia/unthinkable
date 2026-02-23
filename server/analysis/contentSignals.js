/**
 * Content Signals — Social Content Analyzer
 *
 * Single module with four exports:
 *   analyzeHook       — scores the opening 1-2 sentences
 *   analyzeCognitiveLoad — measures working memory demand
 *   detectPersuasion  — checks AIDA / PAS alignment
 *   generateContentExplanation — composes human-readable summary
 *
 * Every scorer attaches reasons[] inline — no downstream interpretation.
 * All heuristics are deterministic. No LLMs, no external APIs.
 */

// ─── Shared Helpers ──────────────────────────────────────────

function splitSentences(text) {
    return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitWords(text) {
    return text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9'-]/g, '')).filter((w) => w.length > 0);
}

function clamp(val, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

// ─── Sentiment lexicon (shared with hook emotional charge) ───

const EMOTION_WORDS = new Set([
    // positive
    'love', 'amazing', 'incredible', 'brilliant', 'stunning', 'obsessed',
    'thrilled', 'excited', 'beautiful', 'inspiring', 'powerful', 'remarkable',
    'extraordinary', 'unbelievable', 'mind-blowing', 'game-changer',
    // negative (also creates emotional charge in hooks)
    'hate', 'terrible', 'awful', 'devastating', 'heartbreaking', 'shocking',
    'scary', 'dangerous', 'painful', 'struggling', 'failed', 'worst',
    'broken', 'frustrated', 'angry', 'furious', 'disgusting', 'tragic',
    // urgency
    'urgent', 'critical', 'immediately', 'deadline', 'warning', 'alert',
    'breaking', 'emergency', 'now', 'today', 'finally',
]);

// ═══════════════════════════════════════════════════════════════
// 1. HOOK ANALYZER
// ═══════════════════════════════════════════════════════════════

/**
 * Hook pattern archetypes — each has a label and a regex.
 * We test the first 1-2 sentences against these.
 */
const HOOK_PATTERNS = [
    { type: 'question', regex: /\?/ },
    { type: 'statistic', regex: /\b\d{1,3}([,.]\d+)?%|\b\d+x\b|\b\d+\s*(million|billion|thousand|percent|times)\b/i },
    { type: 'bold-claim', regex: /\b(most people|nobody|everyone|never|always|the truth is|here's the thing|unpopular opinion|hot take|controversial)\b/i },
    { type: 'story', regex: /\b(i (once|was|had|remember|used to|didn't|couldn't)|last (week|month|year)|true story|years ago|when i)\b/i },
    { type: 'contrarian', regex: /\b(but|however|actually|stop|wrong|myth|lie|overrated|underrated|forget|ignore)\b/i },
    { type: 'urgency', regex: /\b(right now|before it's too late|don'?t miss|hurry|limited|last chance|breaking|just (happened|announced|dropped))\b/i },
    { type: 'imagine', regex: /\b(imagine|picture this|what if|think about)\b/i },
    { type: 'challenge', regex: /\b(bet you|can you|try this|dare|challenge|test yourself|prove)\b/i },
];

/**
 * Vague words that reduce specificity.
 */
const VAGUE_WORDS = new Set([
    'things', 'stuff', 'something', 'somehow', 'somewhat', 'certain',
    'various', 'several', 'many', 'some', 'lots', 'really', 'very',
    'kind of', 'sort of', 'basically', 'literally', 'actually',
    'interesting', 'nice', 'good', 'great', 'important',
]);

/**
 * Score the opening hook.
 *
 * @param {string} text - Full content text
 * @returns {{ score: number, hookType: string|null, firstSentence: string, signals: object, reasons: string[] }}
 */
export function analyzeHook(text) {
    const reasons = [];

    if (!text || text.trim().length === 0) {
        return { score: 0, hookType: null, firstSentence: '', signals: {}, reasons: ['No text to analyze.'] };
    }

    const sentences = splitSentences(text);
    if (sentences.length === 0) {
        return { score: 0, hookType: null, firstSentence: '', signals: {}, reasons: ['No sentences found.'] };
    }

    const firstSentence = sentences[0];
    // Use first 2 sentences as "opening" if available
    const opening = sentences.slice(0, 2).join('. ');
    const openingWords = splitWords(opening);
    const firstWords = splitWords(firstSentence);

    // ── Signal 1: Pattern match ──────────────────────────
    let hookType = null;
    let patternScore = 0;

    // Test first sentence for question mark first (most reliable signal)
    // Note: splitSentences strips punctuation, so check original text
    const firstSentenceEnd = text.indexOf(firstSentence) + firstSentence.length + 1;
    const originalFirstChunk = text.slice(0, Math.min(firstSentenceEnd + 5, text.length));
    if (/\?/.test(originalFirstChunk)) {
        hookType = 'question';
        patternScore = 1;
    } else {
        for (const p of HOOK_PATTERNS) {
            if (p.type === 'question') continue; // already checked
            if (p.regex.test(opening)) {
                hookType = p.type;
                patternScore = 1;
                break;
            }
        }
    }

    if (hookType) {
        reasons.push(`Opening uses a "${hookType}" hook pattern — good for stopping the scroll.`);
    } else {
        reasons.push('Opening doesn\'t match any common hook pattern (question, stat, story, bold claim, etc.).');
    }

    // ── Signal 2: Specificity ────────────────────────────
    const numberCount = (opening.match(/\b\d+/g) || []).length;
    const properNouns = openingWords.filter((w) => /^[A-Z][a-z]/.test(w)).length;
    const vagueCount = openingWords.filter((w) => VAGUE_WORDS.has(w.toLowerCase())).length;

    const specificItems = numberCount + properNouns;
    let specificityScore = 0;
    if (specificItems >= 3) { specificityScore = 1; }
    else if (specificItems >= 1) { specificityScore = 0.6; }
    else { specificityScore = 0.2; }

    if (vagueCount >= 3) {
        specificityScore *= 0.5;
        reasons.push(`Opening has ${vagueCount} vague words (e.g. "things", "really") — concrete details hook better.`);
    }
    if (specificItems >= 2) {
        reasons.push(`Opening has specific details (${numberCount} numbers, ${properNouns} names) — specificity builds credibility.`);
    } else if (specificItems === 0) {
        reasons.push('Opening lacks specific details (numbers, names, data) — abstract openings are easy to scroll past.');
    }

    // ── Signal 3: Brevity ────────────────────────────────
    let brevityScore;
    if (firstWords.length <= 10) { brevityScore = 1; }
    else if (firstWords.length <= 15) { brevityScore = 0.85; }
    else if (firstWords.length <= 20) { brevityScore = 0.6; }
    else if (firstWords.length <= 30) { brevityScore = 0.35; }
    else { brevityScore = 0.1; }

    if (firstWords.length > 25) {
        reasons.push(`First sentence is ${firstWords.length} words — punchy hooks are usually under 15 words.`);
    } else if (firstWords.length <= 12) {
        reasons.push(`First sentence is tight (${firstWords.length} words) — short openings get read.`);
    }

    // ── Signal 4: Intrigue gap ───────────────────────────
    const intriguePatterns = [
        /\.{2,}/, /—/, /\bhere'?s (what|why|how)\b/i,
        /\byou won'?t believe\b/i, /\bturns out\b/i,
        /\bthe (real|actual|surprising|hidden) (reason|truth|secret|story)\b/i,
        /\bno one (talks|tells you|mentions|realizes)\b/i,
        /\bbut (then|wait|first|here'?s)\b/i,
    ];

    let intrigueScore = 0;
    for (const p of intriguePatterns) {
        if (p.test(opening)) { intrigueScore = 1; break; }
    }
    if (intrigueScore > 0) {
        reasons.push('Opening creates a curiosity gap — readers want to know what comes next.');
    }

    // ── Signal 5: Emotional charge ───────────────────────
    const emotionHits = openingWords.filter((w) => EMOTION_WORDS.has(w.toLowerCase())).length;
    let emotionScore = 0;
    if (emotionHits >= 3) { emotionScore = 1; }
    else if (emotionHits >= 1) { emotionScore = 0.6; }
    else { emotionScore = 0.1; }

    if (emotionHits === 0) {
        reasons.push('Opening lacks emotional weight — even one charged word can make a reader pause.');
    } else if (emotionHits >= 2) {
        reasons.push(`Opening has emotional charge (${emotionHits} emotion words) — emotion drives engagement.`);
    }

    // ── Composite ────────────────────────────────────────
    const weights = { pattern: 0.30, specificity: 0.20, brevity: 0.20, intrigue: 0.15, emotion: 0.15 };
    const raw = weights.pattern * patternScore
        + weights.specificity * specificityScore
        + weights.brevity * brevityScore
        + weights.intrigue * intrigueScore
        + weights.emotion * emotionScore;

    const score = clamp(raw * 100);

    const signals = {
        pattern: { score: patternScore, hookType },
        specificity: { score: Math.round(specificityScore * 100) / 100, numbers: numberCount, properNouns, vagueWords: vagueCount },
        brevity: { score: Math.round(brevityScore * 100) / 100, wordCount: firstWords.length },
        intrigue: { score: intrigueScore },
        emotion: { score: Math.round(emotionScore * 100) / 100, emotionWords: emotionHits },
    };

    return { score, hookType, firstSentence, signals, reasons };
}


// ═══════════════════════════════════════════════════════════════
// 2. COGNITIVE LOAD ANALYZER
// ═══════════════════════════════════════════════════════════════

/**
 * Measure how mentally taxing the content is to process.
 * Different from readability (grade level) — this is about working memory.
 *
 * @param {string} text
 * @returns {{ score: number, level: string, metrics: object, reasons: string[] }}
 */
export function analyzeCognitiveLoad(text) {
    const reasons = [];

    if (!text || text.trim().length === 0) {
        return { score: 50, level: 'unknown', metrics: {}, reasons: ['No text to analyze.'] };
    }

    const sentences = splitSentences(text);
    const words = splitWords(text);

    if (words.length < 10) {
        return { score: 70, level: 'low', metrics: {}, reasons: ['Content is very short — cognitive load is minimal.'] };
    }

    // ── Metric 1: Idea density ───────────────────────────
    // Approximate: count unique lowercased content words (>3 chars) per sentence
    const contentWords = words.filter((w) => w.length > 3).map((w) => w.toLowerCase());
    const uniqueContentWords = new Set(contentWords);
    const ideaDensity = sentences.length > 0 ? uniqueContentWords.size / sentences.length : 0;

    // Normalized: 3-6 unique concepts/sentence is comfortable, >10 is overload
    let ideaScore;
    if (ideaDensity <= 4) ideaScore = 1;
    else if (ideaDensity <= 7) ideaScore = 0.7;
    else if (ideaDensity <= 10) ideaScore = 0.4;
    else ideaScore = 0.15;

    if (ideaDensity > 8) {
        reasons.push(`High idea density (${ideaDensity.toFixed(1)} unique concepts/sentence) — readers have to work hard to keep up.`);
    }

    // ── Metric 2: Topic shifts ───────────────────────────
    // Compare keyword overlap between consecutive sentence pairs
    let shiftCount = 0;
    for (let i = 1; i < sentences.length; i++) {
        const prevWords = new Set(splitWords(sentences[i - 1]).map((w) => w.toLowerCase()).filter((w) => w.length > 3));
        const currWords = splitWords(sentences[i]).map((w) => w.toLowerCase()).filter((w) => w.length > 3);

        if (prevWords.size === 0) continue;
        const overlap = currWords.filter((w) => prevWords.has(w)).length;
        const overlapRatio = overlap / Math.max(prevWords.size, 1);

        if (overlapRatio < 0.1) shiftCount++;
    }

    const shiftRatio = sentences.length > 1 ? shiftCount / (sentences.length - 1) : 0;
    let shiftScore;
    if (shiftRatio <= 0.2) shiftScore = 1;
    else if (shiftRatio <= 0.4) shiftScore = 0.7;
    else if (shiftRatio <= 0.6) shiftScore = 0.4;
    else shiftScore = 0.15;

    if (shiftRatio > 0.4) {
        reasons.push(`Frequent topic shifts (${Math.round(shiftRatio * 100)}% of sentence transitions) — reader loses the thread.`);
    }

    // ── Metric 3: Nested complexity ──────────────────────
    // Count embedding markers per sentence: commas, semicolons, parentheses, em-dashes
    const nestCounts = sentences.map((s) => {
        const commas = (s.match(/,/g) || []).length;
        const semis = (s.match(/;/g) || []).length;
        const parens = (s.match(/[()]/g) || []).length;
        const dashes = (s.match(/[—–-]{2,}|—/g) || []).length;
        return commas + semis * 2 + parens * 1.5 + dashes * 1.5;
    });
    const avgNesting = nestCounts.length > 0 ? nestCounts.reduce((a, b) => a + b, 0) / nestCounts.length : 0;

    let nestScore;
    if (avgNesting <= 1.5) nestScore = 1;
    else if (avgNesting <= 3) nestScore = 0.7;
    else if (avgNesting <= 5) nestScore = 0.4;
    else nestScore = 0.15;

    if (avgNesting > 3) {
        reasons.push(`High nesting complexity (avg ${avgNesting.toFixed(1)} embedding markers/sentence) — simpler sentences are easier to process.`);
    }

    // ── Metric 4: Vocabulary diversity (Type-Token Ratio) ─
    const lowerWords = words.map((w) => w.toLowerCase());
    const ttr = new Set(lowerWords).size / lowerWords.length;

    let ttrScore;
    if (ttr <= 0.5) ttrScore = 1;
    else if (ttr <= 0.65) ttrScore = 0.75;
    else if (ttr <= 0.8) ttrScore = 0.5;
    else ttrScore = 0.25;

    if (ttr > 0.75) {
        reasons.push(`Very high vocabulary diversity (${Math.round(ttr * 100)}% unique words) — lots of new terms for the reader to absorb.`);
    }

    // ── Metric 5: Front-loading ──────────────────────────
    // Are key ideas concentrated at the start?
    const quarter = Math.max(1, Math.floor(sentences.length / 4));
    const firstQ = sentences.slice(0, quarter).join(' ');
    const lastQ = sentences.slice(-quarter).join(' ');

    const firstQDensity = new Set(splitWords(firstQ).filter((w) => w.length > 3).map((w) => w.toLowerCase())).size;
    const lastQDensity = new Set(splitWords(lastQ).filter((w) => w.length > 3).map((w) => w.toLowerCase())).size;

    const frontLoadRatio = lastQDensity > 0 ? firstQDensity / lastQDensity : 1;
    let frontLoadScore;
    if (frontLoadRatio >= 1.2) frontLoadScore = 1;      // Front-loaded = good
    else if (frontLoadRatio >= 0.8) frontLoadScore = 0.7;
    else frontLoadScore = 0.4;                           // Back-loaded = harder to follow

    if (frontLoadRatio < 0.7) {
        reasons.push('Key ideas appear late in the content — front-loading the main point reduces cognitive effort.');
    }

    // ── Composite ────────────────────────────────────────
    const weights = { idea: 0.25, shift: 0.20, nest: 0.25, ttr: 0.15, front: 0.15 };
    const raw = weights.idea * ideaScore
        + weights.shift * shiftScore
        + weights.nest * nestScore
        + weights.ttr * ttrScore
        + weights.front * frontLoadScore;

    const score = clamp(raw * 100);

    let level;
    if (score >= 75) level = 'low';
    else if (score >= 50) level = 'moderate';
    else if (score >= 25) level = 'high';
    else level = 'overload';

    if (reasons.length === 0) {
        reasons.push('Cognitive load is well-managed — content is easy to follow.');
    }

    const metrics = {
        ideaDensity: Math.round(ideaDensity * 10) / 10,
        topicShiftRatio: Math.round(shiftRatio * 100),
        avgNestingComplexity: Math.round(avgNesting * 10) / 10,
        vocabularyDiversity: Math.round(ttr * 100),
        frontLoadRatio: Math.round(frontLoadRatio * 100) / 100,
    };

    return { score, level, metrics, reasons };
}


// ═══════════════════════════════════════════════════════════════
// 3. PERSUASION STRUCTURE DETECTOR
// ═══════════════════════════════════════════════════════════════

/**
 * Phase keyword sets.
 * Each phase is checked against the corresponding text segment.
 */

// ── AIDA ─────────────────────────────────────────────────────

const AIDA_KEYWORDS = {
    attention: /\b(did you know|imagine|what if|stop|wait|breaking|alert|attention|important|secret|truth)\b/i,
    interest: /\b(because|research|data|study|found|shows|according|evidence|example|specifically|here's why|the reason)\b/i,
    desire: /\b(benefit|result|outcome|achieve|transform|success|freedom|growth|dream|unlock|gain|improve|upgrade|better)\b/i,
    action: /\b(click|tap|try|start|join|sign up|subscribe|download|comment|share|follow|link|DM|reply|book|register|act now|get started)\b/i,
};

// ── PAS ──────────────────────────────────────────────────────

const PAS_KEYWORDS = {
    problem: /\b(struggle|problem|pain|frustrat|difficult|hard|issue|fail|mistake|wrong|stuck|broken|tired of|sick of|can't|unable)\b/i,
    agitate: /\b(worse|even more|imagine if|what happens|risk|cost|lose|miss out|suffer|consequences|without|never)\b/i,
    solve: /\b(solution|answer|fix|resolve|here's how|the way|instead|try|simple|easy|step|method|approach|tool|strategy)\b/i,
};

/**
 * Score a text segment against a keyword regex.
 * Returns 0-1 confidence.
 */
function phaseConfidence(segment, regex) {
    const sentences = splitSentences(segment);
    if (sentences.length === 0) return 0;

    let hits = 0;
    for (const s of sentences) {
        if (regex.test(s)) hits++;
    }
    return Math.min(1, hits / Math.max(sentences.length * 0.4, 1));
}

/**
 * Detect whether content follows AIDA, PAS, or neither.
 *
 * @param {string} text
 * @returns {{ framework: string, confidence: number, phases: object, reasons: string[] }}
 */
export function detectPersuasion(text) {
    const reasons = [];

    if (!text || text.trim().length === 0) {
        return { framework: 'none', confidence: 0, phases: {}, reasons: ['No text to analyze.'] };
    }

    const words = splitWords(text);
    if (words.length < 15) {
        return { framework: 'none', confidence: 0, phases: {}, reasons: ['Content is too short for persuasion structure detection.'] };
    }

    const len = text.length;

    // ── AIDA check ───────────────────────────────────────
    const aidaSegments = {
        attention: text.slice(0, Math.floor(len * 0.2)),
        interest: text.slice(Math.floor(len * 0.2), Math.floor(len * 0.5)),
        desire: text.slice(Math.floor(len * 0.5), Math.floor(len * 0.8)),
        action: text.slice(Math.floor(len * 0.8)),
    };

    const aidaPhases = {};
    let aidaTotal = 0;
    for (const [phase, segment] of Object.entries(aidaSegments)) {
        const conf = phaseConfidence(segment, AIDA_KEYWORDS[phase]);
        aidaPhases[phase] = Math.round(conf * 100) / 100;
        aidaTotal += conf;
    }

    // ── PAS check ────────────────────────────────────────
    const pasSegments = {
        problem: text.slice(0, Math.floor(len * 0.3)),
        agitate: text.slice(Math.floor(len * 0.3), Math.floor(len * 0.6)),
        solve: text.slice(Math.floor(len * 0.6)),
    };

    const pasPhases = {};
    let pasTotal = 0;
    for (const [phase, segment] of Object.entries(pasSegments)) {
        const conf = phaseConfidence(segment, PAS_KEYWORDS[phase]);
        pasPhases[phase] = Math.round(conf * 100) / 100;
        pasTotal += conf;
    }

    // ── Pick winner ──────────────────────────────────────
    const aidaConfidence = clamp((aidaTotal / 4) * 100);
    const pasConfidence = clamp((pasTotal / 3) * 100);

    const threshold = 25; // minimum confidence to declare a framework

    let framework = 'none';
    let confidence = 0;
    let phases = {};

    if (aidaConfidence >= pasConfidence && aidaConfidence >= threshold) {
        framework = 'AIDA';
        confidence = aidaConfidence;
        phases = aidaPhases;
    } else if (pasConfidence > aidaConfidence && pasConfidence >= threshold) {
        framework = 'PAS';
        confidence = pasConfidence;
        phases = pasPhases;
    }

    // ── Reasons ──────────────────────────────────────────
    if (framework === 'none') {
        reasons.push('Content doesn\'t follow a recognizable persuasion structure (AIDA or PAS).');
        reasons.push('Without a structure, readers may not know what you want them to think or do.');

        // Find what's missing
        if (aidaPhases.action < 0.2 && pasPhases.solve < 0.2) {
            reasons.push('No clear call-to-action or solution — the post ends without directing the reader.');
        }
        if (aidaPhases.attention < 0.3) {
            reasons.push('The opening doesn\'t grab attention strongly enough to set up a persuasion flow.');
        }
    } else if (framework === 'AIDA') {
        reasons.push(`Content roughly follows an AIDA structure (Attention → Interest → Desire → Action).`);
        // Flag weak phases
        const weak = Object.entries(aidaPhases).filter(([, v]) => v < 0.3);
        if (weak.length > 0) {
            reasons.push(`Weak phases: ${weak.map(([k]) => k).join(', ')} — strengthening these would improve the persuasion flow.`);
        }
    } else {
        reasons.push(`Content roughly follows a PAS structure (Problem → Agitate → Solve).`);
        const weak = Object.entries(pasPhases).filter(([, v]) => v < 0.3);
        if (weak.length > 0) {
            reasons.push(`Weak phases: ${weak.map(([k]) => k).join(', ')} — strengthening these would make the argument more compelling.`);
        }
    }

    // Score: detected framework with high confidence = good for social
    const score = framework !== 'none' ? confidence : clamp(Math.max(aidaConfidence, pasConfidence) * 0.5);

    return { score, framework, confidence, phases, reasons };
}


// ═══════════════════════════════════════════════════════════════
// 4. CONTENT EXPLANATION GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Compose a human-readable 2-4 sentence explanation of the overall content quality.
 * Built from template clauses, not LLM generation.
 *
 * @param {{ overallScore: number, hook: object, cognitiveLoad: object, persuasion: object, dimensions: object }} scores
 * @returns {string}
 */
export function generateContentExplanation(scores) {
    const parts = [];

    // ── Overall ──────────────────────────────────────────
    const s = scores.overallScore;
    if (s >= 80) parts.push(`Your content scores ${s}/100 — this is strong and likely to perform well.`);
    else if (s >= 60) parts.push(`Your content scores ${s}/100 — solid foundation but there's room to improve.`);
    else if (s >= 40) parts.push(`Your content scores ${s}/100 — several areas need attention to drive engagement.`);
    else parts.push(`Your content scores ${s}/100 — significant issues are likely hurting engagement.`);

    // ── Hook ─────────────────────────────────────────────
    if (scores.hook) {
        if (scores.hook.score >= 70) {
            parts.push(`The opening hook is strong${scores.hook.hookType ? ` (a ${scores.hook.hookType} pattern)` : ''} — it should stop the scroll.`);
        } else if (scores.hook.score >= 40) {
            parts.push(`The opening is decent but could be punchier — ${scores.hook.hookType ? `the ${scores.hook.hookType} pattern is there but` : 'there\'s no clear hook pattern and'} it needs more specificity or emotion.`);
        } else {
            parts.push('The opening is weak — readers are likely scrolling past without engaging.');
        }
    }

    // ── Cognitive Load ───────────────────────────────────
    if (scores.cognitiveLoad) {
        if (scores.cognitiveLoad.level === 'high' || scores.cognitiveLoad.level === 'overload') {
            parts.push('The content has high cognitive load — too many ideas or complex sentences make it hard to follow.');
        } else if (scores.cognitiveLoad.level === 'moderate') {
            parts.push('Cognitive load is moderate — simplifying sentence structure would improve absorption.');
        }
    }

    // ── Persuasion ───────────────────────────────────────
    if (scores.persuasion) {
        if (scores.persuasion.framework === 'none') {
            parts.push('The content doesn\'t follow a persuasion structure, so the reader may not know what you want them to do.');
        } else {
            parts.push(`The content follows a ${scores.persuasion.framework} persuasion structure (${scores.persuasion.confidence}% match).`);
        }
    }

    return parts.join(' ');
}

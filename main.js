// ─── DOM Elements ─────────────────────────────────────────

const tabFile = document.getElementById('tabFile');
const tabUrl = document.getElementById('tabUrl');
const panelFile = document.getElementById('panelFile');
const panelUrl = document.getElementById('panelUrl');

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileIcon = document.getElementById('fileIcon');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');

const urlInput = document.getElementById('urlInput');
const clearUrlBtn = document.getElementById('clearUrl');

const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox = document.getElementById('errorBox');
const results = document.getElementById('results');

let selectedFile = null;
let activeMode = 'file'; // 'file' or 'url'

// ─── Tab Switching ────────────────────────────────────────

tabFile.addEventListener('click', () => switchMode('file'));
tabUrl.addEventListener('click', () => switchMode('url'));

function switchMode(mode) {
    activeMode = mode;

    tabFile.classList.toggle('input-tab--active', mode === 'file');
    tabUrl.classList.toggle('input-tab--active', mode === 'url');

    panelFile.classList.toggle('input-panel--hidden', mode !== 'file');
    panelUrl.classList.toggle('input-panel--hidden', mode !== 'url');

    // Show analyze button if there's input in the active mode
    updateAnalyzeButton();
    hideError();
    results.classList.remove('results--visible');
}

function updateAnalyzeButton() {
    const hasInput =
        (activeMode === 'file' && selectedFile) ||
        (activeMode === 'url' && urlInput.value.trim().length > 0);
    analyzeBtn.classList.toggle('analyze-btn--visible', hasInput);
}

// ─── File Selection ───────────────────────────────────────

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) selectFile(file);
});

// Drag & drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone--dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('upload-zone--dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('upload-zone--dragover');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
});

removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
});

function selectFile(file) {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        showError('Unsupported file type. Please upload a PDF, PNG, or JPG.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showError('File is too large. Maximum size is 10 MB.');
        return;
    }

    selectedFile = file;
    hideError();

    fileIcon.textContent = file.type === 'application/pdf' ? '📕' : '🖼️';
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.classList.add('file-info--visible');
    updateAnalyzeButton();
    results.classList.remove('results--visible');
}

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.remove('file-info--visible');
    updateAnalyzeButton();
    results.classList.remove('results--visible');
    hideError();
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── URL Input ────────────────────────────────────────────

urlInput.addEventListener('input', () => updateAnalyzeButton());
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyzeBtn.click();
});

clearUrlBtn.addEventListener('click', () => {
    urlInput.value = '';
    updateAnalyzeButton();
    hideError();
});

// ─── Analyze ──────────────────────────────────────────────

analyzeBtn.addEventListener('click', async () => {
    if (activeMode === 'file') {
        await analyzeFile();
    } else {
        await analyzeUrl();
    }
});

async function analyzeFile() {
    if (!selectedFile) return;

    setLoading(true);
    hideError();
    results.classList.remove('results--visible');

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('platform', document.getElementById('platformSelect').value);

        const res = await fetch('/api/analyze', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Analysis failed.');
            return;
        }

        renderResults(data, 'file');
    } catch (err) {
        console.error(err);
        showError('Network error — is the backend running?');
    } finally {
        setLoading(false);
    }
}

async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) return;

    setLoading(true);
    hideError();
    results.classList.remove('results--visible');

    try {
        const platform = document.getElementById('platformSelect').value;
        const res = await fetch('/api/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, platform }),
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'URL analysis failed.');
            return;
        }

        renderResults(data, 'url');
    } catch (err) {
        console.error(err);
        showError('Network error — is the backend running?');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    analyzeBtn.disabled = loading;
    analyzeBtn.classList.toggle('analyze-btn--loading', loading);
    const textEl = analyzeBtn.querySelector('.analyze-btn__text');
    textEl.textContent = loading ? 'Analyzing…' : 'Analyze Content';
}

// ─── Error Handling ───────────────────────────────────────

function showError(message) {
    errorBox.textContent = '⚠️ ' + message;
    errorBox.classList.add('error--visible');
}

function hideError() {
    errorBox.classList.remove('error--visible');
}

// ─── Render Results ───────────────────────────────────────

function renderResults(data, source) {
    const { analysis, extraction, requestId, explanation } = data;
    const { overallScore, platformScore, platformDelta, wordCount, sentenceCount, dimensions, metrics } = analysis;
    const suggestions = [...(data.platformSuggestions || []), ...(data.suggestions || [])];

    // Source info
    const sourceInfoEl = document.getElementById('sourceInfo');
    if (sourceInfoEl) {
        if (source === 'url') {
            const title = data.pageTitle || data.sourceUrl;
            const url = data.sourceUrl;
            sourceInfoEl.innerHTML = `
                <span class="source-info__badge">🌐 URL</span>
                <a href="${url}" target="_blank" rel="noopener" class="source-info__link">${title}</a>
            `;
        } else {
            sourceInfoEl.innerHTML = `
                <span class="source-info__badge">📄 File</span>
                <span class="source-info__name">${data.filename}</span>
            `;
        }
        sourceInfoEl.classList.add('source-info--visible');
    }

    // Score ring
    animateScore(platformScore !== undefined ? platformScore : overallScore);

    // Platform Score UI
    const platformContainer = document.getElementById('platformScoreContainer');
    const pScoreVal = document.getElementById('platformScoreValue');
    const pDeltaVal = document.getElementById('platformDeltaValue');

    if (platformScore !== undefined && platformScore !== overallScore) {
        pScoreVal.textContent = platformScore;
        const deltaLabel = platformDelta >= 0 ? `+${platformDelta}` : `${platformDelta}`;
        pDeltaVal.textContent = `(${deltaLabel} vs generic)`;
        pDeltaVal.style.color = platformDelta >= 0 ? 'var(--success)' : 'var(--danger)';
        pScoreVal.style.color = scoreColor(platformScore);
        platformContainer.style.display = 'block';
    } else {
        platformContainer.style.display = 'none';
    }

    document.getElementById('wordCount').textContent = wordCount.toLocaleString();
    document.getElementById('sentenceCount').textContent = sentenceCount.toLocaleString();
    const resultFilename = document.getElementById('resultFilename');
    resultFilename.textContent = source === 'url' ? (data.pageTitle || 'URL') : (data.filename || '');

    // Extraction metadata
    const metaEl = document.getElementById('extractionMeta');
    if (metaEl) {
        const methodLabel = {
            'pdf-parse': '📄 Native PDF',
            'tesseract-ocr': '🔍 Tesseract OCR',
            'pdf-parse+ocr-fallback': '🔄 PDF → OCR Fallback',
            'pdf-parse (sparse)': '⚠️ Scanned PDF (limited text)',
            'web-scrape': '🌐 Web Scrape',
            'url-image-ocr': '🔍 Image URL → OCR',
        };
        const method = methodLabel[extraction.extraction_method] || extraction.extraction_method;
        const confidence = extraction.confidence_estimate ? `${extraction.confidence_estimate}%` : '—';
        const pages = extraction.page_count || '—';

        metaEl.innerHTML = `
            <span title="Extraction method">${method}</span>
            <span title="Confidence">🎯 ${confidence}</span>
            <span title="Pages">📑 ${pages} pg</span>
            <span title="Request ID" class="extraction-meta__id">🔑 ${requestId.slice(0, 8)}…</span>
        `;
        metaEl.classList.add('extraction-meta--visible');
    }

    // Metrics bar
    const metricsEl = document.getElementById('metricsBadges');
    if (metricsEl && metrics) {
        const toneColors = {
            'positive': 'var(--success)', 'mostly positive': 'var(--success)',
            'neutral': 'var(--text-secondary)',
            'mostly negative': 'var(--warning)', 'negative': 'var(--danger)',
        };
        const toneColor = toneColors[metrics.toneLabel] || 'var(--text-secondary)';
        metricsEl.innerHTML = `
            <span style="border-color: ${toneColor}" title="Detected tone">🎭 ${metrics.toneLabel}</span>
            <span title="Readability level">📚 ${metrics.readabilityCategory}</span>
            ${metrics.emojiCount > 0 ? `<span title="Emojis found">😀 ${metrics.emojiCount} emojis</span>` : ''}
            ${metrics.hashtagCount > 0 ? `<span title="Hashtags found"># ${metrics.hashtagCount} hashtags</span>` : ''}
            <span title="Grade level">🎓 grade ${metrics.gradeLevel || '?'}</span>
        `;
        metricsEl.classList.add('extraction-meta--visible');
    }

    // Dimension cards
    const dimsContainer = document.getElementById('dimensions');
    dimsContainer.innerHTML = '';

    const dimIcons = {
        readability: '📖', structure: '🏗️', engagement: '🔥',
        clarity: '💎', actionability: '🎯', sentiment: '🎭',
        hook: '🪝', cognitiveLoad: '🧠', persuasion: '🎯',
    };

    const dimLabels = {
        readability: 'Readability', structure: 'Structure', engagement: 'Engagement',
        clarity: 'Clarity', actionability: 'Actionability', sentiment: 'Sentiment',
        hook: 'Opening Hook', cognitiveLoad: 'Cognitive Load', persuasion: 'Persuasion',
    };

    for (const [name, dim] of Object.entries(dimensions)) {
        const card = document.createElement('div');
        card.className = 'dim-card';
        const label = dimLabels[name] || name;
        card.innerHTML = `
            <div class="dim-card__header">
                <span class="dim-card__name">${dimIcons[name] || '📊'} ${label}</span>
                <span class="dim-card__score" style="color: ${scoreColor(dim.score)}">${dim.score}</span>
            </div>
            <div class="dim-card__bar">
                <div class="dim-card__bar-fill" style="background: ${scoreColor(dim.score)}"></div>
            </div>
        `;
        dimsContainer.appendChild(card);
        requestAnimationFrame(() => {
            card.querySelector('.dim-card__bar-fill').style.width = dim.score + '%';
        });
    }

    // Suggestions
    const suggestionList = document.getElementById('suggestionList');
    suggestionList.innerHTML = '';

    if (suggestions.length === 0) {
        suggestionList.innerHTML = '<p style="color: var(--success); text-align: center; padding: 2rem;">🎉 Your content looks great — no major suggestions!</p>';
    } else {
        for (const s of suggestions) {
            const el = document.createElement('div');
            el.className = `suggestion suggestion--${s.severity}`;
            el.innerHTML = `
                <div class="suggestion__header">
                    <span class="suggestion__badge suggestion__badge--${s.severity}">${s.severity}</span>
                    <span class="suggestion__dimension">${s.dimension}</span>
                </div>
                <p class="suggestion__what">${s.what}</p>
                <p class="suggestion__why">${s.why}</p>
                <p class="suggestion__how">💡 ${s.how}</p>
                ${s.example ? `<p class="suggestion__example">📝 ${s.example}</p>` : ''}
            `;
            suggestionList.appendChild(el);
        }
    }

    // Explanation panel
    const explEl = document.getElementById('explanationPanel');
    if (explEl && explanation) {
        explEl.innerHTML = `<p class="explanation__text">${explanation}</p>`;
        explEl.classList.add('explanation--visible');
    } else if (explEl) {
        explEl.classList.remove('explanation--visible');
    }

    results.classList.add('results--visible');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Score Animation ──────────────────────────────────────

function animateScore(target) {
    const ring = document.getElementById('scoreRing');
    const valueEl = document.getElementById('scoreValue');
    const circumference = 2 * Math.PI * 70;
    ring.style.stroke = scoreColor(target);
    const offset = circumference - (target / 100) * circumference;
    ring.style.strokeDashoffset = offset;

    let current = 0;
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        current = Math.round(eased * target);
        valueEl.textContent = current;
        valueEl.style.color = scoreColor(current);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function scoreColor(score) {
    if (score >= 70) return 'var(--success)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--danger)';
}

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
const inputArea = document.getElementById('inputArea');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

let selectedFile = null;
let activeMode = 'file'; // 'file' or 'url'

// ─── New Analysis ─────────────────────────────────────────

newAnalysisBtn.addEventListener('click', () => {
    results.classList.remove('results--visible');
    inputArea.classList.remove('input-area--hidden');
    newAnalysisBtn.classList.remove('new-analysis-btn--visible');
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Tab Switching ────────────────────────────────────────

tabFile.addEventListener('click', () => switchMode('file'));
tabUrl.addEventListener('click', () => switchMode('url'));

function switchMode(mode) {
    activeMode = mode;

    tabFile.classList.toggle('input-tab--active', mode === 'file');
    tabUrl.classList.toggle('input-tab--active', mode === 'url');
    
    // Update ARIA states for tab buttons
    tabFile.setAttribute('aria-selected', mode === 'file');
    tabUrl.setAttribute('aria-selected', mode === 'url');

    panelFile.classList.toggle('input-panel--hidden', mode !== 'file');
    panelUrl.classList.toggle('input-panel--hidden', mode !== 'url');

    // Show analyze button if there's input in the active mode
    updateAnalyzeButton();
    hideError();
    results.classList.remove('results--visible');
    
    // Set focus to active input field for better keyboard navigation
    if (mode === 'file') {
        fileInput.focus();
    } else {
        urlInput.focus();
    }
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

// Keyboard support for upload zone
uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
    }
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
        const res = await fetch('/api/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
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
    analyzeBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    const textEl = analyzeBtn.querySelector('.analyze-btn__text');
    textEl.textContent = loading ? 'Analyzing…' : 'Analyze Content';
    
    // Update results section aria-busy state
    const resultsSection = document.getElementById('results');
    if (resultsSection) {
        resultsSection.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
}

// ─── Error Handling ───────────────────────────────────────

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('error--visible');
    
    // Update aria-busy for accessibility
    const resultsSection = document.getElementById('results');
    if (resultsSection) {
        resultsSection.setAttribute('aria-busy', 'false');
    }
    
    // Announce error to screen readers
    errorBox.setAttribute('role', 'alert');
    errorBox.focus();
}

function hideError() {
    errorBox.classList.remove('error--visible');
    errorBox.textContent = '';
}

// ─── Render Results ───────────────────────────────────────

function renderResults(data, source) {
    // Transition UI to results mode
    inputArea.classList.add('input-area--hidden');
    newAnalysisBtn.classList.add('new-analysis-btn--visible');

    const { analysis, suggestions, extraction, requestId } = data;
    const { overallScore, wordCount, sentenceCount, dimensions, metrics } = analysis;

    // Source info (Top Meta Bar Left)
    const sourceInfoEl = document.getElementById('sourceInfo');
    if (sourceInfoEl) {
        if (source === 'url') {
            const title = data.pageTitle || data.sourceUrl;
            const url = data.sourceUrl;
            sourceInfoEl.innerHTML = `
                <span class="suggestion__badge suggestion__badge--medium">🌐 URL</span>
                <a href="${url}" target="_blank" rel="noopener" style="color:var(--text-primary); text-decoration:none;">${title}</a>
            `;
        } else {
            sourceInfoEl.innerHTML = `
                <span class="suggestion__badge suggestion__badge--low">📄 File</span>
                <span style="color:var(--text-primary);">${data.filename}</span>
            `;
        }
    }

    // Extraction metadata (Top Meta Bar Right)
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
            <span style="color:var(--text-muted); font-size: 0.85rem;" title="Extraction method">${method}</span>
            <span style="color:var(--text-muted); font-size: 0.85rem;" title="Confidence">🎯 ${confidence}</span>
            <span style="color:var(--text-muted); font-size: 0.85rem;" title="Pages">📑 ${pages} pg</span>
            <span style="color:var(--text-muted); font-size: 0.75rem;" title="Request ID">🔑 ${requestId.slice(0, 8)}…</span>
        `;
    }

    // Verdict section (Left Panel)
    animateScore(overallScore);
    const toneBadge = document.getElementById('toneBadge');
    if (toneBadge && metrics) {
        const toneColors = {
            'positive': 'var(--success)', 'mostly positive': 'var(--success)',
            'neutral': 'var(--text-secondary)',
            'mostly negative': 'var(--warning)', 'negative': 'var(--danger)',
        };
        const toneColor = toneColors[metrics.toneLabel] || 'var(--text-secondary)';
        toneBadge.style.color = toneColor;
        toneBadge.style.borderColor = toneColor;
        toneBadge.innerHTML = `🎭 ${metrics.toneLabel} Tone`;
    }

    // Quick Stats (Right Panel)
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid && metrics) {
        const readingTime = Math.ceil(wordCount / 200); // approx 200 wpm
        statsGrid.innerHTML = `
            <div class="stat-item">
                <span class="stat-item__value">${wordCount.toLocaleString()}</span>
                <span class="stat-item__label">Words</span>
            </div>
            <div class="stat-item">
                <span class="stat-item__value">${readingTime}m</span>
                <span class="stat-item__label">Reading Time</span>
            </div>
            <div class="stat-item">
                <span class="stat-item__value">${metrics.gradeLevel || '?'}</span>
                <span class="stat-item__label">Grade Level</span>
            </div>
            <div class="stat-item">
                <span class="stat-item__value">${metrics.emojiCount + metrics.hashtagCount}</span>
                <span class="stat-item__label">Social Tags</span>
            </div>
        `;
    }

    // Dimension cards
    const dimsContainer = document.getElementById('dimensions');
    if (dimsContainer) {
        dimsContainer.innerHTML = '';
        const dimIcons = {
            readability: '📖', structure: '🏗️', engagement: '🔥',
            clarity: '💎', actionability: '🎯', sentiment: '🎭',
            hook: '🪝',
        };

        for (const [name, dim] of Object.entries(dimensions)) {
            const card = document.createElement('div');
            card.className = 'dim-card';
            card.innerHTML = `
                <div class="dim-card__header">
                    <span class="dim-card__name">${dimIcons[name] || '📊'} ${name}</span>
                    <span class="dim-card__score" style="color: ${scoreColor(dim.score)}">${dim.score}/100</span>
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
    }

    // Action Plan (Suggestions)
    const suggestionList = document.getElementById('suggestionList');
    if (suggestionList) {
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
                    <p class="suggestion__what" style="font-weight: 600; margin-bottom: 8px;">${s.what}</p>
                    <p class="suggestion__why" style="margin-bottom: 8px; color: var(--text-secondary);">${s.why}</p>
                    <p class="suggestion__how">💡 ${s.how}</p>
                    ${s.example ? `<p class="suggestion__example" style="margin-top: 12px; padding-top: 12px; border-top: 1px dotted rgba(255,255,255,0.1);">📝 ${s.example}</p>` : ''}
                `;
                suggestionList.appendChild(el);
            }
        }
    }

    results.classList.add('results--visible');
    
    // Focus management for accessibility
    const resultHeading = document.querySelector('.results h2, .section-title');
    if (resultHeading) {
        resultHeading.tabIndex = -1;
        resultHeading.focus();
    }
    
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

// ─── DOM Elements ─────────────────────────────────────────

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileIcon = document.getElementById('fileIcon');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox = document.getElementById('errorBox');
const results = document.getElementById('results');

let selectedFile = null;

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
    // Client-side validation
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

    // Update file info bar
    fileIcon.textContent = file.type === 'application/pdf' ? '📕' : '🖼️';
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    fileInfo.classList.add('file-info--visible');
    analyzeBtn.classList.add('analyze-btn--visible');
    results.classList.remove('results--visible');
}

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.remove('file-info--visible');
    analyzeBtn.classList.remove('analyze-btn--visible');
    results.classList.remove('results--visible');
    hideError();
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Analyze ──────────────────────────────────────────────

analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    setLoading(true);
    hideError();
    results.classList.remove('results--visible');

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Analysis failed. Please try again.');
            return;
        }

        renderResults(data);
    } catch (err) {
        console.error(err);
        showError('Network error — is the backend running? Check that the server is started.');
    } finally {
        setLoading(false);
    }
});

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

function renderResults(data) {
    const { analysis, suggestions, filename } = data;
    const { overallScore, wordCount, sentenceCount, dimensions } = analysis;

    // Score ring
    animateScore(overallScore);
    document.getElementById('wordCount').textContent = wordCount.toLocaleString();
    document.getElementById('sentenceCount').textContent = sentenceCount.toLocaleString();
    document.getElementById('resultFilename').textContent = filename;

    // Dimension cards
    const dimsContainer = document.getElementById('dimensions');
    dimsContainer.innerHTML = '';

    const dimIcons = {
        readability: '📖',
        structure: '🏗️',
        engagement: '🔥',
        clarity: '💎',
        actionability: '🎯',
    };

    for (const [name, dim] of Object.entries(dimensions)) {
        const card = document.createElement('div');
        card.className = 'dim-card';
        card.innerHTML = `
            <div class="dim-card__header">
                <span class="dim-card__name">${dimIcons[name] || '📊'} ${name}</span>
                <span class="dim-card__score" style="color: ${scoreColor(dim.score)}">${dim.score}</span>
            </div>
            <div class="dim-card__bar">
                <div class="dim-card__bar-fill" style="background: ${scoreColor(dim.score)}"></div>
            </div>
        `;
        dimsContainer.appendChild(card);

        // Animate bar fill
        requestAnimationFrame(() => {
            const fill = card.querySelector('.dim-card__bar-fill');
            fill.style.width = dim.score + '%';
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
            `;
            suggestionList.appendChild(el);
        }
    }

    results.classList.add('results--visible');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Score Animation ──────────────────────────────────────

function animateScore(target) {
    const ring = document.getElementById('scoreRing');
    const valueEl = document.getElementById('scoreValue');
    const circumference = 2 * Math.PI * 70; // r=70

    // Set the ring color
    ring.style.stroke = scoreColor(target);

    // Animate ring
    const offset = circumference - (target / 100) * circumference;
    ring.style.strokeDashoffset = offset;

    // Animate number
    let current = 0;
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        current = Math.round(eased * target);
        valueEl.textContent = current;
        valueEl.style.color = scoreColor(current);

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}

function scoreColor(score) {
    if (score >= 70) return 'var(--success)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--danger)';
}

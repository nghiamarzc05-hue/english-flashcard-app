// ========================================================
// FILE: app.js - FLASHCARDS PRO (COMBO 2 + 3 + 4 TOÀN DIỆN)
// ========================================================

let allDecks = [];
let customDecks = [];
let currentDeck = null;
let currentDeckItems = []; // Danh sách từ vựng đang được lọc để học
let currentStudyFilter = 'all'; // 'all' | 'unmastered' | 'mastered'
let currentCardIndex = 0;
let isFlipped = false;
let masteredCards = [];
let starredCards = []; 
let cardNotes = {}; // Ghi chú mẹo nhớ theo cardId
let studyHistory = {}; // Nhật ký học tập theo ngày YYYY-MM-DD
let currentStreak = 0;
let DOM = {};
let englishVoice = null;
let speechRate = 0.9;
let voiceAccent = 'US';
let sfxEnabled = true;
let currentSearchFilter = 'all';
let currentDashboardFilter = 'all'; // 'all' | 'unstarted' | 'in_progress' | 'completed' | 'custom'
let editingCustomDeckId = null;
let speechRecognition = null;
let isListeningMic = false;

// ========================================================
// THÔNG BÁO TOAST MƯỢT MÀ (THAY THẾ ALERT MẶC ĐỊNH)
// ========================================================
function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// QUIZ STATE
let quizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let quizAnswering = false;

// AUTOPLAY STATE
let autoPlayTimer = null;
let isAutoPlaying = false;

// 3D CAROUSEL STATE
let currentCarouselIndex = 0;

// ========================================================
// 2. ÂM THANH HIỆU ỨNG (WEB AUDIO API TỰ ĐỘNG - KHÔNG CẦN FILE NGOÀI)
// ========================================================
const AudioFX = {
    ctx: null,
    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        } catch (e) {}
    },
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playFlip() {
        if (!sfxEnabled || !this.ctx) return;
        this.resume();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    },
    playCorrect() {
        if (!sfxEnabled || !this.ctx) return;
        this.resume();
        try {
            const now = this.ctx.currentTime;
            // Chord C-E-G vui tươi
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.06);
                gain.gain.setValueAtTime(0.15, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.3);
            });
        } catch (e) {}
    },
    playWrong() {
        if (!sfxEnabled || !this.ctx) return;
        this.resume();
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.setValueAtTime(110, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {}
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

function initVoices() {
    if (!('speechSynthesis' in window)) return;
    const findVoice = () => {
        let voices = window.speechSynthesis.getVoices();
        const langCode = voiceAccent === 'UK' ? 'en-GB' : 'en-US';
        englishVoice = voices.find(v => v.lang.includes(langCode) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('George'))) || 
                       voices.find(v => v.lang.startsWith(langCode)) || 
                       voices.find(v => v.lang.startsWith('en'));
    };
    findVoice();
    window.speechSynthesis.onvoiceschanged = findVoice;
}

function playWordSound(wordText) {
    const text = wordText || (currentDeckItems && currentDeckItems[currentCardIndex] ? currentDeckItems[currentCardIndex].term : (currentDeck && currentDeck.items && currentDeck.items[currentCardIndex] ? currentDeck.items[currentCardIndex].term : ''));
    if (!text) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voiceAccent === 'UK' ? 'en-GB' : 'en-US';
        utterance.rate = speechRate;
        if (englishVoice) utterance.voice = englishVoice;
        setTimeout(() => { window.speechSynthesis.speak(utterance); }, 40);
    }
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordStudyActivity() {
    const today = getTodayString();
    studyHistory[today] = (studyHistory[today] || 0) + 1;
    localStorage.setItem('studyHistory', JSON.stringify(studyHistory));
    renderActivityHeatmap();
    checkBadges();
}

function checkStreak() {
    const today = getTodayString(); 
    let lastDate = localStorage.getItem('lastStudyDate');
    currentStreak = parseInt(localStorage.getItem('currentStreak')) || 0;
    
    if (lastDate) {
        const last = new Date(lastDate);
        const cur = new Date(today);
        const diffDays = Math.floor((cur - last) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) { 
            currentStreak = 0; 
            localStorage.setItem('currentStreak', 0); 
        }
    }
    if (DOM.statStreak) DOM.statStreak.innerText = `${currentStreak} ngày`;
}

function noiLua() {
    const today = getTodayString();
    recordStudyActivity();

    if (localStorage.getItem('lastStudyDate') !== today) {
        currentStreak++;
        localStorage.setItem('currentStreak', currentStreak);
        localStorage.setItem('lastStudyDate', today);
        if (DOM.statStreak) DOM.statStreak.innerText = `${currentStreak} ngày`;
        if (typeof confetti !== 'undefined') {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    AudioFX.init();

    try { masteredCards = JSON.parse(localStorage.getItem('masteredCards')) || []; } catch (e) { masteredCards = []; }
    try { starredCards = JSON.parse(localStorage.getItem('starredCards')) || []; } catch (e) { starredCards = []; }
    try { cardNotes = JSON.parse(localStorage.getItem('cardNotes')) || {}; } catch (e) { cardNotes = {}; }
    try { studyHistory = JSON.parse(localStorage.getItem('studyHistory')) || {}; } catch (e) { studyHistory = {}; }
    try { customDecks = JSON.parse(localStorage.getItem('customDecks')) || []; } catch (e) { customDecks = []; }

    speechRate = parseFloat(localStorage.getItem('speechRate')) || 0.9;
    voiceAccent = localStorage.getItem('voiceAccent') || 'US';
    sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false';

    initDOM();
    initVoices();
    setupTheme();
    checkStreak();
    mergeData(); 
    populateQuizDecks();
    renderDashboardDecks();
    setupNavigation();
    setupEventListeners();
    updateDashboardStats();
    renderActivityHeatmap();
    checkBadges();

    // Tự động load bài đầu tiên để có sẵn từ học ngay
    if (allDecks.length > 0 && !currentDeck) {
        currentDeck = allDecks[0];
        currentStudyFilter = 'all';
        applyStudyFilter(currentStudyFilter);
    }
});

function initDOM() {
    DOM = {
        views: document.querySelectorAll('.view-section'),
        navItems: document.querySelectorAll('.nav-item, .sidebar-nav .nav-item'),
        deckList: document.getElementById('deckList'),
        deckTotalCount: document.getElementById('deckTotalCount'),
        libraryList: document.getElementById('libraryList'),
        starredList: document.getElementById('starredList'),
        studyStarredBtn: document.getElementById('studyStarredBtn'),
        searchInput: document.getElementById('searchInput'),
        filterPills: document.querySelectorAll('.filter-pill'),
        
        flashcard: document.getElementById('flashcard'),
        cardWord: document.getElementById('cardWord'),
        cardIpa: document.getElementById('cardIpa'),
        cardMeaning: document.getElementById('cardMeaning'),
        cardExampleEn: document.getElementById('cardExampleEn'),
        cardExampleVi: document.getElementById('cardExampleVi'),
        cardPos: document.getElementById('cardPos'),
        cardCounter: document.getElementById('cardCounter'),
        cardCounterBack: document.getElementById('cardCounterBack'),
        cardStatusBadge: document.getElementById('cardStatusBadge'),
        frontSpeakBtn: document.getElementById('frontSpeakBtn'),
        micCheckBtn: document.getElementById('micCheckBtn'),
        micFeedback: document.getElementById('micFeedback'),
        speakExampleBtn: document.getElementById('speakExampleBtn'),
        cardNoteInput: document.getElementById('cardNoteInput'),
        starCardBtn: document.getElementById('starCardBtn'),

        studyDeckName: document.getElementById('studyDeckName'),
        studyProgressPct: document.getElementById('studyProgressPct'),
        studyProgressFill: document.getElementById('studyProgressFill'),
        quickShuffleBtn: document.getElementById('quickShuffleBtn'),
        autoPlayBtn: document.getElementById('autoPlayBtn'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),
        headerThemeBtn: document.getElementById('headerThemeBtn'),
        heroContinueBtn: document.getElementById('heroContinueBtn'),
        heroQuickQuizBtn: document.getElementById('heroQuickQuizBtn'),
        
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        speakBtn: document.getElementById('speakBtn'),
        masterBtn: document.getElementById('masterBtn'),
        notMasteredBtn: document.getElementById('notMasteredBtn'),
        
        statMastered: document.getElementById('statMastered'),
        statProgress: document.getElementById('statProgress'),
        statStreak: document.getElementById('statStreak'),
        resetStatsBtn: document.getElementById('resetStatsBtn'),
        themeSwitch: document.getElementById('themeSwitch'),
        speechRateSelect: document.getElementById('speechRateSelect'),
        voiceAccentSelect: document.getElementById('voiceAccentSelect'),
        sfxSwitch: document.getElementById('sfxSwitch'),
        viewTitle: document.getElementById('viewTitle'),
        viewSubtitle: document.getElementById('viewSubtitle'),

        // HEATMAP & BADGES
        activityHeatmap: document.getElementById('activityHeatmap'),
        badgesContainer: document.getElementById('badgesContainer'),
        badgeUnlockedCount: document.getElementById('badgeUnlockedCount'),

        // BACKUP & RESTORE
        exportDataBtn: document.getElementById('exportDataBtn'),
        importDataBtn: document.getElementById('importDataBtn'),
        importFileInput: document.getElementById('importFileInput'),

        // CUSTOM DECK MODAL
        openCustomDeckModalBtn: document.getElementById('openCustomDeckModalBtn'),
        customDeckModal: document.getElementById('customDeckModal'),
        customDeckModalTitle: document.getElementById('customDeckModalTitle'),
        closeCustomDeckModalBtn: document.getElementById('closeCustomDeckModalBtn'),
        cancelCustomDeckBtn: document.getElementById('cancelCustomDeckBtn'),
        saveCustomDeckBtn: document.getElementById('saveCustomDeckBtn'),
        customDeckTitle: document.getElementById('customDeckTitle'),
        customDeckWords: document.getElementById('customDeckWords'),

        // 3D CAROUSEL ELEMENTS
        deckCarouselStage: document.getElementById('deckCarouselStage'),
        deckCarouselTrack: document.getElementById('deckCarouselTrack'),
        carouselPrevBtn: document.getElementById('carouselPrevBtn'),
        carouselNextBtn: document.getElementById('carouselNextBtn'),
        carouselPagination: document.getElementById('carouselPagination'),
        modeCarouselBtn: document.getElementById('modeCarouselBtn'),
        modeGridBtn: document.getElementById('modeGridBtn'),

        // QUIZ
        quizStartPanel: document.getElementById('quizStartPanel'),
        quizPlayPanel: document.getElementById('quizPlayPanel'),
        quizResultPanel: document.getElementById('quizResultPanel'),
        quizDeckSelect: document.getElementById('quizDeckSelect'),
        startQuizBtn: document.getElementById('startQuizBtn'),
        quizScore: document.getElementById('quizScore'),
        quizCurrentStep: document.getElementById('quizCurrentStep'),
        quizTotalStep: document.getElementById('quizTotalStep'),
        quizPosTag: document.getElementById('quizPosTag'),
        quizQuestionWord: document.getElementById('quizQuestionWord'),
        quizSpeakBtn: document.getElementById('quizSpeakBtn'),
        quizOptionsGrid: document.getElementById('quizOptionsGrid'),
        quizFinalScore: document.getElementById('quizFinalScore'),
        quizScoreFeedback: document.getElementById('quizScoreFeedback'),
        retryQuizBtn: document.getElementById('retryQuizBtn'),
        backToDeckQuizBtn: document.getElementById('backToDeckQuizBtn')
    };

    if (DOM.speechRateSelect) DOM.speechRateSelect.value = String(speechRate);
    if (DOM.voiceAccentSelect) DOM.voiceAccentSelect.value = voiceAccent;
    if (DOM.sfxSwitch) DOM.sfxSwitch.checked = sfxEnabled;
}

function setupTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (DOM.themeSwitch) DOM.themeSwitch.checked = (theme === 'dark');
    updateHeaderThemeIcon(theme);
}

function updateHeaderThemeIcon(theme) {
    if (!DOM.headerThemeBtn) return;
    const icon = DOM.headerThemeBtn.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function mergeData() {
    allDecks = [];
    const checkAndAdd = (data) => {
        if (data && Array.isArray(data)) {
            allDecks = allDecks.concat(data);
        }
    };

    // 1. Nạp từ các biến toàn cục window
    for (let i = 1; i <= 20; i++) {
        const varName = `group_${i}_decks`;
        if (typeof window[varName] !== 'undefined' && Array.isArray(window[varName])) {
            checkAndAdd(window[varName]);
        }
    }

    // 2. Dự phòng kiểm tra biến trực tiếp
    if (allDecks.length === 0) {
        try { if (typeof group_1_decks !== 'undefined') checkAndAdd(group_1_decks); } catch (e) {}
        try { if (typeof group_2_decks !== 'undefined') checkAndAdd(group_2_decks); } catch (e) {}
        try { if (typeof group_3_decks !== 'undefined') checkAndAdd(group_3_decks); } catch (e) {}
        try { if (typeof group_4_decks !== 'undefined') checkAndAdd(group_4_decks); } catch (e) {}
        try { if (typeof group_5_decks !== 'undefined') checkAndAdd(group_5_decks); } catch (e) {}
        try { if (typeof group_6_decks !== 'undefined') checkAndAdd(group_6_decks); } catch (e) {}
        try { if (typeof group_7_decks !== 'undefined') checkAndAdd(group_7_decks); } catch (e) {}
        try { if (typeof group_8_decks !== 'undefined') checkAndAdd(group_8_decks); } catch (e) {}
        try { if (typeof group_9_decks !== 'undefined') checkAndAdd(group_9_decks); } catch (e) {}
        try { if (typeof group_10_decks !== 'undefined') checkAndAdd(group_10_decks); } catch (e) {}
        try { if (typeof group_11_decks !== 'undefined') checkAndAdd(group_11_decks); } catch (e) {}
    }

    // 3. Nạp thêm các bài học tự tạo từ người dùng
    if (customDecks && customDecks.length > 0) {
        allDecks = allDecks.concat(customDecks);
    }

    if (DOM.deckTotalCount) DOM.deckTotalCount.innerText = `${allDecks.length} bài`;
}

function populateQuizDecks() {
    if (!DOM.quizDeckSelect) return;
    DOM.quizDeckSelect.innerHTML = '';
    allDecks.forEach((deck, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${deck.ten} (${deck.items ? deck.items.length : 0} từ)`;
        DOM.quizDeckSelect.appendChild(opt);
    });
}

function isCustomDeck(deck) {
    return Boolean(deck && (deck.isCustom || (deck.id && String(deck.id).startsWith('custom_deck_'))));
}

function getDeckProgressStats(deck) {
    const total = deck && deck.items ? deck.items.length : 0;
    const masteredCount = deck && deck.items ? deck.items.filter(item => masteredCards.includes(item.id)).length : 0;
    return { total, masteredCount };
}

function getFilteredDashboardDecks() {
    return allDecks.filter(deck => {
        const { total, masteredCount } = getDeckProgressStats(deck);
        if (currentDashboardFilter === 'unstarted') return masteredCount === 0;
        if (currentDashboardFilter === 'in_progress') return masteredCount > 0 && masteredCount < total;
        if (currentDashboardFilter === 'completed') return total > 0 && masteredCount === total;
        if (currentDashboardFilter === 'custom') return isCustomDeck(deck);
        return true;
    });
}

function updateDashboardFilterCounts() {
    let unstarted = 0, inProgress = 0, completed = 0, custom = 0;
    allDecks.forEach(deck => {
        const { total, masteredCount } = getDeckProgressStats(deck);
        if (masteredCount === 0) unstarted++;
        else if (total > 0 && masteredCount === total) completed++;
        else inProgress++;
        if (isCustomDeck(deck)) custom++;
    });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('dashCountAll', allDecks.length);
    setTxt('dashCountUnstarted', unstarted);
    setTxt('dashCountInProgress', inProgress);
    setTxt('dashCountCompleted', completed);
    setTxt('dashCountCustom', custom);

    document.querySelectorAll('.dash-filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dashFilter === currentDashboardFilter);
    });
}

function renderDashboardDecks() {
    updateDashboardFilterCounts();
    const filtered = getFilteredDashboardDecks();
    if (DOM.deckTotalCount) DOM.deckTotalCount.innerText = `${filtered.length} bài`;
    renderDeckList(filtered, DOM.deckList);
}

function renderDeckList(data, target) {
    if (!target) return; 
    target.innerHTML = '';
    
    if (!data || data.length === 0) {
        target.innerHTML = '<li style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;"><i class="fa-solid fa-box-open" style="font-size: 2.5rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>Không có bài học nào trong mục này</li>';
        if (target === DOM.deckList) renderDeckCarousel(data);
        return;
    }

    data.forEach(deck => {
        const li = document.createElement('li');
        li.className = 'deck-item';
        const { total, masteredCount } = getDeckProgressStats(deck);
        const customFlag = isCustomDeck(deck) && target === DOM.deckList;
        
        li.innerHTML = `
            <div class="deck-info">
                <strong>${deck.ten}</strong>
                <span class="deck-meta">
                    <i class="fa-regular fa-clone"></i> ${total} từ vựng
                    ${masteredCount > 0 ? ` &bull; <span style="color: var(--success); font-weight:600;"><i class="fa-solid fa-check"></i> ${masteredCount} đã thuộc</span>` : ''}
                </span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                ${customFlag ? `
                    <div class="deck-custom-actions">
                        <button class="deck-action-icon-btn edit-btn" data-action="edit" title="Chỉnh sửa bài học"><i class="fa-solid fa-pen"></i></button>
                        <button class="deck-action-icon-btn delete-btn" data-action="delete" title="Xóa bài học"><i class="fa-solid fa-trash"></i></button>
                    </div>
                ` : ''}
                <div class="deck-chevron">
                    <i class="fa-solid fa-arrow-right"></i>
                </div>
            </div>
        `;

        if (customFlag) {
            const editBtn = li.querySelector('[data-action="edit"]');
            const deleteBtn = li.querySelector('[data-action="delete"]');
            if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditCustomDeckModal(deck); });
            if (deleteBtn) deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomDeck(deck.id); });
        }

        li.addEventListener('click', () => loadDeck(deck));
        target.appendChild(li);
    });

    // Đồng thời cập nhật 3D Carousel nếu đang render danh sách chính
    if (target === DOM.deckList) {
        renderDeckCarousel(data);
    }
}

// ========================================================
// 2.2 RENDER & ĐIỀU HƯỚNG 3D VERTICAL CAROUSEL (3 THẺ)
// ========================================================
function renderDeckCarousel(decksData) {
    if (!DOM.deckCarouselTrack) return;
    const list = Array.isArray(decksData) ? decksData : getFilteredDashboardDecks();

    if (!list || list.length === 0) {
        DOM.deckCarouselTrack.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:40px 24px; background:var(--bg-card); border:1px dashed var(--border-color); border-radius:var(--radius-lg); max-width:440px; width:90%;">
                <i class="fa-solid fa-box-open" style="font-size:2.4rem; margin-bottom:12px; opacity:0.5; display:block;"></i>
                <strong>Chưa có bài học nào trong mục lọc này</strong>
                <p style="font-size:0.86rem; margin-top:6px;">Thử chọn bộ lọc khác hoặc tạo bài học mới nhé!</p>
            </div>
        `;
        if (DOM.carouselPagination) DOM.carouselPagination.innerHTML = '';
        return;
    }

    if (currentCarouselIndex < 0) currentCarouselIndex = 0;
    if (currentCarouselIndex >= list.length) currentCarouselIndex = list.length - 1;

    DOM.deckCarouselTrack.innerHTML = '';

    list.forEach((deck, idx) => {
        const { total, masteredCount } = getDeckProgressStats(deck);
        const pct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
        const customFlag = isCustomDeck(deck);

        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.dataset.index = idx;

        // Phân loại vị trí: Trước (-1), Giữa (0), Sau (+1) hoặc Ẩn
        if (idx === currentCarouselIndex) {
            card.classList.add('card-active');
        } else if (idx === currentCarouselIndex - 1) {
            card.classList.add('card-prev');
        } else if (idx === currentCarouselIndex + 1) {
            card.classList.add('card-next');
        } else {
            card.classList.add('card-hidden');
        }

        card.innerHTML = `
            <div class="c-card-top">
                <span class="c-card-badge"><i class="fa-solid fa-layer-group"></i> Chủ đề #${idx + 1}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${masteredCount > 0 ? `<span class="c-card-mastered"><i class="fa-solid fa-circle-check"></i> ${pct}% (${masteredCount}/${total})</span>` : `<span class="c-card-mastered" style="color:var(--text-muted);"><i class="fa-regular fa-circle"></i> Chưa học</span>`}
                    ${customFlag ? `
                        <div class="deck-custom-actions">
                            <button class="deck-action-icon-btn edit-btn" data-action="edit" title="Chỉnh sửa"><i class="fa-solid fa-pen"></i></button>
                            <button class="deck-action-icon-btn delete-btn" data-action="delete" title="Xóa bài học"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="c-card-body">
                <h3 class="c-card-title">${deck.ten}</h3>
                <div class="c-card-desc">Bao gồm các từ vựng thiết yếu, ví dụ phiên âm chuẩn quốc tế.</div>
            </div>
            <div class="c-card-bottom">
                <div class="c-card-stats">
                    <span><i class="fa-regular fa-clone"></i> ${total} từ</span>
                    <span><i class="fa-solid fa-stopwatch"></i> ~${Math.ceil(total * 0.5)} phút</span>
                </div>
                <button class="c-card-btn" data-action="study">
                    <span>Học ngay</span> <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        `;

        // Nhấp vào thẻ
        card.addEventListener('click', () => {
            if (idx === currentCarouselIndex) {
                loadDeck(deck);
            } else {
                navigateCarouselTo(idx);
            }
        });

        const btn = card.querySelector('[data-action="study"]');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadDeck(deck);
            });
        }

        if (customFlag) {
            const editBtn = card.querySelector('[data-action="edit"]');
            const deleteBtn = card.querySelector('[data-action="delete"]');
            if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditCustomDeckModal(deck); });
            if (deleteBtn) deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomDeck(deck.id); });
        }

        DOM.deckCarouselTrack.appendChild(card);
    });

    renderCarouselPagination(list);
}

function renderCarouselPagination(list) {
    if (!DOM.carouselPagination) return;
    DOM.carouselPagination.innerHTML = '';
    const decks = Array.isArray(list) ? list : getFilteredDashboardDecks();

    decks.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${idx === currentCarouselIndex ? 'active' : ''}`;
        dot.title = `Chủ đề ${idx + 1}`;
        dot.addEventListener('click', () => navigateCarouselTo(idx));
        DOM.carouselPagination.appendChild(dot);
    });
}

function navigateCarouselTo(newIndex) {
    const list = getFilteredDashboardDecks();
    if (newIndex < 0 || newIndex >= list.length) return;
    currentCarouselIndex = newIndex;
    AudioFX.playFlip();
    renderDeckCarousel(list);
}

// ========================================================
// 3. HEATMAP HOẠT ĐỘNG (30 NGÀY QUA) & HUY HIỆU
// ========================================================
function renderActivityHeatmap() {
    if (!DOM.activityHeatmap) return;
    DOM.activityHeatmap.innerHTML = '';

    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({ date: dateStr, dayNum: d.getDate() });
    }

    days.forEach(({ date, dayNum }) => {
        const count = studyHistory[date] || 0;
        let levelClass = 'l-0';
        if (count >= 15) levelClass = 'active-3';
        else if (count >= 6) levelClass = 'active-2';
        else if (count >= 1) levelClass = 'active-1';

        const dayEl = document.createElement('div');
        dayEl.className = `heatmap-day ${levelClass}`;
        dayEl.innerText = dayNum;
        dayEl.title = `${date}: Đã học ${count} lượt từ vựng`;
        DOM.activityHeatmap.appendChild(dayEl);
    });
}

const BADGES = [
    { id: 'first_step', title: 'Khởi Đầu Mới', desc: 'Đã thuộc từ vựng đầu tiên', icon: 'fa-seedling', check: () => masteredCards.length >= 1 },
    { id: 'vocab_20', title: 'Vốn Từ Khá', desc: 'Đã thuộc 20 từ vựng', icon: 'fa-book-bookmark', check: () => masteredCards.length >= 20 },
    { id: 'vocab_100', title: 'Bậc Thầy Từ Vựng', desc: 'Đã thuộc 100 từ vựng', icon: 'fa-crown', check: () => masteredCards.length >= 100 },
    { id: 'streak_3', title: 'Chăm Chỉ', desc: 'Đạt chuỗi học 3 ngày liên tục', icon: 'fa-fire-flame-curved', check: () => currentStreak >= 3 },
    { id: 'starred_5', title: 'Tập Trung', desc: 'Đã đánh dấu sao 5 từ cần ôn', icon: 'fa-star', check: () => starredCards.length >= 5 }
];

function checkBadges() {
    if (!DOM.badgesContainer) return;
    DOM.badgesContainer.innerHTML = '';

    let unlockedCount = 0;
    BADGES.forEach(badge => {
        const isUnlocked = badge.check();
        if (isUnlocked) unlockedCount++;

        const badgeEl = document.createElement('div');
        badgeEl.className = `badge-item ${isUnlocked ? 'unlocked' : ''}`;
        badgeEl.innerHTML = `
            <div class="badge-icon-box">
                <i class="fa-solid ${badge.icon}"></i>
            </div>
            <div class="badge-details">
                <h5>${badge.title}</h5>
                <p>${badge.desc}</p>
            </div>
        `;
        DOM.badgesContainer.appendChild(badgeEl);
    });

    if (DOM.badgeUnlockedCount) {
        DOM.badgeUnlockedCount.innerText = `${unlockedCount}/${BADGES.length}`;
    }
}

// ========================================================
// 4. SAO LƯU & XUẤT / NHẬP JSON & TỰ TẠO BÀI HỌC
// ========================================================
function exportBackupData() {
    const backup = {
        version: '1.1',
        exportedAt: new Date().toISOString(),
        masteredCards,
        starredCards,
        cardNotes,
        studyHistory,
        currentStreak,
        lastStudyDate: localStorage.getItem('lastStudyDate'),
        customDecks
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `flashcards_backup_${getTodayString()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast("Đã xuất file sao lưu JSON thành công!", "success");
}

function importBackupData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.masteredCards) localStorage.setItem('masteredCards', JSON.stringify(data.masteredCards));
            if (data.starredCards) localStorage.setItem('starredCards', JSON.stringify(data.starredCards));
            if (data.cardNotes) localStorage.setItem('cardNotes', JSON.stringify(data.cardNotes));
            if (data.studyHistory) localStorage.setItem('studyHistory', JSON.stringify(data.studyHistory));
            if (data.customDecks) localStorage.setItem('customDecks', JSON.stringify(data.customDecks));
            if (data.currentStreak) localStorage.setItem('currentStreak', data.currentStreak);
            if (data.lastStudyDate) localStorage.setItem('lastStudyDate', data.lastStudyDate);

            showToast("Khôi phục dữ liệu thành công! Đang làm mới...", "success", 1800);
            setTimeout(() => location.reload(), 1200);
        } catch (err) {
            showToast("File sao lưu không đúng định dạng JSON!", "error");
        }
    };
    reader.readAsText(file);
}

function openCreateCustomDeckModal() {
    editingCustomDeckId = null;
    if (DOM.customDeckModalTitle) {
        DOM.customDeckModalTitle.innerHTML = '<i class="fa-solid fa-plus-circle" style="color:var(--primary); margin-right:8px;"></i>Tạo Bài Học Mới';
    }
    if (DOM.customDeckTitle) DOM.customDeckTitle.value = '';
    if (DOM.customDeckWords) DOM.customDeckWords.value = '';
    if (DOM.saveCustomDeckBtn) DOM.saveCustomDeckBtn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu bài học';
    if (DOM.customDeckModal) DOM.customDeckModal.style.display = 'flex';
}

function openEditCustomDeckModal(deck) {
    if (!deck) return;
    editingCustomDeckId = deck.id;
    if (DOM.customDeckModalTitle) {
        DOM.customDeckModalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:var(--primary); margin-right:8px;"></i>Chỉnh Sửa Bài Học';
    }
    if (DOM.customDeckTitle) {
        DOM.customDeckTitle.value = (deck.ten || '').replace(/^⭐\s*/, '');
    }
    if (DOM.customDeckWords) {
        DOM.customDeckWords.value = (deck.items || [])
            .map(item => `${item.term} | ${item.meaning_vi || ''}${item.ipa ? ' | ' + item.ipa : ''}`)
            .join('\n');
    }
    if (DOM.saveCustomDeckBtn) DOM.saveCustomDeckBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật bài học';
    if (DOM.customDeckModal) DOM.customDeckModal.style.display = 'flex';
}

function deleteCustomDeck(deckId) {
    const targetDeck = customDecks.find(d => d.id === deckId);
    if (!targetDeck) return;
    if (!confirm(`Bạn có chắc muốn xóa bộ thẻ "${targetDeck.ten}" không?`)) return;

    customDecks = customDecks.filter(d => d.id !== deckId);
    localStorage.setItem('customDecks', JSON.stringify(customDecks));

    if (currentDeck && currentDeck.id === deckId) {
        currentDeck = null;
    }

    mergeData();
    populateQuizDecks();
    renderDashboardDecks();
    updateDashboardStats();
    showToast(`Đã xóa bài học "${targetDeck.ten}"`, "info");
}

function saveCustomDeck() {
    const title = (DOM.customDeckTitle.value || '').trim();
    const rawWords = (DOM.customDeckWords.value || '').trim();

    if (!title) {
        showToast("Vui lòng nhập tên chủ đề bài học!", "warning");
        return;
    }

    if (!rawWords) {
        showToast("Vui lòng nhập danh sách từ vựng!", "warning");
        return;
    }

    const existingDeck = editingCustomDeckId ? customDecks.find(d => d.id === editingCustomDeckId) : null;
    const existingByTerm = new Map();
    if (existingDeck && existingDeck.items) {
        existingDeck.items.forEach(it => existingByTerm.set((it.term || '').toLowerCase(), it.id));
    }

    const lines = rawWords.split('\n');
    const items = [];

    lines.forEach((line, idx) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts[0]) {
            const preservedId = existingByTerm.get(parts[0].toLowerCase());
            items.push({
                id: preservedId || `custom_${Date.now()}_${idx}`,
                term: parts[0],
                meaning_vi: parts[1] || 'Chưa có nghĩa',
                ipa: parts[2] || '',
                pos: 'vocab',
                example: `Example with ${parts[0]}`,
                example_vi: ''
            });
        }
    });

    if (items.length === 0) {
        showToast("Không tìm thấy từ vựng hợp lệ nào!", "error");
        return;
    }

    let savedDeck;
    if (existingDeck) {
        existingDeck.ten = `⭐ ${title}`;
        existingDeck.items = items;
        existingDeck.isCustom = true;
        savedDeck = existingDeck;
    } else {
        savedDeck = {
            id: `custom_deck_${Date.now()}`,
            ten: `⭐ ${title}`,
            isCustom: true,
            items: items
        };
        customDecks.push(savedDeck);
    }

    localStorage.setItem('customDecks', JSON.stringify(customDecks));

    const wasEditing = Boolean(editingCustomDeckId);
    editingCustomDeckId = null;
    DOM.customDeckTitle.value = '';
    DOM.customDeckWords.value = '';
    DOM.customDeckModal.style.display = 'none';

    mergeData();
    populateQuizDecks();
    renderDashboardDecks();
    updateDashboardStats();

    if (wasEditing) {
        if (currentDeck && currentDeck.id === savedDeck.id) {
            loadDeck(savedDeck);
        }
        showToast(`Đã cập nhật bài học "${title}" (${items.length} từ)!`, "success");
    } else {
        loadDeck(savedDeck);
        showToast(`Đã tạo bài học "${title}" (${items.length} từ)!`, "success");
        if (typeof confetti !== 'undefined') confetti({ particleCount: 150, spread: 80 });
    }
}

function renderWordSearchList(results, target) {
    if (!target) return;
    target.innerHTML = '';
    if (!results || results.length === 0) {
        target.innerHTML = '<li style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;"><i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>Không tìm thấy từ vựng nào</li>';
        return;
    }

    results.forEach(({ word, deck }) => {
        const li = document.createElement('li');
        li.className = 'deck-item';
        const isM = masteredCards.includes(word.id);
        const isS = starredCards.includes(word.id);
        li.innerHTML = `
            <div class="deck-info" style="width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong style="color: var(--primary); font-size:1.25rem;">${word.term}</strong>
                        ${isS ? '<i class="fa-solid fa-star" style="color:var(--warning); font-size:0.9rem;"></i>' : ''}
                    </div>
                    <span style="font-size:0.75rem; background: var(--primary-light); color: var(--primary); padding:3px 10px; border-radius:12px; font-weight:700;">${word.pos || 'VOCAB'}</span>
                </div>
                <div style="font-size:0.95rem; font-weight:600; color: var(--text-main); margin-bottom: 4px;">${word.meaning_vi}</div>
                <div style="font-size:0.85rem; color: var(--text-muted); display:flex; justify-content:space-between;">
                    <span>Bài: ${deck.ten}</span>
                    <span>${isM ? '<i class="fa-solid fa-check" style="color:var(--success)"></i> Đã thuộc' : ''}</span>
                </div>
            </div>
        `;
        li.addEventListener('click', () => {
            currentDeck = deck;
            const idx = deck.items.findIndex(it => it.id === word.id);
            currentCardIndex = idx >= 0 ? idx : 0;
            const studyBtn = document.querySelector('[data-view="study"]');
            if (studyBtn) studyBtn.click();
            showCard();
        });
        target.appendChild(li);
    });
}

function renderStarredList() {
    if (!DOM.starredList) return;
    const starredItems = [];
    allDecks.forEach(d => {
        if (d.items) {
            d.items.forEach(w => {
                if (starredCards.includes(w.id)) {
                    starredItems.push({ word: w, deck: d });
                }
            });
        }
    });

    if (DOM.studyStarredBtn) {
        DOM.studyStarredBtn.style.display = starredItems.length > 0 ? 'inline-flex' : 'none';
    }

    if (starredItems.length === 0) {
        DOM.starredList.innerHTML = `
            <li style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px 20px;">
                <i class="fa-regular fa-star" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.4; display: block;"></i>
                <h4 style="color: var(--text-main); margin-bottom: 8px;">Chưa có từ vựng nào được đánh dấu sao</h4>
                <p>Trong khi lật flashcard, hãy bấm vào biểu tượng ngôi sao để thêm từ cần ôn lại vào đây.</p>
            </li>
        `;
        return;
    }

    renderWordSearchList(starredItems, DOM.starredList);
}

function studyStarredOnly() {
    const starredItems = [];
    allDecks.forEach(d => {
        if (d.items) {
            d.items.forEach(w => {
                if (starredCards.includes(w.id)) {
                    starredItems.push(w);
                }
            });
        }
    });

    if (starredItems.length === 0) return;
    currentDeck = {
        ten: "⭐ Từ Vựng Cần Ôn Tập",
        items: starredItems
    };
    currentCardIndex = 0;
    const studyBtn = document.querySelector('[data-view="study"]');
    if (studyBtn) studyBtn.click();
    showCard();
}

function setupNavigation() {
    DOM.navItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const v = e.currentTarget.getAttribute('data-view');
            DOM.navItems.forEach(b => b.classList.remove('active'));
            DOM.views.forEach(view => view.classList.remove('active'));
            document.querySelectorAll(`[data-view="${v}"]`).forEach(b => b.classList.add('active'));
            const viewEl = document.getElementById(v + 'View');
            if (viewEl) viewEl.classList.add('active');
            
            if (DOM.viewTitle) {
                const titles = { 
                    'dashboard': 'Trang chủ', 
                    'study': currentDeck ? currentDeck.ten : 'Không gian học', 
                    'quiz': 'Trắc nghiệm phản xạ',
                    'starred': 'Từ vựng yêu thích',
                    'library': 'Kho thư viện', 
                    'settings': 'Cài đặt' 
                };
                DOM.viewTitle.innerText = titles[v] || 'Flashcards';
            }

            if (DOM.viewSubtitle) {
                const subtitles = {
                    'dashboard': 'Học từ vựng thông minh mỗi ngày',
                    'study': 'Chạm thẻ để lật, phím mũi tên để chuyển thẻ',
                    'quiz': 'Chọn đáp án chính xác để nhận điểm thưởng',
                    'starred': 'Tập trung ôn tập những từ bạn đã đánh dấu',
                    'library': 'Tra cứu bài học và danh sách từ vựng',
                    'settings': 'Cá nhân hóa trải nghiệm học tập'
                };
                DOM.viewSubtitle.innerText = subtitles[v] || '';
            }

            const isStudy = (v === 'study' && currentDeck);
            if (DOM.quickShuffleBtn) DOM.quickShuffleBtn.style.display = isStudy ? 'inline-flex' : 'none';
            if (DOM.autoPlayBtn) DOM.autoPlayBtn.style.display = isStudy ? 'inline-flex' : 'none';
            if (DOM.fullscreenBtn) DOM.fullscreenBtn.style.display = isStudy ? 'inline-flex' : 'none';

            if (v !== 'study') {
                if (isAutoPlaying) stopAutoPlay();
                stopPronunciationCheck();
            }

            if (v === 'dashboard') {
                renderDashboardDecks();
            }

            if (v === 'starred') {
                renderStarredList();
            }

            if (v === 'library') {
                performSearch();
            }
        });
    });
}

function loadDeck(deck) {
    currentDeck = deck; 
    currentStudyFilter = 'all';
    applyStudyFilter(currentStudyFilter);
    const studyBtn = document.querySelector('[data-view="study"]');
    if (studyBtn) studyBtn.click();
}

function updateFilterCounters() {
    if (!currentDeck || !currentDeck.items) return;
    const allCount = currentDeck.items.length;
    const masteredCount = currentDeck.items.filter(item => masteredCards.includes(item.id)).length;
    const unmasteredCount = allCount - masteredCount;

    const elAll = document.getElementById('countFilterAll');
    const elUnm = document.getElementById('countFilterUnmastered');
    const elMas = document.getElementById('countFilterMastered');
    if (elAll) elAll.innerText = allCount;
    if (elUnm) elUnm.innerText = unmasteredCount;
    if (elMas) elMas.innerText = masteredCount;

    // Highlight button active
    document.querySelectorAll('.study-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentStudyFilter);
    });
}

function applyStudyFilter(filter) {
    if (!currentDeck || !currentDeck.items) return;
    currentStudyFilter = filter;
    
    if (filter === 'mastered') {
        currentDeckItems = currentDeck.items.filter(item => masteredCards.includes(item.id));
    } else if (filter === 'unmastered') {
        currentDeckItems = currentDeck.items.filter(item => !masteredCards.includes(item.id));
    } else {
        currentDeckItems = [...currentDeck.items];
    }

    currentCardIndex = 0;
    updateFilterCounters();
    showCard();
}

function showCard() {
    if (!currentDeck) return;
    updateFilterCounters();

    if (!currentDeckItems || currentDeckItems.length === 0) {
        if (DOM.cardWord) DOM.cardWord.innerText = 'Không có từ';
        if (DOM.cardIpa) DOM.cardIpa.innerText = '';
        if (DOM.cardCounter) DOM.cardCounter.innerText = '0 / 0';
        if (DOM.cardCounterBack) DOM.cardCounterBack.innerText = '0 / 0';
        if (DOM.cardMeaning) DOM.cardMeaning.innerText = `Chưa có từ nào thuộc nhóm "${currentStudyFilter === 'mastered' ? 'Đã thuộc' : 'Chưa nhớ'}".`;
        if (DOM.cardExampleEn) DOM.cardExampleEn.innerText = '';
        if (DOM.cardExampleVi) DOM.cardExampleVi.innerText = '';
        if (DOM.studyProgressPct) DOM.studyProgressPct.innerText = '0%';
        if (DOM.studyProgressFill) DOM.studyProgressFill.style.width = '0%';
        return;
    }

    if (currentCardIndex >= currentDeckItems.length) currentCardIndex = currentDeckItems.length - 1;
    if (currentCardIndex < 0) currentCardIndex = 0;

    const item = currentDeckItems[currentCardIndex];
    isFlipped = false; 
    if (DOM.flashcard) DOM.flashcard.classList.remove('is-flipped');
    
    const total = currentDeckItems.length;
    const currentNum = currentCardIndex + 1;
    const progressPercent = Math.round((currentNum / total) * 100);

    if (DOM.studyDeckName) DOM.studyDeckName.innerText = currentDeck.ten;
    if (DOM.studyProgressPct) DOM.studyProgressPct.innerText = `${progressPercent}%`;
    if (DOM.studyProgressFill) DOM.studyProgressFill.style.width = `${progressPercent}%`;

    stopPronunciationCheck();
    if (DOM.micFeedback) {
        DOM.micFeedback.style.display = 'none';
        DOM.micFeedback.className = 'mic-feedback';
        DOM.micFeedback.innerHTML = '';
    }

    setTimeout(() => {
        if (DOM.cardWord) DOM.cardWord.innerText = item.term || ''; 
        if (DOM.cardIpa) DOM.cardIpa.innerText = item.ipa || '';
        if (DOM.cardCounter) DOM.cardCounter.innerText = `${currentNum} / ${total}`;
        if (DOM.cardCounterBack) DOM.cardCounterBack.innerText = `${currentNum} / ${total}`;
        if (DOM.cardPos) DOM.cardPos.innerText = item.pos || 'TỪ VỰNG'; 
        if (DOM.cardMeaning) DOM.cardMeaning.innerText = item.meaning_vi || '';
        if (DOM.cardExampleEn) DOM.cardExampleEn.innerText = item.example || 'No example available'; 
        if (DOM.cardExampleVi) DOM.cardExampleVi.innerText = item.example_vi || '';
        if (DOM.speakExampleBtn) {
            DOM.speakExampleBtn.style.display = (item.example && item.example !== 'No example available') ? 'inline-flex' : 'none';
        }
        if (DOM.cardNoteInput) {
            DOM.cardNoteInput.value = cardNotes[item.id] || '';
        }
        
        updateCardStatusUI();
    }, 150);
}

// ========================================================
// KIỂM TRA PHÁT ÂM QUA MICRO (WEB SPEECH RECOGNITION)
// ========================================================
function normalizeSpeechText(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9'\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stopPronunciationCheck() {
    isListeningMic = false;
    if (DOM.micCheckBtn) DOM.micCheckBtn.classList.remove('listening');
    if (speechRecognition) {
        try { speechRecognition.abort(); } catch (e) {}
        speechRecognition = null;
    }
}

function togglePronunciationCheck() {
    if (isListeningMic) {
        stopPronunciationCheck();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge!", "warning");
        return;
    }

    if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
    const targetItem = currentDeckItems[currentCardIndex];
    const expectedNorm = normalizeSpeechText(targetItem.term);

    stopPronunciationCheck();
    isListeningMic = true;
    if (DOM.micCheckBtn) DOM.micCheckBtn.classList.add('listening');
    if (DOM.micFeedback) {
        DOM.micFeedback.style.display = 'inline-flex';
        DOM.micFeedback.className = 'mic-feedback listening';
        DOM.micFeedback.innerHTML = '<i class="fa-solid fa-wave-square"></i> Đang nghe bạn đọc...';
    }

    const recognition = new SpeechRecognition();
    speechRecognition = recognition;
    recognition.lang = voiceAccent === 'UK' ? 'en-GB' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
        const results = event.results[0];
        const transcripts = [];
        for (let i = 0; i < results.length; i++) {
            transcripts.push(results[i].transcript);
        }
        const bestText = transcripts[0] || '';
        const matched = transcripts.some(t => {
            const norm = normalizeSpeechText(t);
            return norm === expectedNorm || norm.includes(expectedNorm) || expectedNorm.includes(norm);
        });

        if (DOM.micFeedback) {
            DOM.micFeedback.style.display = 'inline-flex';
            if (matched) {
                DOM.micFeedback.className = 'mic-feedback success';
                DOM.micFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Chuẩn xác! ("${bestText}")`;
                AudioFX.playCorrect();
            } else {
                DOM.micFeedback.className = 'mic-feedback error';
                DOM.micFeedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Nghe thành: "${bestText}". Thử lại nhé!`;
                AudioFX.playWrong();
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
            showToast("Bạn cần cấp quyền Micro cho trình duyệt để luyện phát âm!", "warning");
        } else if (event.error !== 'aborted') {
            if (DOM.micFeedback) {
                DOM.micFeedback.style.display = 'inline-flex';
                DOM.micFeedback.className = 'mic-feedback error';
                DOM.micFeedback.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> Chưa nghe rõ, bấm micro thử lại!';
            }
        }
    };

    recognition.onend = () => {
        isListeningMic = false;
        if (DOM.micCheckBtn) DOM.micCheckBtn.classList.remove('listening');
        speechRecognition = null;
    };

    try {
        recognition.start();
    } catch (err) {
        stopPronunciationCheck();
        showToast("Không thể khởi động Micro. Hãy thử lại!", "error");
    }
}

function updateCardStatusUI() {
    if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
    const item = currentDeckItems[currentCardIndex];
    const isM = masteredCards.includes(item.id);
    const isS = starredCards.includes(item.id);
    
    if (DOM.cardStatusBadge) {
        DOM.cardStatusBadge.innerText = isM ? 'ĐÃ THUỘC' : 'ĐANG HỌC';
        DOM.cardStatusBadge.style.background = isM ? 'var(--success-light)' : 'var(--bg-card-subtle)';
        DOM.cardStatusBadge.style.color = isM ? 'var(--success)' : 'var(--text-muted)';
    }

    if (DOM.starCardBtn) {
        const starIcon = DOM.starCardBtn.querySelector('i');
        if (isS) {
            DOM.starCardBtn.classList.add('active');
            if (starIcon) starIcon.className = 'fa-solid fa-star';
        } else {
            DOM.starCardBtn.classList.remove('active');
            if (starIcon) starIcon.className = 'fa-regular fa-star';
        }
    }

    if (DOM.masterBtn && DOM.notMasteredBtn) {
        if (isM) {
            DOM.masterBtn.style.background = 'var(--success)';
            DOM.masterBtn.style.color = 'white';
            DOM.masterBtn.style.borderColor = 'var(--success)';
            DOM.notMasteredBtn.style.background = '';
            DOM.notMasteredBtn.style.color = '';
            DOM.notMasteredBtn.style.borderColor = '';
        } else {
            DOM.masterBtn.style.background = '';
            DOM.masterBtn.style.color = '';
            DOM.masterBtn.style.borderColor = '';
            DOM.notMasteredBtn.style.background = 'var(--danger-light)';
            DOM.notMasteredBtn.style.color = 'var(--danger)';
            DOM.notMasteredBtn.style.borderColor = 'var(--danger)';
        }
    }
}

function toggleStarCurrentCard() {
    if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
    const id = currentDeckItems[currentCardIndex].id;
    const idx = starredCards.indexOf(id);
    if (idx > -1) {
        starredCards.splice(idx, 1);
    } else {
        starredCards.push(id);
    }
    localStorage.setItem('starredCards', JSON.stringify(starredCards));
    updateCardStatusUI();
    checkBadges();
}

function shuffleCurrentDeck() {
    if (!currentDeckItems || currentDeckItems.length <= 1) return;
    for (let i = currentDeckItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentDeckItems[i], currentDeckItems[j]] = [currentDeckItems[j], currentDeckItems[i]];
    }
    currentCardIndex = 0;
    AudioFX.playFlip();
    showCard();
    if (typeof confetti !== 'undefined') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    }
}

// ========================================================
// AUTOPLAY MODE (TỰ ĐỘNG PHÁT THẺ & ĐỌC TỪ)
// ========================================================
function toggleAutoPlay() {
    if (isAutoPlaying) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
}

function startAutoPlay() {
    if (!currentDeck || !currentDeck.items || currentDeck.items.length === 0) return;
    isAutoPlaying = true;
    if (DOM.autoPlayBtn) {
        DOM.autoPlayBtn.classList.add('active-autoplay');
        DOM.autoPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Dừng tự động</span>';
    }

    runAutoPlayCycle();
}

function stopAutoPlay() {
    isAutoPlaying = false;
    if (autoPlayTimer) clearTimeout(autoPlayTimer);
    if (DOM.autoPlayBtn) {
        DOM.autoPlayBtn.classList.remove('active-autoplay');
        DOM.autoPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Tự động học</span>';
    }
}

function runAutoPlayCycle() {
    if (!isAutoPlaying) return;

    playWordSound();

    autoPlayTimer = setTimeout(() => {
        if (!isAutoPlaying) return;
        if (DOM.flashcard && !DOM.flashcard.classList.contains('is-flipped')) {
            DOM.flashcard.classList.add('is-flipped');
            AudioFX.playFlip();
        }

        autoPlayTimer = setTimeout(() => {
            if (!isAutoPlaying) return;
            const items = currentDeckItems || (currentDeck ? currentDeck.items : []);
            if (currentCardIndex < items.length - 1) {
                currentCardIndex++;
                showCard();
                autoPlayTimer = setTimeout(runAutoPlayCycle, 800);
            } else {
                stopAutoPlay();
                if (typeof confetti !== 'undefined') confetti({ particleCount: 150, spread: 90 });
            }
        }, 2500);
    }, 2200);
}

// ========================================================
// QUIZ GAME ENGINE
// ========================================================
function startQuiz() {
    const selectedIndex = parseInt(DOM.quizDeckSelect ? DOM.quizDeckSelect.value : 0);
    const deck = allDecks[selectedIndex];
    if (!deck || !deck.items || deck.items.length < 4) {
        showToast("Bộ từ này cần ít nhất 4 từ để chơi trắc nghiệm!", "warning");
        return;
    }

    let shuffledItems = [...deck.items].sort(() => 0.5 - Math.random());
    quizQuestions = shuffledItems.slice(0, Math.min(10, shuffledItems.length)).map(item => {
        const wrongOpts = deck.items
            .filter(i => i.id !== item.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map(i => i.meaning_vi);
        
        const allOpts = [...wrongOpts, item.meaning_vi].sort(() => 0.5 - Math.random());
        return {
            word: item.term,
            pos: item.pos || 'VOCAB',
            correctAnswer: item.meaning_vi,
            options: allOpts
        };
    });

    currentQuizIndex = 0;
    quizScore = 0;
    DOM.quizStartPanel.style.display = 'none';
    DOM.quizResultPanel.style.display = 'none';
    DOM.quizPlayPanel.style.display = 'block';

    renderQuizStep();
}

function renderQuizStep() {
    if (currentQuizIndex >= quizQuestions.length) {
        finishQuiz();
        return;
    }

    quizAnswering = false;
    const q = quizQuestions[currentQuizIndex];
    if (DOM.quizCurrentStep) DOM.quizCurrentStep.innerText = currentQuizIndex + 1;
    if (DOM.quizTotalStep) DOM.quizTotalStep.innerText = quizQuestions.length;
    if (DOM.quizScore) DOM.quizScore.innerText = quizScore;
    if (DOM.quizPosTag) DOM.quizPosTag.innerText = q.pos;
    if (DOM.quizQuestionWord) DOM.quizQuestionWord.innerText = q.word;

    playWordSound(q.word);

    if (DOM.quizOptionsGrid) {
        DOM.quizOptionsGrid.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-opt-btn';
            btn.innerText = opt;
            btn.addEventListener('click', () => handleQuizAnswer(opt, btn, q.correctAnswer));
            DOM.quizOptionsGrid.appendChild(btn);
        });
    }
}

function handleQuizAnswer(selectedOpt, btnEl, correctOpt) {
    if (quizAnswering) return;
    quizAnswering = true;

    const allButtons = DOM.quizOptionsGrid.querySelectorAll('.quiz-opt-btn');
    if (selectedOpt === correctOpt) {
        btnEl.classList.add('correct');
        AudioFX.playCorrect();
        quizScore += 10;
        if (DOM.quizScore) DOM.quizScore.innerText = quizScore;
        noiLua();
    } else {
        btnEl.classList.add('wrong');
        AudioFX.playWrong();
        allButtons.forEach(b => {
            if (b.innerText === correctOpt) b.classList.add('correct');
        });
    }

    setTimeout(() => {
        currentQuizIndex++;
        renderQuizStep();
    }, 1100);
}

function finishQuiz() {
    DOM.quizPlayPanel.style.display = 'none';
    DOM.quizResultPanel.style.display = 'block';

    const totalPossible = quizQuestions.length * 10;
    if (DOM.quizFinalScore) DOM.quizFinalScore.innerText = `${quizScore} / ${totalPossible}`;

    let feedback = "Hãy tiếp tục cố gắng hơn nhé!";
    if (quizScore === totalPossible) {
        feedback = "Xuất sắc tuyệt đối! Bạn nhớ hết 100% từ vựng!";
        if (typeof confetti !== 'undefined') confetti({ particleCount: 200, spread: 100 });
    } else if (quizScore >= totalPossible * 0.7) {
        feedback = "Làm rất tốt! Bạn đã nắm vững hầu hết các từ.";
        if (typeof confetti !== 'undefined') confetti({ particleCount: 100, spread: 70 });
    }
    if (DOM.quizScoreFeedback) DOM.quizScoreFeedback.innerText = feedback;
}

function performSearch() {
    const kw = (DOM.searchInput ? DOM.searchInput.value : '').toLowerCase().trim();
    
    if (currentSearchFilter === 'decks') {
        const filteredDecks = allDecks.filter(d => d.ten.toLowerCase().includes(kw));
        renderDeckList(filteredDecks, DOM.libraryList);
    } else if (currentSearchFilter === 'words') {
        const wordResults = [];
        allDecks.forEach(d => {
            if (d.items) {
                d.items.forEach(w => {
                    if (w.term.toLowerCase().includes(kw) || (w.meaning_vi && w.meaning_vi.toLowerCase().includes(kw))) {
                        wordResults.push({ word: w, deck: d });
                    }
                });
            }
        });
        renderWordSearchList(wordResults, DOM.libraryList);
    } else {
        if (!kw) {
            renderDeckList(allDecks, DOM.libraryList);
            return;
        }
        const filteredDecks = allDecks.filter(d => d.ten.toLowerCase().includes(kw));
        const wordResults = [];
        allDecks.forEach(d => {
            if (d.items) {
                d.items.forEach(w => {
                    if (w.term.toLowerCase().includes(kw) || (w.meaning_vi && w.meaning_vi.toLowerCase().includes(kw))) {
                        wordResults.push({ word: w, deck: d });
                    }
                });
            }
        });

        if (wordResults.length > 0) {
            renderWordSearchList(wordResults, DOM.libraryList);
        } else {
            renderDeckList(filteredDecks, DOM.libraryList);
        }
    }
}

function setupEventListeners() {
    if (DOM.flashcard) {
        DOM.flashcard.addEventListener('click', (e) => {
            if (
                e.target.closest('.card-quick-speak') ||
                e.target.closest('.card-mic-btn') ||
                e.target.closest('.example-speak-btn') ||
                e.target.closest('.card-note-box') ||
                e.target.closest('.card-star-btn') ||
                e.target.closest('.control-btn') ||
                window.getSelection().toString().length > 0
            ) return;
            DOM.flashcard.classList.toggle('is-flipped');
            isFlipped = !isFlipped;
            AudioFX.playFlip();
        });
    }

    if (DOM.frontSpeakBtn) {
        DOM.frontSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playWordSound();
        });
    }

    if (DOM.micCheckBtn) {
        DOM.micCheckBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePronunciationCheck();
        });
    }

    if (DOM.speakExampleBtn) {
        DOM.speakExampleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentDeckItems && currentDeckItems[currentCardIndex] && currentDeckItems[currentCardIndex].example) {
                playWordSound(currentDeckItems[currentCardIndex].example);
            }
        });
    }

    if (DOM.cardNoteInput) {
        DOM.cardNoteInput.addEventListener('click', (e) => e.stopPropagation());
        DOM.cardNoteInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                DOM.cardNoteInput.blur();
                showToast("Đã lưu ghi chú mẹo nhớ!", "success", 1800);
            }
        });
        DOM.cardNoteInput.addEventListener('input', () => {
            if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
            const id = currentDeckItems[currentCardIndex].id;
            const val = DOM.cardNoteInput.value.trim();
            if (val) {
                cardNotes[id] = val;
            } else {
                delete cardNotes[id];
            }
            localStorage.setItem('cardNotes', JSON.stringify(cardNotes));
        });
    }

    // Lọc bài học ngay ngoài Trang chủ
    document.querySelectorAll('.dash-filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentDashboardFilter = e.currentTarget.dataset.dashFilter || 'all';
            currentCarouselIndex = 0;
            renderDashboardDecks();
        });
    });

    if (DOM.starCardBtn) {
        DOM.starCardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStarCurrentCard();
        });
    }

    if (DOM.quickShuffleBtn) {
        DOM.quickShuffleBtn.addEventListener('click', () => {
            shuffleCurrentDeck();
        });
    }

    if (DOM.autoPlayBtn) {
        DOM.autoPlayBtn.addEventListener('click', () => {
            toggleAutoPlay();
        });
    }

    if (DOM.studyStarredBtn) {
        DOM.studyStarredBtn.addEventListener('click', () => {
            studyStarredOnly();
        });
    }

    // Chuyển đổi chế độ xem: Lướt 3D vs Xem tất cả (Grid)
    if (DOM.modeCarouselBtn && DOM.modeGridBtn) {
        DOM.modeCarouselBtn.addEventListener('click', () => {
            DOM.modeCarouselBtn.classList.add('active');
            DOM.modeGridBtn.classList.remove('active');
            if (DOM.deckCarouselStage) DOM.deckCarouselStage.style.display = 'flex';
            if (DOM.deckList) DOM.deckList.style.display = 'none';
        });

        DOM.modeGridBtn.addEventListener('click', () => {
            DOM.modeGridBtn.classList.add('active');
            DOM.modeCarouselBtn.classList.remove('active');
            if (DOM.deckCarouselStage) DOM.deckCarouselStage.style.display = 'none';
            if (DOM.deckList) DOM.deckList.style.display = 'grid';
        });
    }

    // Modal tạo bài học
    // Carousel Events (Lướt dọc & Bấm nút)
    if (DOM.carouselPrevBtn) {
        DOM.carouselPrevBtn.addEventListener('click', () => {
            navigateCarouselTo(currentCarouselIndex - 1);
        });
    }
    if (DOM.carouselNextBtn) {
        DOM.carouselNextBtn.addEventListener('click', () => {
            navigateCarouselTo(currentCarouselIndex + 1);
        });
    }

    // Cuộn chuột (Mouse Wheel) để lướt thẻ
    if (DOM.deckCarouselTrack) {
        let isWheelThrottled = false;
        DOM.deckCarouselTrack.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (isWheelThrottled) return;
            isWheelThrottled = true;
            if (e.deltaY > 0) {
                navigateCarouselTo(currentCarouselIndex + 1);
            } else if (e.deltaY < 0) {
                navigateCarouselTo(currentCarouselIndex - 1);
            }
            setTimeout(() => { isWheelThrottled = false; }, 300);
        }, { passive: false });

        // Hỗ trợ Touch Swipe dọc trên điện thoại
        let touchStartY = 0;
        let touchEndY = 0;
        DOM.deckCarouselTrack.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        DOM.deckCarouselTrack.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            const diff = touchStartY - touchEndY;
            if (Math.abs(diff) > 40) {
                if (diff > 0) {
                    navigateCarouselTo(currentCarouselIndex + 1); // vuốt lên -> thẻ kế tiếp
                } else {
                    navigateCarouselTo(currentCarouselIndex - 1); // vuốt xuống -> thẻ trước
                }
            }
        }, { passive: true });
    }

    if (DOM.openCustomDeckModalBtn) {
        DOM.openCustomDeckModalBtn.addEventListener('click', openCreateCustomDeckModal);
    }
    if (DOM.closeCustomDeckModalBtn) {
        DOM.closeCustomDeckModalBtn.addEventListener('click', () => {
            DOM.customDeckModal.style.display = 'none';
        });
    }
    if (DOM.cancelCustomDeckBtn) {
        DOM.cancelCustomDeckBtn.addEventListener('click', () => {
            DOM.customDeckModal.style.display = 'none';
        });
    }
    if (DOM.saveCustomDeckBtn) {
        DOM.saveCustomDeckBtn.addEventListener('click', saveCustomDeck);
    }

    // Backup & Restore
    if (DOM.exportDataBtn) DOM.exportDataBtn.addEventListener('click', exportBackupData);
    if (DOM.importDataBtn) {
        DOM.importDataBtn.addEventListener('click', () => {
            if (DOM.importFileInput) DOM.importFileInput.click();
        });
    }
    if (DOM.importFileInput) {
        DOM.importFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importBackupData(e.target.files[0]);
            }
        });
    }

    // Quiz events
    if (DOM.startQuizBtn) DOM.startQuizBtn.addEventListener('click', startQuiz);
    if (DOM.retryQuizBtn) DOM.retryQuizBtn.addEventListener('click', startQuiz);
    if (DOM.backToDeckQuizBtn) {
        DOM.backToDeckQuizBtn.addEventListener('click', () => {
            DOM.quizResultPanel.style.display = 'none';
            DOM.quizStartPanel.style.display = 'block';
        });
    }
    if (DOM.quizSpeakBtn) {
        DOM.quizSpeakBtn.addEventListener('click', () => {
            const q = quizQuestions[currentQuizIndex];
            if (q) playWordSound(q.word);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const studyView = document.getElementById('studyView');
        if (!studyView || !studyView.classList.contains('active')) return;
        
        if (e.code === 'Space') { 
            e.preventDefault(); 
            if (DOM.flashcard) DOM.flashcard.classList.toggle('is-flipped');
            isFlipped = !isFlipped;
            AudioFX.playFlip();
        } 
        else if (e.key === 'ArrowRight') { if (DOM.nextBtn) DOM.nextBtn.click(); }
        else if (e.key === 'ArrowLeft') { if (DOM.prevBtn) DOM.prevBtn.click(); }
        else if (e.key === 'Enter') { if (DOM.masterBtn) DOM.masterBtn.click(); }
    });

    // Bộ lọc thẻ học (Tất cả / Chưa nhớ / Đã thuộc)
    document.querySelectorAll('.study-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            applyStudyFilter(filter);
        });
    });

    if (DOM.nextBtn) {
        DOM.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            noiLua();
            if (currentDeckItems && currentCardIndex < currentDeckItems.length - 1) { 
                currentCardIndex++; 
                showCard(); 
            } else {
                if (typeof confetti !== 'undefined') confetti({ particleCount: 160, spread: 80 });
            }
        });
    }

    if (DOM.prevBtn) {
        DOM.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentDeckItems && currentCardIndex > 0) { 
                currentCardIndex--; 
                showCard(); 
            }
        });
    }

    if (DOM.speakBtn) {
        DOM.speakBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            playWordSound(); 
        });
    }

    if (DOM.masterBtn) {
        DOM.masterBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            noiLua();
            if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
            const id = currentDeckItems[currentCardIndex].id;
            if (!masteredCards.includes(id)) { 
                masteredCards.push(id); 
                localStorage.setItem('masteredCards', JSON.stringify(masteredCards)); 
                updateDashboardStats(); 
                checkBadges();
            }
            updateCardStatusUI();
            updateFilterCounters();
        });
    }

    if (DOM.notMasteredBtn) {
        DOM.notMasteredBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentDeckItems || !currentDeckItems[currentCardIndex]) return;
            const id = currentDeckItems[currentCardIndex].id;
            const idx = masteredCards.indexOf(id);
            if (idx > -1) { 
                masteredCards.splice(idx, 1); 
                localStorage.setItem('masteredCards', JSON.stringify(masteredCards)); 
                updateDashboardStats(); 
                checkBadges();
            }
            updateCardStatusUI();
            updateFilterCounters();
        });
    }

    if (DOM.themeSwitch) {
        DOM.themeSwitch.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            updateHeaderThemeIcon(theme);
        });
    }

    if (DOM.headerThemeBtn) {
        DOM.headerThemeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const nextTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
            if (DOM.themeSwitch) DOM.themeSwitch.checked = (nextTheme === 'dark');
            updateHeaderThemeIcon(nextTheme);
        });
    }

    if (DOM.fullscreenBtn) {
        DOM.fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
                DOM.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i> <span>Thu nhỏ</span>';
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                DOM.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>Toàn màn hình</span>';
            }
        });
    }

    if (DOM.heroContinueBtn) {
        DOM.heroContinueBtn.addEventListener('click', () => {
            if (allDecks.length > 0) {
                loadDeck(allDecks[0]);
            }
        });
    }

    if (DOM.heroQuickQuizBtn) {
        DOM.heroQuickQuizBtn.addEventListener('click', () => {
            const quizNav = document.querySelector('[data-view="quiz"]');
            if (quizNav) quizNav.click();
        });
    }

    if (DOM.voiceAccentSelect) {
        DOM.voiceAccentSelect.addEventListener('change', (e) => {
            voiceAccent = e.target.value || 'US';
            localStorage.setItem('voiceAccent', voiceAccent);
            initVoices();
        });
    }

    if (DOM.sfxSwitch) {
        DOM.sfxSwitch.addEventListener('change', (e) => {
            sfxEnabled = e.target.checked;
            localStorage.setItem('sfxEnabled', sfxEnabled);
        });
    }

    if (DOM.speechRateSelect) {
        DOM.speechRateSelect.addEventListener('change', (e) => {
            speechRate = parseFloat(e.target.value) || 0.9;
            localStorage.setItem('speechRate', speechRate);
        });
    }

    if (DOM.resetStatsBtn) {
        DOM.resetStatsBtn.addEventListener('click', () => {
            if (confirm("Bạn có chắc muốn xóa toàn bộ tiến độ học tập và chuỗi ngày không?")) { 
                localStorage.removeItem('masteredCards');
                localStorage.removeItem('starredCards');
                localStorage.removeItem('studyHistory');
                localStorage.removeItem('currentStreak');
                localStorage.removeItem('lastStudyDate');
                masteredCards = [];
                starredCards = [];
                studyHistory = {};
                currentStreak = 0;
                updateDashboardStats();
                checkStreak();
                renderActivityHeatmap();
                checkBadges();
                renderDashboardDecks();
                showToast("Đã thiết lập lại tiến độ học!", "success");
            }
        });
    }

    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', () => {
            performSearch();
        });
    }

    if (DOM.filterPills) {
        DOM.filterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                DOM.filterPills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                currentSearchFilter = e.currentTarget.getAttribute('data-filter');
                performSearch();
            });
        });
    }
}

function updateDashboardStats() {
    if (DOM.statMastered) DOM.statMastered.innerText = masteredCards.length;
    let total = 0; 
    allDecks.forEach(d => { if (d && d.items) total += d.items.length; });
    if (total > 0 && DOM.statProgress) {
        DOM.statProgress.innerText = `${Math.round((masteredCards.length / total) * 100)}%`;
    }
}

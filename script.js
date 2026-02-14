// ---------- Utilities & storage keys ----------
const STORAGE_KEYS = {
    HABITS: 'ht_habits_v1',
    XP: 'ht_xp_v1',
    COINS: 'ht_coins_v1',
    MOOD: 'ht_mood_v1',
    THEMES: 'ht_themes_v1',
    LAST_LOGIN: 'ht_last_login_v1'
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

// ---------- Default sample data ----------
const sampleHabits = [{
    id: idGen(),
    name: 'Morning run',
    category: 'Fitness',
    progress: 0,
    streak: 3,
    lastDone: '2 days',
    isDaily: true,
    completedToday: false
}, {
    id: idGen(),
    name: 'Read 30 min',
    category: 'Study',
    progress: 0,
    streak: 7,
    lastDone: 'today',
    isDaily: true,
    completedToday: false
}, {
    id: idGen(),
    name: 'One-off Task',
    category: 'Work',
    progress: 0,
    streak: 0,
    lastDone: 'never',
    isDaily: false, // Default one-off behavior
    completedToday: false
}];

// ---------- App state ----------
let state = {
    habits: load(STORAGE_KEYS.HABITS) || sampleHabits,
    xp: Number(load(STORAGE_KEYS.XP) || 0),
    coins: Number(load(STORAGE_KEYS.COINS) || 0),
    mood: load(STORAGE_KEYS.MOOD) || null,
    unlockedThemes: [...new Set((load(STORAGE_KEYS.THEMES) || ['default']).concat(['ocean', 'midnight']))],
    lastLogin: load(STORAGE_KEYS.LAST_LOGIN) || new Date().toDateString()
};

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
    checkDailyReset();
    renderDate();
    renderUI();
    bindControls();
    applyTheme('default');
    showToast('Welcome — your data is saved locally.');
});

// ---------- Daily Reset Key Logic ----------
function checkDailyReset() {
    const today = new Date().toDateString();
    if (state.lastLogin !== today) {
        state.habits.forEach(h => {
            if (h.isDaily) {
                h.completedToday = false;
                h.progress = 0; // Reset progress for daily tasks
            }
        });
        state.lastLogin = today;
        persist();
        showToast('Daily tasks reset for a new day! ☀️');
    }
}

// ---------- Render helpers ----------
function renderDate() {
    const d = new Date();
    const opts = {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    };
    $('#todayDate').textContent = d.toLocaleDateString(undefined, opts);
}

function renderUI() {
    renderHabits();
    updateHeaderStreak();
    $('#xpCount').textContent = state.xp;
    $('#coinCount').textContent = state.coins;
    updateXPMeter();
    renderMood();
    renderUnlockedThemes();
}

function renderHabits() {
    const list = $('#habitList');
    list.innerHTML = '';
    const tpl = $('#cardTpl').content;
    const search = $('#searchInput').value.trim().toLowerCase();
    const activeCat = $('.chip.active')?.dataset?.cat || 'All';
    let items = state.habits.slice();

    // filters
    if (activeCat && activeCat !== 'All') items = items.filter(h => h.category === activeCat);
    if (search) items = items.filter(h => h.name.toLowerCase().includes(search) || h.category.toLowerCase().includes(search));

    // Focus mode
    const focus = $('#focusToggle').checked;
    if (focus) items = items.sort((a, b) => b.streak - a.streak).slice(0, 3);

    // render
    items.forEach(h => {
        const node = tpl.cloneNode(true);
        const html = node.querySelector('.card');
        html.dataset.id = h.id;

        // Checklist/Daily styling
        if (h.isDaily) {
            html.classList.add('daily-task');
            if (h.completedToday) html.classList.add('completed-daily');
        }

        html.querySelector('.tag').textContent = h.category + (h.isDaily ? ' • Daily' : '');
        html.querySelector('.name').textContent = h.name;

        // Simplify streak/last done text for clarity
        const metaText = h.isDaily
            ? `Streak: <strong>${h.streak}</strong>`
            : `One-off Task`;
        html.querySelector('small.muted').innerHTML = metaText;

        html.querySelector('.progress i').style.width = (h.completedToday ? 100 : h.progress) + '%';
        html.querySelector('.progress + .muted').textContent = (h.completedToday ? 100 : h.progress) + '% complete';

        // Action Button Logic
        const accBtn = html.querySelector('.doneBtn');
        if (h.isDaily && h.completedToday) {
            accBtn.textContent = 'Completed';
            accBtn.disabled = true;
            accBtn.style.opacity = '0.6';
            accBtn.style.cursor = 'default';
        } else {
            accBtn.textContent = '✅ Done';
            accBtn.onclick = () => onDone(h.id);
        }

        list.appendChild(node);
    });

    // if no items
    if (items.length === 0) {
        list.innerHTML = `<div class="card center" style="padding:26px;flex-direction:column"><strong>No habits</strong><div class="muted" style="margin-top:8px">Try adding a habit or remove filters</div></div>`;
    }
}

function updateHeaderStreak() {
    const best = state.habits.reduce((m, h) => Math.max(m, h.streak), 0);
    $('#headerStreak').textContent = `${best} 🔥`;
}

function updateXPMeter() {
    const pct = Math.min(100, (state.xp % 200) / 2); // playful meter
    $('#xpMeter').style.width = pct + '%';
}

function renderMood() {
    $('#moodLabel').textContent = state.mood ? (['', '😤', '😔', '😐', '😄'][state.mood] + ' ') : '—';
    $$('.mood button').forEach(btn => btn.classList.toggle('active', btn.dataset.mood == state.mood));
}

function renderUnlockedThemes() {
    const target = $('#unlockedThemes');
    target.innerHTML = '';
    state.unlockedThemes.forEach(t => {
        const el = document.createElement('div');
        el.className = 'chip';
        el.textContent = t;
        target.appendChild(el);
    })
    // update theme select availability
    $$('#themeSelect option').forEach(opt => opt.disabled = !state.unlockedThemes.includes(opt.value) && opt.value !== 'default');
}

// ---------- Actions ----------
function onDone(id) {
    const h = findHabit(id);
    if (!h) return;

    // Apply rewards
    state.xp += 10;
    state.coins += 2;

    if (h.isDaily) {
        // Daily Task Logic: Mark complete, boost streak, DO NOT DELETE
        if (!h.completedToday) {
            h.completedToday = true;
            h.streak += 1;
            h.lastDone = 'today';
            h.progress = 100;
            showToast(`Daily task completed! +10 XP`);
        }
    } else {
        // One-off Logic: Delete immediately
        state.habits = state.habits.filter(habit => habit.id !== id);
        showToast(`Task completed & removed! +10 XP`);
    }

    persist();
    renderUI();
}

// ---------- CRUD & helpers ----------
function findHabit(id) {
    return state.habits.find(h => h.id == id);
}

function addHabit(h) {
    state.habits.unshift(h);
    persist();
    renderUI();
}

function idGen() {
    return 'h_' + Math.random().toString(36).slice(2, 9);
}

function persist() {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
    localStorage.setItem(STORAGE_KEYS.XP, state.xp);
    localStorage.setItem(STORAGE_KEYS.COINS, state.coins);
    localStorage.setItem(STORAGE_KEYS.MOOD, state.mood || '');
    localStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(state.unlockedThemes));
    localStorage.setItem(STORAGE_KEYS.LAST_LOGIN, state.lastLogin);
}

function load(k) {
    try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null
    } catch (e) {
        return null
    }
}

// ---------- UI bindings ----------
function bindControls() {
    // search
    $('#searchInput').addEventListener('input', debounce(() => renderHabits(), 180));

    // filter chips
    $$('#filters .chip').forEach(ch => ch.addEventListener('click', (e) => {
        $$('#filters .chip').forEach(c => c.classList.remove('active'));
        ch.classList.add('active');
        renderHabits();
    }));

    // add habit
    $('#addHabitBtn').addEventListener('click', () => openHabitForm());

    // habit form handlers
    $('#cancelHabit').addEventListener('click', closeHabitForm);
    $('#closeHabitModal').addEventListener('click', closeHabitForm);
    document.getElementById('habitForm').addEventListener('submit', handleHabitFormSubmit);

    // helper: populate categories from filter chips (keeps them in sync)
    (function syncCategories() {
        const select = $('#habitCategory');
        select.innerHTML = Array.from($$('#filters .chip')).map(c => `<option value="${c.dataset.cat}">${c.dataset.cat}</option>`).join('');
    })();

    $('#addDemoBtn').addEventListener('click', () => {
        state.habits.unshift({
            id: idGen(),
            name: 'New Demo Habit',
            category: 'Study',
            progress: 0,
            streak: 0,
            lastDone: 'never',
            isDaily: false
        });
        persist();
        renderUI();
        showToast('Demo habit added');
    });

    // focus toggle
    $('#focusToggle').addEventListener('change', () => {
        renderHabits();
        showToast($('#focusToggle').checked ? 'Focus Mode on — showing top 3' : 'Focus Mode off');
    });

    // Start Challenge
    $('#startChallengeBtn').addEventListener('click', () => openChallengeDialog());

    // mood selector
    $$('.mood button').forEach(b => b.addEventListener('click', () => {
        state.mood = Number(b.dataset.mood);
        persist();
        renderMood();
        showToast('Mood saved');
    }));

    // claim reward
    $('#claimRewardBtn').addEventListener('click', () => {
        if (state.coins >= 30) {
            state.coins -= 30;
            state.unlockedThemes.push('sunset');
            state.unlockedThemes = Array.from(new Set(state.unlockedThemes));
            persist();
            renderUI();
            showToast('Reward claimed — Sunset theme unlocked!');
        } else showToast('Not enough coins — earn more by completing habits', 1800);
    });

    $('#themeSelect').addEventListener('change', (e) => {
        const t = e.target.value;
        if (!state.unlockedThemes.includes(t) && t !== 'default') {
            showToast('Theme locked — claim with rewards');
            e.target.value = 'default';
            return;
        }
        applyTheme(t);
        showToast('Theme applied');
    });

    $('#resetBtn').addEventListener('click', () => {
        if (confirm('Reset today progress?')) {
            state.habits.forEach(h => {
                h.progress = 0;
                h.streak = 0;
                h.lastDone = 'never';
                h.completedToday = false;
            });
            state.xp = 0;
            state.coins = 0;
            persist();
            renderUI();
            showToast('Day reset');
        }
    });

    $('#startChallengeBtn').addEventListener('contextmenu', e => {
        e.preventDefault();
        openChallengeDialog();
    });

    $('#claimRewardBtn').addEventListener('dblclick', () => { // secret: unlock all
        state.coins += 50;
        state.xp += 100;
        state.unlockedThemes.push('ocean', 'midnight');
        persist();
        renderUI();
        showToast('Secret bonus!');
    });
}

// ---------- Challenge modal (simple) ----------
function openChallengeDialog() {
    const habitNames = state.habits.map(h => h.name).join('\n');
    const pick = prompt('Start a challenge for which habit?\nPick exact name from list:\n' + habitNames + '\n\nOr leave blank to pick the first habit.');
    const target = state.habits.find(h => h.name === pick) || state.habits[0];
    if (!target) {
        showToast('No habit available');
        return;
    }
    const days = prompt('Choose challenge length: 7, 21, 30', '7');
    const len = [7, 21, 30].includes(Number(days)) ? Number(days) : 7;
    target.challenge = {
        length: len,
        started: Date.now(),
        progress: 0
    };
    persist();
    renderUI();
    showToast(`${len}-day challenge started for ${target.name}`);
}

// ---------- Habit creation form (validated) ----------
function openHabitForm() {
    const modal = $('#habitModal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    $('#habitFormError').style.display = 'none';
    $('#habitForm').reset();
    // sensible defaults
    $('#habitStartProgress').value = 0;
    $('#habitName').focus();
    $('#habitIsDaily').checked = true; // Default to daily for convenience
}

function closeHabitForm() {
    const modal = $('#habitModal');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function handleHabitFormSubmit(e) {
    e.preventDefault();
    const name = $('#habitName').value.trim();
    const category = $('#habitCategory').value || 'Other';
    const startProgress = Number($('#habitStartProgress').value) || 0;
    const isDaily = $('#habitIsDaily').checked;

    const errEl = $('#habitFormError');
    errEl.style.display = 'none';
    errEl.textContent = '';

    // validation
    if (!name) {
        errEl.style.display = 'block';
        errEl.textContent = 'Please enter a habit name.';
        return;
    }
    if (startProgress < 0 || startProgress > 100) {
        errEl.style.display = 'block';
        errEl.textContent = 'Start progress must be 0–100.';
        return;
    }

    const newHabit = {
        id: idGen(),
        name,
        category,
        progress: Math.min(100, Math.max(0, startProgress)),
        streak: 0,
        lastDone: 'never',
        isDaily: isDaily,
        completedToday: false
    };

    addHabit(newHabit);
    closeHabitForm();
    showToast('Habit added — ' + name);
}

// ---------- Theme handling ----------
function applyTheme(name) {
    document.documentElement.style.setProperty('--accent', name === 'sunset' ? '#ff6b81' : name === 'ocean' ? '#2bb7f5' : name === 'midnight' ? '#6b7bff' : '#6b5cff');
    document.body.style.background = name === 'sunset' ? 'linear-gradient(135deg,#fff7f2,#fff1f8)' : name === 'ocean' ? 'linear-gradient(135deg,#f1fbff,#eef9ff)' : name === 'midnight' ? 'linear-gradient(135deg,#0f1724,#0b1220)' : 'linear-gradient(135deg,#f7faff,#fff7fb)';
    if (name === 'midnight') {
        document.documentElement.style.setProperty('--card', 'rgba(12,16,30,0.6)');
        document.documentElement.style.setProperty('--muted', '#9aa6c7');
        document.documentElement.style.setProperty('--bg1', '#07070a');
        document.documentElement.style.setProperty('--bg2', '#0b0f1b');
        document.body.style.color = '#e6eef8';
    } else {
        document.documentElement.style.setProperty('--card', 'rgba(255,255,255,0.75)');
        document.documentElement.style.setProperty('--muted', '#98a0b3');
        document.body.style.color = '#0b1220';
    }
    persistThemeChoice(name);
}

function persistThemeChoice(name) {
    localStorage.setItem('ht_theme_choice', name);
}

// ---------- Small helpers ----------
function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function debounce(fn, wait = 120) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
    };
}

function showToast(msg, timeout = 1400) {
    const wrap = $('#toastWrap');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(12px) scale(.98)';
        setTimeout(() => el.remove(), 300);
    }, timeout);
}

function idGen() {
    return 'h_' + Math.random().toString(36).slice(2, 9);
} // duplicated intentionally to keep template simple

// expose helpers to console for testing
window.HT = {
    state,
    persist,
    addHabit,
    renderUI
};

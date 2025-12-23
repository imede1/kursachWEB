// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
// ⬇️ ВСТАВЬ СЮДА СВОЮ ССЫЛКУ С RENDER (без слеша в конце) ⬇️
const API_URL = 'https://tvoy-backend-app.onrender.com'; 

const scheduleStartDate = new Date('2025-09-01T00:00:00'); 

// Расписание (оставляем статичным, т.к. оно редко меняется)
const scheduleData = {
    numerator: {
        'Понедельник': [ { t:'08:30', n:'Мат. Анализ (Лек)', r:'305' }, { t:'10:15', n:'Программирование', r:'201' } ],
        'Вторник': [ { t:'08:30', n:'Английский яз.', r:'108' }, { t:'12:00', n:'Алгоритмы', r:'201' } ],
        'Среда': [ { t:'08:30', n:'Веб-технологии', r:'205' }, { t:'12:00', n:'Физкультура', r:'Спортзал' } ],
        'Четверг': [ { t:'08:30', n:'История', r:'115' } ],
        'Пятница': [ { t:'08:30', n:'Проектирование ПО', r:'205' } ]
    },
    denominator: {
        'Понедельник': [ { t:'08:30', n:'Мат. Анализ (Прак)', r:'305' }, { t:'12:00', n:'Физика', r:'412' } ],
        'Вторник': [ { t:'10:15', n:'Базы данных', r:'203' } ],
        'Среда': [ { t:'10:15', n:'Математика', r:'305' } ],
        'Четверг': [ { t:'10:15', n:'Комп. сети', r:'203' } ],
        'Пятница': [ { t:'10:15', n:'Дискретная мат.', r:'305' } ]
    }
};

let currentUser = null;
let isLoginMode = true;
let currDate = new Date();
let currMonth = currDate.getMonth();
let currYear = currDate.getFullYear();
let chatInterval = null;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    
    // Проверка, если пользователь уже вошел
    const saved = localStorage.getItem('currentUser');
    if(saved) {
        try {
            currentUser = JSON.parse(saved);
            showDashboard();
            initApp();
        } catch(e) {
            localStorage.removeItem('currentUser');
        }
    }
});

function initApp() {
    updateClock();
    setInterval(updateClock, 1000);
    renderSchedule();
    initTabs();
    initCalendar();
    
    // --- ПОДКЛЮЧЕНИЕ МОДУЛЕЙ С БАЗОЙ ДАННЫХ ---
    
    // 1. Загрузка задач пользователя
    initTasks();
    
    // 2. Запуск чата (с автообновлением)
    initChat();
    
    // 3. Загрузка списка участников (С ИСПРАВЛЕНИЕМ)
    initContacts();

    // 4. Загрузка списков (Домашка, Новости и т.д.)
    initGenericList('homework', '/api/homework', ['subject', 'task', 'deadline'], renderHomeworkItem);
    initGenericList('news', '/api/news', ['title', 'content'], renderNewsItem);
    initGenericList('events', '/api/events', ['title', 'event_date', 'location'], renderEventItem);
    initGenericList('feedback', '/api/feedback', ['category', 'subject', 'message'], renderFeedbackItem);
}

// ==========================================
// АВТОРИЗАЦИЯ
// ==========================================
function initAuth() {
    // Переключение Вход / Регистрация
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('authSubmit').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
        document.getElementById('authSwitchText').textContent = isLoginMode ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
        document.getElementById('registerFields').style.display = isLoginMode ? 'none' : 'block';
    });

    // Отправка формы
    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('authUsername').value;
        const password = document.getElementById('authPassword').value;
        const fullName = document.getElementById('authFullName').value;

        const endpoint = isLoginMode ? '/login' : '/register';
        const body = isLoginMode ? { username, password } : { username, password, fullName };

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (res.ok) {
                if (isLoginMode) {
                    login(data);
                } else {
                    alert('Регистрация успешна! Теперь войдите.');
                    // Переключаем на вход
                    isLoginMode = true;
                    document.getElementById('authSubmit').textContent = 'Войти';
                    document.getElementById('registerFields').style.display = 'none';
                    document.getElementById('authSwitchText').textContent = 'Нет аккаунта?';
                }
            } else {
                alert(data.message || 'Ошибка выполнения запроса');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка подключения к серверу. Проверьте API_URL.');
        }
    });

    // Гостевой вход
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        login({ id: 0, username: 'guest', fullName: 'Гость' });
    });

    // Выход
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        location.reload();
    });
}

function login(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    showDashboard();
    initApp();
}

function showDashboard() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    if(currentUser) {
        document.getElementById('userNameDisplay').textContent = currentUser.fullName;
        document.getElementById('userAvatar').textContent = currentUser.username[0].toUpperCase();
    }
}

// ==========================================
// УЧАСТНИКИ (ИЗ БАЗЫ ДАННЫХ)
// ==========================================
async function initContacts() {
    try {
        const res = await fetch(`${API_URL}/api/users`);
        const users = await res.json();
        
        const container = document.getElementById('contactsList');
        if(!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<div style="padding:20px; color:#aaa; grid-column:1/-1; text-align:center;">Пока нет участников</div>';
            return;
        }

        container.innerHTML = users.map(u => {
            const initial = u.fullName ? u.fullName[0].toUpperCase() : '?';
            // Если это текущий пользователь
            let roleBadge = 'Студент';
            if (currentUser && u.username === currentUser.username) {
                roleBadge = '<span style="color:var(--primary); font-weight:bold;">Это Вы</span>';
            }

            return `
            <div class="contact-card">
                <div class="avatar-circle" style="width:60px; height:60px; font-size:1.5rem; margin-bottom:10px;">
                    ${initial}
                </div>
                <div class="name" style="font-weight:700; margin-bottom:4px;">${u.fullName}</div>
                <div class="role" style="font-size:0.8rem; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:4px;">
                    ${roleBadge}
                </div>
            </div>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Ошибка загрузки участников:', err);
    }
}

// ==========================================
// ЗАДАЧИ
// ==========================================
async function initTasks() {
    loadTasks();
    const addBtn = document.getElementById('addTaskBtn');
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);

    newBtn.addEventListener('click', async () => {
        const input = document.getElementById('newTaskInput');
        const text = input.value.trim();
        if(!text) return;
        
        await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, text })
        });
        input.value = '';
        loadTasks();
    });
}

async function loadTasks() {
    if(!currentUser || !currentUser.id) return;
    try {
        const res = await fetch(`${API_URL}/api/tasks?userId=${currentUser.id}`);
        const tasks = await res.json();
        const container = document.getElementById('tasksList');
        
        if(tasks.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">Нет задач</div>';
            return;
        }
        container.innerHTML = tasks.map((t) => `
            <div class="task-row ${t.is_done ? 'done' : ''}">
                <div class="check-circle" onclick="toggleTask(${t.id})">✓</div>
                <span class="task-text">${t.text}</span>
                <div class="delete-task" onclick="deleteTask(${t.id})">✕</div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
}

window.toggleTask = async function(id) {
    await fetch(`${API_URL}/api/tasks/${id}`, { method: 'PUT' });
    loadTasks();
};

window.deleteTask = async function(id) {
    await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
};

// ==========================================
// ЧАТ
// ==========================================
function initChat() {
    const btn = document.getElementById('sendChatBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', sendMessage);
    
    // Автообновление каждые 3 секунды
    loadChat();
    if(chatInterval) clearInterval(chatInterval);
    chatInterval = setInterval(loadChat, 3000);
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if(!message) return;

    await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: currentUser.fullName, message })
    });
    input.value = '';
    loadChat();
}

async function loadChat() {
    try {
        const res = await fetch(`${API_URL}/api/chat`);
        const msgs = await res.json();
        const box = document.getElementById('chatMessages');
        
        // Проверяем, был ли скролл внизу, чтобы автопрокручивать
        const wasScrolled = box.scrollTop + box.clientHeight >= box.scrollHeight - 50;

        box.innerHTML = msgs.map(m => {
            const date = new Date(m.created_at);
            const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const isMe = m.username === currentUser.fullName;
            return `
            <div class="chat-bubble ${isMe ? 'me' : ''}">
                <div class="chat-meta"><b>${m.username}</b> ${timeStr}</div>
                <div class="chat-text">${m.message}</div>
            </div>
        `}).join('');

        if(wasScrolled) box.scrollTop = box.scrollHeight;
    } catch(e) { console.error(e); }
}

// ==========================================
// УНИВЕРСАЛЬНЫЕ СПИСКИ (HW, News, etc)
// ==========================================
function initGenericList(key, apiEndpoint, fieldIds, renderFunc) {
    const btnId = `add${key.charAt(0).toUpperCase() + key.slice(1)}Btn`;
    const listId = `${key}List`;
    
    const loadItems = async () => {
        try {
            const res = await fetch(`${API_URL}${apiEndpoint}`);
            const data = await res.json();
            const container = document.getElementById(listId);
            if(!container) return;
            
            if(data.length === 0) {
                container.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">Нет записей</div>';
            } else {
                container.innerHTML = data.map(item => renderFunc(item)).join('');
            }
        } catch(e) { console.error(e); }
    };

    const btn = document.getElementById(btnId);
    if(btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', async () => {
            const payload = {};
            // Маппинг данных из полей
            if(key === 'homework') {
                payload.subject = document.getElementById('hwSubject').value;
                payload.task = document.getElementById('hwTask').value;
                payload.deadline = document.getElementById('hwDeadline').value;
            } else if (key === 'news') {
                payload.title = document.getElementById('newsTitle').value;
                payload.content = document.getElementById('newsContent').value;
            } else if (key === 'events') {
                payload.title = document.getElementById('eventTitle').value;
                payload.event_date = document.getElementById('eventDate').value;
                payload.location = document.getElementById('eventLocation').value;
            } else if (key === 'feedback') {
                payload.category = document.getElementById('fbCategory').value;
                payload.subject = document.getElementById('fbSubject').value;
                payload.message = document.getElementById('fbMessage').value;
            }

            // Валидация
            let valid = true;
            Object.values(payload).forEach(v => { if(!v) valid = false; });
            if(!valid) { alert('Заполните все поля!'); return; }

            await fetch(`${API_URL}${apiEndpoint}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            // Очистка полей
            fieldIds.forEach(id => { 
                const el = document.getElementById(id); 
                if(el) el.value = '';
                // Специфичный сброс для select
                if(el.tagName === 'SELECT') el.selectedIndex = 0;
            });
            loadItems();
        });
    }
    loadItems();
}

// Шаблоны карточек
function renderHomeworkItem(i) {
    const date = i.deadline ? new Date(i.deadline).toLocaleDateString() : '—';
    return `<div class="item-card"><span class="item-title">${i.subject}</span><div class="item-desc">${i.task}</div><div class="item-meta">Срок: ${date}</div></div>`;
}
function renderNewsItem(i) {
    return `<div class="item-card"><span class="item-title">${i.title}</span><div class="item-desc">${i.content}</div></div>`;
}
function renderEventItem(i) {
    const date = new Date(i.event_date).toLocaleString([], {month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit'});
    return `<div class="item-card"><span class="item-title">${i.title}</span><div class="item-desc">${i.location}</div><div class="item-meta">${date}</div></div>`;
}
function renderFeedbackItem(i) {
    return `<div class="item-card"><span class="item-title" style="color:var(--primary)">[${i.category}] ${i.subject}</span><div class="item-desc">${i.message}</div></div>`;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
function renderSchedule() {
    const now = new Date();
    const start = new Date(scheduleStartDate).setHours(0,0,0,0);
    const today = new Date(now).setHours(0,0,0,0);
    const diffDays = Math.ceil(Math.abs(today - start) / (1000 * 60 * 60 * 24)); 
    const weeksPassed = Math.floor(diffDays / 7);
    const type = (weeksPassed % 2 === 0) ? 'numerator' : 'denominator';
    
    const badge = document.getElementById('weekBadge');
    if(badge) badge.textContent = type === 'numerator' ? 'Числитель' : 'Знаменатель';
    
    const container = document.getElementById('scheduleContainer');
    if(!container) return;
    container.innerHTML = '';
    const week = scheduleData[type];
    for(const [day, lessons] of Object.entries(week)) {
        let html = `<div class="day-block"><div class="day-name">${day}</div>`;
        lessons.forEach(l => {
            html += `<div class="lesson-row"><span class="lesson-time">${l.t}</span><span class="lesson-info"><b>${l.n}</b> <span class="lesson-room">ауд. ${l.r}</span></span></div>`;
        });
        html += `</div>`;
        container.innerHTML += html;
    }
}

function initCalendar() {
    const prev = document.getElementById('prevMonth');
    const next = document.getElementById('nextMonth');
    
    const newPrev = prev.cloneNode(true); prev.parentNode.replaceChild(newPrev, prev);
    const newNext = next.cloneNode(true); next.parentNode.replaceChild(newNext, next);
    
    newPrev.addEventListener('click', () => { currMonth--; if(currMonth < 0) { currMonth = 11; currYear--; } renderCalendar(); });
    newNext.addEventListener('click', () => { currMonth++; if(currMonth > 11) { currMonth = 0; currYear++; } renderCalendar(); });
    renderCalendar();
}

function renderCalendar() {
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const mEl = document.getElementById('currentMonth');
    if(mEl) mEl.textContent = `${months[currMonth]} ${currYear}`;
    
    const daysContainer = document.getElementById('calendarDays');
    if(!daysContainer) return;

    const firstDay = new Date(currYear, currMonth, 1).getDay(); 
    const startDayIndex = firstDay === 0 ? 6 : firstDay - 1; 
    const lastDate = new Date(currYear, currMonth + 1, 0).getDate();
    let html = '';
    for(let i=0; i<startDayIndex; i++) html += `<div class="cal-cell empty"></div>`;
    const today = new Date();
    for(let i=1; i<=lastDate; i++) {
        const isToday = (i === today.getDate() && currMonth === today.getMonth() && currYear === today.getFullYear());
        html += `<div class="cal-cell ${isToday?'today':''}">${i}</div>`;
    }
    daysContainer.innerHTML = html;
}

function updateClock() {
    const el = document.getElementById('clock');
    if(el) { const now = new Date(); el.textContent = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}); }
}

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const el = document.getElementById(target);
            if(el) el.classList.add('active');
        });
    });
}
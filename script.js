// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
// Адрес вашего запущенного Node.js сервера
const API_URL = 'https://kursachweb-backend.onrender.com'; 

const scheduleStartDate = new Date('2025-09-01T00:00:00'); 

// Данные расписания (остаются на клиенте)
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

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    
    const saved = localStorage.getItem('currentUser');
    if(saved) {
        currentUser = JSON.parse(saved);
        showDashboard();
        initApp();
    }
});

function initApp() {
    updateClock();
    setInterval(updateClock, 1000);
    renderSchedule();
    initTabs();
    initCalendar();
    
    // Остальные модули пока работают локально, чтобы не усложнять код
    initTasks();
    initChat();
    loadGenericList('homework', 'addHomeworkBtn', ['hwSubject', 'hwTask', 'hwDeadline']);
    loadGenericList('news', 'addNewsBtn', ['newsTitle', 'newsContent']);
    loadGenericList('events', 'addEventBtn', ['eventTitle', 'eventDate', 'eventLocation']);
    loadGenericList('feedback', 'sendFeedbackBtn', ['fbCategory', 'fbSubject', 'fbMessage']);
}

// ==========================================
// АВТОРИЗАЦИЯ (ЧЕРЕЗ СЕРВЕР)
// ==========================================
function initAuth() {
    // Переключатель Вход / Регистрация
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('authSubmit').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
        document.getElementById('authSwitchText').textContent = isLoginMode ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
        document.getElementById('registerFields').style.display = isLoginMode ? 'none' : 'block';
    });

    // Отправка формы на сервер
    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('authUsername').value;
        const password = document.getElementById('authPassword').value;
        const fullName = document.getElementById('authFullName').value;

        // Определяем URL (Вход или Регистрация)
        const endpoint = isLoginMode ? '/login' : '/register';
        const bodyData = isLoginMode 
            ? { username, password }
            : { username, password, fullName };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if (response.ok) {
                if (isLoginMode) {
                    // Успешный вход
                    login(data);
                } else {
                    // Успешная регистрация
                    alert('Регистрация прошла успешно! Теперь войдите.');
                    // Переключаем форму на вход
                    isLoginMode = true;
                    document.getElementById('authSubmit').textContent = 'Войти';
                    document.getElementById('registerFields').style.display = 'none';
                    document.getElementById('authSwitchText').textContent = 'Нет аккаунта?';
                }
            } else {
                // Ошибка от сервера (например, "Неверный пароль")
                alert(data.message || 'Ошибка выполнения запроса');
            }
        } catch (err) {
            console.error('Network error:', err);
            alert('Ошибка подключения к серверу. Убедитесь, что сервер (node server.js) запущен.');
        }
    });

    // Гостевой вход (без сервера)
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        login({ id: 0, username: 'guest', fullName: 'Гость', isGuest: true });
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
    renderContactsMock();
}

// ==========================================
// ОСТАЛЬНОЙ ФУНКЦИОНАЛ (Local Storage)
// ==========================================
// (Оставляем локальным, чтобы код не был слишком огромным, 
// но вы можете переписать это на сервер по аналогии с auth)

function initTasks() {
    renderTasks();
    const addBtn = document.getElementById('addTaskBtn');
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);

    newBtn.addEventListener('click', () => {
        const input = document.getElementById('newTaskInput');
        const val = input.value.trim();
        if(!val) return;
        const key = `tasks_${currentUser.username}`;
        const tasks = JSON.parse(localStorage.getItem(key) || '[]');
        tasks.push({ id: Date.now(), text: val, done: false });
        localStorage.setItem(key, JSON.stringify(tasks));
        input.value = '';
        renderTasks();
    });
}

function renderTasks() {
    if(!currentUser) return;
    const key = `tasks_${currentUser.username}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const container = document.getElementById('tasksList');
    
    if(tasks.length === 0) {
        container.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">Нет задач</div>';
        return;
    }
    container.innerHTML = tasks.map((t) => `
        <div class="task-row ${t.done ? 'done' : ''}">
            <div class="check-circle" onclick="toggleTask(${t.id})">✓</div>
            <span class="task-text">${t.text}</span>
            <div class="delete-task" onclick="deleteTask(${t.id})">✕</div>
        </div>
    `).join('');
}

window.toggleTask = function(id) {
    const key = `tasks_${currentUser.username}`;
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    const task = tasks.find(t => t.id === id);
    if(task) { task.done = !task.done; localStorage.setItem(key, JSON.stringify(tasks)); renderTasks(); }
};

window.deleteTask = function(id) {
    const key = `tasks_${currentUser.username}`;
    let tasks = JSON.parse(localStorage.getItem(key) || '[]');
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem(key, JSON.stringify(tasks));
    renderTasks();
};

function initChat() {
    const btn = document.getElementById('sendChatBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', sendMsg);
    renderChat();
}

function sendMsg() {
    const input = document.getElementById('chatInput');
    const txt = input.value;
    if(!txt) return;
    const msgs = JSON.parse(localStorage.getItem('chat') || '[]');
    msgs.push({ u: currentUser.fullName, t: txt, time: new Date().toLocaleTimeString().slice(0,5) });
    localStorage.setItem('chat', JSON.stringify(msgs));
    input.value = '';
    renderChat();
}

function renderChat() {
    const msgs = JSON.parse(localStorage.getItem('chat') || '[]');
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.map(m => `
        <div class="chat-bubble ${m.u === currentUser.fullName ? 'me' : ''}">
            <div class="chat-meta"><b>${m.u}</b> ${m.time}</div>
            <div class="chat-text">${m.t}</div>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

function loadGenericList(key, btnId, fieldIds) {
    const render = () => {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const container = document.getElementById(key + 'List');
        if(!container) return;
        
        container.innerHTML = data.length ? data.reverse().map(i => {
            if(key === 'homework') return `<div class="item-card"><span class="item-title">${i.hwSubject}</span><div class="item-desc">${i.hwTask}</div><div class="item-meta">Срок: ${i.hwDeadline}</div></div>`;
            if(key === 'news') return `<div class="item-card"><span class="item-title">${i.newsTitle}</span><div class="item-desc">${i.newsContent}</div></div>`;
            if(key === 'events') return `<div class="item-card"><span class="item-title">${i.eventTitle}</span><div class="item-desc">${i.eventLocation}</div><div class="item-meta">${i.eventDate.replace('T', ' ')}</div></div>`;
            if(key === 'feedback') return `<div class="item-card"><span class="item-title" style="color:var(--primary)">[${i.fbCategory}] ${i.fbSubject}</span><div class="item-desc">${i.fbMessage}</div></div>`;
            return '';
        }).join('') : '<div style="color:#aaa; text-align:center; padding:20px;">Нет записей</div>';
    };

    const btn = document.getElementById(btnId);
    if(btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const obj = {};
            let valid = true;
            fieldIds.forEach(id => {
                const el = document.getElementById(id);
                if(el) { const val = el.value; if(!val) valid = false; obj[id] = val; }
            });
            if(!valid) { alert('Заполните все поля!'); return; }
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            data.push(obj);
            localStorage.setItem(key, JSON.stringify(data));
            fieldIds.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
            render();
        });
    }
    render();
}

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
    if(prev) {
        const newPrev = prev.cloneNode(true);
        prev.parentNode.replaceChild(newPrev, prev);
        newPrev.addEventListener('click', () => { currMonth--; if(currMonth < 0) { currMonth = 11; currYear--; } renderCalendar(); });
    }
    if(next) {
        const newNext = next.cloneNode(true);
        next.parentNode.replaceChild(newNext, next);
        newNext.addEventListener('click', () => { currMonth++; if(currMonth > 11) { currMonth = 0; currYear++; } renderCalendar(); });
    }
    renderCalendar();
}

function renderCalendar() {
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const monthEl = document.getElementById('currentMonth');
    if(monthEl) monthEl.textContent = `${months[currMonth]} ${currYear}`;
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

function renderContactsMock() {
    const contactsContainer = document.getElementById('contactsList');
    if(contactsContainer && currentUser) {
        const mockContacts = [
            {name: 'Администратор', role: 'Система'},
            {name: currentUser.fullName, role: 'Вы'},
            {name: 'Александр Тагайназаров', role: 'Староста'},
        ];
        contactsContainer.innerHTML = mockContacts.map(c => `
            <div class="contact-card">
                <div class="avatar-circle">${c.name[0]}</div>
                <div class="u-info"><div class="name">${c.name}</div><div class="role">${c.role}</div></div>
            </div>
        `).join('');
    }
}
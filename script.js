// ==========================================
// КОНФИГУРАЦИЯ СЕРВЕРА
// ==========================================
// Замените эту ссылку на адрес вашего сервера на Render после деплоя
const API_URL = 'http://localhost:3000/api'; 

// Дата начала учебного года для расчета недель (Числитель/Знаменатель)
const scheduleStartDate = new Date('2025-09-01T00:00:00'); 

// Данные расписания (храним на клиенте, так как они меняются редко)
const scheduleData = {
    numerator: { // Числитель
        'Понедельник': [ { t:'08:30', n:'Мат. Анализ (Лек)', r:'305' }, { t:'10:15', n:'Программирование', r:'201' } ],
        'Вторник': [ { t:'08:30', n:'Английский яз.', r:'108' }, { t:'12:00', n:'Алгоритмы', r:'201' } ],
        'Среда': [ { t:'08:30', n:'Веб-технологии', r:'205' }, { t:'12:00', n:'Физкультура', r:'Спортзал' } ],
        'Четверг': [ { t:'08:30', n:'История', r:'115' } ],
        'Пятница': [ { t:'08:30', n:'Проектирование ПО', r:'205' } ]
    },
    denominator: { // Знаменатель
        'Понедельник': [ { t:'08:30', n:'Мат. Анализ (Прак)', r:'305' }, { t:'12:00', n:'Физика', r:'412' } ],
        'Вторник': [ { t:'10:15', n:'Базы данных', r:'203' } ],
        'Среда': [ { t:'10:15', n:'Математика', r:'305' } ],
        'Четверг': [ { t:'10:15', n:'Комп. сети', r:'203' } ],
        'Пятница': [ { t:'10:15', n:'Дискретная мат.', r:'305' } ]
    }
};

// Глобальные переменные состояния
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
    
    // Проверяем, есть ли сохраненная сессия
    const savedUser = localStorage.getItem('currentUser');
    if(savedUser) {
        currentUser = JSON.parse(savedUser);
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
    
    // Загрузка данных с сервера
    if (currentUser && !currentUser.isGuest) {
        loadTasks();
        loadChat();
        // Загрузка остальных списков (предполагается, что вы добавите эти таблицы в БД)
        // Если таблиц нет, можно пока использовать localStorage как запасной вариант
        loadGenericList('homework', 'addHomeworkBtn', ['hwSubject', 'hwTask', 'hwDeadline']);
        loadGenericList('news', 'addNewsBtn', ['newsTitle', 'newsContent']);
        loadGenericList('events', 'addEventBtn', ['eventTitle', 'eventDate', 'eventLocation']);
        loadGenericList('feedback', 'sendFeedbackBtn', ['fbCategory', 'fbSubject', 'fbMessage']);
    } else {
        // Логика для гостя (локальное хранилище)
        alert('Вы в режиме гостя. Данные не будут сохраняться в базу данных.');
    }
}

// ==========================================
// АВТОРИЗАЦИЯ (API)
// ==========================================
function initAuth() {
    const authForm = document.getElementById('authForm');
    
    // Переключение Вход / Регистрация
    document.getElementById('authSwitchLink').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        document.getElementById('authSubmit').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
        document.getElementById('authSwitchText').textContent = isLoginMode ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
        document.getElementById('registerFields').style.display = isLoginMode ? 'none' : 'block';
    });

    // Обработка формы
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('authUsername').value;
        const password = document.getElementById('authPassword').value;
        const fullName = document.getElementById('authFullName').value;

        try {
            let response;
            if (isLoginMode) {
                // ЛОГИН
                response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
            } else {
                // РЕГИСТРАЦИЯ
                response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, fullName })
                });
            }

            const data = await response.json();

            if (response.ok) {
                // Успех
                login(data);
            } else {
                // Ошибка от сервера
                alert(data.message || 'Ошибка авторизации');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка подключения к серверу. Убедитесь, что сервер запущен.');
        }
    });

    // Вход как гость
    document.getElementById('guestLoginBtn').addEventListener('click', () => {
        login({ username: 'guest', fullName: 'Гость', isGuest: true });
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
        document.getElementById('userNameDisplay').textContent = currentUser.fullName || currentUser.username;
        document.getElementById('userAvatar').textContent = currentUser.username[0].toUpperCase();
    }
    
    // Загрузка мок-контактов (или можно сделать API для получения списка пользователей)
    renderContactsMock();
}

// ==========================================
// МЕНЕДЖЕР ЗАДАЧ (API)
// ==========================================
async function loadTasks() {
    if (!currentUser || currentUser.isGuest) return;

    try {
        const res = await fetch(`${API_URL}/tasks/${currentUser.id}`);
        if (!res.ok) throw new Error('Failed to load tasks');
        
        const tasks = await res.json();
        renderTasksHTML(tasks);
    } catch (err) {
        console.error('Ошибка загрузки задач:', err);
        document.getElementById('tasksList').innerHTML = '<div style="color:red; text-align:center">Ошибка загрузки</div>';
    }

    // Привязываем кнопку добавления
    const addBtn = document.getElementById('addTaskBtn');
    // Удаляем старые листенеры через клонирование
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);
    
    newBtn.addEventListener('click', async () => {
        const input = document.getElementById('newTaskInput');
        const text = input.value.trim();
        if (!text) return;

        try {
            const res = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, text: text })
            });

            if (res.ok) {
                input.value = '';
                loadTasks(); // Перезагружаем список
            }
        } catch (err) {
            console.error(err);
            alert('Не удалось добавить задачу');
        }
    });
}

function renderTasksHTML(tasks) {
    const container = document.getElementById('tasksList');
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">Нет задач</div>';
        return;
    }

    container.innerHTML = tasks.map(t => `
        <div class="task-row ${t.is_done ? 'done' : ''}">
            <div class="check-circle" onclick="toggleTask(${t.id}, ${!t.is_done})">✓</div>
            <span class="task-text">${t.text}</span>
            <div class="delete-task" onclick="deleteTask(${t.id})">✕</div>
        </div>
    `).join('');
}

// Функции для onclick в HTML
window.toggleTask = async function(taskId, newStatus) {
    // Примечание: для этого на сервере должен быть маршрут PUT /api/tasks/:id
    // Если его нет, можно просто удалить и создать заново, но лучше дописать сервер.
    // Пока сделаем имитацию обновления через перезагрузку, если сервер поддерживает update.
    try {
        // Если вы добавили маршрут PUT на сервере:
        /*
        await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ is_done: newStatus })
        });
        */
        console.log('Toggle task ID:', taskId, 'New status:', newStatus);
        // Поскольку в примере сервера был только GET/POST/DELETE, 
        // оставим это место для доработки backend'а.
    } catch(err) {
        console.error(err);
    }
};

window.deleteTask = async function(taskId) {
    if(!confirm('Удалить задачу?')) return;
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
        loadTasks();
    } catch(err) {
        console.error(err);
        alert('Ошибка удаления');
    }
};

// ==========================================
// ЧАТ (API)
// ==========================================
async function loadChat() {
    // В примере сервера не было маршрута GET /api/chat. 
    // Вам нужно добавить таблицу 'messages' и маршруты в server.js.
    // Ниже пример реализации:
    /*
    try {
        const res = await fetch(`${API_URL}/chat`);
        const messages = await res.json();
        const box = document.getElementById('chatMessages');
        box.innerHTML = messages.map(m => `
             <div class="chat-bubble ${m.username === currentUser.username ? 'me' : ''}">
                <div class="chat-meta"><b>${m.username}</b></div>
                <div class="chat-text">${m.text}</div>
            </div>
        `).join('');
        box.scrollTop = box.scrollHeight;
    } catch (e) { console.log('Chat not implemented on server yet'); }
    */

    // Пока используем локальную заглушку, чтобы интерфейс работал
    renderChatLocal();
    
    document.getElementById('sendChatBtn').onclick = () => {
        const input = document.getElementById('chatInput');
        const txt = input.value;
        if(!txt) return;
        
        // Локальное сохранение (замените на fetch POST, когда будет таблица)
        const msgs = JSON.parse(localStorage.getItem('chat') || '[]');
        msgs.push({ u: currentUser.fullName, t: txt, time: new Date().toLocaleTimeString().slice(0,5) });
        localStorage.setItem('chat', JSON.stringify(msgs));
        
        input.value = '';
        renderChatLocal();
    };
}

function renderChatLocal() {
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

// ==========================================
// УНИВЕРСАЛЬНЫЕ СПИСКИ (Новости, Домашка)
// ==========================================
// Пока работает через LocalStorage. Чтобы перевести на MySQL,
// создайте таблицы 'homework', 'news', 'events' и маршруты API,
// затем замените localStorage.getItem на fetch.
function loadGenericList(key, btnId, fieldIds) {
    const render = () => {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const container = document.getElementById(key + 'List');
        if(!container) return;
        
        // Шаблоны для разных типов
        container.innerHTML = data.length ? data.reverse().map(i => {
            if(key === 'homework') return `
                <div class="item-card">
                    <span class="item-title">${i.hwSubject}</span>
                    <div class="item-desc">${i.hwTask}</div>
                    <div class="item-meta">Срок: ${i.hwDeadline}</div>
                </div>`;
            if(key === 'news') return `
                <div class="item-card">
                    <span class="item-title">${i.newsTitle}</span>
                    <div class="item-desc">${i.newsContent}</div>
                </div>`;
            if(key === 'events') return `
                <div class="item-card">
                    <span class="item-title">${i.eventTitle}</span>
                    <div class="item-desc">${i.eventLocation}</div>
                    <div class="item-meta">${i.eventDate}</div>
                </div>`;
            if(key === 'feedback') return `
                <div class="item-card">
                    <span class="item-title" style="color:var(--primary)">[${i.fbCategory}] ${i.fbSubject}</span>
                    <div class="item-desc">${i.fbMessage}</div>
                </div>`;
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
                if(el) {
                    const val = el.value;
                    if(!val) valid = false;
                    obj[id] = val;
                }
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

// ==========================================
// UI: РАСПИСАНИЕ, КАЛЕНДАРЬ, ЧАСЫ
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
            html += `<div class="lesson-row">
                <span class="lesson-time">${l.t}</span>
                <span class="lesson-info"><b>${l.n}</b> <span class="lesson-room">ауд. ${l.r}</span></span>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML += html;
    }
}

function initCalendar() {
    const prev = document.getElementById('prevMonth');
    const next = document.getElementById('nextMonth');
    
    // Удаляем старые листенеры
    if(prev) {
        const newPrev = prev.cloneNode(true);
        prev.parentNode.replaceChild(newPrev, prev);
        newPrev.addEventListener('click', () => {
            currMonth--;
            if(currMonth < 0) { currMonth = 11; currYear--; }
            renderCalendar();
        });
    }
    
    if(next) {
        const newNext = next.cloneNode(true);
        next.parentNode.replaceChild(newNext, next);
        newNext.addEventListener('click', () => {
            currMonth++;
            if(currMonth > 11) { currMonth = 0; currYear++; }
            renderCalendar();
        });
    }
    renderCalendar();
}

function renderCalendar() {
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const monthEl = document.getElementById('currentMonth');
    if(monthEl) monthEl.textContent = `${months[currMonth]} ${currYear}`;
    
    const daysContainer = document.getElementById('calendarDays');
    if(!daysContainer) return;

    const firstDay = new Date(currYear, currMonth, 1).getDay(); // 0 = Вс
    const startDayIndex = firstDay === 0 ? 6 : firstDay - 1; // Пн = 0
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
    if(el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
    }
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
        // Пример статических контактов
        const mockContacts = [
            {name: 'Администратор', role: 'Система'},
            {name: currentUser.fullName, role: 'Вы'},
            {name: 'Иван Иванов', role: 'Староста'},
            {name: 'Мария Петрова', role: 'Студент'}
        ];
        
        contactsContainer.innerHTML = mockContacts.map(c => `
            <div class="contact-card">
                <div class="avatar-circle">${c.name[0]}</div>
                <div class="u-info">
                    <div class="name">${c.name}</div>
                    <div class="role">${c.role}</div>
                </div>
            </div>
        `).join('');
    }
}
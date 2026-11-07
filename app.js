/**
 * Concierge App — main controller
 */

const PASSWORDS = { guest: '1111', admin: '6767' };

const app = {
  role: null,
  assistant: new ConciergeAssistant(),

  init() {
    // Loading splash
    setTimeout(() => {
      this.showScreen('login');
    }, 700);

    this.bindLogin();
    this.bindGuest();
    this.bindAdmin();
    this.bindModal();
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
  },

  // ——— Login ———
  bindLogin() {
    let selectedRole = 'guest';

    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRole = btn.dataset.role;
        document.getElementById('login-hint').textContent =
          selectedRole === 'guest' ? 'Гость: 1111' : 'Администратор: 6767';
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
      });
    });

    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const pwd = document.getElementById('password').value.trim();
      if (pwd === PASSWORDS[selectedRole]) {
        this.role = selectedRole;
        document.getElementById('password').value = '';
        if (selectedRole === 'guest') {
          this.enterGuest();
        } else {
          this.enterAdmin();
        }
      } else {
        this.shake(document.getElementById('password'));
      }
    });
  },

  shake(el) {
    el.style.borderColor = '#c44';
    el.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' }
    ], { duration: 280 });
    setTimeout(() => { el.style.borderColor = ''; }, 600);
  },

  // ——— Guest ———
  enterGuest() {
    this.showScreen('guest');
    this.assistant = new ConciergeAssistant();
    const config = loadConfig();
    document.getElementById('guest-hotel-name').textContent =
      config.hotel.name || 'Concierge';

    const chat = document.getElementById('chat-messages');
    chat.innerHTML = '';
    this.addBotMessage(this.assistant.greeting());
  },

  bindGuest() {
    document.getElementById('btn-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.sendMessage();
    });
    document.getElementById('btn-logout-guest').addEventListener('click', () => {
      this.role = null;
      this.showScreen('login');
    });
    document.getElementById('btn-guest-info').addEventListener('click', () => {
      const h = loadConfig().hotel;
      let text = h.name ? `«${h.name}»\n` : '';
      if (h.address) text += `Адрес: ${h.address}\n`;
      if (h.phone) text += `Тел: ${h.phone}\n`;
      if (h.checkIn) text += `Заезд: ${h.checkIn} · Выезд: ${h.checkOut || '—'}`;
      if (!text) text = 'Данные об отеле ещё не заполнены администратором.';
      this.addBotMessage(text);
    });
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.addUserMessage(text);
    setTimeout(() => {
      const reply = this.assistant.process(text);
      this.addBotMessage(reply);
    }, 280);
  },

  addBotMessage(text) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = this._escape(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') +
      `<span class="time">${this._time()}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  },

  addUserMessage(text) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = this._escape(text) + `<span class="time">${this._time()}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  },

  _escape(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  },

  _time() {
    return new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  },

  // ——— Admin ———
  enterAdmin() {
    this.showScreen('admin');
    this.renderAdmin();
  },

  bindAdmin() {
    document.getElementById('btn-logout-admin').addEventListener('click', () => {
      this.role = null;
      this.showScreen('login');
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
        if (btn.dataset.panel === 'requests') this.renderRequests();
        if (btn.dataset.panel === 'services') this.renderServices();
        if (btn.dataset.panel === 'faq') this.renderFaq();
      });
    });

    // Hotel form
    document.getElementById('form-hotel').addEventListener('submit', e => {
      e.preventDefault();
      const config = loadConfig();
      config.hotel = {
        name: document.getElementById('hotel-name').value.trim(),
        address: document.getElementById('hotel-address').value.trim(),
        phone: document.getElementById('hotel-phone').value.trim(),
        email: document.getElementById('hotel-email').value.trim(),
        checkIn: document.getElementById('hotel-checkin').value.trim() || '14:00',
        checkOut: document.getElementById('hotel-checkout').value.trim() || '12:00',
        description: document.getElementById('hotel-description').value.trim()
      };
      saveConfig(config);
      this.toast('Сохранено');
      this.updateStats();
    });

    // Quick goto
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.goto;
        document.querySelector(`.nav-item[data-panel="${panel}"]`).click();
      });
    });

    document.getElementById('btn-add-service').addEventListener('click', () => this.openServiceModal());
    document.getElementById('btn-add-faq').addEventListener('click', () => this.openFaqModal());

    document.getElementById('btn-reset-data').addEventListener('click', () => {
      if (confirm('Удалить все данные? Это действие нельзя отменить.')) {
        resetAllData();
        this.renderAdmin();
        this.toast('Данные сброшены');
      }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const blob = new Blob([exportConfig()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'concierge-config.json';
      a.click();
    });

    document.getElementById('input-import').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importConfig(reader.result);
          this.renderAdmin();
          this.toast('Импорт выполнен');
        } catch {
          alert('Ошибка чтения файла');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  },

  renderAdmin() {
    const config = loadConfig();
    document.getElementById('hotel-name').value = config.hotel.name || '';
    document.getElementById('hotel-address').value = config.hotel.address || '';
    document.getElementById('hotel-phone').value = config.hotel.phone || '';
    document.getElementById('hotel-email').value = config.hotel.email || '';
    document.getElementById('hotel-checkin').value = config.hotel.checkIn || '';
    document.getElementById('hotel-checkout').value = config.hotel.checkOut || '';
    document.getElementById('hotel-description').value = config.hotel.description || '';
    this.updateStats();
    this.renderServices();
    this.renderFaq();
    this.renderRequests();
  },

  updateStats() {
    const config = loadConfig();
    document.getElementById('stat-services').textContent = (config.services || []).length;
    document.getElementById('stat-faq').textContent = (config.faq || []).length;
    document.getElementById('stat-requests').textContent = loadRequests().length;
  },

  renderServices() {
    const list = document.getElementById('services-list');
    const services = loadConfig().services || [];
    if (!services.length) {
      list.innerHTML = '<p class="muted empty-hint">Услуг пока нет. Нажмите «+ Добавить»</p>';
      return;
    }
    list.innerHTML = services.map((s, i) => `
      <div class="list-item">
        <div class="list-item-content">
          <div class="list-item-title">${this._escape(s.title)}</div>
          <div class="list-item-desc">${this._escape(s.description || '')}${s.price ? ' · ' + this._escape(s.price) : ''}</div>
        </div>
        <div class="list-item-actions">
          <button data-edit-service="${i}">✎</button>
          <button class="del" data-del-service="${i}">✕</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-service]').forEach(btn => {
      btn.addEventListener('click', () => this.openServiceModal(+btn.dataset.editService));
    });
    list.querySelectorAll('[data-del-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        const config = loadConfig();
        config.services.splice(+btn.dataset.delService, 1);
        saveConfig(config);
        this.renderServices();
        this.updateStats();
      });
    });
  },

  renderFaq() {
    const list = document.getElementById('faq-list');
    const faq = loadConfig().faq || [];
    if (!faq.length) {
      list.innerHTML = '<p class="muted empty-hint">База знаний пуста. Добавьте вопросы и ответы.</p>';
      return;
    }
    list.innerHTML = faq.map((f, i) => `
      <div class="list-item">
        <div class="list-item-content">
          <div class="list-item-title">${this._escape(f.question)}</div>
          <div class="list-item-desc">${this._escape(f.answer)}</div>
        </div>
        <div class="list-item-actions">
          <button data-edit-faq="${i}">✎</button>
          <button class="del" data-del-faq="${i}">✕</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-faq]').forEach(btn => {
      btn.addEventListener('click', () => this.openFaqModal(+btn.dataset.editFaq));
    });
    list.querySelectorAll('[data-del-faq]').forEach(btn => {
      btn.addEventListener('click', () => {
        const config = loadConfig();
        config.faq.splice(+btn.dataset.delFaq, 1);
        saveConfig(config);
        this.renderFaq();
        this.updateStats();
      });
    });
  },

  renderRequests() {
    const list = document.getElementById('requests-list');
    const empty = document.getElementById('requests-empty');
    const requests = loadRequests();
    if (!requests.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = requests.map(r => `
      <div class="list-item">
        <div class="list-item-content">
          <div class="list-item-title">${this._escape(String(r.id))} · ${this._escape(String(r.type))} · ${this._escape(String(r.status))}</div>
          <div class="list-item-desc">
            ${this._escape(String(r.guestName || ''))} · №${this._escape(String(r.room || ''))}<br>
            ${this._escape(String(r.description || ''))}
          </div>
        </div>
        <div class="list-item-actions">
          ${r.status === 'new' ? `<button data-done="${this._attr(String(r.id))}">✓</button>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-done]').forEach(btn => {
      btn.addEventListener('click', () => {
        updateRequestStatus(btn.dataset.done, 'done');
        this.renderRequests();
        this.updateStats();
      });
    });
  },

  // ——— Modals ———
  bindModal() {
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
  },

  openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  },

  openServiceModal(editIndex = null) {
    const config = loadConfig();
    const item = editIndex !== null ? config.services[editIndex] : { title: '', description: '', price: '', hours: '' };
    this.openModal(
      editIndex !== null ? 'Редактировать услугу' : 'Новая услуга',
      `
        <div class="field"><label>Название</label><input id="m-title" value="${this._attr(item.title)}" /></div>
        <div class="field"><label>Описание</label><textarea id="m-desc" rows="3">${this._attr(item.description)}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Цена</label><input id="m-price" value="${this._attr(item.price)}" placeholder="бесплатно / от 500 ₽" /></div>
          <div class="field"><label>Часы работы</label><input id="m-hours" value="${this._attr(item.hours)}" placeholder="09:00–21:00" /></div>
        </div>
      `,
      `
        <button class="btn-secondary" id="m-cancel">Отмена</button>
        <button class="btn-primary" id="m-save">Сохранить</button>
      `
    );
    document.getElementById('m-cancel').onclick = () => this.closeModal();
    document.getElementById('m-save').onclick = () => {
      const entry = {
        title: document.getElementById('m-title').value.trim(),
        description: document.getElementById('m-desc').value.trim(),
        price: document.getElementById('m-price').value.trim(),
        hours: document.getElementById('m-hours').value.trim()
      };
      if (!entry.title) return;
      const cfg = loadConfig();
      if (editIndex !== null) cfg.services[editIndex] = entry;
      else cfg.services.push(entry);
      saveConfig(cfg);
      this.closeModal();
      this.renderServices();
      this.updateStats();
    };
  },

  openFaqModal(editIndex = null) {
    const config = loadConfig();
    const item = editIndex !== null ? config.faq[editIndex] : { question: '', answer: '' };
    this.openModal(
      editIndex !== null ? 'Редактировать запись' : 'Новая запись',
      `
        <div class="field"><label>Вопрос</label><input id="m-q" value="${this._attr(item.question)}" /></div>
        <div class="field"><label>Ответ</label><textarea id="m-a" rows="4">${this._attr(item.answer)}</textarea></div>
      `,
      `
        <button class="btn-secondary" id="m-cancel">Отмена</button>
        <button class="btn-primary" id="m-save">Сохранить</button>
      `
    );
    document.getElementById('m-cancel').onclick = () => this.closeModal();
    document.getElementById('m-save').onclick = () => {
      const entry = {
        question: document.getElementById('m-q').value.trim(),
        answer: document.getElementById('m-a').value.trim()
      };
      if (!entry.question || !entry.answer) return;
      const cfg = loadConfig();
      if (editIndex !== null) cfg.faq[editIndex] = entry;
      else cfg.faq.push(entry);
      saveConfig(cfg);
      this.closeModal();
      this.renderFaq();
      this.updateStats();
    };
  },

  toast(msg) {
    // Simple temporary feedback
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#e8e8e8;color:#0a0a0a;padding:8px 20px;border-radius:6px;font-size:13px;z-index:200;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  },

  _attr(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());

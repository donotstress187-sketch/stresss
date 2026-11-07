/**
 * Rule-based virtual concierge.
 * Uses data configured by administrator.
 */

class ConciergeAssistant {
  constructor() {
    this.config = loadConfig();
    this.guestName = null;
    this.guestRoom = null;
  }

  refresh() {
    this.config = loadConfig();
  }

  setGuest(name, room) {
    this.guestName = name;
    this.guestRoom = room;
  }

  process(message) {
    this.refresh();
    const msg = message.trim();
    const lower = msg.toLowerCase();

    // Capture guest identity (word boundaries via lookbehind: Cyrillic-safe)
    const B = '(?<![а-яёa-z])';
    const nameRoom = msg.match(new RegExp(B + 'я[\\s:]+([а-яёa-z]+)[\\s,.]*(?:номер|комната|room)?[\\s:]*(\\d+)', 'i'));
    const nameOnly = msg.match(new RegExp(B + '(?:меня зовут|имя)[\\s:]+([а-яёa-z]+)(?:[\\s,.]*(?:номер|комната|room)?[\\s:]*(\\d+))?', 'i'));
    const roomOnly = msg.match(new RegExp(B + '(?:номер|комната|room)[\\s:]*(\\d+)', 'i'));
    const idMatch = nameRoom || nameOnly || roomOnly;

    if (idMatch) {
      const rest = msg.replace(idMatch[0], '').replace(/[\s,.!?]/g, '');
      if (idMatch === roomOnly) {
        this.guestRoom = roomOnly[1];
        if (rest.length < 3) return `Номер ${this.guestRoom} записан. ${this.guestName ? 'Чем могу помочь?' : 'Как вас зовут?'}`;
      } else {
        this.guestName = this._cap(idMatch[1]);
        if (idMatch[2]) this.guestRoom = idMatch[2];
        if (rest.length < 3) {
          return this.guestRoom
            ? `Принято. ${this.guestName}, номер ${this.guestRoom}. Чем могу помочь?`
            : `Здравствуйте, ${this.guestName}! Укажите, пожалуйста, номер комнаты.`;
        }
      }
    }

    // Create request intents
    if (this._has(lower, ['заказ', 'закаж', 'принеси', 'достав', 'еду в номер', 'room service'])) {
      return this._createRequest('food', msg, 'Заявка на еду / room service создана.');
    }
    if (this._has(lower, ['уборк', 'горничн', 'полотенц', 'постель', 'халат', 'тапочк'])) {
      return this._createRequest('cleaning', msg, 'Заявка на уборку / принадлежности создана.');
    }
    if (this._has(lower, ['не работает', 'сломал', 'техник', 'ремонт', 'кондиционер', 'телевизор', 'вайфай', 'wi-fi', 'интернет'])) {
      return this._createRequest('technical', msg, 'Техническая заявка создана. Приоритет повышен.');
    }
    if (this._has(lower, ['вызови', 'позови', 'персонал', 'администратор', 'менеджер', 'ресепшен'])) {
      return this._createRequest('staff', msg, 'Заявка на вызов персонала создана.');
    }
    if (this._has(lower, ['трансфер', 'такси', 'аэропорт', 'вокзал'])) {
      return this._createRequest('transfer', msg, 'Заявка на трансфер создана.');
    }
    if (this._has(lower, ['мои заявки', 'статус заявки', 'что с заявкой'])) {
      return this._listMyRequests();
    }

    // Knowledge search
    return this._searchKnowledge(lower, msg);
  }

  _createRequest(type, description, successMsg) {
    if (!this.guestRoom) {
      return 'Чтобы создать заявку, укажите имя и номер комнаты.\nНапример: «Я Анна, номер 305»';
    }
    const req = addRequest({
      type,
      description,
      guestName: this.guestName || 'Гость',
      room: this.guestRoom
    });
    return `${successMsg}\nНомер заявки: ${req.id}\nСтатус: новая.`;
  }

  _listMyRequests() {
    if (!this.guestRoom) return 'Сначала укажите номер комнаты.';
    const all = loadRequests().filter(r => r.room === this.guestRoom);
    if (!all.length) return 'У вас пока нет заявок.';
    return all.slice(0, 8).map(r =>
      `• ${r.id} [${r.status}] ${r.type}: ${r.description.slice(0, 60)}`
    ).join('\n');
  }

  _searchKnowledge(lower, original) {
    const hotel = this.config.hotel;
    const results = [];

    // Hotel info triggers
    if (this._has(lower, ['адрес', 'где находится', 'как добраться', 'телефон', 'позвонить', 'контакт'])) {
      const parts = [];
      if (hotel.name) parts.push(hotel.name);
      if (hotel.address) parts.push(`Адрес: ${hotel.address}`);
      if (hotel.phone) parts.push(`Телефон: ${hotel.phone}`);
      if (hotel.email) parts.push(`Email: ${hotel.email}`);
      if (parts.length) results.push(parts.join('\n'));
    }

    if (this._has(lower, ['заезд', 'выезд', 'заселен', 'время заезда', 'чек-ин', 'check-in', 'check-out'])) {
      results.push(`Заезд: ${hotel.checkIn || '—'} · Выезд: ${hotel.checkOut || '—'}`);
    }

    if (this._has(lower, ['об отеле', 'расскажи об отеле', 'описание', 'что за отель']) && hotel.description) {
      results.push(hotel.description);
    }

    // Services
    const matchedServices = (this.config.services || []).filter(s => {
      const text = `${s.title} ${s.description}`.toLowerCase();
      return lower.split(/\s+/).some(w => w.length > 3 && text.includes(w));
    });
    if (matchedServices.length) {
      matchedServices.slice(0, 4).forEach(s => {
        let line = `**${s.title}**`;
        if (s.description) line += `\n${s.description}`;
        if (s.price) line += `\nСтоимость: ${s.price}`;
        if (s.hours) line += `\nВремя: ${s.hours}`;
        results.push(line);
      });
    }

    // FAQ exact / keyword
    const matchedFaq = (this.config.faq || []).filter(f => {
      const q = (f.question || '').toLowerCase();
      const a = (f.answer || '').toLowerCase();
      return lower.split(/\s+/).some(w => w.length > 3 && (q.includes(w) || a.includes(w)));
    });
    if (matchedFaq.length) {
      matchedFaq.slice(0, 3).forEach(f => {
        results.push(`${f.question}\n${f.answer}`);
      });
    }

    // Broad "services" / "что есть"
    if (this._has(lower, ['услуг', 'что есть', 'что предлагаете', 'сервис']) && (this.config.services || []).length) {
      const list = (this.config.services || []).map(s => `• ${s.title}`).join('\n');
      results.push(`Доступные услуги:\n${list}`);
    }

    if (results.length) {
      return results.slice(0, 5).join('\n\n');
    }

    // Fallback
    if (!hotel.name && !(this.config.services || []).length && !(this.config.faq || []).length) {
      return 'База знаний пока пуста. Администратор ещё не заполнил данные об отеле и услугах.\n\nВы можете оставить заявку — укажите имя и номер комнаты, затем опишите запрос.';
    }

    const name = hotel.name || 'нашей гостиницы';
    return `По запросу «${original}» точной информации не нашлось.\n\nЯ могу рассказать об услугах ${name}, принять заявку на еду, уборку, вызов персонала или трансфер.\nУкажите номер комнаты, если ещё не сделали этого.`;
  }

  greeting() {
    this.refresh();
    const name = this.config.hotel.name;
    const intro = name
      ? `Здравствуйте! Я виртуальный консьерж гостиницы «${name}».`
      : 'Здравствуйте! Я виртуальный консьерж.';
    return `${intro}\n\nМогу ответить на вопросы об услугах, принять заявку или вызвать персонал.\n\nДля начала напишите: «Я [Имя], номер [комната]»`;
  }

  _has(text, words) {
    return words.some(w => text.includes(w));
  }

  _cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}

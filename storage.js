/**
 * Local storage layer for Concierge app.
 * All hotel data is stored in the browser / WebView.
 */

const STORAGE_KEY = 'concierge_config_v1';
const REQUESTS_KEY = 'concierge_requests_v1';

const DEFAULT_CONFIG = {
  hotel: {
    name: '',
    address: '',
    phone: '',
    email: '',
    checkIn: '14:00',
    checkOut: '12:00',
    description: ''
  },
  services: [],
  faq: [],
  settings: {
    guestPassword: '1111',
    adminPassword: '6767'
  }
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const data = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...data,
      hotel: { ...DEFAULT_CONFIG.hotel, ...(data.hotel || {}) },
      services: Array.isArray(data.services) ? data.services : [],
      faq: Array.isArray(data.faq) ? data.faq : [],
      settings: { ...DEFAULT_CONFIG.settings, ...(data.settings || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadRequests() {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRequests(list) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
}

function addRequest(req) {
  const list = loadRequests();
  const item = {
    id: Date.now().toString(36).toUpperCase().slice(-6),
    createdAt: new Date().toISOString(),
    status: 'new',
    ...req
  };
  list.unshift(item);
  saveRequests(list);
  return item;
}

function updateRequestStatus(id, status) {
  const list = loadRequests();
  const idx = list.findIndex(r => r.id === id);
  if (idx >= 0) {
    list[idx].status = status;
    saveRequests(list);
  }
}

function resetAllData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REQUESTS_KEY);
}

function exportConfig() {
  const data = {
    config: loadConfig(),
    requests: loadRequests(),
    exportedAt: new Date().toISOString()
  };
  return JSON.stringify(data, null, 2);
}

function importConfig(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data || typeof data !== 'object') throw new Error('bad file');
  if (data.config && typeof data.config === 'object') saveConfig(data.config);
  if (Array.isArray(data.requests)) saveRequests(data.requests);
}

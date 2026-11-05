// Tab Cloud Popup Logic with Drag and Drop & Lifecycle Tracker

let currentActiveTabs = [];
let currentClosedTabs = [];
let draggedTabId = null;

// Инициализация при открытии окна
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupSearch();
  setupActions();
  await loadAndRender();

  // Автообновление каждые 4 секунды пока попап открыт
  setInterval(loadAndRender, 4000);
});

// Загрузка данных из chrome.storage и chrome.tabs
async function loadAndRender() {
  try {
    const [chromeTabs, storageData] = await Promise.all([
      chrome.tabs.query({}),
      chrome.storage.local.get(['activeTabs', 'closedTabs', 'customOrder'])
    ]);

    const activeTabsMap = storageData.activeTabs || {};
    currentClosedTabs = storageData.closedTabs || [];
    const customOrder = storageData.customOrder || [];

    // Объединяем живые табы Chrome с метаданными из хранилища
    const liveTabs = chromeTabs.map(tab => {
      const stored = activeTabsMap[tab.id] || {};
      return {
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        title: tab.title || stored.title || 'Новая вкладка',
        url: tab.url || stored.url || '',
        favIconUrl: tab.favIconUrl || stored.favIconUrl || '',
        openedAt: stored.openedAt || Date.now(),
        lastActiveAt: stored.lastActiveAt || Date.now(),
        history: stored.history || (tab.url ? [{ url: tab.url, title: tab.title || '', timestamp: stored.openedAt || Date.now() }] : [])
      };
    });

    // Сортировка: если есть кастомный порядок drag-and-drop, используем его, иначе индекс таба
    if (customOrder.length > 0) {
      const orderMap = new Map();
      customOrder.forEach((id, idx) => orderMap.set(id, idx));
      liveTabs.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : a.index + 1000;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : b.index + 1000;
        return orderA - orderB;
      });
    } else {
      liveTabs.sort((a, b) => a.index - b.index);
    }

    currentActiveTabs = liveTabs;

    // Обновляем бейджи и счетчики
    updateHeaderCounters(liveTabs.length, currentClosedTabs.length);

    // Отрисовка
    renderActiveTabs();
    renderClosedTabs();
    renderStats();
  } catch (err) {
    console.error('Ошибка загрузки данных:', err);
  }
}

// Обновление счетчиков в шапке
function updateHeaderCounters(activeCount, historyCount) {
  const badge = document.getElementById('tabCounterBadge');
  const activeTag = document.getElementById('activeCountTag');
  const historyTag = document.getElementById('historyCountTag');

  const text = `${activeCount} ${getTabWord(activeCount)}`;
  if (badge) badge.textContent = text;
  if (activeTag) activeTag.textContent = String(activeCount);
  if (historyTag) historyTag.textContent = String(historyCount);
}

// ----------------- ОТРИСОВКА АКТИВНЫХ ТАБОВ С DnD -----------------
function renderActiveTabs() {
  const listEl = document.getElementById('activeTabsList');
  if (!listEl) return;

  const searchQuery = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  const filtered = currentActiveTabs.filter(tab => {
    if (!searchQuery) return true;
    return (tab.title && tab.title.toLowerCase().includes(searchQuery)) ||
           (tab.url && tab.url.toLowerCase().includes(searchQuery));
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-cloud-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
        </svg>
        <div class="empty-title">${searchQuery ? 'Вкладки не найдены' : 'Облако пусто'}</div>
        <div class="empty-desc">${searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Откройте вкладку в Chrome'}</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  filtered.forEach(tab => {
    const card = document.createElement('li');
    card.className = 'tab-card';
    card.setAttribute('draggable', 'true');
    card.dataset.tabId = String(tab.id);

    // Время жизни вкладки
    const timeAgoStr = formatDuration(Date.now() - tab.openedAt);
    const isOld = (Date.now() - tab.openedAt) > (24 * 3600 * 1000); // Старше 24ч

    // Favicon
    const faviconHtml = tab.favIconUrl && tab.favIconUrl.startsWith('http')
      ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" alt="" onerror="this.outerHTML='<div class=\\'tab-fallback-icon\\'>☁</div>'">`
      : `<div class="tab-fallback-icon">☁</div>`;

    // Цепочка истории (если было больше 1 перехода)
    const historyCount = tab.history ? tab.history.length : 1;
    const historyBadgeHtml = historyCount > 1
      ? `<button class="history-chain-btn" title="Показать цепочку переходов (${historyCount})">${historyCount} ↷</button>`
      : '';

    card.innerHTML = `
      <span class="drag-grip" title="Перетащите для изменения порядка">⠿</span>
      ${faviconHtml}
      <div class="tab-details">
        <div class="tab-title-line">
          <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
        </div>
        <span class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(cleanUrl(tab.url))}</span>
      </div>
      <div class="tab-meta-badges">
        ${historyBadgeHtml}
        <span class="time-badge ${isOld ? 'warning' : ''}" title="Открыта: ${new Date(tab.openedAt).toLocaleTimeString()}">${timeAgoStr}</span>
        <button class="tab-close-btn" title="Закрыть вкладку">&times;</button>
      </div>
    `;

    // Клик на саму карточку -> переключиться на таб в Chrome
    card.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close-btn') || e.target.closest('.history-chain-btn') || e.target.closest('.drag-grip')) {
        return;
      }
      switchToTab(tab.id, tab.windowId);
    });

    // Клик на закрытие таба
    const closeBtn = card.querySelector('.tab-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await closeTab(tab.id);
      });
    }

    // Раскрытие истории переходов
    const histBtn = card.querySelector('.history-chain-btn');
    if (histBtn) {
      histBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHistoryAccordion(card, tab.history);
      });
    }

    // Drag and Drop события
    setupCardDnD(card, tab.id);

    listEl.appendChild(card);
  });
}

// ----------------- DRAG AND DROP ОБРАБОТЧИКИ -----------------
function setupCardDnD(card, tabId) {
  card.addEventListener('dragstart', (e) => {
    draggedTabId = tabId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tabId));
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    clearDragOverStyles();
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = card.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    clearDragOverStyles();
    if (e.clientY < midY) {
      card.classList.add('drag-over-top');
    } else {
      card.classList.add('drag-over-bottom');
    }
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    clearDragOverStyles();

    if (!draggedTabId || draggedTabId === tabId) return;

    const rect = card.getBoundingClientRect();
    const placeBefore = e.clientY < (rect.top + rect.height / 2);

    await handleDropReorder(draggedTabId, tabId, placeBefore);
  });
}

function clearDragOverStyles() {
  document.querySelectorAll('.tab-card').forEach(c => {
    c.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

// Перестановка элементов и синхронизация с вкладками Chrome
async function handleDropReorder(sourceId, targetId, placeBefore) {
  const fromIndex = currentActiveTabs.findIndex(t => t.id === sourceId);
  const toIndex = currentActiveTabs.findIndex(t => t.id === targetId);

  if (fromIndex === -1 || toIndex === -1) return;

  // Перемещаем в массиве
  const [movedTab] = currentActiveTabs.splice(fromIndex, 1);
  let insertAt = currentActiveTabs.findIndex(t => t.id === targetId);
  if (!placeBefore) insertAt += 1;

  currentActiveTabs.splice(insertAt, 0, movedTab);

  // Сохраняем кастомный порядок
  const newOrderIds = currentActiveTabs.map(t => t.id);
  await chrome.storage.local.set({ customOrder: newOrderIds });

  // Перемещаем реальную вкладку в Chrome (синхронизация с браузером!)
  try {
    await chrome.tabs.move(sourceId, { index: insertAt });
  } catch (err) {
    console.warn('Не удалось сдвинуть таб в Chrome:', err);
  }

  renderActiveTabs();
}

// ----------------- ОТРИСОВКА ИСТОРИИ ЗАКРЫТЫХ -----------------
function renderClosedTabs() {
  const listEl = document.getElementById('closedTabsList');
  if (!listEl) return;

  const searchQuery = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  const filtered = currentClosedTabs.filter(tab => {
    if (!searchQuery) return true;
    return (tab.title && tab.title.toLowerCase().includes(searchQuery)) ||
           (tab.url && tab.url.toLowerCase().includes(searchQuery));
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-cloud-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <div class="empty-title">${searchQuery ? 'Ничего не найдено' : 'История пуста'}</div>
        <div class="empty-desc">Когда вы закроете вкладку, она сохранится здесь со временем жизни</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  filtered.forEach(tab => {
    const card = document.createElement('li');
    card.className = 'tab-card';

    const closedTimeStr = formatTimeAgo(tab.closedAt || Date.now());
    const lifespanStr = formatDuration(tab.lifespanMs || 0);

    const faviconHtml = tab.favIconUrl && tab.favIconUrl.startsWith('http')
      ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" alt="" onerror="this.outerHTML='<div class=\\'tab-fallback-icon\\'>☁</div>'">`
      : `<div class="tab-fallback-icon">☁</div>`;

    card.innerHTML = `
      ${faviconHtml}
      <div class="tab-details">
        <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
        <span class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(cleanUrl(tab.url))}</span>
      </div>
      <div class="tab-meta-badges">
        <span class="time-badge" title="Жизнь таба: ${lifespanStr}">жил ${lifespanStr}</span>
        <button class="btn-restore-tab" title="Открыть вкладку снова">Восстановить</button>
      </div>
    `;

    const restoreBtn = card.querySelector('.btn-restore-tab');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (tab.url) {
          await chrome.tabs.create({ url: tab.url });
        }
      });
    }

    listEl.appendChild(card);
  });
}

// ----------------- СТАТИСТИКА -----------------
function renderStats() {
  const activeCountEl = document.getElementById('statActiveCount');
  const closedCountEl = document.getElementById('statClosedCount');
  const avgLifespanEl = document.getElementById('statAvgLifespan');
  const oldestTabEl = document.getElementById('statOldestTab');
  const oldestTabTitleEl = document.getElementById('statOldestTabTitle');

  if (activeCountEl) activeCountEl.textContent = String(currentActiveTabs.length);
  if (closedCountEl) closedCountEl.textContent = String(currentClosedTabs.length);

  // Среднее время жизни закрытых табов
  if (currentClosedTabs.length > 0) {
    const totalMs = currentClosedTabs.reduce((acc, t) => acc + (t.lifespanMs || 0), 0);
    const avgMs = Math.round(totalMs / currentClosedTabs.length);
    if (avgLifespanEl) avgLifespanEl.textContent = formatDuration(avgMs);
  } else {
    if (avgLifespanEl) avgLifespanEl.textContent = '—';
  }

  // Старейший открытый таб
  if (currentActiveTabs.length > 0) {
    const oldest = currentActiveTabs.reduce((min, t) => (t.openedAt < min.openedAt ? t : min), currentActiveTabs[0]);
    const age = Date.now() - oldest.openedAt;
    if (oldestTabEl) oldestTabEl.textContent = formatDuration(age);
    if (oldestTabTitleEl) oldestTabTitleEl.textContent = oldest.title || 'Новая вкладка';
  } else {
    if (oldestTabEl) oldestTabEl.textContent = '—';
    if (oldestTabTitleEl) oldestTabTitleEl.textContent = 'нет данных';
  }
}

// Раскрытие аккордеона истории переходов
function toggleHistoryAccordion(card, historyList) {
  let existing = card.querySelector('.history-accordion');
  if (existing) {
    existing.remove();
    return;
  }

  if (!historyList || historyList.length === 0) return;

  const accordion = document.createElement('div');
  accordion.className = 'history-accordion';

  historyList.forEach((step, idx) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'history-step';
    stepEl.innerHTML = `
      <span>${idx + 1}. ${escapeHtml(step.title || cleanUrl(step.url))}</span>
      <time>${new Date(step.timestamp).toLocaleTimeString()}</time>
    `;
    accordion.appendChild(stepEl);
  });

  card.appendChild(accordion);
}

// ----------------- ДЕЙСТВИЯ С ТАБАМИ -----------------
async function switchToTab(tabId, windowId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    if (windowId) {
      await chrome.windows.update(windowId, { focused: true });
    }
  } catch (err) {
    console.warn('Не удалось активировать таб:', err);
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    currentActiveTabs = currentActiveTabs.filter(t => t.id !== tabId);
    renderActiveTabs();
  } catch (err) {
    console.warn('Не удалось закрыть таб:', err);
  }
}

// ----------------- НАВИГАЦИЯ И ПОИСК -----------------
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');

      const target = tabBtn.dataset.tab;
      document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));

      if (target === 'active') document.getElementById('viewActive')?.classList.add('active');
      if (target === 'history') document.getElementById('viewHistory')?.classList.add('active');
      if (target === 'stats') document.getElementById('viewStats')?.classList.add('active');
    });
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  if (!input) return;

  input.addEventListener('input', () => {
    const hasValue = input.value.trim().length > 0;
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasValue);
    renderActiveTabs();
    renderClosedTabs();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      renderActiveTabs();
      renderClosedTabs();
      input.focus();
    });
  }
}

function setupActions() {
  // Кнопка разворачивания на весь экран
  document.getElementById('btnOpenDashboard')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Кнопка очистки истории
  document.getElementById('btnClearHistory')?.addEventListener('click', async () => {
    if (confirm('Очистить всю историю закрытых вкладок?')) {
      await chrome.runtime.sendMessage({ action: 'clearClosedHistory' });
      currentClosedTabs = [];
      renderClosedTabs();
      renderStats();
      updateHeaderCounters(currentActiveTabs.length, 0);
    }
  });

  // Кнопка принудительной синхронизации
  document.getElementById('btnSyncNow')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'sync' });
    await loadAndRender();
  });
}

// ----------------- УТИЛИТЫ ФОРМАТИРОВАНИЯ -----------------
function cleanUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
  } catch {
    return url;
  }
}

function formatDuration(ms) {
  if (ms < 1000) return 'только что';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч ${min % 60} м`;
  const days = Math.floor(hours / 24);
  return `${days} дн ${hours % 24} ч`;
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return 'только что';
  const min = Math.floor(diff / (60 * 1000));
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

function getTabWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'вкладок';
  if (mod10 === 1) return 'вкладка';
  if (mod10 >= 2 && mod10 <= 4) return 'вкладки';
  return 'вкладок';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

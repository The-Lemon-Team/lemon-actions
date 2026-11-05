// Background Service Worker for Tab Cloud (Manifest V3)

const MAX_HISTORY_ITEMS = 500;

// Установка цвета бейджа (небесно-голубой)
chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });

// Функция обновления счетчика на бейдже
async function updateTabBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  } catch (err) {
    console.error('Ошибка обновления бейджа:', err);
  }
}

// Первичная синхронизация открытых вкладок со storage
async function syncTabsWithStorage() {
  try {
    const chromeTabs = await chrome.tabs.query({});
    const { activeTabs = {}, closedTabs = [] } = await chrome.storage.local.get(['activeTabs', 'closedTabs']);
    const now = Date.now();

    const currentTabIds = new Set(chromeTabs.map(t => t.id));
    const updatedActiveTabs = { ...activeTabs };

    // 1. Проверяем вкладки, которые закрылись пока браузер / сервис воркер спал
    for (const [idStr, record] of Object.entries(activeTabs)) {
      const id = Number(idStr);
      if (!currentTabIds.has(id)) {
        closedTabs.unshift({
          ...record,
          closedAt: now,
          lifespanMs: Math.max(0, now - (record.openedAt || now))
        });
        delete updatedActiveTabs[idStr];
      }
    }

    // Ограничиваем историю
    const trimmedClosed = closedTabs.slice(0, MAX_HISTORY_ITEMS);

    // 2. Добавляем новые вкладки
    for (const tab of chromeTabs) {
      if (!updatedActiveTabs[tab.id]) {
        updatedActiveTabs[tab.id] = {
          id: tab.id,
          windowId: tab.windowId,
          index: tab.index,
          url: tab.url || tab.pendingUrl || '',
          title: tab.title || 'Новая вкладка',
          favIconUrl: tab.favIconUrl || '',
          openedAt: now,
          lastActiveAt: now,
          history: tab.url && !tab.url.startsWith('chrome://newtab')
            ? [{ url: tab.url, title: tab.title || '', timestamp: now }]
            : []
        };
      } else {
        // Обновляем текущее состояние
        updatedActiveTabs[tab.id].index = tab.index;
        if (tab.url) updatedActiveTabs[tab.id].url = tab.url;
        if (tab.title) updatedActiveTabs[tab.id].title = tab.title;
        if (tab.favIconUrl) updatedActiveTabs[tab.id].favIconUrl = tab.favIconUrl;
      }
    }

    await chrome.storage.local.set({
      activeTabs: updatedActiveTabs,
      closedTabs: trimmedClosed
    });

    await updateTabBadge();
  } catch (err) {
    console.error('Ошибка синхронизации вкладок:', err);
  }
}

// 1. Слушатель открытия новой вкладки
chrome.tabs.onCreated.addListener(async (tab) => {
  const now = Date.now();
  const { activeTabs = {} } = await chrome.storage.local.get('activeTabs');

  const initialUrl = tab.url || tab.pendingUrl || '';
  activeTabs[tab.id] = {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    url: initialUrl,
    title: tab.title || 'Новая вкладка',
    favIconUrl: tab.favIconUrl || '',
    openedAt: now,
    lastActiveAt: now,
    history: initialUrl && !initialUrl.startsWith('chrome://newtab')
      ? [{ url: initialUrl, title: tab.title || '', timestamp: now }]
      : []
  };

  await chrome.storage.local.set({ activeTabs });
  await updateTabBadge();
});

// 2. Слушатель обновления вкладки (смена URL, загрузка страницы, смена тайтла)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { activeTabs = {} } = await chrome.storage.local.get('activeTabs');
  const record = activeTabs[tabId];
  if (!record) return;

  let hasChanges = false;

  if (changeInfo.title && changeInfo.title !== record.title) {
    record.title = changeInfo.title;
    hasChanges = true;
  }

  if (changeInfo.favIconUrl && changeInfo.favIconUrl !== record.favIconUrl) {
    record.favIconUrl = changeInfo.favIconUrl;
    hasChanges = true;
  }

  if (changeInfo.url && changeInfo.url !== record.url) {
    const newUrl = changeInfo.url;
    record.url = newUrl;
    if (tab.title) record.title = tab.title;

    // Добавляем переход в цепочку истории внутри таба
    if (!newUrl.startsWith('chrome://newtab')) {
      if (!record.history) record.history = [];
      const lastHistoryEntry = record.history[record.history.length - 1];
      if (!lastHistoryEntry || lastHistoryEntry.url !== newUrl) {
        record.history.push({
          url: newUrl,
          title: tab.title || newUrl,
          timestamp: Date.now()
        });
      }
    }
    hasChanges = true;
  }

  if (hasChanges) {
    activeTabs[tabId] = record;
    await chrome.storage.local.set({ activeTabs });
  }
});

// 3. Слушатель активации (перехода пользователя на вкладку)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { activeTabs = {} } = await chrome.storage.local.get('activeTabs');
  if (activeTabs[activeInfo.tabId]) {
    activeTabs[activeInfo.tabId].lastActiveAt = Date.now();
    await chrome.storage.local.set({ activeTabs });
  }
});

// 4. Слушатель закрытия вкладки
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const now = Date.now();
  const { activeTabs = {}, closedTabs = [] } = await chrome.storage.local.get(['activeTabs', 'closedTabs']);

  const closingRecord = activeTabs[tabId];
  if (closingRecord) {
    const lifespan = Math.max(0, now - (closingRecord.openedAt || now));
    const closedEntry = {
      ...closingRecord,
      closedAt: now,
      lifespanMs: lifespan
    };

    // Добавляем в начало истории закрытых
    closedTabs.unshift(closedEntry);
    if (closedTabs.length > MAX_HISTORY_ITEMS) {
      closedTabs.length = MAX_HISTORY_ITEMS;
    }

    delete activeTabs[tabId];
    await chrome.storage.local.set({ activeTabs, closedTabs });
  }

  await updateTabBadge();
});

// Синхронизация при запуске браузера и установке расширения
chrome.runtime.onInstalled.addListener(() => {
  syncTabsWithStorage();
});

chrome.runtime.onStartup.addListener(() => {
  syncTabsWithStorage();
});

// Поддержка сообщений из интерфейса (например, принудительный sync или удаление истории)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sync') {
    syncTabsWithStorage().then(() => sendResponse({ status: 'ok' }));
    return true;
  }
  if (request.action === 'clearClosedHistory') {
    chrome.storage.local.set({ closedTabs: [] }).then(() => sendResponse({ status: 'ok' }));
    return true;
  }
});

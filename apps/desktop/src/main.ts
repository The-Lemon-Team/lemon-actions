import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { DEFAULT_DOCK_CONFIG } from './defaults';
import { DockConfig, HealthStatus, OpenMode, StackApp } from './types';

const STORAGE_FALLBACK_KEY = 'lemon-dock-config-v1';
const COMPACT_HEIGHT = 74;
const EXPANDED_HEIGHT = 468;
const HEALTH_POLL_INTERVAL_MS = 15000;

const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

class LemonDockController {
  private config: DockConfig = structuredClone(DEFAULT_DOCK_CONFIG);
  private healthMap = new Map<string, HealthStatus>();
  private isExpanded = false;
  private editingAppId: string | null = null;
  private rootEl: HTMLElement;

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
  }

  async init(): Promise<void> {
    await this.loadConfig();
    await this.syncWindowState();
    await this.syncTrayApps();
    this.render();
    void this.refreshAllHealth();
    setInterval(() => void this.refreshAllHealth(), HEALTH_POLL_INTERVAL_MS);
  }

  private async loadConfig(): Promise<void> {
    try {
      const raw = isTauriRuntime()
        ? await invoke<string | null>('load_apps_config')
        : localStorage.getItem(STORAGE_FALLBACK_KEY);

      if (raw) {
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as DockConfig;
        const existingIds = new Set(parsed.apps.map((a) => a.id));
        const missingDefaults = DEFAULT_DOCK_CONFIG.apps.filter((a) => !existingIds.has(a.id));
        if (missingDefaults.length > 0) {
          parsed.apps.push(...structuredClone(missingDefaults));
          this.config = parsed;
          await this.saveConfig();
          return;
        }
        this.config = parsed;
        return;
      }
    } catch (err) {
      console.warn('Failed to load dock config, using defaults:', err);
    }
    this.config = structuredClone(DEFAULT_DOCK_CONFIG);
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    const json = JSON.stringify(this.config, null, 2);
    if (isTauriRuntime()) {
      await invoke('save_apps_config', { json });
      await this.syncTrayApps();
    } else {
      localStorage.setItem(STORAGE_FALLBACK_KEY, json);
    }
  }

  private async syncTrayApps(): Promise<void> {
    if (!isTauriRuntime()) return;
    try {
      await invoke('sync_tray_apps', { apps: this.config.apps });
    } catch (err) {
      console.warn('Failed to sync tray apps:', err);
    }
  }

  private async syncWindowState(): Promise<void> {
    if (!isTauriRuntime()) return;
    try {
      await invoke('set_always_on_top', { onTop: this.config.alwaysOnTop });
      await this.resizeDockWindow();
    } catch (err) {
      console.warn('Window sync failed:', err);
    }
  }

  private async resizeDockWindow(): Promise<void> {
    if (!isTauriRuntime()) return;
    const pinnedCount = this.config.apps.filter((a) => a.pinned).length;
    const dockWidth = Math.min(1200, Math.max(620, pinnedCount * 86 + 220));
    const width = this.isExpanded ? Math.max(dockWidth, 760) : dockWidth;
    const height = this.isExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;
    await getCurrentWindow().setSize(new LogicalSize(width, height));
  }

  private async refreshAllHealth(): Promise<void> {
    const checks = this.config.apps.map(async (app) => {
      if (!this.healthMap.has(app.id)) {
        this.healthMap.set(app.id, 'checking');
      }
      if (!isTauriRuntime()) {
        this.healthMap.set(app.id, 'unknown');
        return;
      }
      try {
        const alive = await invoke<boolean>('check_service_health', { url: app.url });
        this.healthMap.set(app.id, alive ? 'online' : 'offline');
      } catch {
        this.healthMap.set(app.id, 'offline');
      }
    });

    await Promise.all(checks);
    this.updateStatusDots();
  }

  private updateStatusDots(): void {
    for (const app of this.config.apps) {
      const dot = this.rootEl.querySelector<HTMLElement>(`[data-status-for="${app.id}"]`);
      if (!dot) continue;
      const status = this.healthMap.get(app.id) ?? 'unknown';
      dot.className = `status-dot ${status}`;
    }
  }

  private async launchApp(app: StackApp, modeOverride?: OpenMode): Promise<void> {
    const mode = modeOverride ?? app.openMode;
    if (!isTauriRuntime()) {
      window.open(app.url, '_blank', 'noopener');
      return;
    }

    try {
      if (mode === 'webview') {
        await invoke('open_app_window', {
          id: app.id,
          title: app.name,
          url: app.url,
        });
      } else {
        await openUrl(app.url);
      }
    } catch (err) {
      console.error(`Failed to launch ${app.name}:`, err);
    }
  }

  private async toggleAlwaysOnTop(): Promise<void> {
    this.config.alwaysOnTop = !this.config.alwaysOnTop;
    await this.saveConfig();
    if (isTauriRuntime()) {
      await invoke('set_always_on_top', { onTop: this.config.alwaysOnTop });
    }
    this.render();
  }

  private async toggleExpanded(focusAppId?: string): Promise<void> {
    this.isExpanded = focusAppId ? true : !this.isExpanded;
    if (focusAppId) {
      this.editingAppId = focusAppId;
    } else if (!this.isExpanded) {
      this.editingAppId = null;
    }
    await this.resizeDockWindow();
    this.render();
  }

  private async hideToTray(): Promise<void> {
    if (isTauriRuntime()) {
      await invoke('hide_main_window');
    }
  }

  private async togglePin(appId: string): Promise<void> {
    const app = this.config.apps.find((a) => a.id === appId);
    if (!app) return;
    app.pinned = !app.pinned;
    await this.saveConfig();
    await this.resizeDockWindow();
    this.render();
  }

  private async moveApp(appId: string, delta: -1 | 1): Promise<void> {
    const idx = this.config.apps.findIndex((a) => a.id === appId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= this.config.apps.length) return;
    const [item] = this.config.apps.splice(idx, 1);
    this.config.apps.splice(target, 0, item);
    await this.saveConfig();
    this.render();
  }

  private async deleteApp(appId: string): Promise<void> {
    this.config.apps = this.config.apps.filter((a) => a.id !== appId);
    if (this.editingAppId === appId) {
      this.editingAppId = null;
    }
    await this.saveConfig();
    await this.resizeDockWindow();
    this.render();
  }

  private async resetDefaults(): Promise<void> {
    this.config = structuredClone(DEFAULT_DOCK_CONFIG);
    this.editingAppId = null;
    await this.saveConfig();
    await this.resizeDockWindow();
    this.render();
    void this.refreshAllHealth();
  }

  private render(): void {
    const pinnedApps = this.config.apps.filter((a) => a.pinned);
    const editingApp = this.editingAppId
      ? this.config.apps.find((a) => a.id === this.editingAppId) ?? null
      : null;

    this.rootEl.innerHTML = `
      <div class="dock-bar">
        <div class="drag-handle" data-tauri-drag-region title="Перетащить панель">
          <span class="grip-dots" data-tauri-drag-region>⋮⋮</span>
          <span class="brand-mark" data-tauri-drag-region>🍋</span>
        </div>

        <div class="dock-apps" id="dock-apps">
          ${pinnedApps
            .map((app) => {
              const status = this.healthMap.get(app.id) ?? 'unknown';
              const modeIcon = app.openMode === 'webview' ? '▣' : '↗';
              const titleText = `${app.name}\n${app.url}\nКлик: ${
                app.openMode === 'webview' ? 'в окне Tauri' : 'в браузере'
              } | Shift+клик: альт. режим | ПКМ: настроить`;
              return `
                <button
                  class="app-btn"
                  data-app-id="${escapeAttr(app.id)}"
                  style="--app-accent: ${escapeAttr(app.color)}"
                  title="${escapeAttr(titleText)}"
                >
                  <span class="mode-badge">${modeIcon}</span>
                  <span class="status-dot ${status}" data-status-for="${escapeAttr(app.id)}"></span>
                  <span class="app-icon">${escapeHtml(app.icon)}</span>
                  <span class="app-label">${escapeHtml(app.shortName)}</span>
                </button>
              `;
            })
            .join('')}
        </div>

        <div class="dock-controls">
          <button
            class="ctrl-btn ${this.config.alwaysOnTop ? 'active' : ''}"
            id="btn-ontop"
            title="Поверх всех окон"
          >📌</button>
          <button
            class="ctrl-btn"
            id="btn-refresh"
            title="Проверить доступность сервисов"
          >↻</button>
          <button
            class="ctrl-btn ${this.isExpanded ? 'active' : ''}"
            id="btn-settings"
            title="Настроить приложения и порты"
          >⚙️</button>
          <button
            class="ctrl-btn"
            id="btn-hide"
            title="Свернуть в системный трей"
          >—</button>
        </div>
      </div>

      ${this.isExpanded ? this.renderManagerPanel(editingApp) : ''}
    `;

    this.bindEvents();
  }

  private renderManagerPanel(editingApp: StackApp | null): string {
    return `
      <div class="manager-panel">
        <div class="manager-header">
          <span>Приложения стека Lemon (${this.config.apps.length})</span>
          <span class="manager-hint">Shift+клик по кнопке открывает в альтернативном режиме (WebView ↔ Браузер)</span>
        </div>
        <div class="manager-body">
          <div class="apps-list">
            ${this.config.apps
              .map(
                (app, idx) => `
              <div class="app-row ${this.editingAppId === app.id ? 'selected' : ''}">
                <span class="app-row-icon">${escapeHtml(app.icon)}</span>
                <div class="app-row-info">
                  <div class="app-row-name">${escapeHtml(app.name)}</div>
                  <div class="app-row-url">${escapeHtml(app.url)} · ${
                    app.openMode === 'webview' ? 'Окно' : 'Браузер'
                  }</div>
                </div>
                <div class="row-actions">
                  <button class="mini-btn ${app.pinned ? 'pinned' : ''}" data-pin="${escapeAttr(app.id)}" title="Закрепить на панели">★</button>
                  <button class="mini-btn" data-up="${escapeAttr(app.id)}" ${idx === 0 ? 'disabled' : ''} title="Выше">↑</button>
                  <button class="mini-btn" data-down="${escapeAttr(app.id)}" ${idx === this.config.apps.length - 1 ? 'disabled' : ''} title="Ниже">↓</button>
                  <button class="mini-btn" data-edit="${escapeAttr(app.id)}" title="Редактировать">✎</button>
                  <button class="mini-btn danger" data-del="${escapeAttr(app.id)}" title="Удалить">✕</button>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>

          <form class="editor-form" id="app-editor-form">
            <div class="editor-title">${editingApp ? `Редактировать: ${escapeHtml(editingApp.name)}` : 'Добавить приложение'}</div>
            <div class="field-row">
              <div class="field">
                <label>Название</label>
                <input name="name" required value="${escapeAttr(editingApp?.name ?? '')}" placeholder="Lemon Projectarium" />
              </div>
              <div class="field">
                <label>Короткое имя</label>
                <input name="shortName" required value="${escapeAttr(editingApp?.shortName ?? '')}" placeholder="Projectarium" />
              </div>
            </div>
            <div class="field">
              <label>URL (можно легко сменить порт)</label>
              <input name="url" type="url" required value="${escapeAttr(editingApp?.url ?? 'http://localhost:')}" placeholder="http://localhost:4205/projectarium" />
            </div>
            <div class="field-row">
              <div class="field">
                <label>Иконка (emoji)</label>
                <input name="icon" required value="${escapeAttr(editingApp?.icon ?? '🚀')}" maxlength="4" />
              </div>
              <div class="field">
                <label>Цвет акцента</label>
                <input name="color" type="color" value="${escapeAttr(editingApp?.color ?? '#f7d02c')}" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Режим открытия</label>
                <select name="openMode">
                  <option value="webview" ${editingApp?.openMode !== 'browser' ? 'selected' : ''}>Окно Tauri (WebView)</option>
                  <option value="browser" ${editingApp?.openMode === 'browser' ? 'selected' : ''}>Внешний браузер</option>
                </select>
              </div>
              <div class="field" style="justify-content: flex-end;">
                <label class="checkbox-field">
                  <input name="pinned" type="checkbox" ${editingApp?.pinned ?? true ? 'checked' : ''} />
                  Закрепить на панели
                </label>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">${editingApp ? 'Сохранить' : 'Добавить'}</button>
              ${
                editingApp
                  ? '<button type="button" class="btn-secondary" id="btn-cancel-edit">Новое</button>'
                  : '<button type="button" class="btn-secondary" id="btn-reset-defaults">Сброс</button>'
              }
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-app-id]').forEach((btn) => {
      const appId = btn.dataset.appId!;
      const app = this.config.apps.find((a) => a.id === appId);
      if (!app) return;

      btn.addEventListener('click', (e) => {
        const altMode: OpenMode | undefined = e.shiftKey
          ? app.openMode === 'webview'
            ? 'browser'
            : 'webview'
          : undefined;
        void this.launchApp(app, altMode);
      });

      btn.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          const altMode: OpenMode = app.openMode === 'webview' ? 'browser' : 'webview';
          void this.launchApp(app, altMode);
        }
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        void this.toggleExpanded(app.id);
      });
    });

    this.rootEl.querySelector('#btn-ontop')?.addEventListener('click', () => void this.toggleAlwaysOnTop());
    this.rootEl.querySelector('#btn-refresh')?.addEventListener('click', () => void this.refreshAllHealth());
    this.rootEl.querySelector('#btn-settings')?.addEventListener('click', () => void this.toggleExpanded());
    this.rootEl.querySelector('#btn-hide')?.addEventListener('click', () => void this.hideToTray());

    if (!this.isExpanded) return;

    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach((btn) => {
      btn.addEventListener('click', () => void this.togglePin(btn.dataset.pin!));
    });
    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((btn) => {
      btn.addEventListener('click', () => void this.moveApp(btn.dataset.up!, -1));
    });
    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-down]').forEach((btn) => {
      btn.addEventListener('click', () => void this.moveApp(btn.dataset.down!, 1));
    });
    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.editingAppId = btn.dataset.edit!;
        this.render();
      });
    });
    this.rootEl.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => void this.deleteApp(btn.dataset.del!));
    });

    this.rootEl.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
      this.editingAppId = null;
      this.render();
    });
    this.rootEl.querySelector('#btn-reset-defaults')?.addEventListener('click', () => void this.resetDefaults());

    const form = this.rootEl.querySelector<HTMLFormElement>('#app-editor-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') ?? '').trim();
      const shortName = String(fd.get('shortName') ?? '').trim();
      const url = String(fd.get('url') ?? '').trim();
      const icon = String(fd.get('icon') ?? '🚀').trim() || '🚀';
      const color = String(fd.get('color') ?? '#f7d02c');
      const openMode = (fd.get('openMode') === 'browser' ? 'browser' : 'webview') as OpenMode;
      const pinned = fd.get('pinned') === 'on';

      if (!name || !shortName || !url) return;

      if (this.editingAppId) {
        const target = this.config.apps.find((a) => a.id === this.editingAppId);
        if (target) {
          target.name = name;
          target.shortName = shortName;
          target.url = url;
          target.icon = icon;
          target.color = color;
          target.openMode = openMode;
          target.pinned = pinned;
        }
        this.editingAppId = null;
      } else {
        const id = `${shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
        this.config.apps.push({ id, name, shortName, url, icon, color, openMode, pinned });
      }

      await this.saveConfig();
      await this.resizeDockWindow();
      this.render();
      void this.refreshAllHealth();
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

const appRoot = document.getElementById('app');
if (appRoot) {
  const controller = new LemonDockController(appRoot);
  void controller.init();
}

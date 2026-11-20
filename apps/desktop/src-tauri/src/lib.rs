use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;
use tokio::net::TcpStream;
use tokio::time::timeout;

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayAppItem {
    id: String,
    name: String,
    url: String,
    icon: String,
    open_mode: String,
    pinned: bool,
}

struct TrayState {
    tray: TrayIcon,
    apps: Mutex<Vec<TrayAppItem>>,
}

fn config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    Ok(dir.join("apps.json"))
}

fn sanitize_label(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    format!("app-{}", cleaned.trim_matches('-'))
}

#[tauri::command]
async fn open_app_window(
    app: AppHandle,
    id: String,
    title: String,
    url: String,
) -> Result<(), String> {
    let label = sanitize_label(&id);

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL '{url}': {e}"))?;

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title(&title)
        .inner_size(1280.0, 820.0)
        .min_inner_size(520.0, 380.0)
        .center()
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|e| format!("Failed to open app window: {e}"))?;

    Ok(())
}

#[tauri::command]
async fn check_service_health(url: String) -> bool {
    let Ok(parsed) = url::Url::parse(&url) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let Some(port) = parsed.port_or_known_default() else {
        return false;
    };

    let addr = format!("{host}:{port}");
    matches!(
        timeout(Duration::from_millis(650), TcpStream::connect(addr)).await,
        Ok(Ok(_))
    )
}

#[tauri::command]
fn load_apps_config(app: AppHandle) -> Result<Option<String>, String> {
    let path = config_file_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config '{}': {e}", path.display()))?;
    Ok(Some(content))
}

#[tauri::command]
fn save_apps_config(app: AppHandle, json: String) -> Result<(), String> {
    let path = config_file_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir '{}': {e}", parent.display()))?;
    }
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write config '{}': {e}", path.display()))?;
    Ok(())
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, on_top: bool) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_always_on_top(on_top)
            .map_err(|e| format!("Failed to set always on top: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide().map_err(|e| format!("Failed to hide window: {e}"))?;
    }
    Ok(())
}

fn build_tray_menu(app: &AppHandle, apps: &[TrayAppItem]) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    let toggle_i = MenuItem::with_id(app, "toggle", "Показать / Скрыть панель", true, None::<&str>)?;
    menu.append(&toggle_i)?;

    let pinned: Vec<&TrayAppItem> = apps.iter().filter(|a| a.pinned).collect();
    if !pinned.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        for item in pinned {
            let label = format!("{} {}", item.icon, item.name);
            let menu_id = format!("launch:{}", item.id);
            let app_item = MenuItem::with_id(app, menu_id, label, true, None::<&str>)?;
            menu.append(&app_item)?;
        }
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
    menu.append(&quit_i)?;
    Ok(menu)
}

#[tauri::command]
fn sync_tray_apps(
    app: AppHandle,
    state: State<'_, TrayState>,
    apps: Vec<TrayAppItem>,
) -> Result<(), String> {
    let menu = build_tray_menu(&app, &apps)
        .map_err(|e| format!("Failed to build tray menu: {e}"))?;
    state
        .tray
        .set_menu(Some(menu))
        .map_err(|e| format!("Failed to update tray menu: {e}"))?;
    if let Ok(mut guard) = state.apps.lock() {
        *guard = apps;
    }
    Ok(())
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let is_visible = win.is_visible().unwrap_or(false);
        if is_visible {
            let _ = win.hide();
        } else {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let menu = build_tray_menu(app.handle(), &[])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Lemon Dock — Быстрый доступ")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    if id == "toggle" {
                        toggle_main_window(app);
                    } else if id == "quit" {
                        app.exit(0);
                    } else if let Some(app_id) = id.strip_prefix("launch:") {
                        let target = app
                            .try_state::<TrayState>()
                            .and_then(|s| s.apps.lock().ok().and_then(|list| {
                                list.iter().find(|a| a.id == app_id).cloned()
                            }));

                        if let Some(item) = target {
                            if item.open_mode == "browser" {
                                let _ = app.opener().open_url(&item.url, None::<&str>);
                            } else {
                                let handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = open_app_window(handle, item.id, item.name, item.url).await;
                                });
                            }
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let tray = tray_builder.build(app)?;
            app.manage(TrayState {
                tray,
                apps: Mutex::new(Vec::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_app_window,
            check_service_health,
            load_apps_config,
            save_apps_config,
            set_always_on_top,
            hide_main_window,
            sync_tray_apps,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

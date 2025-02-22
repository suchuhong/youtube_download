#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_window::init())
        .setup(|app| {
            let app_handle = app.handle();
            
            // Start Python backend
            std::thread::spawn(move || {
                let python_path = if cfg!(target_os = "windows") {
                    "python"
                } else {
                    "python3"
                };

                let status = Command::new(python_path)
                    .args(&["backend/main.py"])
                    .status()
                    .expect("Failed to start Python backend");

                if !status.success() {
                    app_handle.emit_all("backend-error", "Backend process terminated").unwrap();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
} 
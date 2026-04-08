// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 방금 만든 commands 모듈을 불러옵니다.
mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            
            // 📂 Filesystem 도구들
            commands::filesystem::list_directory,
            commands::filesystem::read_text_file,
            commands::filesystem::write_text_file, 
            commands::filesystem::delete_path,
            commands::filesystem::find_files,
            commands::filesystem::copy_path,
            commands::filesystem::move_path,
            commands::filesystem::get_user_home,

            // 🚀 Application 도구들
            commands::application::open_application,
            commands::application::find_application,
            commands::application::kill_process,

            // 💻 System Info 도구들
            commands::system::get_system_info,
            commands::system::get_realtime_system_info,
            commands::system::get_network_info,
            commands::system::get_battery_info,
            commands::system::control_system,
            commands::system::control_audio,
            commands::system::get_display_info,
            commands::system::control_brightness,

            // 🌐 Browser 도구들
            commands::browser::web_search,
            commands::browser::open_url,
            commands::browser::read_webpage,

            // 👁️ Desktop Control 도구들
            commands::desktop::move_mouse_and_click,
            commands::desktop::type_text,
            commands::desktop::take_screenshot,
            commands::desktop::resize_window,
            commands::desktop::get_active_window_info,
            
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 애플리케이션 실행 중 에러 발생");
}
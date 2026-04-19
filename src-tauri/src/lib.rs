pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            
            // 📂 Filesystem 모듈
            commands::filesystem::list_directory,
            commands::filesystem::read_text_file,
            commands::filesystem::write_text_file, 
            commands::filesystem::delete_path,
            commands::filesystem::find_files,
            commands::filesystem::copy_path,
            commands::filesystem::move_path,
            commands::filesystem::get_user_home,

            // 🚀 Application 모듈
            commands::application::open_application,
            commands::application::find_application,
            commands::application::kill_process,

            // 💻 System Info 모듈
            commands::system::get_system_info,
            commands::system::get_realtime_system_info,
            commands::system::get_network_info,
            commands::system::get_battery_info,
            commands::system::control_system,
            commands::system::control_audio,
            commands::system::get_display_info,
            commands::system::control_brightness,
            commands::system::resize_window,

            // 🌐 Browser 모듈
            commands::browser::web_search,
            commands::browser::open_url,
            commands::browser::read_webpage,

        ])
        .run(tauri::generate_context!())
        .expect("Tauri 애플리케이션 실행 중 에러 발생");
}
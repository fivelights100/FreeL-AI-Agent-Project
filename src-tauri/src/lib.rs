use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 💡 expect() 대신 match를 사용하여 파일이 없어도 앱이 죽지 않게 방어합니다.
            match app.shell().sidecar("freel-scanner") {
                Ok(sidecar) => {
                    match sidecar.spawn() {
                        Ok(_) => println!("[Tauri] 백엔드 스캐너가 성공적으로 실행되었습니다."),
                        Err(e) => eprintln!("[Tauri 에러] 스캐너 실행 실패: {}", e),
                    }
                }
                Err(e) => eprintln!("[Tauri 에러] 스캐너 파일을 찾을 수 없습니다: {}", e),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
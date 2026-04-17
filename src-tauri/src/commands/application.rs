use std::env;
use ignore::WalkBuilder;
use sysinfo::System;
use tauri::command;

// Windows 레지스트리 탐색을 위한 모듈 (Windows 환경에서만 컴파일되도록 안전 처리)
#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[command]
pub fn open_application(app_name: String, args: Option<Vec<String>>) -> Result<String, String> {
    let mut cmd = std::process::Command::new("cmd");
    cmd.arg("/C").arg("start").arg(""); 
    cmd.arg(&app_name);

    if let Some(arguments) = &args {
        cmd.args(arguments);
    }

    match cmd.spawn() {
        Ok(_) => {
            if let Some(arguments) = args {
                Ok(format!("'{}' 프로그램을 다음 인수와 함께 실행했습니다: {:?}", app_name, arguments))
            } else {
                Ok(format!("'{}' 프로그램을 실행했습니다.", app_name))
            }
        },
        Err(e) => Err(format!("'{}' 실행 실패: {}", app_name, e)),
    }
}

#[command]
pub fn find_application(name: String) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    let name_lower = name.to_lowercase();

    #[cfg(target_os = "windows")]
    {
        // 1. 레지스트리 스캔: App Paths (Win+R 실행 경로, 크롬/오피스 등 가장 정확한 .exe 경로)
        let app_paths = [
            (HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths"),
            (HKEY_CURRENT_USER, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths"),
        ];

        for (hkey, path) in app_paths.iter() {
            let root = RegKey::predef(*hkey);
            if let Ok(app_paths_key) = root.open_subkey(path) {
                for key_name in app_paths_key.enum_keys().filter_map(|k| k.ok()) {
                    if key_name.to_lowercase().contains(&name_lower) {
                        if let Ok(app_key) = app_paths_key.open_subkey(&key_name) {
                            if let Ok(exe_path) = app_key.get_value::<String, _>("") {
                                results.push(exe_path);
                            }
                        }
                    }
                }
            }
        }

        // 2. 레지스트리 스캔: 제어판 프로그램 목록 (Uninstall 경로)
        let uninstall_paths = [
            (HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
            (HKEY_LOCAL_MACHINE, "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
            (HKEY_CURRENT_USER, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        ];

        for (hkey, path) in uninstall_paths.iter() {
            let root = RegKey::predef(*hkey);
            if let Ok(uninstall_key) = root.open_subkey(path) {
                for key_name in uninstall_key.enum_keys().filter_map(|k| k.ok()) {
                    if let Ok(app_key) = uninstall_key.open_subkey(&key_name) {
                        // DisplayName(앱 이름)에 검색어가 포함되어 있다면
                        if let Ok(display_name) = app_key.get_value::<String, _>("DisplayName") {
                            if display_name.to_lowercase().contains(&name_lower) {
                                // 해당 앱의 아이콘 경로(보통 실제 exe 경로와 동일)를 추출
                                if let Ok(mut icon_path) = app_key.get_value::<String, _>("DisplayIcon") {
                                    if let Some(idx) = icon_path.rfind(',') {
                                        icon_path.truncate(idx); // 경로 끝에 붙은 아이콘 인덱스(",0") 제거
                                    }
                                    let clean_path = icon_path.trim_matches('"').to_string();
                                    if clean_path.to_lowercase().ends_with(".exe") {
                                        results.push(clean_path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. 기존 방식: 바탕화면 및 시작 메뉴의 바로가기(.lnk) 탐색 (레지스트리에 없는 휴대용 앱용)
    let mut search_paths = Vec::new();
    if let Ok(appdata) = env::var("APPDATA") { search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", appdata)); }
    if let Ok(programdata) = env::var("PROGRAMDATA") { search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", programdata)); }
    if let Ok(userprofile) = env::var("USERPROFILE") { search_paths.push(format!("{}\\Desktop", userprofile)); }
    if let Ok(public) = env::var("PUBLIC") { search_paths.push(format!("{}\\Desktop", public)); }

    for base_path in search_paths {
        let walker = WalkBuilder::new(&base_path).max_depth(Some(3)).build();
        for result in walker {
            if let Ok(entry) = result {
                let path = entry.path();
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        let lower_filename = filename.to_lowercase();
                        
                        // .url 확장자도 수집하도록 조건을 추가합니다!
                        if lower_filename.contains(&name_lower) && (lower_filename.ends_with(".lnk") || lower_filename.ends_with(".url")) {
                            results.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
    // 최종 결과 필터링 (중복 제거 및 상위 10개만 반환)
    results.sort();
    results.dedup();
    results.truncate(10);

    Ok(results)
}

#[command]
pub fn kill_process(name: String) -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    let mut killed_count = 0;
    
    let target_name = name.to_lowercase().replace(".exe", "");
    
    for (_pid, process) in sys.processes() {
        let p_name = process.name().to_string_lossy().to_lowercase();
        if p_name.contains(&target_name) {
            if process.kill() { killed_count += 1; }
        }
    }
    
    if killed_count > 0 {
        Ok(format!("'{}' 프로그램이 성공적으로 종료되었습니다. (관련 프로세스 {}개 강제 종료됨)", name, killed_count))
    } else {
        Ok(format!("'{}' 이름의 실행 중인 프로그램을 찾지 못했거나, 종료할 권한이 없습니다.", name))
    }
}
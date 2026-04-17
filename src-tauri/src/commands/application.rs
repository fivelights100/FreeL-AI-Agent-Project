use std::env;
// 👇 walkdir::WalkDir 대신 ignore::WalkBuilder를 가져옵니다.
use ignore::WalkBuilder;
use sysinfo::System;
use tauri::command;

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
    let mut search_paths = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") { 
        search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", appdata)); 
    }
    if let Ok(programdata) = env::var("PROGRAMDATA") { 
        search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", programdata)); 
    }
    if let Ok(userprofile) = env::var("USERPROFILE") { 
        search_paths.push(format!("{}\\Desktop", userprofile)); 
    }
    if let Ok(public) = env::var("PUBLIC") { 
        search_paths.push(format!("{}\\Desktop", public)); 
    }

    for base_path in search_paths {
        // 👇 ignore::WalkBuilder를 사용하여 시작 메뉴와 바탕화면 탐색 (깊이 3)
        let walker = WalkBuilder::new(&base_path).max_depth(Some(3)).build();
        
        for result in walker {
            if let Ok(entry) = result {
                let path = entry.path();
                if path.is_file() {
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        // .lnk(바로가기) 파일만 수집
                        if filename.to_lowercase().contains(&name_lower) && filename.ends_with(".lnk") {
                            results.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
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
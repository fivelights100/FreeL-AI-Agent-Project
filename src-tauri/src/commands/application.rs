use std::env;
use walkdir::WalkDir;
use sysinfo::System;
use tauri::command;

#[command]
pub fn open_application(app_name: String, args: Option<Vec<String>>) -> Result<String, String> {
    // 💡 핵심 변경: Windows의 'start' 명령어를 사용하여 .lnk(바로가기) 및 레지스트리 등록 앱 실행 지원
    let mut cmd = std::process::Command::new("cmd");
    cmd.arg("/C").arg("start").arg(""); // ""는 start 명령어의 타이틀 버그 방지용 빈 문자열
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

    // 1. 현재 사용자 시작 메뉴
    if let Ok(appdata) = env::var("APPDATA") { 
        search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", appdata)); 
    }
    // 2. 모든 사용자(공용) 시작 메뉴
    if let Ok(programdata) = env::var("PROGRAMDATA") { 
        search_paths.push(format!("{}\\Microsoft\\Windows\\Start Menu\\Programs", programdata)); 
    }
    // 3. 현재 사용자 바탕화면
    if let Ok(userprofile) = env::var("USERPROFILE") { 
        search_paths.push(format!("{}\\Desktop", userprofile)); 
    }
    // 4. 모든 사용자(공용) 바탕화면 추가
    if let Ok(public) = env::var("PUBLIC") { 
        search_paths.push(format!("{}\\Desktop", public)); 
    }

    for base_path in search_paths {
        // 시작 메뉴와 바탕화면은 깊이가 깊지 않으므로 max_depth(3) 정도로 제한하여 속도 향상
        for entry in WalkDir::new(&base_path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
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
    
    // 검색 결과 중복 제거 및 최대 10개만 반환 (토큰 절약)
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
    
    // 프로세스 이름은 보통 .exe가 붙어있으므로 유연하게 처리
    let target_name = name.to_lowercase().replace(".exe", "");
    
    for (_pid, process) in sys.processes() {
        let p_name = process.name().to_string_lossy().to_lowercase();
        // 크롬 같은 경우 'chrome.exe' 프로세스가 여러 개 생성되므로 포함(contains) 여부로 확인
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
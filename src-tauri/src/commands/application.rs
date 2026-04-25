use std::env;
use std::fs;
use std::path::PathBuf;
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

    // 1. 기존 방식: 바탕화면 및 시작 메뉴의 바로가기(.lnk, .url) 탐색
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
                        if lower_filename.contains(&name_lower) && (lower_filename.ends_with(".lnk") || lower_filename.ends_with(".url")) {
                            results.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. file-scanner 검색 모드 연동 (인수 전달 및 결과 캡처)
    // AI가 "오버워치 overwatch" 처럼 공백으로 여러 개를 줄 수 있으므로 쪼개서 인수로 넣습니다.
    let keywords: Vec<&str> = name_lower.split_whitespace().collect();

    let mut cmd = std::process::Command::new("freel-scanner.exe");
    cmd.args(&keywords); // 추출한 키워드들을 freel-scanner.exe의 인수로 전달

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW (검은 창 안 보이게)
    }

    // status()가 아닌 output()을 사용하여 스캐너의 콘솔 출력(stdout)을 가져옴
    if let Ok(output) = cmd.output() {
        if output.status.success() {
            // 한글 경로가 깨지지 않도록 UTF-8로 변환하여 읽음
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            
            // 스캐너가 출력한 경로들을 한 줄씩 읽어서 결과 배열에 추가
            for line in stdout_str.lines() {
                let path_str = line.trim();
                if !path_str.is_empty() {
                    results.push(path_str.to_string());
                }
            }
        }
    }

    // 3. 최종 결과 필터링 (중복 제거 및 AI가 소화하기 좋게 최대 15개로 제한)
    results.sort();
    results.dedup();
    results.truncate(15);

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
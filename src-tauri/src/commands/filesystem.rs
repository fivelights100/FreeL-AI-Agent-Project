use std::fs;
use ignore::WalkBuilder;
use std::sync::{Arc, Mutex}; 
use tauri::command;

#[command]
pub fn list_directory(path: String) -> Result<Vec<String>, String> {
    let mut entries = Vec::new();
    match fs::read_dir(&path) {
        Ok(paths) => {
            for path in paths {
                if let Ok(entry) = path {
                    if let Ok(file_name) = entry.file_name().into_string() {
                        entries.push(file_name);
                    }
                }
            }
            Ok(entries)
        }
        Err(e) => Err(format!("디렉토리를 읽지 못했습니다: {}", e)),
    }
}

#[command]
pub fn read_text_file(path: String) -> Result<String, String> {
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("파일을 읽지 못했습니다: {}", e)),
    }
}

#[command]
pub fn write_text_file(path: String, content: String) -> Result<String, String> {
    match fs::write(&path, content) {
        Ok(_) => Ok(format!("파일 쓰기 성공: {}", path)),
        Err(e) => Err(format!("파일 쓰기 실패: {}", e)),
    }
}

#[command]
pub fn delete_path(path: String) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("경로를 찾을 수 없습니다: {}", e))?;
    if metadata.is_dir() {
        match fs::remove_dir_all(&path) {
            Ok(_) => Ok(format!("폴더 삭제 성공: {}", path)),
            Err(e) => Err(format!("폴더 삭제 실패: {}", e)),
        }
    } else {
        match fs::remove_file(&path) {
            Ok(_) => Ok(format!("파일 삭제 성공: {}", path)),
            Err(e) => Err(format!("파일 삭제 실패: {}", e)),
        }
    }
}

// 👇 초고속 병렬 탐색 엔진으로 교체된 find_files 함수
#[command]
pub fn find_files(path: String, query: String, depth: usize) -> Result<Vec<String>, String> {
    // 멀티스레드 환경에서 안전하게 결과를 담을 배열 (Arc + Mutex)
    let results = Arc::new(Mutex::new(Vec::new()));
    let query_lower = query.to_lowercase();

    let mut builder = WalkBuilder::new(&path);
    builder.add_custom_ignore_filename(".freelignore");
    builder.max_depth(Some(depth));
    // 기본적으로 ignore는 .gitignore, 숨김 파일 등을 자동으로 무시(skip)하여 검색 속도를 극대화합니다.

    // 멀티스레드 병렬 탐색 실행
    builder.build_parallel().run(|| {
        let results_clone = Arc::clone(&results);
        let query_clone = query_lower.clone();
        
        Box::new(move |result| {
            if let Ok(entry) = result {
                let file_name = entry.file_name().to_string_lossy().to_lowercase();
                
                // 파일명에 검색어가 포함되어 있는지 확인
                if file_name.contains(&query_clone) {
                    if let Ok(mut res) = results_clone.lock() {
                        res.push(entry.path().to_string_lossy().into_owned());
                    }
                }
            }
            ignore::WalkState::Continue
        })
    });

    let mut final_results = results.lock().unwrap().clone();
    
    if final_results.is_empty() {
        return Ok(vec!["검색 결과가 없습니다.".to_string()]);
    }
    
    // 순서가 섞인 스레드 검색 결과를 보기 좋게 정렬
    final_results.sort();
    
    Ok(final_results)
}

#[command]
pub fn copy_path(source: String, destination: String) -> Result<String, String> {
    std::fs::copy(&source, &destination)
        .map(|_| format!("성공적으로 복사되었습니다: {} -> {}", source, destination))
        .map_err(|e| format!("복사 실패: {}", e))
}

#[command]
pub fn move_path(source: String, destination: String) -> Result<String, String> {
    std::fs::rename(&source, &destination)
        .map(|_| format!("성공적으로 이동(이름 변경)되었습니다: {} -> {}", source, destination))
        .map_err(|e| format!("이동 실패: {}", e))
}

#[command]
pub fn get_user_home() -> String {
    std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_else(|_| "C:\\".to_string()))
}
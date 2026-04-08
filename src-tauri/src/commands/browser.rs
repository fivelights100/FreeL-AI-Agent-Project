use reqwest::Client;
use std::time::Duration;
use serde_json::Value;
use tauri::command;

// 1. 기존 기능: Tavily API를 이용한 웹 검색
#[command]
pub async fn web_search(query: String, api_key: String) -> Result<String, String> {
    let client = Client::new();
    let res = client.post("https://api.tavily.com/search")
        .json(&serde_json::json!({
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": true
        }))
        .send()
        .await
        .map_err(|e| format!("네트워크 오류: {}", e))?;

    let json: Value = res.json().await.map_err(|e| format!("JSON 파싱 오류: {}", e))?;
    let mut result_text = String::new();
    
    if let Some(answer) = json["answer"].as_str() {
        if !answer.is_empty() { result_text.push_str(&format!("요약 답변: {}\n\n", answer)); }
    }
    
    if let Some(results) = json["results"].as_array() {
        result_text.push_str("검색 결과:\n");
        for item in results.iter().take(3) {
            let title = item["title"].as_str().unwrap_or("No title");
            let url = item["url"].as_str().unwrap_or("No URL");
            let content = item["content"].as_str().unwrap_or("No content");
            // URL도 함께 반환하도록 수정하여 AI가 나중에 접속할 수 있게 함
            result_text.push_str(&format!("- [{}]({})\n  내용: {}\n\n", title, url, content));
        }
    }

    if result_text.is_empty() {
        Ok("검색 결과가 없습니다.".to_string())
    } else {
        Ok(result_text)
    }
}

// 2. 신규 기능: 사용자의 기본 브라우저로 특정 URL 열기
#[command]
pub fn open_url(url: String) -> Result<String, String> {
    // Windows의 'start' 명령어를 사용하여 기본 브라우저 호출
    let mut cmd = std::process::Command::new("cmd");
    cmd.arg("/C").arg("start").arg("").arg(&url);

    match cmd.spawn() {
        Ok(_) => Ok(format!("사용자의 기본 브라우저에서 다음 URL을 성공적으로 열었습니다: {}", url)),
        Err(e) => Err(format!("URL 열기 실패: {}", e)),
    }
}

// 3. 신규 기능: 특정 웹페이지의 전체 본문 읽어오기 (Jina Reader API 활용)
#[command]
pub async fn read_webpage(url: String) -> Result<String, String> {
    // 💡 변경점 1: 15초 이상 걸리면 강제로 연결을 끊어버리도록 타임아웃 설정
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("클라이언트 생성 오류: {}", e))?;

    let request_url = format!("https://r.jina.ai/{}", url);
    
    // 💡 변경점 2: 불필요한 이미지 렌더링 대기를 줄이기 위해 텍스트 위주로 요청하는 헤더 추가
    let res = client.get(&request_url)
        .header("X-Return-Format", "markdown")
        .send()
        .await
        .map_err(|e| format!("웹페이지 스크래핑 시간이 초과되었거나 네트워크 오류가 발생했습니다: {}", e))?;

    let content = res.text().await.map_err(|e| format!("본문 텍스트 변환 실패: {}", e))?;
    
    // 토큰 제한 보호 (최대 1만 자)
    let max_length = 10000;
    let truncated_content = if content.len() > max_length {
        format!("{}...\n\n[주의: 본문이 너무 길어 뒷부분이 생략되었습니다]", &content[..max_length])
    } else {
        content
    };

    Ok(truncated_content)
}
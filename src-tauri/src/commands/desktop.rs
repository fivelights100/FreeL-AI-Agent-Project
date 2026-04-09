use enigo::{Enigo, KeyboardControllable, MouseControllable, MouseButton};
use screenshots::Screen;
use base64::{Engine as _, engine::general_purpose};
use tauri::{command, Window, LogicalSize};

#[command]
pub fn move_mouse_and_click(x: i32, y: i32) -> Result<String, String> {
    let mut enigo = Enigo::new();
    enigo.mouse_move_to(x, y);
    enigo.mouse_click(MouseButton::Left);
    Ok(format!("마우스를 ({}, {})로 이동하고 클릭했습니다.", x, y))
}

#[command]
pub fn type_text(text: String) -> Result<String, String> {
    let mut enigo = Enigo::new();
    enigo.key_sequence(&text);
    Ok(format!("'{}' 텍스트를 타이핑했습니다.", text))
}

#[command]
pub fn take_screenshot() -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("모니터 인식 실패: {}", e))?;
    if screens.is_empty() { return Err("모니터를 찾을 수 없습니다.".to_string()); }

    let screen = screens[0];
    let image = screen.capture().map_err(|e| format!("캡처 실패: {}", e))?;

    let mut buffer = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buffer);
    
    screenshots::image::DynamicImage::ImageRgba8(image)
        .write_to(&mut cursor, screenshots::image::ImageFormat::Png)
        .map_err(|e| format!("PNG 변환 실패: {}", e))?;
    
    let base64_str = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

#[command]
pub fn resize_window(window: Window, expand: bool) -> Result<String, String> {
    let _ = window.set_resizable(true);
    if expand {
        let _ = window.set_size(LogicalSize::new(1200.0, 800.0));
    } else {
        let _ = window.set_size(LogicalSize::new(600.0, 800.0));
    }
    let _ = window.set_resizable(false);
    Ok("창 크기 변경 완료".to_string())
}

#[command]
pub fn get_active_window_info() -> Result<String, String> {
    use active_win_pos_rs::get_active_window;
    match get_active_window() {
        Ok(window) => {
            Ok(format!("🖥️ [현재 활성화된 창 정보]\n- 앱/프로세스 이름: {}\n- 창 제목: {}", window.app_name, window.title))
        },
        Err(_) => Err("현재 활성화된 창 정보를 가져오지 못했습니다.".to_string()),
    }
}
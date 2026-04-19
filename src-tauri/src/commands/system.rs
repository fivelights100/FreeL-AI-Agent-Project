use sysinfo::{System, Disks};
use tauri::command;

#[command]
pub fn get_system_info() -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    let total_mem = sys.total_memory() / 1024 / 1024; 
    let used_mem = sys.used_memory() / 1024 / 1024;
    let cpu_count = sys.cpus().len();
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    
    Ok(format!("운영체제: {} {}\nCPU 코어 수: {}개\n메모리 상태: 전체 {} MB 중 {} MB 사용 중", os_name, os_version, cpu_count, total_mem, used_mem))
}

#[command]
pub fn get_realtime_system_info() -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();

    let global_cpu = sys.global_cpu_usage();
    let gb_divider = 1_073_741_824.0;
    let total_mem = sys.total_memory() as f64 / gb_divider;
    let used_mem = sys.used_memory() as f64 / gb_divider;
    let mem_usage = (used_mem / total_mem) * 100.0;

    let mut disk_info = String::new();
    let disks = Disks::new_with_refreshed_list();
    for disk in &disks {
        let total = disk.total_space() as f64 / gb_divider;
        let available = disk.available_space() as f64 / gb_divider;
        if total > 0.0 {
            let name = disk.name().to_string_lossy();
            let mount = disk.mount_point().to_string_lossy();
            disk_info.push_str(&format!("  - [{}] {} (총 {:.1}GB / 남은 공간 {:.1}GB)\n", name, mount, total, available));
        }
    }

    Ok(format!("📊 [실시간 시스템 상태]\n- CPU 사용률: {:.1}%\n- 메모리(RAM): {:.1}GB / {:.1}GB (사용률: {:.1}%)\n- 디스크 상태:\n{}", global_cpu, used_mem, total_mem, mem_usage, disk_info))
}

#[command]
pub fn get_network_info() -> Result<String, String> {
    use std::net::UdpSocket; 
    let mut status = String::from("🌐 [네트워크 상태 및 IP 정보]\n");
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(socket) => {
            match socket.connect("8.8.8.8:80") {
                Ok(()) => {
                    if let Ok(local_addr) = socket.local_addr() {
                        status.push_str("- 인터넷 연결: 정상 (온라인) 🟢\n");
                        status.push_str(&format!("- 로컬 IP 주소 (IPv4): {}\n", local_addr.ip()));
                    } else { status.push_str("- 상태: 알 수 없음\n"); }
                },
                Err(_) => {
                    status.push_str("- 인터넷 연결: 끊김 (오프라인) 🔴\n");
                    status.push_str("- 로컬 IP 주소: 확인 불가 (네트워크 연결 안 됨)\n");
                }
            }
        },
        Err(e) => { status.push_str(&format!("- 네트워크 어댑터 접근 실패: {}\n", e)); }
    }
    Ok(status)
}

#[command]
pub fn get_battery_info() -> Result<String, String> {
    let manager = battery::Manager::new().map_err(|e| format!("배터리 시스템 접근 실패: {}", e))?;
    let mut batteries = manager.batteries().map_err(|e| format!("배터리 정보 읽기 실패: {}", e))?;
    let mut status = String::from("🔋 [전원 및 배터리 상태]\n");
    let mut has_battery = false;

    for (idx, battery_result) in batteries.enumerate() {
        if let Ok(battery) = battery_result {
            has_battery = true;
            let percentage = battery.state_of_charge().value * 100.0;
            let state_str = match battery.state() {
                battery::State::Charging => "충전 중 ⚡",
                battery::State::Discharging => "사용 중 (전원 분리됨) 🔋",
                battery::State::Empty => "방전됨 텅~",
                battery::State::Full => "충전 완료 (전원 연결됨) 🔌",
                _ => "알 수 없음",
            };
            status.push_str(&format!("- 배터리 {}: {:.1}% ({})\n", idx + 1, percentage, state_str));
        }
    }
    if !has_battery { status.push_str("- 배터리가 존재하지 않습니다. (데스크탑 PC 환경으로 추정됨)\n"); }
    Ok(status)
}

#[command]
pub fn control_system(action: String) -> Result<String, String> {
    let mut cmd = if cfg!(target_os = "windows") { std::process::Command::new("cmd") } else { std::process::Command::new("sh") };
    let arg = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    cmd.arg(arg);

    match action.as_str() {
        "shutdown" => { if cfg!(target_os = "windows") { cmd.arg("shutdown /s /t 0"); } else { cmd.arg("sudo shutdown -h now"); } },
        "restart" => { if cfg!(target_os = "windows") { cmd.arg("shutdown /r /t 0"); } else { cmd.arg("sudo shutdown -r now"); } },
        "sleep" => { if cfg!(target_os = "windows") { cmd.arg("rundll32.exe powrprof.dll,SetSuspendState 0,1,0"); } else { cmd.arg("pmset sleepnow"); } },
        _ => return Err("지원하지 않는 명령입니다. (shutdown, restart, sleep 중 하나여야 함)".to_string()),
    }

    match cmd.spawn() {
        Ok(_) => Ok(format!("시스템 명령 '{}'을(를) 성공적으로 실행했습니다.", action)),
        Err(e) => Err(format!("시스템 명령 실행 실패: {}", e)),
    }
}

#[command]
pub fn control_audio(action: String) -> Result<String, String> {
    use enigo::{Enigo, Key, KeyboardControllable};
    let mut enigo = Enigo::new();
    match action.as_str() {
        "mute" => { enigo.key_click(Key::VolumeMute); Ok("시스템 음소거(또는 해제)를 실행했습니다.".to_string()) },
        "up" => { for _ in 0..5 { enigo.key_click(Key::VolumeUp); } Ok("시스템 볼륨을 올렸습니다 (약 +10%).".to_string()) },
        "down" => { for _ in 0..5 { enigo.key_click(Key::VolumeDown); } Ok("시스템 볼륨을 내렸습니다 (약 -10%).".to_string()) },
        _ => Err("지원하지 않는 명령입니다.".to_string()),
    }
}

#[command]
pub fn get_display_info() -> Result<String, String> {
    use display_info::DisplayInfo;
    let displays = DisplayInfo::all().map_err(|e| format!("디스플레이 정보를 가져오는데 실패했습니다: {}", e))?;
    let mut info_str = String::from("🖥️ [모니터 및 해상도 정보]\n");

    for (i, display) in displays.iter().enumerate() {
        let is_primary = if display.is_primary { "(주 모니터)" } else { "" };
        info_str.push_str(&format!("- 모니터 {} {}: 해상도 {} x {}, 위치(X:{}, Y:{}), 배율: {:.0}%\n", i + 1, is_primary, display.width, display.height, display.x, display.y, display.scale_factor * 100.0));
    }
    Ok(info_str)
}

#[command]
pub async fn control_brightness(action: String, level: Option<u32>) -> Result<String, String> {
    use brightness::Brightness;
    use futures::stream::TryStreamExt;

    let devices = brightness::brightness_devices().try_collect::<Vec<_>>().await.map_err(|e| format!("디스플레이 접근 실패: {}", e))?;
    if devices.is_empty() { return Err("밝기를 조절할 수 있는 디스플레이를 찾을 수 없습니다.".to_string()); }

    let mut results = Vec::new();
    for mut dev in devices {
        let name = dev.device_name().await.unwrap_or_else(|_| "Unknown".to_string());
        let current = dev.get().await.unwrap_or(0);
        
        match action.as_str() {
            "get" => { results.push(format!("- {}: 현재 밝기 {}%", name, current)); },
            "set" => {
                if let Some(l) = level {
                    let target = l.clamp(0, 100);
                    let _ = dev.set(target).await;
                    results.push(format!("- {}: 밝기를 {}%로 설정했습니다.", name, target));
                } else { return Err("set 명령을 사용할 때는 level 값이 필요합니다.".to_string()); }
            },
            "up" => {
                let target = (current + 10).clamp(0, 100);
                let _ = dev.set(target).await;
                results.push(format!("- {}: 밝기를 {}%로 올렸습니다.", name, target));
            },
            "down" => {
                let target = current.saturating_sub(10).clamp(0, 100);
                let _ = dev.set(target).await;
                results.push(format!("- {}: 밝기를 {}%로 내렸습니다.", name, target));
            },
            _ => return Err("지원하지 않는 명령입니다.".to_string()),
        }
    }
    Ok(format!("💡 [화면 밝기 제어 결과]\n{}", results.join("\n")))
}

#[tauri::command]
pub fn resize_window(window: tauri::Window, expand: bool) {
    // expand가 true면 넓은 창, false면 좁은 창으로 변경하는 로직
    // (이전에 사용하셨던 로직을 그대로 붙여넣어 주세요)
    use tauri::LogicalSize;
    if expand {
        let _ = window.set_size(LogicalSize::new(1200.0, 800.0));
    } else {
        let _ = window.set_size(LogicalSize::new(400.0, 600.0));
    }
}
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // lib.rs에 정의된 run() 함수를 실행합니다.
    freel_desktop_lib::run();
}
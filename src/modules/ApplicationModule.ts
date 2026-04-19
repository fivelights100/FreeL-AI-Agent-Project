import { invoke } from "@tauri-apps/api/core";
import { AgentModule } from "./types";

export const ApplicationModule: AgentModule = {
  id: "application",
  name: "Applications Module",
  description: "데스크탑에 설치된 프로그램 검색 및 실행",
  
  getTools: () => [
    {
      type: "function",
      function: {
        name: "open_application",
        description: "주어진 이름이나 경로의 앱을 실행합니다. 특정 파일이나 URL을 함께 열어야 할 경우 인수를 추가할 수 있습니다.",
        parameters: { 
          type: "object", 
          properties: { 
            app_name: { type: "string", description: "실행할 앱의 이름 또는 절대 경로 (예: 'chrome', 'notepad', 'C:\\...\\app.exe')" },
            args: { 
              type: "array", 
              items: { type: "string" }, 
              description: "앱에 전달할 인수 목록 - 필요 없으면 생략 가능" 
            }
          }, 
          required: ["app_name"] 
        }
      }
    },
    {
      type: "function",
      function: {
        name: "find_application",
        description: "앱의 실행 경로(.lnk)를 시작 메뉴에서 검색합니다.",
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
      }
    },
    {
      type: "function",
      function: {
        name: "kill_process",
        description: "실행 중인 프로그램을 강제로 종료합니다.",
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
      }
    }
  ],

  execute: async (toolName: string, args: any): Promise<string> => {
    switch (toolName) {
      case "open_application":
        return await invoke<string>("open_application", { appName: args.app_name, args: args.args });
      case "find_application":
        return JSON.stringify(await invoke<string[]>("find_application", { name: args.name }));
      case "kill_process":
        return await invoke<string>("kill_process", { name: args.name });
      default:
        throw new Error(`[ApplicationModule] 지원하지 않는 도구입니다: ${toolName}`);
    }
  }
};
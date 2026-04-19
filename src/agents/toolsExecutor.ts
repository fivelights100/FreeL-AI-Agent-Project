import { MODULE_REGISTRY } from "../modules"; // 새로 만든 index.ts에서 불러옵니다.

// (이전에 정리했던 도구 권한 목록은 그대로 유지합니다)
export const READ_TOOLS = [
  "list_directory", "read_text_file", "find_files", "get_system_info",
  "get_realtime_system_info", "get_network_info", "get_battery_info", "get_display_info"
];
export const WEB_TOOLS = ["web_search", "read_webpage"];
export const EXECUTE_TOOLS = [
  "write_text_file", "delete_path", "copy_path", "move_path", 
  "open_application", "find_application", "kill_process",
  "control_system", "control_audio", "control_brightness", "open_url"
];

// 1. 허용된 도구 목록 가져오기 (각 모듈의 getTools() 함수 호출)
export const getAllowedTools = (installedModules: string[], allowedToolNames: string[]) => {
  return MODULE_REGISTRY
    .filter(moduleItem => installedModules.includes(moduleItem.id))
    .flatMap(moduleItem => moduleItem.getTools())
    .filter(tool => tool.type === "function" && allowedToolNames.includes((tool as any).function.name));
};

// 2. 도구 실행 라우터 (MCP 클라이언트 역할)
export const executeToolCall = async (toolCall: any, tavilyKey: string): Promise<string> => {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || "{}");

  // 등록된 모듈들을 순회하며 해당 도구를 가진 모듈을 찾습니다.
  for (const moduleItem of MODULE_REGISTRY) {
    const tools = moduleItem.getTools();
    const hasTool = tools.some(t => (t as any).function.name === name);
    
    // 도구를 찾았다면 해당 모듈의 execute 함수로 위임합니다.
    if (hasTool) {
      try {
        // ✨ context 객체에 tavilyKey 등을 담아서 모듈에 전달합니다.
        return await moduleItem.execute(name, args, { tavilyKey });
      } catch (err) {
        return `실행 실패: ${err}`;
      }
    }
  }

  // 어떤 모듈에서도 도구를 찾지 못한 경우
  return `실행 실패: '${name}' 도구를 처리할 수 있는 모듈이 시스템에 존재하지 않습니다.`;
};
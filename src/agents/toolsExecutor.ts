import { invoke } from "@tauri-apps/api/core";
import { PLUGIN_REGISTRY } from "../config/plugins";

export const READ_TOOLS = ["list_directory", "read_text_file", "find_files", "get_system_info"];
export const WEB_TOOLS = ["web_search", "read_webpage"];
export const EXECUTE_TOOLS = ["write_text_file", "delete_path", "copy_path", "move_path", "open_application", "find_application", "kill_process", "take_screenshot", "move_mouse_and_click"];

// 특정 권한을 가진 도구 객체들만 추출
export const getAllowedTools = (installedPlugins: string[], allowedToolNames: string[]) => {
  return PLUGIN_REGISTRY
    .filter(plugin => installedPlugins.includes(plugin.id))
    .flatMap(plugin => plugin.tools)
    .filter(tool => tool.type === "function" && allowedToolNames.includes((tool as any).function.name));
};

// 실제 도구(Tool)를 실행하는 로직
export const executeToolCall = async (toolCall: any): Promise<string> => {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || "{}");
  try {
    if (name === "get_system_info") return await invoke<string>("get_system_info");
    if (name === "web_search") return await invoke<string>("web_search", { query: args.query, apiKey: import.meta.env.VITE_TAVILY_API_KEY! });
    if (name === "list_directory") return JSON.stringify(await invoke<string[]>("list_directory", { path: args.path }));
    if (name === "read_text_file") return await invoke<string>("read_text_file", { path: args.path });
    if (name === "write_text_file") return await invoke<string>("write_text_file", { path: args.path, content: args.content });
    if (name === "delete_path") return await invoke<string>("delete_path", { path: args.path });
    if (name === "find_files") return JSON.stringify(await invoke<string[]>("find_files", { path: args.path, query: args.query, depth: args.depth || 3 }));
    if (name === "open_application") return await invoke<string>("open_application", { appName: args.app_name, args: args.args });
    if (name === "find_application") return JSON.stringify(await invoke<string[]>("find_application", { name: args.name }));
    if (name === "kill_process") return await invoke<string>("kill_process", { name: args.name });
    // 다른 도구들도 동일하게 매핑 (생략 없이 사용 중인 툴 모두 작성)
    
    return "성공적으로 모의 실행됨 (해당 도구의 실제 구현이 연결되지 않음).";
  } catch (err) {
    return `실행 실패: ${err}`;
  }
};
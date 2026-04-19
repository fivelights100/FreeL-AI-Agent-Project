import { invoke } from "@tauri-apps/api/core";
import { AgentModule } from "./types";

export const BrowserModule: AgentModule = {
  id: "browser",
  name: "Browser Module",
  description: "인터넷 웹 검색 및 웹페이지 직접 열기/읽기",
  
  getTools: () => [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "인터넷 검색이 필요할 때 웹 검색을 수행합니다.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
      }
    },
    {
      type: "function",
      function: {
        name: "open_url",
        description: "사용자의 기본 브라우저를 띄워서 특정 URL 화면을 직접 열어줍니다.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
      }
    },
    {
      type: "function",
      function: {
        name: "read_webpage",
        description: "특정 웹페이지(URL) 안으로 들어가 본문 텍스트 전체를 읽어옵니다.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
      }
    }
  ],

  // 💡 context 객체를 통해 tavilyKey를 받아옵니다.
  execute: async (toolName: string, args: any, context?: any): Promise<string> => {
    switch (toolName) {
      case "web_search":
        if (!context?.tavilyKey) {
          throw new Error("시스템 설정에서 Tavily API 키를 먼저 입력해주세요.");
        }
        return await invoke<string>("web_search", { query: args.query, apiKey: context.tavilyKey });
      case "open_url":
        return await invoke<string>("open_url", { url: args.url });
      case "read_webpage":
        return await invoke<string>("read_webpage", { url: args.url });
      default:
        throw new Error(`[BrowserModule] 지원하지 않는 도구입니다: ${toolName}`);
    }
  }
};
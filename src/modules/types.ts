import OpenAI from "openai";

// 모든 MCP 모듈이 반드시 구현해야 하는 표준 인터페이스입니다.
export interface AgentModule {
  id: string;          // 모듈의 고유 ID (예: "filesystem")
  name: string;        // 화면에 표시될 모듈 이름
  description: string; // 모듈에 대한 설명
  
  // 에이전트에게 제공할 도구(Tool)들의 JSON 스키마 목록을 반환합니다.
  getTools: () => OpenAI.Chat.ChatCompletionTool[];
  
  // 에이전트가 도구를 호출했을 때 실제로 실행되는 로직을 담당합니다.
  // context에는 tavilyKey 등 실행에 필요한 부가 정보가 담길 수 있습니다.
  execute: (toolName: string, args: any, context?: any) => Promise<string>;
}
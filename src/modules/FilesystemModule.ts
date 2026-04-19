import { invoke } from "@tauri-apps/api/core";
import { AgentModule } from "./types";
import OpenAI from "openai";

export const FilesystemModule: AgentModule = {
  id: "filesystem",
  name: "Filesystem Module",
  description: "로컬 파일 및 디렉토리 접근 권한 (읽기, 쓰기, 삭제)",
  
  getTools: () => [
    {
      type: "function",
      function: {
        name: "list_directory",
        description: "주어진 경로의 폴더 및 파일 목록을 배열 형태로 반환합니다.",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
      }
    },
    {
      type: "function",
      function: {
        name: "read_text_file",
        description: "주어진 경로의 텍스트 파일 내용을 읽습니다.",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
      }
    },
    {
      type: "function",
      function: {
        name: "write_text_file",
        description: "지정된 경로에 텍스트 파일을 생성하거나 내용을 덮어씁니다.",
        parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
      }
    },
    {
      type: "function",
      function: {
        name: "delete_path",
        description: "지정된 경로의 파일이나 폴더를 삭제합니다.",
        parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
      }
    },
    {
      type: "function",
      function: {
        name: "find_files",
        description: "주어진 폴더 및 하위 폴더 전체에서 특정 이름이나 확장자를 가진 파일을 검색합니다.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "검색을 시작할 최상위 폴더 경로" },
            query: { type: "string", description: "검색할 파일명 또는 확장자 (예: '보고서', '.pdf')" }
          },
          required: ["path", "query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "copy_path",
        description: "파일을 지정된 새로운 경로로 복사합니다.",
        parameters: {
          type: "object",
          properties: {
            source: { type: "string", description: "원본 파일의 전체 경로" },
            destination: { type: "string", description: "복사될 새 파일의 전체 경로" }
          },
          required: ["source", "destination"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "move_path",
        description: "파일이나 폴더를 새로운 경로로 이동시키거나 이름을 변경합니다.",
        parameters: {
          type: "object",
          properties: {
            source: { type: "string", description: "원본 경로" },
            destination: { type: "string", description: "이동될 새 경로" }
          },
          required: ["source", "destination"]
        }
      }
    }
  ],

  // 🔥 핵심: 이 모듈 소속의 도구들이 호출되면 여기서 모두 처리합니다!
  execute: async (toolName: string, args: any): Promise<string> => {
    switch (toolName) {
      case "list_directory":
        return JSON.stringify(await invoke<string[]>("list_directory", { path: args.path }));
      case "read_text_file":
        return await invoke<string>("read_text_file", { path: args.path });
      case "write_text_file":
        return await invoke<string>("write_text_file", { path: args.path, content: args.content });
      case "delete_path":
        return await invoke<string>("delete_path", { path: args.path });
      case "find_files":
        // depth는 기본값 3을 주도록 처리합니다.
        return JSON.stringify(await invoke<string[]>("find_files", { path: args.path, query: args.query, depth: args.depth || 3 }));
      case "copy_path":
        return await invoke<string>("copy_path", { source: args.source, destination: args.destination });
      case "move_path":
        return await invoke<string>("move_path", { source: args.source, destination: args.destination });
      default:
        throw new Error(`[FilesystemModule] 지원하지 않는 도구입니다: ${toolName}`);
    }
  }
};
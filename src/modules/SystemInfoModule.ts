import { invoke } from "@tauri-apps/api/core";
import { AgentModule } from "./types";

export const SystemInfoModule: AgentModule = {
  id: "system_info",
  name: "System Info Module",
  description: "컴퓨터 운영체제, CPU, 메모리 상태 확인 및 하드웨어 제어",
  
  getTools: () => [
    {
      type: "function",
      function: {
        name: "get_system_info",
        description: "현재 컴퓨터의 전반적인 시스템 상태를 확인합니다.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "get_realtime_system_info",
        description: "현재 컴퓨터의 실시간 CPU, 메모리(RAM), 디스크 상태를 확인합니다.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "get_network_info",
        description: "현재 컴퓨터의 인터넷 연결 상태와 IP 주소를 확인합니다.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "get_battery_info",
        description: "현재 컴퓨터의 배터리 잔량 및 전원 연결 상태를 확인합니다.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "get_display_info",
        description: "컴퓨터에 연결된 모니터 정보를 확인합니다.",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    {
      type: "function",
      function: {
        name: "control_system",
        description: "컴퓨터의 전원을 제어합니다.",
        parameters: {
          type: "object",
          properties: { action: { type: "string", enum: ["shutdown", "restart", "sleep"] } },
          required: ["action"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "control_audio",
        description: "컴퓨터의 마스터 볼륨을 제어합니다.",
        parameters: {
          type: "object",
          properties: { action: { type: "string", enum: ["mute", "up", "down"] } },
          required: ["action"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "control_brightness",
        description: "노트북 내장 디스플레이의 밝기를 조절합니다.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["get", "set", "up", "down"] },
            level: { type: "integer" }
          },
          required: ["action"]
        }
      }
    }
  ],

  execute: async (toolName: string, args: any): Promise<string> => {
    switch (toolName) {
      case "get_system_info": return await invoke<string>("get_system_info");
      case "get_realtime_system_info": return await invoke<string>("get_realtime_system_info");
      case "get_network_info": return await invoke<string>("get_network_info");
      case "get_battery_info": return await invoke<string>("get_battery_info");
      case "get_display_info": return await invoke<string>("get_display_info");
      case "control_system": return await invoke<string>("control_system", { action: args.action });
      case "control_audio": return await invoke<string>("control_audio", { action: args.action });
      case "control_brightness": return await invoke<string>("control_brightness", { action: args.action, level: args.level });
      default:
        throw new Error(`[SystemInfoModule] 지원하지 않는 도구입니다: ${toolName}`);
    }
  }
};
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { PLUGIN_REGISTRY } from "../config/plugins";
import systemPromptText from "../systemPrompt.txt?raw";

// ✅ 1. App.tsx에 있던 Message 타입을 이쪽으로 이사시켰습니다.
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
};

// ✅ 2. 초기화할 때 쓸 시스템 프롬프트도 이쪽에서 내보냅니다.
export const systemPrompt: Message = {
  role: "system",
  content: systemPromptText
};

// 훅이 외부에서 받아와야 할 정보들 (Props)
interface UseAgentProps {
  openai: OpenAI;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  installedPlugins: string[];
  fsWhitelist: string[];
  userHome: string;
  setSystemStatus: React.Dispatch<React.SetStateAction<string>>;
  indexingDepth: number;
  indexingBasePath: string;
}

export function useAgent({
  openai,
  messages,
  setMessages,
  installedPlugins,
  fsWhitelist,
  userHome,
  setSystemStatus,
  indexingDepth,
  indexingBasePath
}: UseAgentProps) {
  // ✅ 3. AI 작업 상태(isProcessing) 관리도 이 엔진 안에서 직접 처리합니다.
  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ 4. 핵심 AI 자율 주행 엔진! (기존 handleSendMessage)
  const sendMessage = async (userMsg: string) => {
    setIsProcessing(true);

    // 경로 보안 검사 함수
    const isPathAllowed = (targetPath: string) => {
      if (!targetPath) return false;
      if (fsWhitelist.length === 0) return true;
      const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase();
      return fsWhitelist.some(allowedPath => {
        const normalizedAllowed = allowedPath.replace(/\\/g, '/').toLowerCase();
        return normalizedTarget.startsWith(normalizedAllowed);
      });
    };

    let currentMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages([...currentMessages]);

    try {
      setSystemStatus("AI: 의도 파악 및 계획 생성 중...");

      const activeTools = PLUGIN_REGISTRY
        .filter(plugin => installedPlugins.includes(plugin.id))
        .flatMap(plugin => plugin.tools);

      let isTaskComplete = false;
      let loopCount = 0;
      const MAX_LOOPS = 5;

      while (!isTaskComplete && loopCount < MAX_LOOPS) {
        loopCount++;

        const dynamicSystemPrompt = `${systemPromptText}\n\n[System Context] - 현재 사용자의 홈 디렉토리 절대 경로: ${userHome} ${indexingBasePath ? `- 🎯 파일 탐색/인덱싱 시작 기준 경로: ${indexingBasePath} (파일 탐색 도구 사용 시 이 경로를 최우선으로 적용하세요.)` : ''}`;
        
        const messagesForAPI = currentMessages.map(msg => 
          msg.role === "system" ? { ...msg, content: dynamicSystemPrompt } : msg
        );

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messagesForAPI as any,
          tools: activeTools.length > 0 ? activeTools : undefined,
          tool_choice: activeTools.length > 0 ? "auto" : "none",
        });

        const responseMessage = response.choices[0].message as Message;
        currentMessages.push(responseMessage);
        setMessages([...currentMessages]);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          let capturedImage: string | null = null;

          for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.type === "function") {
              const args = JSON.parse(toolCall.function.arguments || "{}");
              let toolResultContent = "";

              try {
                // ============ [도구 실행 분기 시작] ============
                if (toolCall.function.name === "list_directory") {
                  if (!isPathAllowed(args.path)) {
                    toolResultContent = `[보안 차단] '${args.path}'는 접근이 허용되지 않은 경로입니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (list_directory)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> discovery.list_directory (path: '${args.path}')`);
                    const files = await invoke<string[]>("list_directory", { path: args.path });
                    toolResultContent = JSON.stringify(files);
                  }
                } else if (toolCall.function.name === "read_text_file") {
                  if (!isPathAllowed(args.path)) {
                    toolResultContent = `[보안 차단] '${args.path}'는 접근이 허용되지 않은 경로입니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (read_text_file)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> read.read_text_file (path: '${args.path}')`);
                    const content = await invoke<string>("read_text_file", { path: args.path });
                    toolResultContent = content;
                  }
                } else if (toolCall.function.name === "write_text_file") {
                  if (!isPathAllowed(args.path)) {
                    toolResultContent = `[보안 차단] '${args.path}'는 접근이 허용되지 않은 경로입니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (write_text_file)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> write.write_text_file (path: '${args.path}')`);
                    const result = await invoke<string>("write_text_file", { path: args.path, content: args.content });
                    toolResultContent = result;
                  }
                } else if (toolCall.function.name === "delete_path") {
                  if (!isPathAllowed(args.path)) {
                    toolResultContent = `[보안 차단] '${args.path}'는 접근이 허용되지 않은 경로입니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (delete_path)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> mutate.delete_path (path: '${args.path}')`);
                    const result = await invoke<string>("delete_path", { path: args.path });
                    toolResultContent = result;
                  }
                } else if (toolCall.function.name === "find_files") {
                  if (!isPathAllowed(args.path)) {
                    toolResultContent = `[보안 차단] '${args.path}'는 접근이 허용되지 않은 경로입니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (find_files)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> search.find_files (path: '${args.path}')`);
                    const results = await invoke<string[]>("find_files", { path: args.path, query: args.query, depth: indexingDepth });
                    toolResultContent = results.join('\n');
                  }
                } else if (toolCall.function.name === "copy_path") {
                  if (!isPathAllowed(args.source) || !isPathAllowed(args.destination)) {
                    toolResultContent = `[보안 차단] 원본 또는 대상 경로가 허용되지 않았습니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (copy_path)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> filesystem.copy_path`);
                    const result = await invoke<string>("copy_path", { source: args.source, destination: args.destination });
                    toolResultContent = result;
                  }
                } else if (toolCall.function.name === "move_path") {
                  if (!isPathAllowed(args.source) || !isPathAllowed(args.destination)) {
                    toolResultContent = `[보안 차단] 원본 또는 대상 경로가 허용되지 않았습니다.`;
                    setSystemStatus("SYSTEM: ❌ 보안 차단 (move_path)");
                  } else {
                    setSystemStatus(`SYSTEM: 실행 계획 -> filesystem.move_path`);
                    const result = await invoke<string>("move_path", { source: args.source, destination: args.destination });
                    toolResultContent = result;
                  }
                } else if (toolCall.function.name === "open_application") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> application.open_application (app_name: '${args.app_name}')`);
                  const result = await invoke<string>("open_application", { appName: args.app_name, args: args.args || [] });
                  toolResultContent = result;
                } else if (toolCall.function.name === "find_application") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> application.find_application (name: '${args.name}')`);
                  const result = await invoke<string[]>("find_application", { name: args.name });
                  if (result.length === 0) {
                      toolResultContent = "검색된 앱이 없습니다. 다른 이름으로 검색해보세요.";
                  } else {
                      toolResultContent = `다음 경로들을 찾았습니다. 이 중 가장 적합한 경로를 골라 open_application으로 실행하세요:\n${result.join('\n')}`;
                  }
                } else if (toolCall.function.name === "kill_process") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> application.kill_process (name: '${args.name}')`);
                  const result = await invoke<string>("kill_process", { name: args.name });
                  toolResultContent = result;
                } else if (toolCall.function.name === "get_system_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.get_system_info`);
                  const result = await invoke<string>("get_system_info");
                  toolResultContent = result;
                } else if (toolCall.function.name === "get_realtime_system_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.get_realtime_system_info`);
                  const result = await invoke<string>("get_realtime_system_info");
                  toolResultContent = result;  
                } else if (toolCall.function.name === "get_network_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.get_network_info`);
                  const result = await invoke<string>("get_network_info");
                  toolResultContent = result;
                } else if (toolCall.function.name === "get_battery_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.get_battery_info`);
                  const result = await invoke<string>("get_battery_info");
                  toolResultContent = result;
                } else if (toolCall.function.name === "control_system") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.control_system (action: '${args.action}')`);
                  const result = await invoke<string>("control_system", { action: args.action });
                  toolResultContent = result;
                } else if (toolCall.function.name === "control_audio") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.control_audio (action: '${args.action}')`);
                  const result = await invoke<string>("control_audio", { action: args.action });
                  toolResultContent = result;
                } else if (toolCall.function.name === "get_display_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.get_display_info`);
                  const result = await invoke<string>("get_display_info");
                  toolResultContent = result;
                } else if (toolCall.function.name === "control_brightness") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> system.control_brightness (action: '${args.action}')`);
                  const result = await invoke<string>("control_brightness", { action: args.action, level: args.level });
                  toolResultContent = result;
                } else if (toolCall.function.name === "web_search") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> browser.web_search (query: '${args.query}')`);
                  const tavilyApiKey = import.meta.env.VITE_TAVILY_API_KEY;
                  if (!tavilyApiKey) throw new Error("Tavily API 키가 설정되지 않았습니다.");
                  const result = await invoke<string>("web_search", { query: args.query, apiKey: tavilyApiKey });
                  toolResultContent = result;
                } else if (toolCall.function.name === "open_url") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> browser.open_url (url: '${args.url}')`);
                  const result = await invoke<string>("open_url", { url: args.url });
                  toolResultContent = result;
                } else if (toolCall.function.name === "read_webpage") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> browser.read_webpage (url: '${args.url}')`);
                  const result = await invoke<string>("read_webpage", { url: args.url });
                  toolResultContent = result;
                } else if (toolCall.function.name === "move_mouse_and_click") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.move_mouse_and_click (x: ${args.x}, y: ${args.y})`);
                  const result = await invoke<string>("move_mouse_and_click", { x: args.x, y: args.y });
                  toolResultContent = result;
                } else if (toolCall.function.name === "type_text") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.type_text (text: '${args.text}')`);
                  const result = await invoke<string>("type_text", { text: args.text });
                  toolResultContent = result;
                } else if (toolCall.function.name === "take_screenshot") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.take_screenshot ()`);
                  const base64Image = await invoke<string>("take_screenshot");
                  toolResultContent = `화면 캡처 성공.`;
                  capturedImage = base64Image;
                } else if (toolCall.function.name === "read_clipboard") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.read_clipboard`);
                  const text = await readText();
                  toolResultContent = text ? `클립보드 내용: ${text}` : "클립보드가 비어있거나 텍스트 형식이 아닙니다.";
                } else if (toolCall.function.name === "write_clipboard") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.write_clipboard`);
                  await writeText(args.text);
                  toolResultContent = "텍스트가 클립보드에 성공적으로 복사되었습니다.";
                } else if (toolCall.function.name === "get_active_window_info") {
                  setSystemStatus(`SYSTEM: 실행 계획 -> desktop.get_active_window_info`);
                  const result = await invoke<string>("get_active_window_info");
                  toolResultContent = result;
                }
                // ============ [도구 실행 분기 끝] ============
              } catch (err) {
                toolResultContent = `실행 실패: ${err}`;
              }

              currentMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: toolResultContent,
              });
            }
          }

          if (capturedImage) {
            currentMessages.push({
              role: "user",
              content: [
                { type: "text", text: "방금 캡처한 화면 이미지입니다. 목표물의 위치를 파악하여 다음 도구를 실행하거나 답변을 완료해 주세요." },
                { type: "image_url", image_url: { url: capturedImage } }
              ]
            } as any);
          }

          setSystemStatus(`AI: 작업 결과 분석 및 다음 행동 결정 중... (${loopCount}/${MAX_LOOPS})`);
        } else {
          isTaskComplete = true; // 최종 답변 도착 (루프 종료)
        }
      }

      if (loopCount >= MAX_LOOPS) {
        currentMessages.push({
          role: "assistant",
          content: "⚠️ 안전을 위해 연속 행동 횟수 제한(5회)에 도달하여 작업을 중단했습니다. 명령을 더 구체적으로 내려주세요."
        });
        setMessages([...currentMessages]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ 오류가 발생했습니다: ${error}` }]);
    } finally {
      setSystemStatus("대기 중...");
      setIsProcessing(false);
    }
  };

  return { isProcessing, sendMessage };
}
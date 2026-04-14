import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { PLUGIN_REGISTRY } from "../config/plugins";
import systemPromptText from "../systemPrompt.txt?raw";

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
};

export const systemPrompt: Message = {
  role: "system",
  content: systemPromptText
};

interface UseAgentProps {
  openai: OpenAI;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  installedPlugins: string[];
  fsWhitelist: string[];
  userHome: string;
  setSystemStatus: React.Dispatch<React.SetStateAction<string>>;
  indexingDepth: number;
}

// [다중 에이전트 시스템 프롬프트]
const MAIN_AGENT_PROMPT = `
당신은 메인 에이전트입니다. 사용자의 입력을 분석하여 '단순 대화(chat)'인지, 데스크탑 제어나 도구가 필요한 '작업(task)'인지 분류하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{ "type": "chat" 또는 "task", "response": "chat일 경우 사용자에게 할 친절한 답변 (task일 경우 빈 문자열)" }
`;

const PLANNER_AGENT_PROMPT = `
당신은 기획/설계 에이전트입니다. 사용자의 요청을 분석하여 탐색/분석 에이전트가 실행할 수 있는 구체적인 단계별 계획을 수립하세요.
현재 사용 가능한 도구(파일탐색, 앱실행, 웹검색 등)를 고려해야 합니다.
반드시 아래 JSON 형식으로만 응답하세요:
{ "summary": "작업에 대한 간략한 요약", "steps": ["1단계: ...", "2단계: ..."] }
`;

const REVIEWER_AGENT_PROMPT = `
당신은 검증/안전 에이전트입니다. 사용자의 요청과 기획된 계획(Plan)을 검토하여 위험성을 판단하세요.
파일 무단 삭제, 알 수 없는 앱 실행, 위험한 시스템 제어 등이 포함되어 있다면 FAIL 처리하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{ "status": "PASS" 또는 "FAIL", "feedback": "PASS인 경우 '안전함', FAIL인 경우 위험 요소에 대한 구체적 설명" }
`;

export function useAgent({
  openai, messages, setMessages, installedPlugins, fsWhitelist, userHome, setSystemStatus, indexingDepth
}: UseAgentProps) {
  
  const [isProcessing, setIsProcessing] = useState(false);

  const isPathAllowed = (targetPath: string) => {
    if (!targetPath) return false;
    if (fsWhitelist.length === 0) return true;
    const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase();
    return fsWhitelist.some(allowedPath => {
      const normalizedAllowed = allowedPath.replace(/\\/g, '/').toLowerCase();
      return normalizedTarget.startsWith(normalizedAllowed);
    });
  };

  // [에이전트 4] 탐색/분석 에이전트 (Worker)
  const executeWorkerAgent = async (planSummary: string, originalUserMsg: string, currentMessagesState: Message[]) => {
    const activeTools = PLUGIN_REGISTRY
      .filter(plugin => installedPlugins.includes(plugin.id))
      .flatMap(plugin => plugin.tools);

    let isTaskComplete = false;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    // 👇 사용자의 눈(UI)에는 보이지 않지만, Worker의 시스템 프롬프트에 계획을 주입합니다.
    const dynamicSystemPrompt = `${systemPromptText}\n\n[System Context] - 사용자 홈: ${userHome}\n\n[수행할 목표 계획 (기획 에이전트 전달 사항)]\n${planSummary}`;
    
    let workerMessages: Message[] = [...currentMessagesState];

    while (!isTaskComplete && loopCount < MAX_LOOPS) {
      loopCount++;
      setSystemStatus(`AI: 탐색/분석 에이전트 도구 실행 중... (${loopCount}/${MAX_LOOPS})`);

      const messagesForAPI = workerMessages.map(msg => 
        msg.role === "system" ? { ...msg, content: dynamicSystemPrompt } : msg
      );

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messagesForAPI as any,
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : "none",
      });

      const responseMessage = response.choices[0].message as Message;
      workerMessages.push(responseMessage);
      setMessages([...workerMessages]); // 툴 호출/결과 등은 기존처럼 업데이트 (UI에서 숨기려면 ChatList.tsx에서 role="tool" 필터링 필요)

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
              // ... 등등 기존 툴 코드 전부 포함 ...
              else {
                 toolResultContent = "알 수 없는 도구이거나 모의 실행입니다.";
              }

            } catch (err) {
              toolResultContent = `실행 실패: ${err}`;
            }

            workerMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: toolResultContent,
            });
          }
        }

        if (capturedImage) {
            workerMessages.push({
              role: "user",
              content: [
                { type: "text", text: "화면을 캡처했습니다." },
                { type: "image_url", image_url: { url: capturedImage } }
              ]
            } as any);
        }
      } else {
        isTaskComplete = true; 
      }
    }

    if (loopCount >= MAX_LOOPS) {
      workerMessages.push({ role: "assistant", content: "작업이 길어져 중단되었습니다. 결과를 확인해주세요." });
      setMessages([...workerMessages]);
    }
  };

  // ==========================================
  // 메인 프로세스
  // ==========================================
  const sendMessage = async (userMsg: string) => {
    setIsProcessing(true);
    let currentMessages = [...messages];

    try {
      currentMessages.push({ role: "user", content: userMsg });
      setMessages([...currentMessages]);

      // [에이전트 1] 메인 에이전트
      setSystemStatus("메인 에이전트: 의도 분석 중...");
      const mainResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MAIN_AGENT_PROMPT },
          { role: "user", content: userMsg }
        ]
      });

      const mainResult = JSON.parse(mainResponse.choices[0].message.content || "{}");

      if (mainResult.type === "chat") {
        currentMessages.push({ role: "assistant", content: mainResult.response });
        setMessages([...currentMessages]);
        setIsProcessing(false);
        setSystemStatus("대기 중...");
        return;
      }

      // [에이전트 2] 기획/설계 에이전트
      setSystemStatus("기획 에이전트: 작업 계획 수립 중...");
      const planResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PLANNER_AGENT_PROMPT },
          { role: "user", content: userMsg }
        ]
      });

      const planResult = JSON.parse(planResponse.choices[0].message.content || "{}");
      // 💡 여기서 currentMessages.push(...) 를 하지 않으므로 사용자 채팅창에 기획서가 노출되지 않습니다.

      // [에이전트 3] 검증 에이전트 (항상 실행)
      setSystemStatus("검증 에이전트: 계획 안전성 평가 중...");
      const reviewResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: REVIEWER_AGENT_PROMPT },
          { role: "user", content: `사용자 요청: ${userMsg}\n수립된 계획: ${JSON.stringify(planResult)}` }
        ]
      });

      const reviewResult = JSON.parse(reviewResponse.choices[0].message.content || "{}");

      if (reviewResult.status === "FAIL") {
        currentMessages.push({ role: "assistant", content: `🚨 보안 검증 실패로 작업을 중단했습니다.\n사유: ${reviewResult.feedback}` });
        setMessages([...currentMessages]);
      } else {
        // 검증 통과 시 조용히 Worker 에이전트 실행
        await executeWorkerAgent(JSON.stringify(planResult.steps), userMsg, currentMessages);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ 에이전트 처리 중 오류가 발생했습니다: ${error}` }]);
    } finally {
      setIsProcessing(false);
      setSystemStatus("대기 중..."); 
    }
  };

  return { isProcessing, sendMessage };
}
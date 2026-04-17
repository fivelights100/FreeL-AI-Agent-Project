import { useState } from "react";
import OpenAI from "openai";
import { 
  MAIN_INTENT_PROMPT, PLANNER_PROMPT, WEB_RESEARCHER_PROMPT, 
  SECURITY_ASSESSOR_PROMPT, QA_VALIDATOR_PROMPT, MAIN_EXECUTOR_PROMPT 
} from "../agents/prompts";
import { 
  READ_TOOLS, WEB_TOOLS, EXECUTE_TOOLS, 
  getAllowedTools, executeToolCall 
} from "../agents/toolsExecutor";

// App.tsx에서 기존처럼 임포트할 수 있도록 다시 내보내기(re-export) 해줍니다.
export { systemPrompt } from "../agents/prompts"; 

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
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

export function useAgent({
  openai, messages, setMessages, installedPlugins, fsWhitelist, userHome, setSystemStatus
}: UseAgentProps) {
  
  const [isProcessing, setIsProcessing] = useState(false);

  // [핵심 로직] 권한이 제한된 에이전트의 자율 주행 루프
  const runAgentLoop = async (agentName: string, systemPrompt: string, userPrompt: string, allowedToolNames: string[]) => {
    const allowedTools = getAllowedTools(installedPlugins, allowedToolNames);
    let loopMessages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    let isDone = false;
    let loopCount = 0;
    const MAX_LOOPS = 5;
    let finalJsonResponse = null;

    while (!isDone && loopCount < MAX_LOOPS) {
      loopCount++;
      setSystemStatus(`${agentName} 가동 중... (${loopCount})`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: loopMessages as any,
        tools: allowedTools.length > 0 ? allowedTools : undefined,
        tool_choice: allowedTools.length > 0 ? "auto" : "none",
      });

      const msg = response.choices[0].message as Message;
      loopMessages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const call of msg.tool_calls) {
          const result = await executeToolCall(call);
          loopMessages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: result });
        }
      } else {
        isDone = true;
        finalJsonResponse = JSON.parse(msg.content || "{}");
      }
    }
    return finalJsonResponse;
  };

  // [메인 오케스트레이션 파이프라인]
  const sendMessage = async (userMsg: string) => {
    setIsProcessing(true);
    let currentMessages = [...messages];
    currentMessages.push({ role: "user", content: userMsg });
    setMessages([...currentMessages]);

    try {
      // 1. 메인 에이전트 (의도 파악)
      setSystemStatus("의도 분석 중...");
      const intentRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: MAIN_INTENT_PROMPT }, { role: "user", content: userMsg }]
      });
      const intent = JSON.parse(intentRes.choices[0].message.content || "{}");

      if (intent.type === "chat") {
        setMessages(prev => [...prev, { role: "assistant", content: intent.response }]);
        return;
      }

      // 2. 기획/설계 에이전트 (읽기 전용 권한)
      const plannerContext = `사용자 요청: ${userMsg}\n시스템 홈: ${userHome}`;
      const planResult = await runAgentLoop("기획/설계 에이전트", PLANNER_PROMPT, plannerContext, READ_TOOLS);

      // 3. 탐색/분석 에이전트 (웹 검색 전용 권한)
      let webReport = "웹 검색을 수행하지 않았습니다.";
      if (planResult.requires_web_search) {
        const webContext = `사용자 요청: ${userMsg}\n기획자의 계획: ${JSON.stringify(planResult.summary)}`;
        const webResult = await runAgentLoop("탐색/분석 에이전트", WEB_RESEARCHER_PROMPT, webContext, WEB_TOOLS);
        webReport = webResult.research_report;
      }

      // 4. 위험성 평가 에이전트
      setSystemStatus("위험성 평가 중...");
      const assessRes = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SECURITY_ASSESSOR_PROMPT },
          { role: "user", content: `계획: ${JSON.stringify(planResult)}\n화이트리스트: ${fsWhitelist.length > 0 ? fsWhitelist.join(", ") : "전체 허용"}` }
        ]
      });
      const assessCheck = JSON.parse(assessRes.choices[0].message.content || "{}");
      if (assessCheck.status === "FAIL") {
        setMessages(prev => [...prev, { role: "assistant", content: `🚨 위험 감지(차단됨): ${assessCheck.reason}` }]);
        return;
      }

      // 5. 사전 검증 에이전트
      setSystemStatus("사전 논리 검증 중...");
      const qaPreRes = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: QA_VALIDATOR_PROMPT },
          { role: "user", content: `검증 모드: pre\n목표: ${userMsg}\n계획: ${JSON.stringify(planResult)}` }
        ]
      });
      const qaPreCheck = JSON.parse(qaPreRes.choices[0].message.content || "{}");
      if (qaPreCheck.status === "FAIL") {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ 계획 오류 중단:\n${qaPreCheck.feedback}` }]);
        return;
      }

      // 6. 메인 에이전트 실행
      const execContext = `목표: ${userMsg}\n계획: ${JSON.stringify(planResult.steps)}\n웹 데이터: ${webReport}`;
      const execResult = await runAgentLoop("메인 실행 에이전트", MAIN_EXECUTOR_PROMPT, execContext, EXECUTE_TOOLS);

      // 7. 사후 검증 에이전트
      setSystemStatus("사후 결과 검증 중...");
      const qaPostRes = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: QA_VALIDATOR_PROMPT },
          { role: "user", content: `검증 모드: post\n원래 목표: ${userMsg}\n수행 결과: ${JSON.stringify(execResult)}` }
        ]
      });
      const qaPostCheck = JSON.parse(qaPostRes.choices[0].message.content || "{}");

      // 최종 답변 출력
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `✅ 작업이 완료되었습니다.\n\n${execResult.final_result_summary}\n\nQA 피드백: ${qaPostCheck.feedback}` 
      }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ 처리 중 오류 발생: ${error}` }]);
    } finally {
      setIsProcessing(false);
      setSystemStatus("대기 중...");
    }
  };

  return { isProcessing, sendMessage };
}
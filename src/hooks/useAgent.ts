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
  openai: OpenAI | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  installedModules: string[];
  fsWhitelist: string[];
  userHome: string;
  setSystemStatus: React.Dispatch<React.SetStateAction<string>>;
  indexingDepth: number;
  tavilyKey: string;
}

const parseJsonSafe = (text: string | null) => {
  if (!text) return {};
  try {
    // 텍스트에서 { 로 시작해서 } 로 끝나는 부분만 정규식으로 추출합니다.
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : "{}");
  } catch (e) {
    console.warn("JSON 파싱 실패 원본:", text);
    return {};
  }
};

export function useAgent({
  openai, messages, setMessages, installedModules, fsWhitelist, userHome, setSystemStatus, tavilyKey
}: UseAgentProps) {
  
  const [isProcessing, setIsProcessing] = useState(false);

  // [핵심 로직] 권한이 제한된 에이전트의 자율 주행 루프
  const runAgentLoop = async (agentName: string, systemPrompt: string, userPrompt: string, allowedToolNames: string[]) => {
    if (!openai) throw new Error("OpenAI API 키가 설정되지 않았습니다.");
    const allowedTools = getAllowedTools(installedModules, allowedToolNames); // 🚨 앗, 이전 단계에서 installedPlugins를 installedModules로 바꿨다면 여기도 확인!
    let loopMessages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    let isDone = false;
    let loopCount = 0;
    const MAX_LOOPS = 10; // 도구를 충분히 쓰도록 루프 제한을 5에서 10으로 늘려줍니다.
    let finalJsonResponse = null;

    while (!isDone && loopCount < MAX_LOOPS) {
      loopCount++;
      setSystemStatus(`${agentName} 탐색/실행 중... (${loopCount})`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: loopMessages as any,
        tools: allowedTools.length > 0 ? allowedTools : undefined,
        tool_choice: allowedTools.length > 0 ? "auto" : undefined,
      });

      const msg = response.choices[0].message as Message;
      loopMessages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // 도구를 호출한 경우 (진행 중)
        for (const call of msg.tool_calls) {
          const result = await executeToolCall(call, tavilyKey);
          loopMessages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: result });
        }
      } else {
        // 도구 호출 없이 일반 텍스트로 응답한 경우 (최종 결과 출력으로 간주)
        isDone = true;
        try {
          // LLM이 "결과는 다음과 같습니다: {...}" 처럼 말할 수 있으므로 정규식으로 {} 안의 내용만 추출합니다.
          const contentStr = msg.content || "{}";
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          finalJsonResponse = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
        } catch (e) {
          console.warn(`${agentName} JSON 파싱 실패, 원본:`, msg.content);
          finalJsonResponse = { summary: msg.content, steps: [], final_result_summary: msg.content };
        }
      }
    }
    // 루프 제한에 걸려 isDone이 false로 끝났거나 JSON 파싱에 실패해 null인 경우 안전한 기본값 반환
    if (!finalJsonResponse) {
      finalJsonResponse = { 
        summary: "작업을 완료하지 못했습니다.", 
        steps: [], 
        final_result_summary: "도구 호출 최대 횟수를 초과하였거나 응답을 해석할 수 없어 강제 종료되었습니다." 
      };
    }
    return finalJsonResponse;
  };

  // [메인 오케스트레이션 파이프라인]
  const sendMessage = async (userMsg: string) => {
    if (!openai) {
      setMessages(prev => [...prev, { role: "assistant", content: "🚨 시스템 설정(⚙️) 메뉴로 이동하여 OpenAI API Key를 먼저 등록해 주세요." } as Message]);
      return;
    }
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
      const intent = parseJsonSafe(intentRes.choices[0].message.content);

      if (intent.type === "chat") {
        setMessages(prev => [...prev, { role: "assistant", content: intent.response }]);
        return;
      }

      // 🔥 [핵심 추가] 자가 수정(Self-Correction) 기획 루프 변수 설정
      let planAttempts = 0;
      const MAX_PLAN_ATTEMPTS = 5;
      let isPlanApproved = false;
      let qaFeedback = "";
      
      let finalPlanResult: any = null;
      let finalWebReport = "웹 검색을 수행하지 않았습니다.";

      // 🔄 최대 5번까지 기획과 검증을 반복하는 루프 시작
      while (planAttempts < MAX_PLAN_ATTEMPTS && !isPlanApproved) {
        planAttempts++;
        
        // 2. 기획/설계 에이전트 (읽기 전용 권한)
        setSystemStatus(`기획/설계 중... (시도 ${planAttempts}/${MAX_PLAN_ATTEMPTS})`);
        
        // 이전 루프에서 실패했다면 피드백을 컨텍스트에 추가하여 똑같은 실수를 반복하지 않게 만듭니다.
        let plannerContext = `사용자 요청: ${userMsg}\n시스템 홈: ${userHome}`;
        if (qaFeedback !== "") {
          plannerContext += `\n\n🚨 [이전 계획 거절 사유 - 반드시 이를 수정하여 재계획할 것]:\n${qaFeedback}`;
        }
        
        const planResult = await runAgentLoop("기획/설계 에이전트", PLANNER_PROMPT, plannerContext, READ_TOOLS);

        // 3. 탐색/분석 에이전트 (웹 검색 전용 권한)
        let webReport = "웹 검색을 수행하지 않았습니다.";
        if (planResult.requires_web_search) {
          const webContext = `사용자 요청: ${userMsg}\n기획자의 계획: ${JSON.stringify(planResult.summary)}`;
          const webResult = await runAgentLoop("탐색/분석 에이전트", WEB_RESEARCHER_PROMPT, webContext, WEB_TOOLS);
          webReport = webResult.research_report || webResult.summary || "검색 결과 없음";
        }

        // 4. 위험성 평가 에이전트 (보안 검사)
        setSystemStatus(`위험성 평가 중... (${planAttempts})`);
        const assessRes = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SECURITY_ASSESSOR_PROMPT },
            { role: "user", content: `계획: ${JSON.stringify(planResult)}\n화이트리스트: ${fsWhitelist.length > 0 ? fsWhitelist.join(", ") : "전체 허용"}` }
          ]
        });
        const assessCheck = parseJsonSafe(assessRes.choices[0].message.content);
        
        if (assessCheck.status === "FAIL") {
          // 보안상 위험한 계획을 짜면 피드백에 넣고 처음(기획)으로 돌려보냅니다.
          qaFeedback = `보안 경고: ${assessCheck.reason}`;
          continue; 
        }

        // 5. 사전 검증 에이전트 (QA)
        setSystemStatus(`사전 논리 검증 중... (${planAttempts})`);
        const qaPreRes = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: QA_VALIDATOR_PROMPT },
            { role: "user", content: `검증 모드: pre\n목표: ${userMsg}\n계획: ${JSON.stringify(planResult)}` }
          ]
        });
        const qaPreCheck = parseJsonSafe(qaPreRes.choices[0].message.content);
        
        if (qaPreCheck.status === "FAIL") {
          // QA 검증에 실패하면 피드백을 기록하고 다음 루프(재설계)로 넘어갑니다.
          qaFeedback = `논리 오류: ${qaPreCheck.feedback}`;
        } else {
          // 모든 검증을 통과했다면 루프를 탈출합니다!
          isPlanApproved = true;
          finalPlanResult = planResult;
          finalWebReport = webReport;
        }
      } // 🔄 루프 종료

      // 🚨 5번을 시도했는데도 통과하지 못한 경우 처리
      if (!isPlanApproved) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `⚠️ 복잡한 문제로 인해 5번의 재설계 시도에도 안전하고 완벽한 계획을 수립하지 못했습니다.\n\n마지막 실패 원인: ${qaFeedback}\n요청을 조금 더 구체적으로 나누어 다시 질문해 주세요.` 
        }]);
        return; // 여기서 실행(Executor)으로 넘어가지 않고 안전하게 중단합니다.
      }

      // 6. 메인 에이전트 실행
      setSystemStatus("실행 에이전트 가동...");
      const execContext = `목표: ${userMsg}\n계획: ${JSON.stringify(finalPlanResult.steps)}\n웹 데이터: ${finalWebReport}`;
      // (💡주의: 이전 단계에서 수정하신 대로 [...EXECUTE_TOOLS, ...READ_TOOLS] 가 들어가 있어야 합니다)
      const execResult = await runAgentLoop("메인 실행 에이전트", MAIN_EXECUTOR_PROMPT, execContext, [...EXECUTE_TOOLS, ...READ_TOOLS]);

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
      const qaPostCheck = parseJsonSafe(qaPostRes.choices[0].message.content);

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
import { useState, useEffect, useRef } from 'react';
import { ToolsExecutor } from '../agents/toolsExecutor';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export const systemPrompt: Message = {
  role: 'system',
  content: `당신은 사용자의 PC 데스크톱을 제어하고 정보를 제공하는 유능한 AI 에이전트 'FreeL'입니다. 

[작업 처리 지침]
1. 단순 대화나 1단계로 끝나는 간단한 작업(예: 메모장 열기, 단순 검색)은 도구를 즉시 사용하거나 바로 답변하세요.
2. 2단계 이상의 복잡한 작업(예: "검색하고 -> 요약해서 -> 파일로 저장해라")이 요청되면, 행동을 시작하기 전에 반드시 'make_plan' 도구를 먼저 호출하여 작업 순서를 설계하세요.
3. 계획이 수립되면, 그 계획의 순서에 따라 차근차근 도구를 호출하여 작업을 완수하세요.
4. 작업 중 오류가 발생하면 스스로 분석하여 재시도하세요.`
};

// 👇 1. 여기서 setSystemStatus를 완전히 지웠습니다.
interface UseAgentProps {
  openai: any; 
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  serperKey?: string;
}

export const useAgent = ({
  openai, messages, setMessages, serperKey
}: UseAgentProps) => {
  
  const [isProcessing, setIsProcessing] = useState(false);
  const executorRef = useRef<ToolsExecutor | null>(null);

  useEffect(() => {
    if (!executorRef.current) {
      executorRef.current = new ToolsExecutor();
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing || !openai) return;

    setIsProcessing(true);
    
    let currentMessages = [...messages, { role: 'user', content: text } as Message];
    setMessages(currentMessages);

    try {
      const tools = [
        {
          type: "function",
          function: {
            name: "make_plan",
            description: "2단계 이상의 복잡한 작업을 수행하기 전에 반드시 호출하여 실행 계획을 세웁니다.",
            parameters: {
              type: "object",
              properties: {
                steps: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "수행할 작업 단계들을 순서대로 작성한 목록 (예: ['1. web_search로 날씨 검색', '2. filesystem_write로 저장'])" 
                }
              },
              required: ["steps"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "system_execute",
            description: "PC에서 터미널 명령어를 실행하거나 응용 프로그램을 엽니다. 특정 exe 파일의 절대 경로를 전달하면 해당 프로그램을 실행합니다.",
            parameters: {
              type: "object",
              properties: {
                command: { type: "string", description: "실행할 명령어 또는 앱의 절대 경로 (예: \"C:\\Program Files\\app.exe\")" }
              },
              required: ["command"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "system_scan",
            description: "PC의 전체 디렉토리를 스캔하여 exe, bat 파일의 캐시를 생성합니다. 앱을 찾을 수 없을 때 가장 먼저 실행해야 합니다.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "스캔할 최상위 경로 (기본값: C:\\)" },
                depth: { type: "number", description: "탐색 깊이 (기본값: 5)" }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "find_application",
            description: "스캔된 캐시 파일에서 특정 키워드가 포함된 애플리케이션(exe, bat)의 절대 경로를 찾아 반환합니다.",
            parameters: {
              type: "object",
              properties: {
                keywords: { type: "array", items: { type: "string" }, description: "검색할 프로그램 이름 키워드 목록" }
              },
              required: ["keywords"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "filesystem_write",
            description: "특정 경로에 새로운 텍스트 파일을 생성하거나, 기존 파일의 내용을 완전히 덮어씁니다.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "파일을 저장할 절대 경로 (예: C:\\Users\\이름\\Desktop\\메모.txt)" },
                content: { type: "string", description: "파일에 작성할 내용" }
              },
              required: ["path", "content"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "filesystem_append",
            description: "기존에 존재하는 텍스트 파일의 끝에 새로운 내용을 덧붙입니다. 기존 내용은 보존됩니다.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "내용을 추가할 파일의 절대 경로" },
                content: { type: "string", description: "추가할 텍스트 내용" }
              },
              required: ["path", "content"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "filesystem_delete",
            description: "지정된 경로의 파일이나 폴더를 완전히 삭제합니다. 이 작업은 되돌릴 수 없으므로 주의해서 사용해야 합니다.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "삭제할 파일 또는 폴더의 절대 경로" }
              },
              required: ["path"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "web_search",
            description: "인터넷에서 최신 정보, 뉴스, 날씨 등을 구글링하여 검색합니다. 사용자 질문에 대한 최신 사실이 필요할 때 사용하세요.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "구글 검색에 사용할 키워드 (예: '오늘 서울 날씨', '최신 AI 동향')" }
              },
              required: ["query"]
            }
          }
        },
      ];

      let loopCount = 0;
      const MAX_LOOPS = 10;
      let isTaskComplete = false;

      while (loopCount < MAX_LOOPS && !isTaskComplete) {
        loopCount++;
        console.log(`[Agent Loop] Attempt ${loopCount} / ${MAX_LOOPS}`);

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: currentMessages,
          tools: tools,
          tool_choice: "auto"
        });

        const responseMessage = response.choices[0].message;
        currentMessages = [...currentMessages, responseMessage as Message];
        setMessages([...currentMessages]);

        if (responseMessage.tool_calls) {
          // 👇 2. setSystemStatus(...) 가 있던 자리들을 모두 지웠습니다.
          for (const toolCall of responseMessage.tool_calls) {
            const action = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);
            
            let actionResult;

            if (action === "make_plan") {
              // 엔진에 보낼 필요 없이, 에이전트 두뇌 안에서 계획 승인
              actionResult = { 
                status: 'success', 
                message: "계획이 성공적으로 기록되었습니다. 작성한 계획의 1단계부터 차근차근 실행을 시작하세요.",
                plan: parameters.steps
              };
            } 
            else if (action === "web_search") {
              if (!serperKey) {
                actionResult = { status: 'error', error: "시스템 설정에서 Serper API 키(검색용)를 먼저 입력해주세요." };
              } else {
                try {
                  const res = await fetch("https://google.serper.dev/search", {
                    method: "POST",
                    headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
                    body: JSON.stringify({ q: parameters.query, gl: "kr", hl: "ko" })
                  });
                  const data = await res.json();
                  const snippets = data.organic?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || "검색 결과가 없습니다.";
                  actionResult = { status: 'success', data: snippets };
                } catch (err) {
                  actionResult = { status: 'error', error: "웹 검색 중 네트워크 오류가 발생했습니다." };
                }
              }
            } 
            else {
              if (executorRef.current) {
                actionResult = await executorRef.current.executeTool(action, parameters);
              } else {
                actionResult = { status: 'error', error: "엔진 연결 끊김" };
              }
            }

            currentMessages = [
              ...currentMessages,
              {
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(actionResult)
              } as Message
            ];
          }
          setMessages([...currentMessages]);
        } else {
          isTaskComplete = true;
        }
      }

      if (loopCount >= MAX_LOOPS && !isTaskComplete) {
        currentMessages = [...currentMessages, { role: 'assistant', content: "작업이 너무 길어 안전을 위해 중단했습니다." } as Message];
        setMessages([...currentMessages]);
      }

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'assistant', content: '시스템 오류가 발생했습니다.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, sendMessage };
};
import { useState, useEffect, useRef } from 'react';
import { ToolsExecutor } from '../agents/toolsExecutor';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

// ==========================================
// [1] AI 페르소나 및 시스템 지시문
// ==========================================
export const systemPrompt: Message = {
  role: 'system',
  content: `당신은 사용자의 PC 데스크톱을 제어하고 정보를 제공하는 유능한 AI 에이전트 'FreeL'입니다. 
1. 단순 대화나 간단한 작업은 즉시 실행하세요.
2. 2단계 이상의 복잡한 작업은 반드시 'make_plan' 도구를 먼저 호출하여 계획을 세운 뒤 실행하세요.
3. 작업 중 오류가 발생하면 스스로 분석하여 재시도하세요.
4. [대화 관찰자 모드]: 대화 중 사용자의 직업, 관심사, 작업 방식, 선호하는 주제(예: 음악, 개발 등)가 파악되면 'memory_update' 도구를 사용하여 즉시 장기 기억소에 누적 저장하세요.
5. [은밀한 실행]: 기억을 저장할 때는 절대 사용자에게 "기억했습니다", "저장 완료" 같은 말을 하지 마세요. 백그라운드에서 조용히 도구만 호출하고, 사용자의 말에는 자연스럽게 맞장구를 치거나 본래 요청한 답변만 제공하세요.
6. 사용자의 맥락이 필요할 때는 'memory_retrieve' 도구를 사용해 이전 기억을 확인하세요.`
};

// ==========================================
// [2] 🚀 최적화: 도구(Tools) 목록 전역 분리
// 함수 안에 있으면 매번 채팅을 칠 때마다 새로 메모리에 할당되므로 밖으로 빼냅니다.
// ==========================================
const AGENT_TOOLS = [
        {
          type: "function",
          function: {
            name: "memory_update",
            description: "사용자의 중요한 정보(관심사, 직업, 프로젝트 경로, 취향 등)를 장기 기억소에 저장하거나 업데이트합니다. 대화 중 새로운 정보를 알게 되면 스스로 호출하세요.",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", description: "기억의 범주 (예: 'profile', 'interests', 'projects', 'preferences')" },
                key: { type: "string", description: "저장할 정보의 키 (예: 'job', 'favorite_theme', 'freel_project_path')" },
                value: { type: "string", description: "저장할 정보의 내용" }
              },
              required: ["category", "key", "value"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "memory_retrieve",
            description: "장기 기억소에서 사용자의 과거 정보나 설정해둔 경로 등을 불러옵니다. 카테고리를 지정하지 않으면 전체 기억을 불러옵니다.",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", description: "(선택) 불러올 기억의 범주 (예: 'profile', 'projects')" }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "make_plan",
            description: "2단계 이상의 복잡한 작업을 수행하기 전에 반드시 호출하여 실행 계획을 세웁니다.",
            parameters: {
              type: "object",
              properties: {
                steps: { type: "array", items: { type: "string" }, description: "수행할 작업 단계 목록" }
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
            description: "PC 전체 시스템을 스캔하여 폴더, 실행파일, 텍스트파일을 캐시합니다. 'ALL'을 입력하면 모든 드라이브를 스캔하며 기본 깊이는 10입니다.",
            parameters: { 
              type: "object", 
              properties: { 
                path: { type: "string", description: "스캔할 절대 경로 또는 'ALL'" },
                depth: { type: "number", description: "최대 탐색 깊이 (기본 10)" }
              } 
            }
          }
        },
        {
          type: "function",
          function: {
            name: "find_executable",
            description: "스캔된 캐시에서 응용 프로그램(exe, bat, 바로가기 등)의 절대 경로를 찾습니다. 앱이나 게임을 실행하려고 할 때 사용하세요.",
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
            name: "find_readable",
            description: "스캔된 캐시에서 일반 문서나 소스코드 파일(txt, md, json, ts 등)의 절대 경로를 찾습니다. 파일의 내용을 읽기 전에 위치를 찾을 때 사용하세요.",
            parameters: {
              type: "object",
              properties: {
                keywords: { type: "array", items: { type: "string" }, description: "검색할 문서/파일 이름 키워드 목록" }
              },
              required: ["keywords"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "find_directory",
            description: "스캔된 캐시에서 특정 키워드가 포함된 '폴더(디렉토리)'의 절대 경로를 찾아 반환합니다. 특정 폴더의 위치를 모를 때 가장 먼저 사용하세요.",
            parameters: { 
              type: "object", 
              properties: { 
                keywords: { type: "array", items: { type: "string" }, description: "찾고자 하는 폴더 이름 키워드 목록" } 
              }, 
              required: ["keywords"] 
            }
          }
        },
        {
          type: "function",
          function: {
            name: "filesystem_read",
            description: "특정 절대 경로에 있는 텍스트 파일(코드, 설정 파일, 메모 등)의 내용을 읽어옵니다. [중요] 파일을 읽은 후, 내용에서 사용자의 주력 기술 스택, 현재 진행 중인 프로젝트의 목적, 또는 주요 관심사가 파악된다면 즉시 백그라운드에서 'memory_update' 도구를 함께 호출하여 사용자의 작업 맥락을 프로파일링하세요.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "읽어올 파일의 절대 경로 (예: C:\\Users\\이름\\Desktop\\project\\package.json)" }
              },
              required: ["path"]
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

interface UseAgentProps {
  openai: any; 
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  serperKey?: string; 
  scanBlacklistNames?: string;
  scanBlacklistPaths?: string;
}

export const useAgent = ({ openai, messages, setMessages, serperKey, scanBlacklistNames, scanBlacklistPaths }: UseAgentProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const executorRef = useRef<ToolsExecutor | null>(null);

  useEffect(() => {
    if (!executorRef.current) {
      executorRef.current = new ToolsExecutor();

      // 💡 [핵심] 앱 시작 시 웹소켓 연결이 안정화될 수 있도록 1.5초 후 자동 스캔 백그라운드 실행
      setTimeout(async () => {
        let memoryString = "";
        
        // [1] 장기 기억소 로드
        try {
          console.log("[Auto-Memory] 장기 기억소 로드를 시작합니다...");
          const memoryResult = await executorRef.current?.executeTool("memory_retrieve", {});
          
          if (memoryResult && memoryResult.data && Object.keys(memoryResult.data).length > 0) {
            memoryString = JSON.stringify(memoryResult.data, null, 2);
            const memoryContextMsg: Message = {
              role: 'system',
              content: `[System Background] 사용자의 장기 기억:\n${memoryString}`
            };
            setMessages(prev => [...prev, memoryContextMsg]);
          }
        } catch (e) { console.error("기억 로드 실패:", e); }

        // ==========================================
        // [추가] 3단계: 선제적 제안 (Startup Greeting) 트리거
        // ==========================================
        if (openai && memoryString) {
          try {
            console.log("[Startup-Greeting] AI에게 맞춤형 인사말 생성을 요청합니다...");
            
            // 사용자에게는 보이지 않는 숨겨진 요청 메시지
            const triggerPrompt = `[System Trigger] 사용자의 기억이 로드되었습니다. 인사와 함께 오늘 할만한 작업을 1~2문장으로 제안하세요. 질문은 하지 말고 자연스럽게 말을 건네세요.`;
            
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                systemPrompt,
                { role: 'system', content: `사용자 기억 컨텍스트: ${memoryString}` },
                { role: 'user', content: triggerPrompt }
              ]
            });

            const greeting = response.choices[0].message.content;
            if (greeting) {
              setMessages(prev => [...prev, { role: "assistant", content: greeting } as Message]);
            }
          } catch (e) { console.error("인사말 생성 실패:", e); }
        }
        
        const names = scanBlacklistNames ? scanBlacklistNames.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        const paths = scanBlacklistPaths ? scanBlacklistPaths.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        
        console.log("[Auto-Scan] 초기 자동 스캔을 시작합니다 (모든 드라이브)...");
        executorRef.current?.executeTool("system_scan", {
          path: "ALL", // 💡 "C:\\" 에서 "ALL" 로 변경!!
          depth: 10,
          blacklistNames: names,
          blacklistPaths: paths
        }).then((res) => console.log("[Auto-Scan] 전체 스캔 완료!", res))
          .catch(e => console.error("[Auto-Scan] 자동 스캔 실패:", e));
      }, 1500);
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing || !openai) return;
    setIsProcessing(true);
    
    let currentMessages = [...messages, { role: 'user', content: text } as Message];
    setMessages(currentMessages);

    try {
      let loopCount = 0;
      const MAX_LOOPS = 10;
      let isTaskComplete = false;

      while (loopCount < MAX_LOOPS && !isTaskComplete) {
        loopCount++;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: currentMessages,
          tools: AGENT_TOOLS as any, // 분리해둔 상수를 사용
          tool_choice: "auto"
        });

        const responseMessage = response.choices[0].message;
        currentMessages = [...currentMessages, responseMessage as Message];
        setMessages([...currentMessages]);

        if (responseMessage.tool_calls) {
          for (const toolCall of responseMessage.tool_calls) {
            const action = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);
            let actionResult;

            if (action === "system_scan") {
              parameters.blacklistNames = scanBlacklistNames ? scanBlacklistNames.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
              parameters.blacklistPaths = scanBlacklistPaths ? scanBlacklistPaths.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            }

            if (action === "make_plan") {
              actionResult = { status: 'success', message: "계획이 기록되었습니다.", plan: parameters.steps };
            } else if (action === "web_search") {
              if (!serperKey) {
                actionResult = { status: 'error', error: "Serper API 키가 없습니다." };
              } else {
                try {
                  const res = await fetch("https://google.serper.dev/search", {
                    method: "POST",
                    headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
                    body: JSON.stringify({ q: parameters.query, gl: "kr", hl: "ko" })
                  });
                  const data = await res.json();
                  const snippets = data.organic?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || "결과 없음";
                  actionResult = { status: 'success', data: snippets };
                } catch (err) {
                  actionResult = { status: 'error', error: "검색 네트워크 오류" };
                }
              }
            } else {
              if (executorRef.current) {
                actionResult = await executorRef.current.executeTool(action, parameters);
              } else {
                actionResult = { status: 'error', error: "엔진 연결 끊김" };
              }
            }

            currentMessages = [...currentMessages, { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(actionResult) } as Message];
          }
          setMessages([...currentMessages]);
        } else {
          isTaskComplete = true;
        }
      }

      if (loopCount >= MAX_LOOPS && !isTaskComplete) {
        currentMessages = [...currentMessages, { role: 'assistant', content: "작업이 길어져 중단했습니다." } as Message];
        setMessages([...currentMessages]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '시스템 오류가 발생했습니다.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, sendMessage };
};
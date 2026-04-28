import { useState, useRef, useEffect, useMemo } from "react";
import { getCurrentWindow, currentMonitor, LogicalSize } from '@tauri-apps/api/window';
import OpenAI from "openai";
import "./App.css";

import { useSettings } from "./hooks/useSettings";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useAgent, systemPrompt, Message } from "./hooks/useAgent";

import { Header } from "./components/Header";
import { ChatList } from "./components/ChatList";
import { ChatInput } from "./components/ChatInput";
import { Live2DView } from "./components/Live2DView";
import { SystemSettingsView } from "./components/SystemSettingsView";

function App() {
  const { 
    openaiKey, setOpenaiKey, serperKey, setSerperKey, 
    elevenlabsKey, setElevenlabsKey, voiceId, setVoiceId 
  } = useSettings();

  const [activeTab, setActiveTab] = useState<"chat" | "2d" | "system">("chat");
  const [chatSubTab, setChatSubTab] = useState<"general" | "thought" | "debug">("general");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBentoOpen, setIsBentoOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    systemPrompt as Message, 
    { role: "assistant", content: "안녕하세요! 사용자님의 데스크톱 제어 AI입니다." } as Message
  ]);
  const [inputText, setInputText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openai = useMemo(() => {
    if (!openaiKey) return null;
    return new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
  }, [openaiKey]);

  // 상태 보고(setSystemStatus) 관련 코드를 떼어낸 훅 사용
  const { isRecording, startRecording, stopRecording } = useAudioRecorder({ openai, setInputText });
  const { isProcessing, sendMessage } = useAgent({ openai, messages, setMessages, serperKey });

  // 💡 [핵심 로직] 전체 메시지 중 '가장 마지막 사용자 입력'의 위치를 찾습니다.
  const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
  // 💡 해당 위치부터 끝까지 잘라내어 "현재 진행 중인 작업" 배열을 만듭니다.
  const currentTaskMessages = lastUserIndex >= 0 ? messages.slice(lastUserIndex) : [];

  useEffect(() => {
    const adjustWindowSize = async () => {
      try {
        const appWindow = getCurrentWindow();
        const monitor = await currentMonitor();
        if (monitor) {
          const monitorWidth = monitor.size.width / monitor.scaleFactor;
          const monitorHeight = monitor.size.height / monitor.scaleFactor;
          await appWindow.setSize(new LogicalSize(monitorWidth * 0.16, monitorHeight * 0.6));
          await appWindow.show();
        }
      } catch (e) { console.warn("Tauri 환경 아님"); }
    };
    adjustWindowSize();
  }, []);

  useEffect(() => { 
    if (messagesEndRef.current) {
      messagesEndRef.current.parentElement?.scrollTo({ top: messagesEndRef.current.parentElement.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, chatSubTab]);
  
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText, isExpanded]);

  const toggleWindowSize = async () => {
    try {
      const nextExpanded = !isExpanded;
      const appWindow = getCurrentWindow();
      const monitor = await currentMonitor();
      if (monitor) {
        const monitorWidth = monitor.size.width / monitor.scaleFactor;
        const monitorHeight = monitor.size.height / monitor.scaleFactor;
        await appWindow.setSize(new LogicalSize(monitorWidth * (nextExpanded ? 0.4 : 0.16), monitorHeight * 0.6));
      }
      setIsExpanded(nextExpanded);
    } catch (error) { console.error(error); }
  };

  const handleSend = () => {
    if (!inputText.trim() || isProcessing) return;
    const textToProcess = inputText.trim();
    setInputText(""); 
    sendMessage(textToProcess);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0A0A0B] text-slate-200 font-sans overflow-hidden p-2 sm:p-4 selection:bg-indigo-500/30">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <Header 
        isBentoOpen={isBentoOpen} setIsBentoOpen={setIsBentoOpen} 
        isExpanded={isExpanded} toggleWindowSize={toggleWindowSize} 
        activeTab={activeTab} setActiveTab={setActiveTab} 
      />

      <main className="flex-1 overflow-hidden p-4 relative flex flex-col bg-white/[0.02] border border-white/5 rounded-2xl">
        {activeTab === "chat" ? (
          <div className="flex flex-col h-full gap-4">
            
            <div className="flex items-center justify-end shrink-0 gap-3 mb-1">
              {isProcessing && <div className="w-5 h-5 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />}
              <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                <button onClick={() => setChatSubTab("general")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chatSubTab === "general" ? "bg-blue-500 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>일반 채팅</button>
                <button onClick={() => setChatSubTab("thought")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chatSubTab === "thought" ? "bg-amber-500 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>생각 과정</button>
                <button onClick={() => setChatSubTab("debug")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chatSubTab === "debug" ? "bg-emerald-500 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>디버깅</button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col">
              {/* 1. 일반 채팅 (전체 메시지에서 JSON만 숨김) */}
              {chatSubTab === "general" && (
                <ChatList messages={messages.filter(m => !m.tool_calls && m.role !== 'tool')} messagesEndRef={messagesEndRef} />
              )}
              
              {/* 2. 생각 과정 (currentTaskMessages 사용) */}
              {chatSubTab === "thought" && (
                <div className="absolute inset-0 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                  {currentTaskMessages.filter(m => m.tool_calls || m.role === 'tool').map((msg, i) => (
                    <div key={i} className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-sm text-amber-100/80">
                      {msg.tool_calls ? (
                        <div><span className="font-bold">🧠 AI의 설계:</span> {msg.tool_calls.map(t => t.function.name).join(', ')} 도구를 사용하기로 결정함</div>
                      ) : (
                        <div><span className="font-bold">🦾 엔진의 응답:</span> 작업 완료 (또는 에러 발생)</div>
                      )}
                    </div>
                  ))}
                  {currentTaskMessages.filter(m => m.tool_calls || m.role === 'tool').length === 0 && (
                    <div className="text-center text-white/30 text-sm mt-10">현재 진행 중인 작업의 도구 호출 내역이 없습니다.</div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* 3. 디버깅 (currentTaskMessages 사용) */}
              {chatSubTab === "debug" && (
                <div className="absolute inset-0 overflow-y-auto pr-2 custom-scrollbar">
                  <pre className="text-[11px] text-emerald-300/80 bg-black/50 p-4 rounded-xl border border-emerald-500/20 whitespace-pre-wrap break-all">
                    {/* 전체 메시지가 아닌 현재 작업 메시지만 문자열로 변환하여 출력 */}
                    {JSON.stringify(currentTaskMessages, null, 2)}
                  </pre>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <ChatInput 
              isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
              isExpanded={isExpanded} textareaRef={textareaRef}
              inputText={inputText} setInputText={setInputText}
              isProcessing={isProcessing} handleSend={handleSend}
            />
          </div>
        ) : activeTab === "2d" ? (
          <Live2DView isProcessing={isProcessing} lastMessage={messages[messages.length - 1]} />
        ) : (
          <SystemSettingsView 
            openaiKey={openaiKey} setOpenaiKey={setOpenaiKey}
            serperKey={serperKey} setSerperKey={setSerperKey}
            elevenlabsKey={elevenlabsKey} setElevenlabsKey={setElevenlabsKey}
            voiceId={voiceId} setVoiceId={setVoiceId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
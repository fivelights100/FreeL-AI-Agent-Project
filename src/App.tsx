import { useState, useRef, useEffect, useMemo } from "react";
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
    elevenlabsKey, setElevenlabsKey, voiceId, setVoiceId,
    scanBlacklistNames, setScanBlacklistNames,
    scanBlacklistPaths, setScanBlacklistPaths
  } = useSettings();

  const [activeTab, setActiveTab] = useState<"chat" | "2d" | "system">("chat");
  const [chatSubTab, setChatSubTab] = useState<"general" | "thought" | "debug">("general");
  const [isBentoOpen, setIsBentoOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    systemPrompt as Message
  ]);
  const [inputText, setInputText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openai = useMemo(() => {
    if (!openaiKey) return null;
    return new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
  }, [openaiKey]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({ openai, setInputText });
  const { isProcessing, sendMessage } = useAgent({ openai, messages, setMessages, serperKey, scanBlacklistNames, scanBlacklistPaths });

  const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
  const currentTaskMessages = lastUserIndex >= 0 ? messages.slice(lastUserIndex) : [];

  useEffect(() => { 
    if (messagesEndRef.current) {
      messagesEndRef.current.parentElement?.scrollTo({ top: messagesEndRef.current.parentElement.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, chatSubTab]);

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

      {/* 헤더 부분: 넓이 확장 관련 프롭스 모두 제거됨 */}
      <Header 
        isBentoOpen={isBentoOpen} setIsBentoOpen={setIsBentoOpen} 
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
              {chatSubTab === "general" && (
                <ChatList messages={messages.filter(m => !m.tool_calls && m.role !== 'tool')} messagesEndRef={messagesEndRef} />
              )}
              
              {chatSubTab === "thought" && (
                <div className="absolute inset-0 overflow-y-auto p-5 custom-scrollbar flex flex-col">
                  {currentTaskMessages.filter(m => m.tool_calls || m.role === 'tool').map((msg, i) => {
                    if (msg.tool_calls) {
                      return msg.tool_calls.map((toolCall, j) => (
                        <div key={`call-${i}-${j}`} className="relative pl-6 border-l-2 border-blue-500/30 pb-6">
                          <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                          <div className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                            <span>🧠 AI의 판단</span>
                          </div>
                          <div className="bg-blue-950/40 border border-blue-500/20 p-3 rounded-xl shadow-lg inline-block">
                             <span className="text-blue-100 font-mono text-xs bg-blue-600/30 px-2 py-1 rounded-md border border-blue-500/30">
                               {toolCall.function.name}
                             </span>
                             <span className="text-blue-200/70 text-xs ml-2">도구 사용 결정</span>
                          </div>
                        </div>
                      ));
                    } 
                    else if (msg.role === 'tool') {
                      let parsedContent: any = {};
                      try { parsedContent = JSON.parse(msg.content || "{}"); } catch(e) {}

                      if (parsedContent.plan) {
                         return (
                           <div key={`tool-${i}`} className="relative pl-6 border-l-2 border-amber-500/30 pb-6 animate-fade-in-up">
                             <div className="absolute w-3 h-3 bg-amber-500 rounded-full -left-[7px] top-1 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                             <div className="text-xs font-bold text-amber-400 mb-2">📋 작업 계획 수립 완료</div>
                             <div className="bg-amber-950/30 border border-amber-500/20 p-4 rounded-xl shadow-lg flex flex-col gap-2">
                               {parsedContent.plan.map((step: string, stepIdx: number) => (
                                 <div key={stepIdx} className="flex items-start gap-2 text-sm text-amber-100/90 bg-amber-900/20 p-2 rounded-lg border border-amber-500/10">
                                   <span className="shrink-0 text-amber-500 text-xs mt-0.5">❖</span>
                                   <span className="font-medium">{step}</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )
                      }

                      const isSuccess = parsedContent.status === 'success';
                      return (
                        <div key={`tool-${i}`} className={`relative pl-6 border-l-2 pb-6 animate-fade-in-up ${isSuccess ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                          <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${isSuccess ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`} />
                          <div className={`text-xs font-bold mb-2 flex items-center gap-1 ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isSuccess ? '✅ 실행 완료' : '❌ 실행 실패 (재설계 루프 진입)'}
                          </div>
                          <div className={`border p-3 rounded-xl shadow-lg text-xs leading-relaxed max-h-40 overflow-y-auto custom-scrollbar ${isSuccess ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-100/80' : 'bg-red-950/20 border-red-500/20 text-red-100/80'}`}>
                             {isSuccess ? (parsedContent.message || "작업이 성공적으로 수행되었습니다. (데이터는 내부적으로 처리됨)") : (parsedContent.error || "알 수 없는 오류가 발생했습니다.")}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {isProcessing && (
                     <div className="relative pl-6 border-l-2 border-slate-500/30 pb-6">
                       <div className="absolute w-3 h-3 bg-slate-400 rounded-full -left-[7px] top-1 animate-ping" />
                       <div className="absolute w-3 h-3 bg-slate-500 rounded-full -left-[7px] top-1" />
                       <div className="text-xs font-bold text-slate-400 mb-1">⏳ 에이전트가 다음 행동을 판단 중입니다...</div>
                     </div>
                  )}

                  {currentTaskMessages.filter(m => m.tool_calls || m.role === 'tool').length === 0 && !isProcessing && (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3 mt-16">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2 shadow-inner">
                        <span className="text-2xl opacity-50">💭</span>
                      </div>
                      <span>현재 진행 중인 작업의 도구 호출 내역이 없습니다.</span>
                      <span className="text-xs opacity-60">복잡한 명령을 내리면 AI의 계획과 실행 과정이 이곳에 표시됩니다.</span>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}

              {chatSubTab === "debug" && (
                <div className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-400">🔍 데이터 스트림 디버거</span>
                    <span className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-white/50">총 {currentTaskMessages.length}개 노드</span>
                  </div>

                  {currentTaskMessages.map((msg, i) => {
                    let roleColor = "text-emerald-300";
                    let borderColor = "border-emerald-500/30";
                    let bgColor = "bg-emerald-950/20";
                    let roleLabel = "🤖 Assistant (일반 답변)";

                    if (msg.role === 'user') {
                      roleColor = "text-blue-300";
                      borderColor = "border-blue-500/30";
                      bgColor = "bg-blue-950/20";
                      roleLabel = "👤 User (사용자 입력)";
                    } else if (msg.role === 'tool') {
                      roleColor = "text-amber-300";
                      borderColor = "border-amber-500/30";
                      bgColor = "bg-amber-950/20";
                      roleLabel = "⚙️ Tool Result (엔진 반환값)";
                    } else if (msg.role === 'system') {
                      roleColor = "text-slate-300";
                      borderColor = "border-slate-500/30";
                      bgColor = "bg-slate-950/20";
                      roleLabel = "⚙️ System (시스템 프롬프트)";
                    } else if (msg.tool_calls) {
                      roleColor = "text-indigo-300";
                      borderColor = "border-indigo-500/30";
                      bgColor = "bg-indigo-950/20";
                      roleLabel = "🧠 Tool Call (도구 호출 요청)";
                    }

                    return (
                      <div key={`debug-${i}`} className={`shrink-0 rounded-xl border ${borderColor} ${bgColor} overflow-hidden shadow-lg animate-fade-in-up`}>
                        <div className={`px-4 py-2 border-b ${borderColor} bg-black/40 flex justify-between items-center`}>
                          <span className={`text-xs font-bold ${roleColor}`}>{roleLabel}</span>
                          <span className="text-[10px] text-white/30 font-mono">[{i}]</span>
                        </div>
                        <div className="p-4 overflow-x-auto custom-scrollbar">
                          <pre className={`text-[11px] ${roleColor} font-mono whitespace-pre-wrap break-all leading-relaxed`}>
                            {JSON.stringify(msg, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 입력창 부분: 불필요한 프롭스 모두 제거됨 */}
            <ChatInput 
              isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
              textareaRef={textareaRef}
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
            scanBlacklistNames={scanBlacklistNames} setScanBlacklistNames={setScanBlacklistNames}
            scanBlacklistPaths={scanBlacklistPaths} setScanBlacklistPaths={setScanBlacklistPaths}
          />
        )}
      </main>
    </div>
  );
}

export default App;
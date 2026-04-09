import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";
import "./App.css";

// 훅(Hooks)
import { useSettings } from "./hooks/useSettings";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useAgent, systemPrompt, Message } from "./hooks/useAgent";

// 컴포넌트(Components)
import { PluginView } from "./components/PluginView";
import { Header } from "./components/Header";
import { ChatList } from "./components/ChatList";
import { ChatInput } from "./components/ChatInput";
import { Live2DView } from "./components/Live2DView";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, 
});

function App() {
  const { installedPlugins, setInstalledPlugins, fsWhitelist, setFsWhitelist, userHome } = useSettings();

  const [indexingBasePath, setIndexingBasePath] = useState("");
  const [indexingDepth, setIndexingDepth] = useState(3);

  const [activeTab, setActiveTab] = useState<"chat" | "plugin">("chat");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBentoOpen, setIsBentoOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([systemPrompt, { role: "assistant", content: "안녕하세요! 사용자님의 데스크탑 제어 AI입니다. 무엇이든 요청해 주세요.\n\n절대로 개인정보를 입력하지 마세요!!\n\n처음 사용하시는 사용자 께서는 플러그인 활성화 및 플러그인 초기 설정을 먼저 진행해 주세요." }]);
  const [inputText, setInputText] = useState("");
  const [systemStatus, setSystemStatus] = useState("대기 중...");

  const [chatMode, setChatMode] = useState<"text" | "2d">("text");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({ openai, setInputText, setSystemStatus });
  const { isProcessing, sendMessage } = useAgent({ openai, messages, setMessages, installedPlugins, fsWhitelist, userHome, setSystemStatus, indexingDepth, indexingBasePath });

  // 화면 스크롤 및 텍스트박스 높이 조절
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText, isExpanded]);

  const toggleWindowSize = async () => {
    try {
      const nextExpanded = !isExpanded;
      await invoke("resize_window", { expand: nextExpanded });
      setIsExpanded(nextExpanded);
    } catch (error) { console.error("화면 크기 변경 실패:", error); }
  };

  const handleSend = () => {
    if (!inputText.trim() || isProcessing) return;
    const textToProcess = inputText.trim();
    setInputText(""); 
    sendMessage(textToProcess);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 to-blue-950 text-white font-sans overflow-hidden p-2 sm:p-4">
      
      {/* 1. 상단바 (Header) */}
      <Header 
        isBentoOpen={isBentoOpen} setIsBentoOpen={setIsBentoOpen} 
        isExpanded={isExpanded} toggleWindowSize={toggleWindowSize} 
        activeTab={activeTab} setActiveTab={setActiveTab} 
      />

      {/* 2. 메인 화면 (Main) */}
      <main className="flex-1 overflow-hidden p-4 relative flex flex-col">
        {activeTab === "chat" ? (
          <div className="flex flex-col h-full gap-4">
            
            <div className="flex items-center justify-between shrink-0">
              <div className="bg-blue-950/50 border border-blue-400/30 rounded-lg p-3 text-xs text-blue-200 flex items-center gap-2 transition-all">
                {isProcessing ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <div className="w-4 h-4 rounded-full bg-blue-500/50" />}
                {systemStatus}
              </div>

              {/* 💡 서브 탭 (일반 채팅 / 2D 라이브) */}
              <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setChatMode("text")}
                  className={`px-4 py-1 text-xs font-semibold rounded-md transition-colors ${chatMode === "text" ? "bg-blue-500 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                >
                  일반 채팅
                </button>
                <button
                  onClick={() => setChatMode("2d")}
                  className={`px-4 py-1 text-xs font-semibold rounded-md transition-colors ${chatMode === "2d" ? "bg-purple-500 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                >
                  ✨ 2D 라이브
                </button>
              </div>
            </div>

            {/* 👇 3. chatMode에 따라 화면 전환 (입력창은 공통 유지) */}
            {chatMode === "text" ? (
              <ChatList messages={messages} messagesEndRef={messagesEndRef} />
            ) : (
              <Live2DView isProcessing={isProcessing} lastMessage={messages[messages.length - 1]} />
            )}

            {/* 입력창 (ChatInput) */}
            <ChatInput 
              isAttachmentOpen={isAttachmentOpen} setIsAttachmentOpen={setIsAttachmentOpen}
              isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}
              isExpanded={isExpanded} textareaRef={textareaRef}
              inputText={inputText} setInputText={setInputText}
              isProcessing={isProcessing} handleSend={handleSend}
            />
          </div>
        ) : (
          <PluginView 
            installedPlugins={installedPlugins} 
            setInstalledPlugins={setInstalledPlugins} 
            fsWhitelist={fsWhitelist} 
            setFsWhitelist={setFsWhitelist}
            indexingBasePath={indexingBasePath}
            setIndexingBasePath={setIndexingBasePath}
            indexingDepth={indexingDepth}
            setIndexingDepth={setIndexingDepth}
          />
        )}
      </main>
    </div>
  );
}

export default App;
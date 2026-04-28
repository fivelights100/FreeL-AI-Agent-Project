import React from "react";

interface ChatInputProps {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isExpanded: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  handleSend: () => void;
}

export function ChatInput({
  isRecording, startRecording, stopRecording,
  isExpanded, textareaRef, inputText, setInputText, isProcessing, handleSend
}: ChatInputProps) {
  
  return (
    <div className="shrink-0 mt-2 relative">
      <div className="flex items-end gap-2">
        
        {/* 마이크 (absolute 띄움 효과 제거, 입력창과 동일한 줄에 배치) */}
        <button
          onClick={() => { isRecording ? stopRecording() : startRecording(); }}
          className={`shrink-0 flex items-center justify-center transition-all rounded-xl ${
            isExpanded ? "w-12 h-[48px]" : "w-[42px] h-[42px]"
          } ${
            isRecording 
              ? "bg-red-500/20 text-red-400 border border-red-500 animate-pulse" 
              : "bg-white/10 hover:bg-white/20 text-white border border-transparent"
          }`}
          title="음성으로 명령하기"
        >
          {isRecording ? "⏹️" : "🎙️"}
        </button>

        {/* 입력창 */}
        {isExpanded ? (
          <textarea
            ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
            disabled={isProcessing} placeholder={isProcessing ? "작업을 수행하고 있습니다..." : "Shift + Enter로 줄바꿈을 할 수 있습니다..."}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3 text-[14px] outline-none transition-all duration-300 placeholder:text-slate-500 focus:bg-white/[0.05] focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 resize-none overflow-y-auto min-h-[48px] shadow-inner"
            rows={1}
          />
        ) : (
          <input 
            type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} 
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend(); }} 
            disabled={isProcessing} placeholder={isProcessing ? "작업 중..." : "AI에게 요청할 내용을 입력하세요..."} 
            className="flex-1 h-[42px] bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-400 focus:bg-black/50 transition-all placeholder:text-white/40 disabled:opacity-50" 
          />
        )}
        
        {/* 전송 버튼 (마이크 및 입력창과 높이를 맞춤) */}
        <button 
          onClick={handleSend} 
          disabled={isProcessing} 
          className={`bg-white text-black hover:bg-slate-200 disabled:bg-white/10 disabled:text-white/30 px-5 rounded-xl text-sm font-bold transition-all duration-300 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] ${isExpanded ? "h-[48px]" : "h-[42px]"}`}
        >
          전송
        </button>
      </div>
    </div>
  );
}
import React from "react";

interface ChatInputProps {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  handleSend: () => void;
}

export function ChatInput({
  isRecording, startRecording, stopRecording,
  textareaRef, inputText, setInputText, isProcessing, handleSend
}: ChatInputProps) {
  
  return (
    <div className="shrink-0 mt-2 relative">
      <div className="flex items-end gap-2">
        
        {/* 마이크 버튼 (고정 크기) */}
        <button
          onClick={() => { isRecording ? stopRecording() : startRecording(); }}
          className={`shrink-0 flex items-center justify-center transition-all rounded-xl w-12 h-[48px] ${
            isRecording 
              ? "bg-red-500/20 text-red-400 border border-red-500 animate-pulse" 
              : "bg-white/10 hover:bg-white/20 text-white border border-transparent"
          }`}
          title="음성으로 명령하기"
        >
          {isRecording ? "⏹️" : "🎙️"}
        </button>

        {/* 항상 textarea 사용 */}
        <textarea
          ref={textareaRef} 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { 
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { 
              e.preventDefault(); 
              handleSend(); 
            } 
          }}
          disabled={isProcessing} 
          placeholder={isProcessing ? "작업을 수행하고 있습니다..." : "Shift + Enter로 줄바꿈을 할 수 있습니다..."}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-3 text-[14px] outline-none transition-all duration-300 placeholder:text-slate-500 focus:bg-white/[0.05] focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 resize-none overflow-y-auto min-h-[48px] shadow-inner custom-scrollbar"
          rows={1}
        />
        
        {/* 전송 버튼 (고정 크기) */}
        <button 
          onClick={handleSend} 
          disabled={isProcessing} 
          className="bg-white text-black hover:bg-slate-200 disabled:bg-white/10 disabled:text-white/30 px-5 rounded-xl text-sm font-bold transition-all duration-300 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] h-[48px]"
        >
          전송
        </button>
      </div>
    </div>
  );
}
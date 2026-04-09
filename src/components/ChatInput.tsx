import React from "react";

interface ChatInputProps {
  isAttachmentOpen: boolean;
  setIsAttachmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  isAttachmentOpen, setIsAttachmentOpen, isRecording, startRecording, stopRecording,
  isExpanded, textareaRef, inputText, setInputText, isProcessing, handleSend
}: ChatInputProps) {
  
  return (
    <div className="shrink-0 mt-2 relative">
      {/* 첨부 팝업 메뉴 (위치 조정됨) */}
      {isAttachmentOpen && (
        <div className="absolute bottom-[110%] left-0 flex gap-2 p-2 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl animate-fade-in-up">
          <button
            onClick={() => { isRecording ? stopRecording() : startRecording(); setIsAttachmentOpen(false); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-red-500/20 text-red-400 border border-red-500 animate-pulse" : "bg-white/10 hover:bg-white/20 text-white border border-transparent"}`}
            title="음성으로 명령하기"
          >
            {isRecording ? "⏹️" : "🎙️"}
          </button>
          <button onClick={() => { alert("파일 첨부 기능은 곧 추가될 예정입니다! 📁"); setIsAttachmentOpen(false); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all" title="파일 첨부하기">
            📁
          </button>
        </div>
      )}

      {/* 💡 입력 컨테이너 (플러스 버튼 + 입력창 + 전송 버튼이 한 줄에 배치됨) */}
      <div className="flex items-end gap-2">
        {/* 플러스 버튼 */}
        <button
          onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
          className={`shrink-0 w-10 h-[42px] flex items-center justify-center rounded-lg border transition-all ${isAttachmentOpen ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"}`}
        >
          <span className={`text-2xl font-light transition-transform duration-200 ${isAttachmentOpen ? "rotate-45" : "rotate-0"}`}>+</span>
        </button>

        {/* 입력창 */}
        {isExpanded ? (
          <textarea
            ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
            disabled={isProcessing} placeholder={isProcessing ? "작업을 수행하고 있습니다..." : "Shift + Enter로 줄바꿈을 할 수 있습니다..."}
            className="flex-1 bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-400 focus:bg-black/50 transition-all placeholder:text-white/40 disabled:opacity-50 resize-none overflow-y-auto min-h-[42px]"
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
        
        {/* 전송 버튼 */}
        <button onClick={handleSend} disabled={isProcessing} className="h-[42px] bg-blue-500 hover:bg-blue-400 disabled:bg-blue-800 disabled:text-white/50 px-4 rounded-lg text-sm font-semibold transition-colors shrink-0">
          전송
        </button>
      </div>
    </div>
  );
}
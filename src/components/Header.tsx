import React from "react";
import freelLogo from "../assets/freel-logo.png";

interface HeaderProps {
  isBentoOpen: boolean;
  setIsBentoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExpanded: boolean;
  toggleWindowSize: () => Promise<void>;
  activeTab: "chat" | "plugin";
  setActiveTab: React.Dispatch<React.SetStateAction<"chat" | "plugin">>;
}

export function Header({ 
  isBentoOpen, setIsBentoOpen, isExpanded, toggleWindowSize, activeTab, setActiveTab 
}: HeaderProps) {
  
  return (
    // 💡 p-3 -> p-2, mb-4 -> mb-2 로 수정하여 두께와 간격을 줄임
    <header className="shrink-0 flex items-center justify-between p-3 border border-white/[0.06] rounded-2xl bg-white/[0.02] backdrop-blur-xl mb-3 shadow-[0_4px_30px_rgba(0,0,0,0.1)] relative z-50 transition-all">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsBentoOpen(!isBentoOpen)} 
          className="flex items-center gap-3 focus:outline-none group relative p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          {/* 💡 h-7 -> h-6 으로 로고 크기 살짝 줄임 */}
          <img src={freelLogo} alt="FreeL 로고" className="h-6 w-auto transition-transform group-hover:scale-105 drop-shadow-md" />
          <span className={`text-white/50 text-xs transition-transform ${isBentoOpen ? 'rotate-180' : 'rotate-0'}`}>▼</span>
        </button>
      </div>
      
      <button 
        onClick={toggleWindowSize}
        title={isExpanded ? "기본 모드로 축소" : "와이드 모드로 확장"}
        // 💡 h-[36px] -> h-[32px] 로 버튼 높이 줄임
        className="h-[32px] bg-white/10 hover:bg-white/20 px-3 rounded-lg text-sm font-bold text-white/80 transition-colors border border-white/20 shrink-0"
      >
        {isExpanded ? "<" : ">"}
      </button>

      {isBentoOpen && (
        <div className="absolute top-full left-0 mt-3 w-full sm:w-auto min-w-[320px] bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-fade-in-up">
          <div className="grid grid-cols-3 gap-3">
            <div onClick={() => { setActiveTab("chat"); setIsBentoOpen(false); }} className={`bg-slate-700 border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-600 transition-colors group text-center shadow-sm ${activeTab === "chat" ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-600"}`}>
              <span className="text-2xl transition-transform group-hover:scale-110 drop-shadow-md">💬</span>
              <p className="text-xs font-semibold text-white/90">채팅</p>
            </div>
            <div onClick={() => { setActiveTab("plugin"); setIsBentoOpen(false); }} className={`bg-slate-700 border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-600 transition-colors group text-center shadow-sm ${activeTab === "plugin" ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-600"}`}>
              <span className="text-2xl transition-transform group-hover:scale-110 drop-shadow-md">🧩</span>
              <p className="text-xs font-semibold text-white/90">플러그인</p>
            </div>
            <div onClick={() => { setIsBentoOpen(false); alert("설정 기능은 준비 중입니다!"); }} className="bg-slate-700 border border-slate-600 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-600 transition-colors group text-center shadow-sm">
              <span className="text-2xl transition-transform group-hover:scale-110 drop-shadow-md">⚙️</span>
              <p className="text-xs font-semibold text-white/90">설정</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
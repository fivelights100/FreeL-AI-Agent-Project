import React from "react";
import freelLogo from "../assets/freel-logo.png";

interface HeaderProps {
  isBentoOpen: boolean;
  setIsBentoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: "chat" | "2d" | "system";
  setActiveTab: React.Dispatch<React.SetStateAction<"chat" | "2d" | "system">>;
}

export const Header = ({ 
  isBentoOpen, setIsBentoOpen, activeTab, setActiveTab 
}: HeaderProps) => {
  
  return (
    // 1. 기존의 배경색(bg-white/...), 테두리(border), 그림자 등을 모두 제거하여 투명하게 만듭니다.
    <header className="shrink-0 flex items-center justify-between p-2 relative z-50 mb-2">
      
      {/* 👈 왼쪽: 햄버거 메뉴 버튼 및 드롭다운 */}
      <div className="relative z-10">
        <button 
          onClick={() => setIsBentoOpen(!isBentoOpen)} 
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
          title="메뉴 열기"
        >
          {/* 햄버거 아이콘 SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* 햄버거 메뉴 클릭 시 나타나는 드롭다운 리스트 */}
        {isBentoOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800/95 backdrop-blur-xl border border-slate-600 rounded-xl p-2 shadow-2xl animate-fade-in-up">
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => { setActiveTab("chat"); setIsBentoOpen(false); }} 
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3 ${activeTab === "chat" ? "bg-blue-500/20 text-blue-300" : "text-white/80 hover:bg-white/10"}`}
              >
                <span className="text-lg">💬</span> 채팅 모드
              </button>
              <button 
                onClick={() => { setActiveTab("2d"); setIsBentoOpen(false); }} 
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3 ${activeTab === "2d" ? "bg-purple-500/20 text-purple-300" : "text-white/80 hover:bg-white/10"}`}
              >
                <span className="text-lg">✨</span> 2D 라이브
              </button>
              <button 
                onClick={() => { setActiveTab("system"); setIsBentoOpen(false); }} 
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-3 ${activeTab === "system" ? "bg-blue-500/20 text-blue-300" : "text-white/80 hover:bg-white/10"}`}
              >
                <span className="text-lg">⚙️</span> 시스템 설정
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🎯 가운데: 로고 (Absolute 정렬로 양옆 버튼 크기에 무관하게 항상 정중앙에 위치) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        <img 
          src={freelLogo} 
          alt="FreeL 로고" 
          className="h-10 w-auto opacity-80 drop-shadow-md" 
        />
      </div>
    </header>
  );
}
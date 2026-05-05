import { useState } from "react";

interface SystemSettingsProps {
  openaiKey: string; setOpenaiKey: (key: string) => void;
  serperKey: string; setSerperKey: (key: string) => void;
  elevenlabsKey: string; setElevenlabsKey: (key: string) => void;
  voiceId: string; setVoiceId: (key: string) => void;
  scanBlacklistNames: string; setScanBlacklistNames: (key: string) => void;
  scanBlacklistPaths: string; setScanBlacklistPaths: (key: string) => void;
}

// 💻 데스크톱 사이드바용 네비게이션 버튼 컴포넌트
const NavItem = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
      isActive 
        ? "bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30 shadow-inner" 
        : "text-white/50 bg-transparent hover:bg-white/5 hover:text-white border border-transparent"
    }`}
  >
    {label}
  </button>
);

export const SystemSettingsView = ({ 
  openaiKey, setOpenaiKey, 
  serperKey, setSerperKey, 
  elevenlabsKey, setElevenlabsKey, 
  //voiceId, setVoiceId,
  scanBlacklistNames, setScanBlacklistNames,
  scanBlacklistPaths, setScanBlacklistPaths
}: SystemSettingsProps) => {
  
  const [activeTab, setActiveTab] = useState<string>("general-api");

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-900/50 rounded-2xl border border-white/10 animate-fade-in-up overflow-hidden">
      
      {/* ========================================================= */}
      {/* 📱 모바일 최적화 UI: 1줄로 끝나는 네이티브 드롭다운 메뉴        */}
      {/* ========================================================= */}
      <div className="md:hidden p-4 border-b border-white/10 bg-black/20 shrink-0">
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-blue-400 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          >
            <optgroup label="일반 설정" className="bg-slate-800 text-white/50 font-normal">
              <option value="general-general" className="text-white font-semibold">일반</option>
              <option value="general-api" className="text-white font-semibold">API 키 관리</option>
              <option value="general-info" className="text-white font-semibold">시스템 정보</option>
            </optgroup>
            <optgroup label="도구 설정" className="bg-slate-800 text-white/50 font-normal">
              <option value="tools-scan" className="text-white font-semibold">스캐너 블랙리스트</option>
              <option value="tools-file" className="text-white font-semibold">파일 제어 설정</option>
            </optgroup>
            <optgroup label="2D LIVE 설정" className="bg-slate-800 text-white/50 font-normal">
              <option value="live-general" className="text-white font-semibold">아바타 일반 설정</option>
              <option value="live-advanced" className="text-white font-semibold">아바타 고급 설정</option>
            </optgroup>
          </select>
          {/* 우측 하향 화살표 (디자인용) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400/50 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 💻 데스크톱 최적화 UI: 직관적이고 넓은 왼쪽 사이드바           */}
      {/* ========================================================= */}
      <div className="hidden md:flex w-56 bg-black/30 border-r border-white/10 p-5 flex-col gap-5 shrink-0 overflow-y-auto">
        {/* 1. 일반 설정 그룹 */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider px-2">일반 설정</span>
          <div className="flex flex-col gap-1">
            <NavItem label="일반" isActive={activeTab === "general-general"} onClick={() => setActiveTab("general-general")} />
            <NavItem label="API" isActive={activeTab === "general-api"} onClick={() => setActiveTab("general-api")} />
            <NavItem label="정보" isActive={activeTab === "general-info"} onClick={() => setActiveTab("general-info")} />
          </div>
        </div>

        <div className="w-full h-px bg-white/5 shrink-0" />

        {/* 2. 도구 설정 그룹 */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider px-2">도구 설정</span>
          <div className="flex flex-col gap-1">
            <NavItem label="스캔" isActive={activeTab === "tools-scan"} onClick={() => setActiveTab("tools-scan")} />
            <NavItem label="파일" isActive={activeTab === "tools-file"} onClick={() => setActiveTab("tools-file")} />
          </div>
        </div>

        <div className="w-full h-px bg-white/5 shrink-0" />

        {/* 3. 2D LIVE 설정 그룹 */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider px-2">2D LIVE 설정</span>
          <div className="flex flex-col gap-1">
            <NavItem label="일반" isActive={activeTab === "live-general"} onClick={() => setActiveTab("live-general")} />
            <NavItem label="고급" isActive={activeTab === "live-advanced"} onClick={() => setActiveTab("live-advanced")} />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 💡 메인 콘텐츠 영역 (이전과 동일하게 유지)                    */}
      {/* ========================================================= */}
      <div className="flex-1 p-5 md:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl">
          
          {activeTab === "general-general" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">기본 설정</h3>
              <p className="text-white/50 text-sm">일반 설정 기능이 준비 중입니다. 향후 테마 변경 및 에이전트 이름 설정 기능이 추가될 예정입니다.</p>
            </div>
          )}

          {activeTab === "general-api" && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">API 키 관리</h3>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-blue-300">OpenAI API Key (두뇌)</label>
                <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-white placeholder:text-white/20" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-emerald-300">Serper API Key (웹 검색)</label>
                <input type="password" value={serperKey} onChange={(e) => setSerperKey(e.target.value)} placeholder="Serper.dev API 키 입력..." className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder:text-white/20" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-purple-300">ElevenLabs API Key (음성 합성)</label>
                <input type="password" value={elevenlabsKey} onChange={(e) => setElevenlabsKey(e.target.value)} placeholder="음성 합성 API 키 입력..." className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition-colors text-white placeholder:text-white/20" />
              </div>
            </div>
          )}

          {activeTab === "general-info" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">시스템 정보</h3>
              <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-blue-500/20 flex items-center justify-center rounded-2xl text-3xl">🤖</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">FreeL AI Agent</h3>
                    <p className="text-blue-300 text-sm">Version 1.0.0 (Local Desktop Engine)</p>
                  </div>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">
                  사용자의 데스크톱 환경을 자율적으로 제어하고, 파일 시스템을 관리하며, 웹 검색을 지원하는 인공지능 에이전트입니다.
                </p>
              </div>
            </div>
          )}

          {activeTab === "tools-scan" && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">스캐너 블랙리스트 설정</h3>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-amber-300">제외할 폴더명 (이름 기준)</label>
                <textarea 
                  value={scanBlacklistNames} 
                  onChange={(e) => setScanBlacklistNames(e.target.value)}
                  placeholder="예: Windows, node_modules, .git"
                  className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder:text-white/20 resize-none h-20 leading-relaxed"
                />
                <p className="text-xs text-white/50">해당 이름을 가진 폴더는 위치에 상관없이 무조건 스캔을 건너뜁니다.</p>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm font-semibold text-rose-300">제외할 절대 경로 (경로 기준)</label>
                <textarea 
                  value={scanBlacklistPaths} 
                  onChange={(e) => setScanBlacklistPaths(e.target.value)}
                  placeholder="예: C:\Windows, C:\Program Files\WindowsApps"
                  className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-rose-500 transition-colors text-white placeholder:text-white/20 resize-none h-20 leading-relaxed"
                />
                <p className="text-xs text-white/50">해당 경로 및 하위의 모든 폴더를 스캔 대상에서 제외합니다.</p>
              </div>
            </div>
          )}

          {activeTab === "tools-file" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">파일 제어 설정</h3>
              <p className="text-white/50 text-sm">파일 읽기/쓰기 권한 및 보호 폴더 설정 기능이 추가될 예정입니다.</p>
            </div>
          )}

          {activeTab === "live-general" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">2D LIVE 아바타 설정</h3>
              <p className="text-white/50 text-sm">Live2D 모델 경로 및 기본 애니메이션 설정 기능이 준비 중입니다.</p>
            </div>
          )}

          {activeTab === "live-advanced" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-2">2D LIVE 고급 설정</h3>
              <p className="text-white/50 text-sm">립싱크(Lip-sync) 매핑 및 렌더링 프레임 설정이 준비 중입니다.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
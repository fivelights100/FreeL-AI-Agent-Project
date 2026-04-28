import React from "react";

interface SystemSettingsProps {
  openaiKey: string; 
  setOpenaiKey: (key: string) => void;
  serperKey: string; 
  setSerperKey: (key: string) => void;
  elevenlabsKey: string; 
  setElevenlabsKey: (key: string) => void;
  voiceId: string; 
  setVoiceId: (key: string) => void;
}

export const SystemSettingsView = ({ 
  openaiKey, setOpenaiKey, 
  serperKey, setSerperKey, 
  elevenlabsKey, setElevenlabsKey, 
  voiceId, setVoiceId 
}: SystemSettingsProps) => {
  return (
    <div className="flex flex-col h-full bg-slate-900/50 p-6 rounded-2xl border border-white/10 animate-fade-in-up overflow-y-auto custom-scrollbar">
      <h2 className="text-2xl font-bold mb-6 text-white">⚙️ 시스템 설정</h2>
      
      <div className="flex flex-col gap-6 max-w-md">
        
        {/* 1. OpenAI Key */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-blue-300">OpenAI API Key</label>
          <input 
            type="password" 
            value={openaiKey} 
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-white placeholder:text-white/20"
          />
          <p className="text-xs text-white/50">에이전트의 두뇌 역할을 하는 모델 사용을 위한 키입니다.</p>
        </div>

        {/* 2. Serper Key (웹 검색용) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-emerald-300">Serper API Key (Web Search)</label>
          <input 
            type="password" 
            value={serperKey} 
            onChange={(e) => setSerperKey(e.target.value)}
            placeholder="Serper.dev API 키 입력..."
            className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder:text-white/20"
          />
          <p className="text-xs text-white/50">에이전트가 구글 인터넷 검색을 수행하기 위해 필요합니다.</p>
        </div>

        {/* 3. ElevenLabs Key (나중을 위한 대비) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-purple-300">ElevenLabs API Key (TTS)</label>
          <input 
            type="password" 
            value={elevenlabsKey} 
            onChange={(e) => setElevenlabsKey(e.target.value)}
            placeholder="음성 합성 API 키 입력..."
            className="px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition-colors text-white placeholder:text-white/20"
          />
          <p className="text-xs text-white/50">2D 라이브 및 에이전트의 자연스러운 음성 출력을 위한 키입니다.</p>
        </div>

      </div>
    </div>
  );
};
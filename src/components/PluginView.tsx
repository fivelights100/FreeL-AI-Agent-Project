import { useState } from "react";
import { PLUGIN_REGISTRY } from "../config/plugins";

export function PluginView({ 
  installedPlugins, setInstalledPlugins,
  fsWhitelist, setFsWhitelist,
  indexingBasePath = "", setIndexingBasePath,
  indexingDepth = 3, setIndexingDepth,
  requiresApproval = true, 
  setRequiresApproval
}: { 
  installedPlugins: string[], setInstalledPlugins: React.Dispatch<React.SetStateAction<string[]>>,
  fsWhitelist: string[], setFsWhitelist: React.Dispatch<React.SetStateAction<string[]>>,
  indexingBasePath?: string, setIndexingBasePath?: React.Dispatch<React.SetStateAction<string>>,
  indexingDepth?: number, setIndexingDepth?: React.Dispatch<React.SetStateAction<number>>,
  requiresApproval?: boolean, setRequiresApproval?: React.Dispatch<React.SetStateAction<boolean>>
}) {
  
  const [newPathInput, setNewPathInput] = useState("");
  const [basePathError, setBasePathError] = useState("");

  const handleAddPath = () => {
    const trimmedPath = newPathInput.trim();
    if (trimmedPath && !fsWhitelist.includes(trimmedPath)) {
      setFsWhitelist([...fsWhitelist, trimmedPath]);
      setNewPathInput(""); 
    }
  };

  const handleRemovePath = (targetPath: string) => {
    setFsWhitelist(fsWhitelist.filter(p => p !== targetPath));
  };

  const handleBasePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (setIndexingBasePath) setIndexingBasePath(val);

    const upperVal = val.trim().toUpperCase();
    if (upperVal === "C:\\" || upperVal === "C:/") {
      setBasePathError("C:\\ 최상단 경로는 지정할 수 없습니다.");
    } else {
      setBasePathError("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 mb-4 flex items-center justify-between">
        {/* 👇 텍스트를 '모듈 설정'으로 변경하고, 불필요한 탭 버튼 그룹을 제거했습니다. */}
        <h2 className="text-lg font-bold flex items-center gap-2 text-blue-100">
          🧩 모듈 설정
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-4">
        {/* 사용자가 설치/삭제를 직접 관리하지 않으므로 PLUGIN_REGISTRY 전체를 보여주어 설정만 관리합니다. */}
        {PLUGIN_REGISTRY.map(plugin => {
          return (
            <div key={plugin.id} className="bg-white/5 border border-white/10 rounded-xl p-4 transition-all animate-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-blue-400 text-lg">⚙️</span>
                <h3 className="font-semibold text-white text-sm">{plugin.name} 상세 설정</h3>
              </div>
              
              <div className="bg-black/30 p-4 rounded-lg border border-white/5 text-xs text-white/60">
                {plugin.id === "filesystem" ? (
                  <div className="mt-2 space-y-6">
                    
                    {/* 👇 그룹 이름을 '탐색'으로 변경하고 화이트리스트 기능 통합 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white/90">🗂️ 탐색</h4>
                      </div>
                      <p className="text-[10px] text-white/50 mb-4 leading-relaxed">
                        AI가 파일 탐색 시 접근할 수 있는 안전한 경로(White List)와 폴더 탐색 깊이를 설정합니다.
                      </p>

                      <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5">
                        
                        {/* 1. 화이트리스트 영역 */}
                        <div>
                          <label className="block text-white/70 mb-1.5 text-xs font-semibold">🛡️ 안전한 경로 목록 (White List)</label>
                          <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
                            (예: C:\Users\이름\Desktop\AI_Workspace)<br/>
                            <span className="text-yellow-400/80">※ 목록이 비어있으면 모든 경로 접근이 허용되므로 주의하세요!</span>
                          </p>

                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={newPathInput}
                              onChange={(e) => setNewPathInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddPath(); }}
                              placeholder="허용할 폴더의 전체 경로를 입력하세요..."
                              className="flex-1 bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-blue-400 transition-colors"
                            />
                            <button onClick={handleAddPath} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                              추가
                            </button>
                          </div>

                          <ul className="space-y-1.5">
                            {fsWhitelist.map((path, idx) => (
                              <li key={idx} className="flex justify-between items-center bg-blue-900/20 border border-blue-500/30 px-3 py-2 rounded-md text-xs text-blue-100">
                                <span className="truncate mr-2 flex-1" title={path}>{path}</span>
                                <button onClick={() => handleRemovePath(path)} className="text-red-400 hover:text-red-300 font-bold px-1 text-sm shrink-0" title="경로 삭제">✕</button>
                              </li>
                            ))}
                            {fsWhitelist.length === 0 && (
                              <div className="text-center py-4 bg-black/20 border border-white/5 rounded-md text-[10px] text-white/40">
                                등록된 경로가 없습니다. 현재 모든 경로에 대한 접근이 허용되어 있습니다.
                              </div>
                            )}
                          </ul>
                        </div>

                        {/* 2. 인덱싱 깊이 영역 */}
                        <div className="pt-3 border-t border-white/10">
                          <label className="block text-white/70 mb-1.5 text-xs font-semibold">파일 깊이 (최대 5)</label>
                          <select
                            value={indexingDepth}
                            onChange={(e) => setIndexingDepth && setIndexingDepth(Number(e.target.value))}
                            className="w-full bg-black/50 border border-white/20 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-blue-400 transition-colors"
                          >
                            {[1, 2, 3, 4, 5].map((num) => (
                              <option key={num} value={num}>{num}단계</option>
                            ))}
                          </select>
                        </div>

                      </div>
                    </div>

                  </div>
                ) : (
                  <p>이 모듈은 다중 에이전트 시스템에 의해 자동으로 최적화되어 작동 중입니다.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
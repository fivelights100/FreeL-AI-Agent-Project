import { useState, useEffect } from "react";
import { load } from '@tauri-apps/plugin-store';

export function useSettings() {
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  // 👇 새롭게 추가된 API 키 및 설정 상태
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [serperKey, setSerperKey] = useState<string>("");
  const [elevenlabsKey, setElevenlabsKey] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const store = await load('freel_settings.json');

        // 👇 설정 불러오기
        const savedOpenai = await store.get<string>("openaiKey");
        if (savedOpenai) setOpenaiKey(savedOpenai);

        const savedTavily = await store.get<string>("tavilyKey");
        if (savedTavily) setSerperKey(savedTavily);

        const savedElevenlabs = await store.get<string>("elevenlabsKey");
        if (savedElevenlabs) setElevenlabsKey(savedElevenlabs);

        const savedVoiceId = await store.get<string>("voiceId");
        if (savedVoiceId) setVoiceId(savedVoiceId);
      } catch (err) {
        console.error("설정 로드 실패:", err);
      } finally {
        setIsStoreLoaded(true);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!isStoreLoaded) return; 

    const saveSettings = async () => {
      try {
        const store = await load('freel_settings.json');
        
        // 👇 설정 저장하기
        await store.set("openaiKey", openaiKey);
        await store.set("tavilyKey", serperKey);
        await store.set("elevenlabsKey", elevenlabsKey);
        await store.set("voiceId", voiceId);
        
        await store.save(); 
      } catch (err) {
        console.error("설정 저장 실패:", err);
      }
    };
    saveSettings();
  }, [openaiKey, serperKey, elevenlabsKey, voiceId, isStoreLoaded]);

  return { 
    openaiKey, setOpenaiKey,
    serperKey, setSerperKey,
    elevenlabsKey, setElevenlabsKey,
    voiceId, setVoiceId
  };
}
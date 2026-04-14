import { useState, useEffect } from "react";
import { load } from '@tauri-apps/plugin-store';
import { invoke } from "@tauri-apps/api/core";

export function useSettings() {
  const [installedPlugins, setInstalledPlugins] = useState<string[]>(["filesystem", "system_info"]);
  const [fsWhitelist, setFsWhitelist] = useState<string[]>([]);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [userHome, setUserHome] = useState<string>("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const store = await load('freel_settings.json');
        
        const savedPlugins = await store.get<string[]>("installedPlugins");
        if (savedPlugins) setInstalledPlugins(savedPlugins);

        const savedWhitelist = await store.get<string[]>("fsWhitelist");
        if (savedWhitelist) setFsWhitelist(savedWhitelist);

        const homePath = await invoke<string>("get_user_home");
        setUserHome(homePath);
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
        await store.set("installedPlugins", installedPlugins);
        await store.set("fsWhitelist", fsWhitelist);
        await store.save(); 
      } catch (err) {
        console.error("설정 저장 실패:", err);
      }
    };
    saveSettings();
  }, [installedPlugins, fsWhitelist, isStoreLoaded]);

  return { installedPlugins, setInstalledPlugins, fsWhitelist, setFsWhitelist, userHome };
}
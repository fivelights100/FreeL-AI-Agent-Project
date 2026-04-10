import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { Message } from "../hooks/useAgent";

(window as any).PIXI = PIXI;

interface Live2DViewProps {
  isProcessing: boolean;
  lastMessage: Message | undefined;
}

export function Live2DView({ isProcessing, lastMessage }: Live2DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      autoStart: true,
      backgroundAlpha: 0, 
      resizeTo: containerRef.current, // 컨테이너 크기에 맞춰 캔버스 크기 자동 조절
    });
    appRef.current = app;

    const canvas = app.view;
    canvas.className = "absolute inset-0 pointer-events-auto";
    containerRef.current.appendChild(canvas);

    // 💡 적용하셨던 Hiyori 모델(또는 다른 로컬 모델) 경로로 유지해주세요.
    const modelUrl = "public/models/hiyori_ex/runtime/hiyori_free_t08.model3.json";

    // 화면 리사이즈 이벤트용 변수
    let handleResize: () => void;

    Live2DModel.from(modelUrl).then((model) => {
      modelRef.current = model;
      app.stage.addChild(model);

      // ✨ [수정 2] 화면 크기가 변할 때 중앙 위치를 다시 계산해주는 함수
      handleResize = () => {
        if (!app.renderer) return;
        const rWidth = app.renderer.width;
        const rHeight = app.renderer.height;
        const scale = Math.min(rWidth / model.width, rHeight / model.height) * 1.3;
        
        model.scale.set(scale);
        model.x = rWidth / 2 - (model.width * scale) / 2 + -200;
        model.y = rHeight / 2 - (model.height * scale) / 2 + -200;
      };

      // 처음 로딩 시 위치 세팅
      handleResize();

      // 브라우저 창 크기가 변할 때마다 위치 재계산
      window.addEventListener("resize", handleResize);
      // PIXI 렌더러 자체가 리사이즈 될 때도 위치 재계산
      app.renderer.on("resize", handleResize);

      app.stage.interactive = true;
      app.stage.on("pointermove", (e: PIXI.InteractionEvent) => {
        model.focus(e.data.global.x, e.data.global.y);
      });
      
      model.interactive = true;
      model.on("pointerdown", () => {
        // Hiyori 무료 모델처럼 Expression이 없는 경우 Motion으로 대응 (있다면 expressionManager 사용)
        if (model.internalModel.motionManager) {
          model.internalModel.motionManager.startMotion("Tap@Body", 0, 3);
        }
      });
    }).catch(err => console.error("Live2D 모델 로딩 실패:", err));

    return () => {
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (appRef.current) appRef.current.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    if (
      lastMessage?.role === "assistant" && 
      lastMessage.content && 
      modelRef.current && 
      !lastMessage.content.includes("[SYSTEM:")
    ) {
      playElevenLabsAndLipSync(lastMessage.content, modelRef.current);
    }
  }, [lastMessage]);

  const playElevenLabsAndLipSync = async (rawText: string, model: any) => {
    if (isPlaying) return;
    
    // ✨ [수정 1] TTS가 코드를 읽지 못하게 쓸데없는 텍스트 필터링!
    const cleanText = rawText
      .replace(/```[\s\S]*?```/g, "") // 긴 코드 블록 (```) 제거
      .replace(/`[^`]+`/g, "")         // 짧은 인라인 코드 (`) 제거
      .replace(/https?:\/\/[^\s]+/g, "") // 웹 링크 (http:// 등) 제거
      .replace(/\[.*?\]/g, "")         // 감정 태그 등 괄호 텍스트 제거
      .trim();                         // 앞뒤 공백 정리

    // 코드를 다 지웠더니 읽을 말이 아예 없다면 립싱크를 실행하지 않음
    if (!cleanText) return;

    setIsPlaying(true);

    const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY; 
    const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

    if (!ELEVENLABS_API_KEY || !VOICE_ID) {
      console.error("환경 변수(.env)에 ElevenLabs API 키 또는 Voice ID가 없습니다!");
      setIsPlaying(false);
      return;
    }

    try {
      // 정제된 깔끔한 텍스트(cleanText)만 전송
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText, 
          model_id: "eleven_multilingual_v2", 
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API 에러: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaElementSource(audio);
      
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audio.play();

      const updateMouth = () => {
        if (audio.paused || audio.ended) {
          model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0);
          setIsPlaying(false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        const mouthOpenness = Math.min(1.0, average / 40.0);
        model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenness);

        requestAnimationFrame(updateMouth);
      };

      updateMouth();

    } catch (error) {
      console.error("ElevenLabs 통신 에러:", error);
      setIsPlaying(false);
    }
  };

  const isToolLog = lastMessage?.content?.includes("[SYSTEM:") || lastMessage?.content?.includes("실행 계획");
  const displayContent = isToolLog ? "작업을 수행하고 있습니다..." : lastMessage?.content;

  return (
    <div ref={containerRef} className="flex-1 bg-black/20 border border-white/5 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center">
      {displayContent && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl text-sm text-white/90 shadow-2xl animate-fade-in-up z-10 pointer-events-auto">
          
          <div className="max-h-[140px] overflow-y-auto whitespace-pre-wrap pr-2 custom-scrollbar">
            {displayContent}
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="absolute top-4 right-4 bg-blue-500/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg animate-pulse z-10">
          AI 생각 중...
        </div>
      )}
    </div>
  );
}
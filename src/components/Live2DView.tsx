import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { Message } from "../hooks/useAgent";

// PIXI 전역 변수 노출 (버전 6에서는 필수)
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

    // 1. PIXI Application (v6) 초기화
    const app = new PIXI.Application({
      autoStart: true,
      backgroundAlpha: 0, 
      resizeTo: containerRef.current, 
    });
    appRef.current = app;

    const canvas = app.view;
    canvas.className = "absolute inset-0 pointer-events-auto";
    containerRef.current.appendChild(canvas);

    // 2. 모델 로딩
    const modelUrl = "/models/hiyori_ex/runtime/hiyori_free_t08.model3.json";

    Live2DModel.from(modelUrl).then((model) => {
      modelRef.current = model;
      app.stage.addChild(model);

      // 크기 및 위치 조절
      const scale = Math.min(app.renderer.width / model.width, app.renderer.height / model.height) * 1.3;
      model.scale.set(scale);
      model.x = app.renderer.width / 2 - (model.width * scale) / 2 + -200;
      model.y = app.renderer.height / 2 - (model.height * scale) / 2 + -200;

      // 3. 마우스 추적 (버전 6 방식: e.data.global 사용)
      app.stage.interactive = true;
      app.stage.on("pointermove", (e: PIXI.InteractionEvent) => {
        model.focus(e.data.global.x, e.data.global.y);
      });

      // 클릭 이벤트
      model.interactive = true;
      model.on("pointerdown", () => {
        model.internalModel.motionManager.expressionManager?.setRandomExpression();
      });

    }).catch(err => {
      console.error("Live2D 모델 로딩 실패:", err);
    });

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
      }
    };
  }, []);

  // 2️⃣ ElevenLabs 연동 및 실시간 립싱크 마법! ✨
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

  // ElevenLabs 호출 및 립싱크 함수
  const playElevenLabsAndLipSync = async (text: string, model: any) => {
    if (isPlaying) return;
    setIsPlaying(true);

    const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY; 
    const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

    // 안전 장치: 환경 변수가 설정되지 않았을 경우 에러 표시
    if (!ELEVENLABS_API_KEY || !VOICE_ID) {
      console.error("환경 변수(.env)에 ElevenLabs API 키 또는 Voice ID가 없습니다!");
      setIsPlaying(false);
      return;
    }

    try {
      // 1. ElevenLabs API 호출
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          // 💡 한국어 지원을 위해 반드시 'eleven_multilingual_v2' 모델을 사용해야 합니다!
          model_id: "eleven_multilingual_v2", 
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API 에러: ${response.status}`);
      }

      // 2. 음성 파일(Blob) 변환
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // 3. Web Audio API를 이용해 소리의 크기(볼륨)를 실시간으로 분석 (기존 코드와 동일!)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaElementSource(audio);
      
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // 4. 소리에 맞춰 입 벌리기 애니메이션 시작
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

        // 볼륨 민감도 조절 (숫자가 낮을수록 입이 더 쉽게 벌어짐. 30~50 추천)
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
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl text-sm text-white/90 shadow-2xl animate-fade-in-up pointer-events-none z-10">
          {displayContent}
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